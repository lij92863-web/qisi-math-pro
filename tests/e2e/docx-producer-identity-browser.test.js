const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    createImportThroughUi,
    clearE2eData,
    installBrowserEngineInjection,
    readImportStageTrace,
    assertNoRuntimeErrors
} = require('./browser-harness.js');
const Contract = require('../../qisi-docx-producer-identity-contract.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);
const stageNames = async (page, batchId) => (
    await readImportStageTrace(page, batchId)
).map(event => event.stage);

test('normal UI real DOCX files preserve deterministic identity and refuse the retired vision identity', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32119);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [{ value: { questions: [{
                questionNumber: '1',
                type: '单选题',
                stem: 'Which real DOCX vision statement is correct?',
                options: {
                    A: 'First', B: 'Second', C: 'Third', D: 'Fourth'
                },
                answer: '',
                solution: '',
                images: [],
                isFragment: false,
                question_bbox: [0, 0, 1000, 1000]
            }] } }]
        });

        // 2026-10-22: the DOCX visual fallback is retired. The batch must fail
        // closed before any conversion or OCR call, not silently fall back.
        const retired = await createImportThroughUi(harness.page, {
            producerMode: 'docx-vision',
            files: [{ file: fixture('docx-vision.docx'), roles: ['question'] }]
        });
        const retiredBatch = retired.snapshot.batches.find(
            batch => batch.id === retired.batchId
        );
        assert.equal(retiredBatch.status, 'failed');
        assert.equal(engine.calls.length, 0, 'no vision/OCR calls may run');
        const retiredStages = await stageNames(harness.page, retired.batchId);
        assert.equal(
            retiredStages.includes('source-producer-entered'),
            false,
            'retired identity must not enter a producer'
        );

        const deterministic = await createImportThroughUi(harness.page, {
            producerMode: 'docx-deterministic',
            files: [
                { file: fixture('docx-question.docx'), roles: ['question'] },
                { file: fixture('docx-answer.docx'), roles: ['answer'] },
                { file: fixture('docx-solution.docx'), roles: ['solution'] }
            ]
        });
        const deterministicDrafts = deterministic.snapshot.drafts.filter(
            draft => draft.batchId === deterministic.batchId
        );
        assert.equal(deterministicDrafts.length, 1);
        const deterministicDraft = deterministicDrafts[0];
        assert.equal(deterministicDraft.source.format, 'docx');
        assert.equal(deterministicDraft.producer.mode, 'deterministic-docx');
        assert.equal(
            deterministicDraft.producer.routeId,
            Contract.ROUTES.DOCX_DETERMINISTIC
        );
        assert.equal(deterministicDraft.answer, 'A');
        assert.match(deterministicDraft.solution, /declared stable answer/);
        assert.equal(
            Contract.validateCanonicalIdentity(deterministicDraft).valid,
            true
        );
        const deterministicStages = await stageNames(
            harness.page,
            deterministic.batchId
        );
        assert.ok(deterministicStages.includes('source-producer-entered'));
        assert.ok(deterministicStages.includes('parser-entered'));
        assert.ok(deterministicStages.includes('draft-persisted'));
        assert.equal(engine.realApiCalled, false);
        assert.equal(harness.forbiddenRequests.length, 0);
        // The only expected console error is the deliberate refusal of the retired
        // identity; anything else still counts as a runtime error.
        const unexpected = harness.consoleErrors.filter(
            line => !line.includes('PRODUCTION_IMPORT_PRODUCER_RETIRED')
        );
        assert.deepEqual(unexpected, []);
        harness.consoleErrors.length = 0;
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
