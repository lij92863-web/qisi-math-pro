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

test('review draft command failure reloads persisted state and shows a UI error', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32109);
    const { page } = harness;

    try {
        const batchId = await seedReviewBatch(page, {
            batchId: 'e2e_review_command_failure'
        });
        await page.evaluate(async () => {
            const proxy = window.Qisi.Runtime
                .getRuntimeDependency('AppProxy');
            proxy.view = 'batchImport';
            await proxy.openBatchList();
        });
        await callProxy(page, 'openBatchReview', batchId);
        await page.locator('.batch-latex-source-editor').waitFor();

        await page.evaluate(() => {
            window.__qisiOriginalDraftPersistenceService =
                window.Qisi.DraftPersistenceService;
            window.Qisi.DraftPersistenceService = Object.freeze({
                ...window.Qisi.DraftPersistenceService,
                persistReviewDraftCommand: async () => {
                    const error = new Error('fixture write failure');
                    error.code = 'DRAFT_PERSISTENCE_WRITE_FAILED';
                    throw error;
                }
            });
        });

        await page.locator('.batch-latex-source-editor').fill(
            '1. This edit must roll back\nA. One\nB. Two\nC. Three\nD. Four'
        );
        await callProxy(page, 'saveActiveDraftQuestion');

        await page.waitForFunction(() =>
            document.querySelector('.batch-toast')?.textContent
                ?.includes('DRAFT_PERSISTENCE_WRITE_FAILED')
        );
        assert.match(
            await page.locator('.batch-latex-source-editor').inputValue(),
            /E2E original stem/
        );
        const snapshot = await getDbSnapshot(page);
        const draft = snapshot.drafts.find(item =>
            item.batchId === 'e2e_review_command_failure'
        );
        assert.match(draft.stem, /E2E original stem/);
        assert.doesNotMatch(draft.stem, /must roll back/);
        assert.equal(snapshot.questions.length, 0);

        await page.evaluate(() => {
            window.Qisi.DraftPersistenceService =
                window.__qisiOriginalDraftPersistenceService;
            delete window.__qisiOriginalDraftPersistenceService;
        });
        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
