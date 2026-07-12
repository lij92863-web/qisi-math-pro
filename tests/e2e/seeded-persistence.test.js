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

test('seeded-persistence: seeded review state survives a browser reload', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32103);
    const { page } = harness;

    try {
        const batchId = await seedReviewBatch(page, {
            batchId: 'e2e_persist_batch',
            title: 'E2E persistence task'
        });
        await page.getByRole('button', { name: '批量录题' }).click();
        await callProxy(page, 'openBatchReview', batchId);
        await page.locator('.batch-latex-source-editor').fill(
            '1. Persistence stem\nA. One\nB. Two\nC. Three\nD. Four'
        );
        await page.getByRole('button', { name: /保存修改/ }).click();

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() =>
            Boolean(
                window.Qisi?.Runtime
                    ?.getRuntimeDependency('AppProxy')
            )
        );

        const snapshot = await getDbSnapshot(page);
        const draft = snapshot.drafts.find(
            item => item.batchId === 'e2e_persist_batch'
        );
        assert.match(draft.stem, /Persistence stem/);
        assert.equal(draft.options[0], 'One');

        await callProxy(page, 'openBatchReview', batchId);
        await page.locator('.batch-latex-source-editor').waitFor();
        await page.waitForFunction(
            () => document.querySelector('.batch-latex-source-editor')
                ?.value
                .includes('Persistence stem')
        );
        assert.match(
            await page.locator('.batch-latex-source-editor').inputValue(),
            /Persistence stem/
        );

        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
