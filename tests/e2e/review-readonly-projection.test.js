const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, seedReviewBatch, callProxy, getDbSnapshot, assertNoRuntimeErrors } = require('./browser-harness');

test('review filters and readonly previews preserve the active editor, focus, unsaved input and durable evidence', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(32843);
    try {
        const id = await seedReviewBatch(h.page, { batchId: 'readonly_review_projection' });
        await callProxy(h.page, 'openBatchReview', id);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'batchImport'; });
        const editor = h.page.locator('.batch-latex-source-editor');
        await editor.waitFor();
        const before = await getDbSnapshot(h.page);
        const source = 'Unsaved projection source $x+1$\nA. first\nB. second\nC. third\nD. fourth';
        await editor.fill(source);
        await editor.focus();
        await h.page.evaluate(() => { window.auditEditorNode = document.activeElement; });
        for (const filter of ['problems', 'images', 'reviewed', 'all']) {
            await h.page.evaluate(value => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').batchImportFilter = value; }, filter);
            const observation = await h.page.evaluate(() => {
                const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
                return { id: p.activeDraftQuestionId, dirty: p.activeDraftEditorDirty,
                    source: p.activeDraftEditorBuffer, focusPreserved: document.activeElement === window.auditEditorNode,
                    preview: p.activeDraftEditorPreview };
            });
            assert.equal(observation.id, id + '_q1');
            assert.equal(observation.dirty, true);
            assert.equal(observation.source, source);
            assert.equal(observation.focusPreserved, true);
            assert.equal(observation.preview.options.length, 4);
            assert.match(observation.preview.stem, /Unsaved projection source/);
        }
        const after = await getDbSnapshot(h.page);
        assert.deepEqual(after, before);
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
