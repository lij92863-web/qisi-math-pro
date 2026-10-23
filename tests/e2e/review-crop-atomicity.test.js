const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('manual crop actual pixels, source identity and token persist together only after explicit retry', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32848);
    try {
        const batchId = await H.seedReviewBatch(h.page, { batchId: 'crop_atomic' });
        await h.page.evaluate(async batchId => {
            const db = new Dexie('QisiMathVueDB'); await db.open();
            try {
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 100;
                const ctx = canvas.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 100, 100);
                const q = await db.table('draftQuestions').get(batchId + '_q1');
                q.sourcePageImage = canvas.toDataURL('image/png'); q.sourceQuestionFileId = batchId + '_docx'; q.sourcePage = 2;
                q.rawText = 'original crop source evidence';
                await db.table('draftQuestions').put(q);
            } finally { db.close(); }
        }, batchId);
        await H.callProxy(h.page, 'openBatchReview', batchId);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'batchImport'; });
        const before = await H.getDbSnapshot(h.page);
        await h.page.getByRole('button', { name: '重新裁剪', exact: true }).first().click();
        const modal = h.page.locator('.batch-crop-modal');
        await modal.waitFor();
        await modal.getByRole('button', { name: '关闭', exact: true }).click();
        assert.deepEqual(await H.getDbSnapshot(h.page), before, 'cancel never writes');
        await h.page.getByRole('button', { name: '重新裁剪', exact: true }).first().click();
        const image = modal.locator('.batch-crop-image-wrap > img');
        await image.evaluate(img => img.decode());
        const rect = await image.boundingBox();
        await h.page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height * 0.2);
        await h.page.mouse.down();
        await h.page.mouse.move(rect.x + rect.width * 0.7, rect.y + rect.height * 0.7, { steps: 4 });
        await h.page.mouse.up();
        await h.page.evaluate(() => {
            const original = window.Qisi.DraftPersistenceService;
            window.auditRestoreCropPersistence = () => { window.Qisi.DraftPersistenceService = original; };
            window.Qisi.DraftPersistenceService = Object.freeze({ ...original,
                async persistReviewDraftCommand() { throw new Error('CROP_ATOMIC_WRITE_REJECTED'); }
            });
        });
        await modal.getByRole('button', { name: '保存为当前题图', exact: true }).click();
        await h.page.waitForFunction(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').batchToast.includes('CROP_ATOMIC_WRITE_REJECTED'));
        assert.deepEqual(await H.getDbSnapshot(h.page), before);
        const failed = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { count: p.activeDraftQuestion.images.length, version: p.activeDraftQuestion.version,
                dirty: p.activeDraftEditorDirty, open: p.cropModalOpen };
        });
        assert.deepEqual(failed, { count: 0, version: 1, dirty: false, open: true });
        await h.page.evaluate(() => window.auditRestoreCropPersistence());
        await modal.getByRole('button', { name: '保存为当前题图', exact: true }).click();
        await modal.waitFor({ state: 'detached' });
        const after = await H.getDbSnapshot(h.page);
        assert.equal(after.images.length, 1);
        const crop = after.images[0], q = after.drafts.find(row => row.id === batchId + '_q1');
        assert.equal(crop.source, 'manual-crop');
        assert.equal(crop.sourceFileId, batchId + '_docx'); assert.equal(crop.sourcePage, 2);
        assert.equal(crop.questionId, q.id); assert.equal(crop.batchId, batchId);
        assert.ok(Math.abs(crop.width - 50) <= 1 && Math.abs(crop.height - 50) <= 1);
        assert.match(q.stem, new RegExp(crop.id)); assert.match(q.editorSource, new RegExp(crop.id));
        assert.equal(q.rawTextOriginal, 'original crop source evidence');
        assert.equal(q.sourcePageImage, before.drafts.find(row => row.id === q.id).sourcePageImage);
        assert.deepEqual(after.drafts.find(row => row.id === batchId + '_q2'), before.drafts.find(row => row.id === batchId + '_q2'));
        assert.equal(after.questions.length, 0);
        await H.callProxy(h.page, 'openBatchList');
        await H.callProxy(h.page, 'openBatchReview', batchId);
        const restored = await H.getDbSnapshot(h.page);
        assert.deepEqual(restored.images, after.images, 'reopening retains exact crop bytes and source evidence');
        const pixel = await h.page.evaluate(async url => {
            const image = new Image(); image.src = url; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            return [...ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data];
        }, crop.url);
        assert.deepEqual(pixel, [255, 0, 0, 255]);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('retained PDF crop saves real rotated pixels to the selected option and preserves machine evidence', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32849);
    try {
        const batchId = await H.seedReviewBatch(h.page, { batchId: 'pdf_crop_atomic' });
        await h.page.evaluate(async batchId => {
            const stream = '1 0 0 rg\n24 40 24 24 re f\n';
            const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Rotate 90 /Resources << >> /Contents 4 0 R >>',
                `<< /Length ${stream.length} >>\nstream\n${stream}endstream`];
            let text = '%PDF-1.4\n'; const offsets = [0];
            objects.forEach((body, index) => { offsets.push(text.length); text += `${index + 1} 0 obj\n${body}\nendobj\n`; });
            const xref = text.length;
            text += 'xref\n0 5\n0000000000 65535 f \n' + offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
                `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
            const db = new Dexie('QisiMathVueDB'); await db.open();
            try {
                const file = await db.table('draftImportFiles').get(batchId + '_pdf');
                file.uploadPath = 'data:application/pdf;base64,' + btoa(text);
                const renderer = window.Qisi.BrowserPdfRenderer.createBrowserPdfRenderer({
                    dataUrlToBlob: async url => new Blob([Uint8Array.from(atob(url.split(',')[1]), c => c.charCodeAt(0))], { type: 'application/pdf' }),
                    getBatchFileRoles: () => ['full'], logBatchPdfDiag() {}, batchHasQuestionRole: () => true,
                    estimateVisionCalls: () => 0, recordRenderedPages() {}, showBatchToast() {}, getRecognitionMode: () => 'mock'
                });
                const page = await renderer.renderPdfRegion(file, { pageNo: 1, bbox: [0, 0, 1000, 1000] });
                const q = await db.table('draftQuestions').get(batchId + '_q1');
                q.producer = { routeId: 'pdf-mineru-v1' }; q.manualConfirmed = false;
                q.pdfReview = { protocol: 'pdf-mineru-v1', optionLabels: ['A', 'B', 'C', 'D'], states: {},
                    candidates: { question: [], answer: [], solution: [] }, taskProblems: [], rawSources: [{ sourceId: file.id, sha256: 'a'.repeat(64) }],
                    sourcePageImages: [{ ...page, pageNo: 1, sourceFileId: file.id, sourceFileName: file.filename }] };
                await db.table('draftQuestions').put(q); await db.table('draftImportFiles').put(file);
            } finally { db.close(); }
        }, batchId);
        const before = await H.getDbSnapshot(h.page);
        await H.callProxy(h.page, 'openBatchReview', batchId);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'batchImport'; });
        await h.page.getByRole('button', { name: '重新裁剪', exact: true }).first().click();
        const modal = h.page.locator('.batch-crop-modal'), image = modal.locator('.batch-crop-image-wrap > img');
        await image.evaluate(img => img.decode());
        const rect = await image.boundingBox();
        await h.page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.2);
        await h.page.mouse.down();
        await h.page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.4, { steps: 4 });
        await h.page.mouse.up();
        await modal.locator('select').selectOption('option:B');
        await modal.getByRole('button', { name: '保存为当前题图', exact: true }).click();
        await modal.waitFor({ state: 'detached' });
        const after = await H.getDbSnapshot(h.page), q = after.drafts.find(row => row.id === batchId + '_q1');
        const prior = before.drafts.find(row => row.id === q.id), crop = after.images[0];
        assert.equal(after.images.length, 1); assert.equal(q.stem, prior.stem);
        assert.match(q.options[1], new RegExp(crop.id)); assert.equal(q.images[0].position, 'option:B');
        assert.equal(q.manualConfirmed, false); assert.equal(q.imageReviewStatus, 'need_confirm');
        assert.equal(crop.sourceFileId, batchId + '_pdf'); assert.equal(crop.sourcePage, 1);
        assert.deepEqual(q.pdfReview.candidates, prior.pdfReview.candidates);
        assert.deepEqual(q.pdfReview.rawSources, prior.pdfReview.rawSources);
        assert.deepEqual(q.pdfReview.sourcePageImages, prior.pdfReview.sourcePageImages);
        assert.deepEqual(after.files, before.files);
        const pixel = await h.page.evaluate(async url => {
            const image = new Image(); image.src = url; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            return [...ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data];
        }, crop.url);
        assert.deepEqual(pixel, [255, 0, 0, 255]);
        assert.equal(after.questions.length, 0);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

