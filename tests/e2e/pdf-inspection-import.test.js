const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, createImportThroughUi, callProxy } = require('./browser-harness.js');
const { makePdf } = require('../fixtures/pdf-ingestion.js');

test('real PDF text bytes import without recognition; mixed-page transport failure exposes original for review', { timeout: 60000 }, async () => {
    for (const mixed of [false, true]) {
        const harness = await startBrowserApp(32152);
        const { page } = harness;
        page.on('dialog', dialog => dialog.accept());
        try {
            const { batchId, snapshot } = await createImportThroughUi(page, {
                name: mixed ? 'mixed.pdf' : 'text.pdf', mimeType: 'application/pdf', buffer: makePdf(mixed)
            });
            const batch = snapshot.batches[0];
            assert.equal(batch.status, 'review', batch.errorMessage);
            assert.equal(snapshot.questions.length, 0, 'recognition must never write the formal bank');
            if (mixed) {
                // The owner's rule (2026-09-17): a mixed page keeps the text it can read as a safe partial
                // draft instead of leaving the whole file at "0 题" whenever the visual service is
                // unreachable. The draft is not invented - it comes from the page's own text layer, and the
                // page itself still goes to 待核对原页 with its reason.
                assert.equal(snapshot.drafts.length, 1, 'the readable text of a mixed page makes its own draft');
                assert.equal(snapshot.drafts[0].fieldEvidence.stem.source, 'pdf-text');
                assert.equal(batch.withheldItems.length, 1);
                assert.equal(batch.ingestionSourcePages.length, 1);
                assert.match(batch.ingestionSourcePages[0].imageUrl, /^data:image\/jpeg/);
                assert.equal(harness.forbiddenRequests.length, 1, 'one blocked transport attempt, no retries');
                await callProxy(page, 'openBatchReview', batchId);
                const evidence = page.getByTestId('pdf-withheld-review');
                await evidence.locator('summary').click();
                assert.equal(await evidence.locator('img').count(), 1);
                assert.ok(await evidence.locator('img').evaluate(img => img.complete && img.naturalWidth > 0));
            } else {
                assert.equal(snapshot.drafts.length, 1);
                assert.equal(snapshot.drafts[0].questionNumber, '1');
                assert.match(snapshot.drafts[0].stem, /Calculate the sum/);
                assert.equal(snapshot.drafts[0].fieldEvidence.stem.source, 'pdf-text');
                assert.equal(harness.forbiddenRequests.length, 0);
            }
            assert.deepEqual(harness.pageErrors, []);
        } finally { await harness.close(); }
    }
});
