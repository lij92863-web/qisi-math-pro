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

test('normal UI real DOCX files preserve deterministic and vision producer identities', {
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

        const vision = await createImportThroughUi(harness.page, {
            producerMode: 'docx-vision',
            files: [{ file: fixture('docx-vision.docx'), roles: ['question'] }]
        });
        const visionDrafts = vision.snapshot.drafts.filter(
            draft => draft.batchId === vision.batchId
        );
        assert.equal(visionDrafts.length, 1);
        const visionDraft = visionDrafts[0];
        assert.equal(visionDraft.source.format, 'docx');
        assert.equal(visionDraft.producer.mode, 'vision-ai');
        assert.equal(
            visionDraft.producer.routeId,
            Contract.ROUTES.DOCX_VISION
        );
        assert.equal(visionDraft.controlledWrite.evaluated, true);
        assert.equal(
            Contract.validateCanonicalIdentity(visionDraft).valid,
            true
        );
        const visionStages = await stageNames(harness.page, vision.batchId);
        for (const stage of [
            'source-producer-entered',
            'document-converted',
            'page-rendered',
            'ocr-adapter-called',
            'parser-entered',
            'validation-complete',
            'draft-persisted',
            'readback-verified'
        ]) assert.ok(visionStages.includes(stage), stage);

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
        assert.notEqual(
            visionDraft.producer.mode,
            deterministicDraft.producer.mode,
            'non-applicable-different-producers'
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
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
