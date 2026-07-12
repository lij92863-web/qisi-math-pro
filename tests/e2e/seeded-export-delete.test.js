const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    callProxy,
    seedReviewBatch,
    getDbSnapshot,
    clearE2eData,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

test('seeded-export-delete: export and task deletion preserve formal questions', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32104);
    const { page } = harness;

    try {
        const batchId = await seedReviewBatch(page, {
            batchId: 'e2e_export_batch',
            title: 'E2E export delete task'
        });

        await page.evaluate(async id => {
            const db = new Dexie('QisiMathVueDB');
            await db.open();
            await db.table('questions').put({
                id: 'e2e_formal_question',
                grade: '高一',
                diff: '中等',
                type: '单选题',
                stem: 'Formal export question',
                options: ['A1', 'B1', 'C1', 'D1'],
                answer: 'A',
                solution: 'Formal solution',
                images: [],
                meta: { importBatchId: id },
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            db.close();
            localStorage.setItem('qisi_teacher_name', 'E2E Teacher');
        }, batchId);

        await page.getByRole('button', { name: '题库与检索' }).click();
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: /导出题库数据/ }).click();
        const download = await downloadPromise;
        assert.match(download.suggestedFilename(), /\.zip$/);

        await page.getByRole('button', { name: '批量录题' }).click();
        await callProxy(page, 'openBatchList');
        await page.waitForFunction(() =>
            document.body.textContent.includes('E2E export delete task')
        );

        page.once('dialog', dialog => dialog.accept());
        const row = page.locator('.batch-job-row')
            .filter({ hasText: 'E2E export delete task' });
        await row.getByRole('button', { name: '删除' }).click();

        await page.waitForFunction(async id => {
            const db = new Dexie('QisiMathVueDB');
            await db.open();
            const batch = await db.table('draftImportBatches').get(id);
            db.close();
            return !batch;
        }, batchId);

        const snapshot = await getDbSnapshot(page);
        assert.equal(snapshot.batches.length, 0);
        assert.equal(snapshot.questions.length, 1);
        assert.equal(snapshot.questions[0].id, 'e2e_formal_question');

        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
