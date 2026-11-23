const test = require('node:test');
const assert = require('node:assert/strict');
const {
    startBrowserApp, seedReviewBatch, callProxy, getDbSnapshot,
    assertNoRuntimeErrors
} = require('./browser-harness');

async function prepare(mode, port) {
    const h = await startBrowserApp(port);
    try {
        await h.page.addInitScript(selected => {
            window.auditConfirmCalls = [];
            window.Qisi = window.Qisi || {};
            Object.defineProperty(window.Qisi, 'ReviewWorkflowService', {
                configurable: true,
                set(owner) {
                    Object.defineProperty(window.Qisi, 'ReviewWorkflowService', {
                        configurable: true,
                        value: Object.freeze({
                            ...owner,
                            createReviewWorkflowService(ports) {
                                const service = owner.createReviewWorkflowService(ports);
                                return Object.freeze({
                                    ...service,
                                    async confirmDraft(command) {
                                        window.auditConfirmCalls.push({ ...command });
                                        if (selected === 'throw' && command.draftId.endsWith('_q2')) {
                                            throw new Error('FIXTURE_CONFIRM_STORAGE_FAILURE');
                                        }
                                        if (selected === 'all-fail') {
                                            return { accepted: false, validation: { errors: [{ message: 'fixture rejection' }] } };
                                        }
                                        return service.confirmDraft(command);
                                    }
                                });
                            }
                        })
                    });
                }
            });
        }, mode);
        await h.page.reload();
        await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const batchId = await seedReviewBatch(h.page, { batchId: 'batch_confirm_' + mode });
        await h.page.evaluate(async ({ batchId, mode }) => {
            const db = new window.Dexie('QisiMathVueDB');
            await db.open();
            try {
                const first = await db.table('draftQuestions').get(batchId + '_q1');
                await db.table('draftQuestions').put({ ...first, id: batchId + '_q3', order: 3, questionNumber: '3', stem: 'Last valid fixture question' });
                if (mode === 'reject') {
                    await db.table('draftQuestions').update(batchId + '_q2', { type: '单选题', options: [] });
                }
                if (mode === 'all-success') {
                    await db.table('draftQuestions').put({ ...first, id: batchId + '_q2', order: 2, questionNumber: '2', stem: 'Middle valid fixture question' });
                }
                if (mode === 'filtered') {
                    await db.table('draftQuestions').update(batchId + '_q2', { status: 'reviewed' });
                    await db.table('draftQuestions').update(batchId + '_q3', { status: 'submitted' });
                }
            } finally { db.close(); }
        }, { batchId, mode });
        await callProxy(h.page, 'openBatchReview', batchId);
        await h.page.evaluate(({ batchId, mode }) => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            p.view = 'batchImport';
            p.selectedDraftIds = mode === 'empty' ? [] : [1, 2, 3].map(n => batchId + '_q' + n);
            if (mode === 'filtered') p.selectedDraftIds.push('missing-id');
            window.auditReviewErrors = [];
            const config = p.$.appContext.config;
            const original = config.errorHandler;
            config.errorHandler = (...args) => {
                window.auditReviewErrors.push(String(args[0]?.message || args[0]));
                original?.(...args);
            };
        }, { batchId, mode });
        await h.page.locator('.batch-latex-source-editor').waitFor();
        return { h, batchId };
    } catch (error) { await h.close(); throw error; }
}

for (const [index, mode] of ['reject', 'throw', 'all-fail', 'all-success', 'filtered', 'empty', 'save-failure'].entries()) {
    test('batch confirmation keeps durable state and UI coherent: ' + mode, { timeout: 30000 }, async () => {
        const { h, batchId } = await prepare(mode, 32831 + index);
        try {
            if (mode === 'save-failure') {
                await h.page.evaluate(() => {
                    window.Qisi.DraftPersistenceService = Object.freeze({
                        ...window.Qisi.DraftPersistenceService,
                        async persistReviewDraftCommand() { throw new Error('FIXTURE_SAVE_FAILURE'); }
                    });
                });
                await h.page.locator('.batch-latex-source-editor').fill('Unsaved fixture edit\nA. a\nB. b\nC. c\nD. d');
            }
            if (mode === 'empty') await callProxy(h.page, 'confirmSelectedDrafts');
            else {
                await h.page.getByRole('button', { name: '总览', exact: true }).click();
                await h.page.getByRole('button', { name: /确认选中 \d+ 题/ }).click();
            }
            await h.page.waitForFunction(() => window.auditReviewErrors.length || document.querySelector('.batch-toast')?.textContent?.trim());
            const ui = await h.page.evaluate(() => {
                const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
                return { errors: window.auditReviewErrors, calls: window.auditConfirmCalls,
                    selected: [...p.selectedDraftIds], dirty: p.activeDraftEditorDirty,
                    toast: document.querySelector('.batch-toast')?.textContent,
                    rows: p.batchDraftQuestions.map(q => ({ id: q.id, status: q.status, version: q.version })) };
            });
            assert.deepEqual(ui.errors, [], 'confirmation must not escape through Vue errorHandler');
            const snapshot = await getDbSnapshot(h.page);
            assert.equal(snapshot.questions.length, 0, 'batch confirmation does not submit formal questions');
            const calls = ui.calls.map(c => c.draftId);
            const ids = [1, 2, 3].map(n => batchId + '_q' + n);
            if (mode === 'empty' || mode === 'save-failure') {
                assert.deepEqual(calls, []);
                assert.match(ui.toast, mode === 'empty' ? /请先勾选/ : /FIXTURE_SAVE_FAILURE/);
                assert.deepEqual(ui.selected, mode === 'empty' ? [] : ids);
                if (mode === 'save-failure') {
                    assert.equal(ui.dirty, true);
                    await h.page.getByRole('button', { name: '逐题审核', exact: true }).click();
                    assert.match(await h.page.locator('.batch-latex-source-editor').inputValue(), /Unsaved fixture edit/);
                    assert.equal(snapshot.drafts.find(q => q.id === ids[0]).version, 1);
                }
            } else {
                assert.deepEqual(calls, mode === 'filtered' ? [ids[0]] : ids);
                for (const call of ui.calls) {
                    assert.equal(call.batchId, batchId);
                    assert.equal(call.expectedDraftVersion, 1);
                    assert.equal(call.actorId, 'local-teacher');
                    assert.equal(call.selectedContentConfirmed, true);
                }
                const failedIds = mode === 'all-fail' ? ids : ['reject', 'throw'].includes(mode) ? [ids[1]] : [];
                assert.deepEqual(ui.selected, failedIds);
                assert.match(ui.toast, mode === 'all-fail' ? /已确认 0 题，3 题未通过/ : mode === 'all-success' ? /已确认 3 题/ : mode === 'filtered' ? /已确认 1 题/ : /已确认 2 题，1 题未通过/);
                for (const row of ui.rows) {
                    const saved = snapshot.drafts.find(q => q.id === row.id);
                    assert.equal(row.status, saved.status);
                    assert.equal(row.version, saved.version);
                }
            }
            assertNoRuntimeErrors(h);
        } finally { await h.close(); }
    });
}
