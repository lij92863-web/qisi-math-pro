const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Export = require('../../qisi-export-service.js');

const {
    startBrowserApp,
    callProxy,
    createImportThroughUi,
    getDbSnapshot,
    clearE2eData,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);

test('true DOCX files reach admitted v2, reload, and sanitized export', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32312);
    const { page } = harness;
    try {
        await clearE2eData(page);
        const { batchId, snapshot: imported } = await createImportThroughUi(
            page,
            {
                producerMode: 'docx-deterministic',
                files: [
                    { file: fixture('docx-question.docx'), roles: ['question'] },
                    { file: fixture('docx-answer.docx'), roles: ['answer'] },
                    { file: fixture('docx-solution.docx'), roles: ['solution'] }
                ]
            }
        );
        const draft = imported.drafts.find(item => item.batchId === batchId);
        assert.equal(draft.answer, 'A');
        assert.match(draft.solution, /declared stable answer/);
        await callProxy(page, 'openBatchReview', batchId);
        await callProxy(page, 'markDraftReviewed');
        const reviewed = await getDbSnapshot(page);
        const current = reviewed.drafts.find(item => item.batchId === batchId);
        assert.equal(
            await callProxy(page, 'submitDraftQuestion', current.id, true),
            true
        );

        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(
            window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')
        ));
        const snapshot = await getDbSnapshot(page);
        const formal = snapshot.questions[0];
        assert.equal(formal.schemaVersion, 'qisi.question.v2');
        assert.equal(formal.source.format, 'docx');
        assert.equal(formal.producer.mode, 'deterministic-docx');
        assert.equal(formal.provenance.answer.status, 'deterministic-source');
        assert.equal(formal.supportSources.length, 2);

        const plan = await Export.createExportService({
            resolveImages: async () => []
        }).build(snapshot.questions);
        assert.doesNotMatch(
            JSON.stringify(plan),
            /PRIVATE_RAW_EVIDENCE_MUST_NOT_EXPORT/
        );
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
