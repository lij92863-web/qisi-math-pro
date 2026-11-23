const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startBrowserApp, createImportThroughUi, getDbSnapshot, callProxy, assertNoRuntimeErrors } = require('./browser-harness');
const { installMineruReplay } = require('../harness/mineru-replay');
const fixture = name => path.resolve(__dirname, '../fixtures/true-import', name);
const item = text => ({ page_idx: 0, type: 'text', text });

test('PDF pending drafts and incomplete choices cannot be admitted through either review entry', { timeout: 60000 }, async () => {
    const h = await startBrowserApp(32195);
    const { page } = h;
    try {
        const dialogs = [];
        page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
        await installMineruReplay(page, [{ file: fixture('pdf-question.pdf'), items: [
            item('一、单项选择题'),
            item('1. 第一题范围确认 A.甲 B.乙 C.丙 D.丁'),
            item('2. 第二题批量入库 A.孙 B.吴 C.郑 D.王'),
            item('3. 第三题缺少答案 A.壹 B.贰 C.叁 D.肆'),
            item('参考答案'), item('2【答案】B')
        ] }]);
        const result = await createImportThroughUi(page, { files: [{ file: fixture('pdf-question.pdf'), roles: ['full'] }] });
        assert.equal(result.snapshot.drafts.length, 3);
        const rangeWarning = '第 1 页有一段内容需要核对归属';
        // Reproduce the persisted task-wide warning while keeping the real PDF draft contract.
        await page.evaluate(async ({ ids, warning }) => {
            const db = new Dexie('QisiMathVueDB');
            await db.open();
            const table = db.table('draftQuestions');
            for (const id of ids) {
                const draft = await table.get(id);
                draft.pdfReview.taskProblems = [warning];
                draft.pdfReview.taskIssuesAcknowledged = false;
                if (String(draft.questionNumber) === '1') draft.solution = '由题意可得 r=1。';
                if (String(draft.questionNumber) === '2') {
                    draft.options = [];
                    draft.solution = '因为 r=1，所以结论成立。';
                }
                await table.put(draft);
            }
            db.close();
        }, { ids: result.snapshot.drafts.map(draft => draft.id), warning: rangeWarning });
        await callProxy(page, 'openBatchReview', result.batchId);

        const button = name => page.getByRole('button', { name, exact: true });
        assert.equal(await button('确认本题来源范围').count(), 0);
        assert.equal(await button('仅标记已确认').count(), 0);
        assert.equal(result.snapshot.drafts.find(draft => String(draft.questionNumber) === '1').fieldProvenance.stem.status, 'rejected');
        assert.equal(await button('入库并下一题').isDisabled(), true);
        await page.keyboard.press('Alt+Enter');
        assert.equal((await getDbSnapshot(page)).questions.length, 0);

        await button('总览').click();
        const row = number => page.getByRole('checkbox', { name: '选择第 ' + number + ' 题', exact: true });
        await button('全选未入库题').click();
        assert.equal(await page.locator('.v-overview [type=checkbox]:checked').count(), 3);
        await button('取消全选').click();
        assert.equal(await page.locator('.v-overview [type=checkbox]:checked').count(), 0);
        await row(2).check();
        await row(3).check();
        await button('入库已审核选中题目').click();
        await page.getByText(/入库只接受已审核题目/).waitFor();
        await page.locator('.v-overview tbody tr').filter({ hasText: '第二题批量入库' }).dblclick();
        await page.getByRole('heading', { name: '题目 2', exact: true }).waitFor();
        const reviewed = page.waitForEvent('dialog');
        await button('确认审核').click();
        await reviewed;
        assert.ok(dialogs.some(message => /选项/.test(message)));
        const snapshot = await getDbSnapshot(page);
        assert.equal(snapshot.questions.length, 0);
        assert.ok(snapshot.drafts.every(draft => draft.status === 'pending'));
        assert.deepEqual(snapshot.drafts.find(draft => String(draft.questionNumber) === '1').pdfReview.taskProblems, [rangeWarning]);
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('separate PDF review preserves verified support and formal admission rejects duplicate content', { timeout: 60000 }, async () => {
    const h = await startBrowserApp(32197);
    const { page } = h;
    try {
        const stem = '已知曲线交于三点，求三角形的外接圆面积。';
        await installMineruReplay(page, [
            { file: fixture('pdf-question.pdf'), items: [
                item('一、填空题'), item('1. ' + stem), item('2. ' + stem)
            ] },
            { file: fixture('pdf-answer.pdf'), items: [
                item('参考答案'), item('1【答案】$13\\pi$'), item('【解析】由方程可得 $r=1$。'),
                item('2【答案】$13\\pi$'), item('【解析】由方程可得 $r=1$。')
            ] }
        ]);
        const { batchId, snapshot } = await createImportThroughUi(page, { files: [
            { file: fixture('pdf-question.pdf'), roles: ['question'] },
            { file: fixture('pdf-answer.pdf'), roles: ['answer', 'solution'] }
        ] });
        assert.equal(snapshot.drafts.length, 2);
        // Replay reviewed fields from a separate, already verified support file.
        await page.evaluate(async ids => {
            const db = new Dexie('QisiMathVueDB');
            await db.open();
            const table = db.table('draftQuestions');
            for (const id of ids) {
                const draft = await table.get(id);
                for (const field of ['answer', 'solution']) {
                    Object.assign(draft.fieldProvenance[field], {
                        kind: 'controlled-write', status: 'controlled-write', controlledWriteAccepted: true
                    });
                }
                await table.put(draft);
            }
            db.close();
        }, snapshot.drafts.map(draft => draft.id));
        await callProxy(page, 'openBatchReview', batchId);
        const button = name => page.getByRole('button', { name, exact: true });
        await button('确认审核').click();
        await page.getByText(/已确认审核，可单独入库/).waitFor();
        const reviewedSnapshot = await getDbSnapshot(page);
        assert.equal(reviewedSnapshot.questions.length, 0);
        const reviewed = reviewedSnapshot.drafts.find(row => row.questionNumber === '1');
        const stemReview = reviewed.fieldProvenance.stem;
        assert.equal(stemReview.status, 'review-confirmed');
        assert.equal(stemReview.manuallyEdited, false);
        assert.equal(stemReview.manualEditRevision, undefined);
        assert.ok(stemReview.reviewedBy && Date.parse(stemReview.reviewedAt));
        assert.equal(reviewed.fieldProvenance.answer.status, 'controlled-write');
        assert.notEqual(reviewed.manualEdited, true);
        await button('入库并下一题').click();
        await page.getByText('已入库 1/2', { exact: true }).waitFor({ timeout: 5000 });
        await page.getByRole('heading', { name: '题目 2', exact: true }).waitFor();
        await button('确认审核').click();
        await page.getByText(/已确认审核，可单独入库/).waitFor();
        await button('总览').click();
        await page.getByRole('checkbox', { name: '选择第 2 题', exact: true }).check();
        await button('入库已审核选中题目').click();
        await page.getByText(/1 题未入库/).waitFor({ timeout: 5000 });
        await page.reload();
        const stored = await getDbSnapshot(page);
        assert.equal(stored.questions.length, 1);
        assert.equal(stored.drafts.find(draft => draft.questionNumber === '2').status, 'reviewed');
        for (const question of stored.questions) {
            assert.match(question.solution, /r=1/);
            assert.equal(question.provenance.answer.sourceId, question.supportSources[0].sourceId);
            assert.equal(question.provenance.stem.status, 'review-confirmed');
            assert.equal(question.provenance.stem.reviewedAt, stemReview.reviewedAt);
            assert.notEqual(question.admission.acceptCurrentContent, true);
        }
        assertNoRuntimeErrors(h);
    } finally {
        await h.close();
    }
});

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
        assert.ok(draft.pdfReview.sourcePageImages.length);
        assert.ok(draft.pdfReview.sourcePageImages.every(page => !page.url));
        const sharedPages = result.snapshot.files[0].pdfMineruEvidence.tasks[0].pageImages;
        assert.equal(sharedPages.length, 1);
        assert.match(sharedPages[0].url, /^data:image\//);
        await h.page.reload();
        const restored = (await getDbSnapshot(h.page)).drafts.find(d => d.id === draft.id);
        assert.deepEqual(restored.pdfReview, draft.pdfReview);
        assert.deepEqual(restored.fieldProvenance, draft.fieldProvenance);
        await h.page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '批量录题', exact: true }).click();
        await callProxy(h.page, 'openBatchReview', result.batchId);
        assert.equal(await h.page.evaluate(() => Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftSourcePageImages[0].url.startsWith('data:image/')), true);
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

        await h.page.evaluate(async id => {
            const draft = await db.draftQuestions.get(id);
            draft.pdfReview.taskProblems = ['原卷范围需要核对'];
            draft.pdfReview.taskIssuesAcknowledged = false;
            await db.draftQuestions.put(draft);
        }, draft.id);
        await callProxy(h.page, 'openBatchReview', result.batchId);
        await h.page.getByRole('button', { name: '总览', exact: true }).click();
        await h.page.getByRole('checkbox', { name: '选择第 1 题', exact: true }).check();
        await h.page.getByRole('button', { name: '确认选中 1 题', exact: true }).click();
        await h.page.getByText('已确认 1 题。', { exact: true }).waitFor();
        const batchReviewed = await getDbSnapshot(h.page);
        assert.equal(batchReviewed.questions.length, 0);
        const confirmed = batchReviewed.drafts.find(row => row.id === draft.id);
        assert.equal(confirmed.status, 'reviewed');
        assert.equal(confirmed.imageReviewStatus, 'confirmed');
        assert.equal(confirmed.pdfReview.taskIssuesAcknowledged, true);
        assert.equal(confirmed.fieldProvenance.stem.status, 'review-confirmed');
        assert.equal(confirmed.fieldProvenance.stem.manuallyEdited, false);
        await h.page.getByRole('button', { name: '逐题审核', exact: true }).click();
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
