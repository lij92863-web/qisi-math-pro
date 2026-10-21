const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startBrowserApp, createImportThroughUi, getDbSnapshot, callProxy, assertNoRuntimeErrors } = require('./browser-harness');
const { installMineruReplay } = require('../harness/mineru-replay');
const fixture = name => path.resolve(__dirname, '../fixtures/true-import', name);
const item = text => ({ page_idx: 0, type: 'text', text });

test('default PDF UI uses exact-byte MinerU evidence; reload retains sources and review fields', { timeout: 60000 }, async () => {
    const h = await startBrowserApp(32193);
    try {
        const replay = await installMineruReplay(h.page, [{ file: fixture('pdf-question.pdf'), items: [
            item('一、单项选择题'), item('1. 第一题 A.甲 B.乙 C.丙 D.丁'),
            item('参考答案'), item('1【答案】A'), item('【解析】甲符合题意。')
        ] }]);
        const result = await createImportThroughUi(h.page, { files: [{ file: fixture('pdf-question.pdf'), roles: ['full'] }] });
        const batch = result.snapshot.batches.find(b => b.id === result.batchId);
        assert.equal(batch.status, 'review', JSON.stringify(batch));
        const draft = result.snapshot.drafts[0];
        assert.equal(draft.producer.routeId, 'pdf-mineru-v1');
        assert.equal(draft.answer, 'A'); assert.match(draft.solution, /甲符合题意/);
        assert.equal(draft.fieldProvenance.answer.status, 'rejected');
        assert.equal(draft.manualConfirmed, false); assert.equal(result.snapshot.questions.length, 0);
        assert.equal(replay.calls.filter(p => p.endsWith('/parse')).length, 1);
        assert.ok(draft.pdfReview.rawSources[0].sha256);
        await h.page.reload();
        const restored = (await getDbSnapshot(h.page)).drafts.find(d => d.id === draft.id);
        assert.deepEqual(restored.pdfReview, draft.pdfReview);
        assert.deepEqual(restored.fieldProvenance, draft.fieldProvenance);
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('MinerU support answers, images and the human adoption path reach reviewed without changing the draft source', { timeout: 60000 }, async () => {
    const h = await startBrowserApp(32194);
    try {
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        await installMineruReplay(h.page, [
            { file: fixture('pdf-question.pdf'), items: [
                item('一、单项选择题'), item('1. 第一题'),
                { page_idx: 0, type: 'image', img_path: 'images/figure.png', image_caption: ['图1'] },
                item('A.甲 B.乙 C.丙 D.丁')
            ], images: { 'images/figure.png': { type: 'image/png', bytes: png } } },
            { file: fixture('pdf-answer.pdf'), items: [item('参考答案'), item('1【答案】A'), item('【解析】甲符合题意。')] }
        ]);
        const result = await createImportThroughUi(h.page, { files: [
            { file: fixture('pdf-question.pdf'), roles: ['question'] },
            { file: fixture('pdf-answer.pdf'), roles: ['answer', 'solution'] }
        ] });
        let draft = result.snapshot.drafts[0];
        assert.equal(draft.answer, 'A');
        assert.match(draft.solution, /甲符合题意/);
        assert.equal(draft.images.length, 1);
        assert.match(draft.images[0].url, /^data:image\/png;base64,/);
        assert.ok(draft.stem.includes('[[IMAGE:' + draft.images[0].id + ']]'));
        assert.equal(draft.fieldProvenance.answer.blockIds[0], draft.supportSources[0].sourceId + '/p1b1');
        assert.deepEqual(draft.pdfReview.candidates.answer[0].item.source_pages, [1]);
        assert.equal(result.snapshot.questions.length, 0);

        await callProxy(h.page, 'openBatchReview', result.batchId);
        for (const field of ['question', 'answer', 'solution']) {
            await callProxy(h.page, 'choosePdfCandidate', field, 0);
        }
        draft = (await getDbSnapshot(h.page)).drafts.find(row => row.id === draft.id);
        assert.equal(draft.fieldProvenance.stem.status, 'manual');
        assert.equal(draft.fieldProvenance.answer.status, 'manual');
        assert.equal(draft.fieldProvenance.solution.status, 'manual');
        // A MinerU crop must be confirmed before the source-range gate allows review.
        await callProxy(h.page, 'confirmDraftImages');
        await callProxy(h.page, 'markDraftReviewed');
        draft = (await getDbSnapshot(h.page)).drafts.find(row => row.id === draft.id);
        const reviewToast = await h.page.evaluate(() =>
            window.Qisi.Runtime.getRuntimeDependency('AppProxy').batchToast);
        assert.equal(draft.status, 'reviewed', reviewToast);
        assert.equal(draft.manualConfirmed, true);
        assert.equal(draft.producer.routeId, 'pdf-mineru-v1');
        assert.equal(draft.pdfReview.protocol, 'pdf-mineru-v1');
        assert.deepEqual(draft.pdfReview.rawSources.map(source => source.sourceId).sort(),
            result.snapshot.files.map(file => file.id).sort());
        assert.equal(await callProxy(h.page, 'submitDraftQuestion', draft.id, true), true);
        const formal = await getDbSnapshot(h.page);
        assert.equal(formal.questions.length, 1);
        assert.equal(formal.questions[0].producer.routeId, 'pdf-mineru-v1');
        assert.equal(formal.questions[0].answer, 'A');

        await h.page.reload();
        const restored = (await getDbSnapshot(h.page)).drafts.find(row => row.id === draft.id);
        assert.equal(restored.status, 'submitted');
        assert.equal(restored.images.length, 1);
        assert.match(restored.images[0].url, /^data:image\/png;base64,/);
        assertNoRuntimeErrors(h);
    } finally {
        await h.close();
    }
});
