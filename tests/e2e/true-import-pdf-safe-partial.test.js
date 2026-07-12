const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp, callProxy, installImportTransport, createImportThroughUi,
    getDbSnapshot, clearE2eData
} = require('./browser-harness.js');
const { pdfCandidate } = require('./true-import-fixtures.js');

test('true PDF safe-partial keeps prefix and rejected ownership out of formal data', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32113);
    const { page } = harness;
    try {
        const rejected = pdfCandidate();
        rejected.fieldProvenance.answer = {
            status: 'rejected', reasonCode: 'ownership-rewind'
        };
        rejected.fieldProvenance.solution = {
            status: 'rejected', reasonCode: 'solution-ownership-rewind'
        };
        await installImportTransport(page, {
            expectedQuestionNumbers: ['1', '2', '3'],
            candidates: [rejected, pdfCandidate({
                id: 'true_pdf_draft_3', questionNumber: '3'
            })]
        });
        const { batchId, snapshot } = await createImportThroughUi(page, {
            name: 'true-safe-partial.pdf',
            mimeType: 'application/pdf', buffer: Buffer.from('%PDF mock transport')
        });
        assert.equal(snapshot.drafts.length, 1);
        assert.equal(snapshot.batches[0].prefixTruncated, true);
        assert.equal(snapshot.drafts[0].supportLevel, 'prefix');
        await callProxy(page, 'openBatchReview', batchId);
        await callProxy(page, 'markDraftReviewed');
        const afterConfirm = await getDbSnapshot(page);
        assert.equal(afterConfirm.drafts[0].status, 'pending');
        assert.equal(afterConfirm.questions.length, 0);
        assert.equal(harness.forbiddenRequests.length, 0);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
