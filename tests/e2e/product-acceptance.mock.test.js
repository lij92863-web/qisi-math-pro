const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    callProxy,
    seedReviewBatch,
    getDbSnapshot,
    waitForDbSnapshot,
    clearE2eData,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

test('mock DOCX/PDF upload reaches review, edit, confirm, and formal insertion', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32102);
    const { page } = harness;

    try {
        await page.getByRole('button', { name: '批量录题' }).click();
        await page.locator('.batch-home-upload').click();
        const input = page.locator('input[type="file"][accept*=".docx"]');
        await input.setInputFiles([
            {
                name: 'mock-question.docx',
                mimeType:
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                buffer: Buffer.from('mock-docx-fixture')
            },
            {
                name: 'mock-support.pdf',
                mimeType: 'application/pdf',
                buffer: Buffer.from('%PDF-1.4 mock')
            }
        ]);

        for (let index = 0; index < 2; index += 1) {
            const modal = page.locator('.batch-purpose-modal')
                .filter({ has: page.locator('.batch-purpose-options') });
            await modal.waitFor({ state: 'visible' });
            await modal.locator('.batch-purpose-options input').nth(3).check();
            await modal.getByRole('button', { name: '确认添加' }).click();
        }
        await page.waitForFunction(
            () => document.querySelectorAll('.batch-file-card').length === 2
        );
        assert.equal(await page.locator('.batch-file-card').count(), 2);

        const batchId = await seedReviewBatch(page);
        await callProxy(page, 'openBatchReview', batchId);
        await page.locator('.batch-latex-source-editor').waitFor();

        const editor = page.locator('.batch-latex-source-editor');
        await editor.fill(
            '1. E2E updated stem\nA. Alpha revised\nB. Beta revised\nC. Gamma\nD. Delta'
        );
        await page.getByRole('button', { name: /保存修改/ }).click();

        await page.getByRole('button', { name: '答案内容' }).click();
        await page.locator('.batch-editor-card.content textarea').fill('B');

        await page.getByRole('button', { name: '解析内容' }).click();
        await page.locator('.batch-editor-card.content textarea')
            .fill('E2E updated solution');

        await page.getByRole('button', { name: /标记已确认/ }).click();
        await waitForDbSnapshot(page, snapshot =>
            snapshot.drafts.some(item =>
                item.questionNumber === '1' &&
                item.status === 'reviewed'
            )
        );
        await page.getByRole('button', { name: /提交入库/ }).click();

        const snapshot = await waitForDbSnapshot(
            page,
            value => value.questions.length === 1
        );
        assert.equal(snapshot.questions.length, 1);
        assert.match(snapshot.questions[0].stem, /E2E updated stem/);
        assert.equal(snapshot.questions[0].options[0], 'Alpha revised');
        assert.equal(snapshot.questions[0].answer, 'B');
        assert.equal(snapshot.questions[0].solution, 'E2E updated solution');
        assert.equal(
            snapshot.drafts.find(item => item.questionNumber === '1').status,
            'submitted'
        );

        const partial = snapshot.drafts.find(
            item => item.questionNumber === '2'
        );
        assert.equal(partial.answer, '');
        assert.equal(partial.supportLevel, 'prefix');
        assert.equal(partial.manualReviewRequired, true);

        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
