const test = require('node:test');
const assert = require('node:assert/strict');
const Export = require('../../qisi-export-service.js');

const {
    startBrowserApp, callProxy, installImportTransport, createImportThroughUi,
    getDbSnapshot, clearE2eData, assertNoRuntimeErrors
} = require('./browser-harness.js');
const { docxCandidate } = require('./true-import-fixtures.js');

test('true DOCX import reaches admitted v2, reload, and sanitized export', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32112);
    const { page } = harness;
    try {
        await installImportTransport(page, {
            expectedQuestionNumbers: ['1'], candidates: [docxCandidate()]
        });
        const { batchId, snapshot: imported } = await createImportThroughUi(page, {
            name: 'true-question.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: Buffer.from('deterministic transport fixture')
        });
        assert.equal(imported.drafts.length, 1);
        assert.equal(imported.drafts[0].status, 'pending');
        await callProxy(page, 'openBatchReview', batchId);
        await callProxy(page, 'markDraftReviewed');
        assert.equal(await callProxy(
            page, 'submitDraftQuestion', imported.drafts[0].id, true
        ), true);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(
            window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')
        ));
        const snapshot = await getDbSnapshot(page);
        const question = snapshot.questions[0];
        assert.equal(question.schemaVersion, 'qisi.question.v2');
        assert.equal(question.source.mode, 'docx-deterministic');
        assert.equal(question.provenance.stem.status, 'deterministic-source');
        assert.ok(question.admission.decisionId);

        const plan = await Export.createExportService({
            resolveImages: async () => []
        }).build(snapshot.questions);
        assert.doesNotMatch(JSON.stringify(plan), /PRIVATE_RAW_EVIDENCE_MUST_NOT_EXPORT/);
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
