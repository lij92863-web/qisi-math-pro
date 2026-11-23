const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

for (const [index, mode] of ['confirm-reject', 'submit-reject', 'submit-throw', 'double-click', 'new-input', 'new-batch', 'submit-new-input'].entries()) {
    test('separate review and admission preserve action boundaries: ' + mode, { timeout: 35000 }, async () => {
        const h = await H.startBrowserApp(32850 + index);
        try {
            const dialogs = [];
            h.page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
            await h.page.addInitScript(mode => {
                window.auditActionCalls = []; window.auditActionResults = [];
                const gate = new Promise(resolve => { window.auditReleaseAction = resolve; });
                window.Qisi = window.Qisi || {};
                Object.defineProperty(window.Qisi, 'ReviewWorkflowService', { configurable: true,
                    set(owner) { Object.defineProperty(window.Qisi, 'ReviewWorkflowService', { configurable: true,
                        value: Object.freeze({ ...owner, createReviewWorkflowService(ports) {
                            const service = owner.createReviewWorkflowService(ports);
                            return Object.freeze({ ...service,
                                async confirmDraft(command) {
                                    window.auditActionCalls.push({ step: 'confirm', ...command });
                                    if (mode === 'confirm-reject') return { accepted: false, validation: { errors: [{ message: 'E3_CONFIRM_REJECTED' }] } };
                                    if (['double-click', 'new-input', 'new-batch'].includes(mode)) {
                                        window.auditActionPending = true; await gate;
                                    }
                                    return service.confirmDraft(command);
                                },
                                async submitDraft(command) {
                                    window.auditActionCalls.push({ step: 'submit', ...command });
                                    if (mode === 'submit-new-input') { window.auditActionPending = true; await gate; }
                                    if (!window.auditAllowSubmit && mode === 'submit-throw') throw new Error('E3_SUBMIT_STORAGE_FAILURE');
                                    if (!window.auditAllowSubmit && mode === 'submit-reject') return { accepted: false,
                                        validation: { errors: [{ message: 'E3_SUBMIT_REJECTED' }] } };
                                    return service.submitDraft(command);
                                }
                            });
                        } }) }); }
                });
            }, mode);
            await h.page.reload();
            await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
            const batchId = await H.seedReviewBatch(h.page, { batchId: 'e3_' + mode });
            const other = await H.seedReviewBatch(h.page, { batchId: 'e3_other_' + mode });
            await H.callProxy(h.page, 'openBatchReview', batchId);
            await h.page.evaluate(() => {
                const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy'); p.view = 'batchImport';
                for (const name of ['reviewCurrentDraft', 'submitReviewedDraft']) {
                    const action = p[name];
                    p[name] = (...args) => {
                        const result = action(...args);
                        Promise.resolve(result).then(value => window.auditActionResults.push({ value }),
                            error => window.auditActionResults.push({ error: String(error.message) }));
                        return result;
                    };
                }
            });
            const review = h.page.getByRole('button', { name: '确认审核', exact: true });
            const submit = h.page.getByRole('button', { name: '入库并下一题', exact: true });
            const submits = mode.startsWith('submit-');
            assert.equal(await submit.isDisabled(), true);
            if (submits) {
                await review.click();
                await h.page.waitForFunction(() => window.auditActionResults.length === 1);
                assert.equal((await H.getDbSnapshot(h.page)).questions.length, 0);
            }
            const button = submits ? submit : review;
            await button.click();
            if (['double-click', 'new-input', 'new-batch', 'submit-new-input'].includes(mode)) {
                await h.page.waitForFunction(() => window.auditActionPending);
                if (mode === 'double-click') {
                    assert.equal(await button.isDisabled(), true, 'pending UI disables duplicate admission');
                    await button.dispatchEvent('click');
                    assert.equal(await h.page.evaluate(() => window.auditActionCalls.length), 1, 'pending click must not start another confirmation');
                } else {
                    if (mode === 'new-batch') {
                        await H.callProxy(h.page, 'openBatchReview', other);
                        await h.page.evaluate(other => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').selectedDraftIds = [other + '_q2']; }, other);
                    }
                    await h.page.locator('.batch-latex-source-editor').fill('Later unsaved text\nA. one\nB. two\nC. three\nD. four');
                    await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftQuestion.year = '2041'; });
                }
                await h.page.evaluate(() => window.auditReleaseAction());
            }
            await h.page.waitForFunction(count => window.auditActionResults.length >= count, submits ? 2 : 1);
            if (mode === 'double-click') assert.equal(await h.page.evaluate(() => window.auditActionResults.length), 1, 'only the enabled UI action reaches admission');
            let snapshot = await H.getDbSnapshot(h.page);
            let calls = await h.page.evaluate(() => window.auditActionCalls);
            assert.equal(calls.filter(call => call.step === 'confirm').length, 1);
            if (mode === 'confirm-reject') {
                assert.equal(snapshot.questions.length, 0); assert.equal(calls.length, 1);
                assert.equal(snapshot.drafts.find(row => row.id === batchId + '_q1').status, 'pending');
                assert.ok(dialogs.some(message => message.includes('E3_CONFIRM_REJECTED')));
            } else if (mode === 'submit-reject' || mode === 'submit-throw') {
                assert.equal(snapshot.questions.length, 0);
                assert.equal(snapshot.drafts.find(row => row.id === batchId + '_q1').status, 'reviewed');
                assert.equal(calls.filter(call => call.step === 'submit').length, 1, 'no automatic retry');
                assert.ok(dialogs.some(message => message.includes('已确认')), 'report the durable completed step');
                await h.page.evaluate(() => { window.auditAllowSubmit = true; });
                await button.click();
                await h.page.waitForFunction(() => window.auditActionResults.length === 3);
                snapshot = await H.getDbSnapshot(h.page); calls = await h.page.evaluate(() => window.auditActionCalls);
                assert.equal(snapshot.questions.length, 1);
                assert.equal(calls.filter(call => call.step === 'confirm').length, 1, 'explicit retry submits the existing confirmation');
                assert.equal(calls.filter(call => call.step === 'submit').length, 2);
            } else if (mode === 'double-click') {
                assert.equal(snapshot.questions.length, 0); assert.equal(calls.length, 1);
                assert.equal(snapshot.drafts.find(row => row.id === batchId + '_q1').status, 'reviewed');
            } else if (mode === 'submit-new-input') {
                assert.equal(snapshot.questions.length, 1, 'the requested in-flight insert may already commit');
                assert.doesNotMatch(snapshot.questions[0].stem, /Later unsaved text/);
                const ui = await h.page.evaluate(() => {
                    const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
                    return { source: p.activeDraftEditorBuffer, dirty: p.activeDraftEditorDirty, year: p.activeDraftQuestion.year, toast: p.batchToast };
                });
                assert.match(ui.source, /Later unsaved text/); assert.equal(ui.dirty, true); assert.equal(ui.year, '2041');
                assert.match(ui.toast, /新输入仍在编辑器/);
            } else {
                assert.equal(snapshot.questions.length, 0, 'new work or navigation must stop automatic submission');
                assert.equal(calls.length, 1);
                const ui = await h.page.evaluate(() => {
                    const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
                    return { batchId: p.activeBatchId, source: p.activeDraftEditorBuffer, dirty: p.activeDraftEditorDirty,
                        year: p.activeDraftQuestion.year, selected: [...p.selectedDraftIds] };
                });
                assert.equal(ui.batchId, mode === 'new-batch' ? other : batchId);
                assert.match(ui.source, /Later unsaved text/); assert.equal(ui.dirty, true); assert.equal(ui.year, '2041');
                if (mode === 'new-batch') assert.deepEqual(ui.selected, [other + '_q2']);
                assert.equal(snapshot.drafts.find(row => row.id === batchId + '_q1').status, 'reviewed');
            }
            assert.ok((await h.page.evaluate(() => window.auditActionResults)).every(result => !result.error));
            H.assertNoRuntimeErrors(h);
        } finally { await h.close(); }
    });
}
