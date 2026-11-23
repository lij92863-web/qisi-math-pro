const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('real delete button leaves draft, image and editor unchanged on storage failure, then an explicit retry persists together', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32847);
    try {
        const batchId = await H.seedReviewBatch(h.page, { batchId: 'image_atomic' });
        await h.page.evaluate(async batchId => {
            const db = new Dexie('QisiMathVueDB'); await db.open();
            try {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 80, 80);
            const url = canvas.toDataURL('image/png');
            const image = { id: 'figure_atomic', batchId, questionId: batchId + '_q1', url,
                source: 'docx-inline-figure', status: 'need_confirm', confidence: 0.8, createdAt: 1, updatedAt: 1 };
            await db.table('draftImages').put(image);
            const q = await db.table('draftQuestions').get(batchId + '_q1');
            q.images = [{ ...image }]; q.stem += '\n[[IMAGE:figure_atomic]]'; q.hasImage = true;
            q.imageReviewStatus = 'need_confirm';
            q.sourcePageImage = url; q.sourceQuestionFileId = batchId + '_docx'; q.sourcePage = 1;
            await db.table('draftQuestions').put(q);
            } finally { db.close(); }
        }, batchId);
        await H.callProxy(h.page, 'openBatchReview', batchId);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'batchImport'; });
        await h.page.locator('.v-review-diagnostics').evaluate(el => { el.open = true; });
        const before = await H.getDbSnapshot(h.page);
        const beforeUi = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { q: JSON.parse(JSON.stringify(p.activeDraftQuestion)), source: p.activeDraftEditorBuffer,
                original: p.activeDraftEditorOriginal, images: JSON.parse(JSON.stringify(p.batchDraftImages)) };
        });
        await h.page.evaluate(() => {
            const original = window.Qisi.DraftPersistenceService;
            window.auditRestoreImagePersistence = () => { window.Qisi.DraftPersistenceService = original; };
            window.Qisi.DraftPersistenceService = Object.freeze({ ...original,
                async persistReviewDraftCommand() { window.auditImageRejected = true; throw new Error('E2_INJECTED_STORAGE_FAILURE'); }
            });
        });
        h.page.once('dialog', dialog => dialog.accept());
        await h.page.getByRole('button', { name: '删除图片', exact: true }).click();
        await h.page.waitForFunction(() => window.auditImageRejected);
        await h.page.waitForFunction(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').batchToast.includes('E2_INJECTED_STORAGE_FAILURE'));
        const failedUi = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { q: JSON.parse(JSON.stringify(p.activeDraftQuestion)), source: p.activeDraftEditorBuffer,
                original: p.activeDraftEditorOriginal, images: JSON.parse(JSON.stringify(p.batchDraftImages)) };
        });
        assert.deepEqual(await H.getDbSnapshot(h.page), before, 'failed transaction must not alter persisted state');
        assert.deepEqual(failedUi, beforeUi, 'failed command must not leave optimistic token/image edits');
        await h.page.evaluate(() => window.auditRestoreImagePersistence());
        h.page.once('dialog', dialog => dialog.dismiss());
        await h.page.getByRole('button', { name: '删除图片', exact: true }).click();
        assert.deepEqual(await H.getDbSnapshot(h.page), before, 'cancel has no write');
        h.page.once('dialog', dialog => dialog.accept());
        await h.page.getByRole('button', { name: '删除图片', exact: true }).click();
        await h.page.waitForFunction(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftQuestion.version === 2);
        const saved = await H.getDbSnapshot(h.page);
        assert.equal(saved.images.find(row => row.id === 'figure_atomic').status, 'deleted');
        assert.doesNotMatch(saved.drafts.find(row => row.id === batchId + '_q1').stem, /figure_atomic/);
        assert.deepEqual(saved.drafts.find(row => row.id === batchId + '_q2'), before.drafts.find(row => row.id === batchId + '_q2'));
        await H.callProxy(h.page, 'openBatchReview', batchId);
        assert.equal(await h.page.evaluate(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftEditorDirty), false);
        assert.equal(saved.questions.length, 0);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
