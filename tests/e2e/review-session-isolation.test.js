const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

for (const [index, mode] of ['new-input', 'new-batch'].entries()) {
    test('a pending review save preserves ' + mode + ' without confirming or overwriting it', { timeout: 30000 }, async () => {
        const h = await H.startBrowserApp(32845 + index);
        try {
            const oldBatch = await H.seedReviewBatch(h.page, { batchId: 'session_old' });
            const newBatch = await H.seedReviewBatch(h.page, { batchId: 'session_new' });
            await H.callProxy(h.page, 'openBatchReview', oldBatch);
            await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'batchImport'; });
            const editor = h.page.locator('.batch-latex-source-editor');
            await editor.waitFor();
            await h.page.evaluate(() => {
                const original = window.Qisi.DraftPersistenceService;
                const gate = new Promise(resolve => { window.auditReleaseSave = resolve; });
                window.Qisi.DraftPersistenceService = Object.freeze({ ...original,
                    async persistReviewDraftCommand(...args) {
                        window.auditSavePending = true;
                        await gate;
                        return original.persistReviewDraftCommand(...args);
                    }
                });
                const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
                const save = p.saveActiveDraftQuestion;
                p.saveActiveDraftQuestion = (...args) => {
                    const result = save(...args);
                    window.auditSavePromise = result;
                    result.then(value => { window.auditSaveResult = { done: true, value }; }, error => {
                        window.auditSaveResult = { done: true, error: String(error.message) };
                    });
                    return result;
                };
            });
            const first = 'First save source\nA. one\nB. two\nC. three\nD. four';
            const second = 'New unsaved source\nA. alpha\nB. beta\nC. gamma\nD. delta';
            await editor.fill(first);
            await h.page.getByRole('button', { name: '保存修改', exact: true }).click();
            await h.page.waitForFunction(() => window.auditSavePending);
            if (mode === 'new-batch') {
                h.page.once('dialog', dialog => dialog.accept());
                await H.callProxy(h.page, 'openBatchReview', newBatch);
            }
            await editor.fill(second);
            await h.page.evaluate(() => {
                window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftQuestion.year = '2033';
                window.auditReleaseSave();
            });
            await h.page.waitForFunction(() => window.auditSaveResult?.done);
            const ui = await h.page.evaluate(() => {
                const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
                return { result: window.auditSaveResult, batchId: p.activeBatchId, source: p.activeDraftEditorBuffer,
                    original: p.activeDraftEditorOriginal, dirty: p.activeDraftEditorDirty,
                    version: p.activeDraftQuestion.version, year: p.activeDraftQuestion.year };
            });
            assert.equal(ui.result.error, undefined);
            assert.equal(ui.result.value, false, 'a following confirm action must stop when new unsaved work exists');
            assert.equal(ui.batchId, mode === 'new-batch' ? newBatch : oldBatch);
            assert.equal(ui.source, second);
            assert.equal(ui.dirty, true);
            assert.equal(ui.year, '2033');
            assert.equal(ui.version, mode === 'new-batch' ? 1 : 2);
            const snapshot = await H.getDbSnapshot(h.page);
            const saved = snapshot.drafts.find(q => q.id === oldBatch + '_q1');
            assert.match(saved.stem, /First save source/);
            assert.doesNotMatch(saved.stem, /New unsaved source/);
            assert.equal(saved.version, 2);
            assert.notEqual(saved.year, '2033');
            assert.equal(snapshot.questions.length, 0);
            assert.equal(snapshot.drafts.find(q => q.id === newBatch + '_q1').version, 1);
            H.assertNoRuntimeErrors(h);
        } finally { await h.close(); }
    });
}
