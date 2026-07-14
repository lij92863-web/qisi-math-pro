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

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);

test('normal UI real PDF reaches projection and controlled-write without shadow candidates', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32117);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [
                { value: { questions: [{
                    questionNumber: '1',
                    type: '单选题',
                    stem: 'Which real PDF production statement is correct?',
                    options: {
                        A: 'First', B: 'Second', C: 'Third', D: 'Fourth'
                    },
                    answer: '',
                    solution: '',
                    images: [],
                    isFragment: false,
                    question_bbox: [0, 0, 1000, 1000]
                }] } },
                '1. 【答案】A\n【解析】First follows from the supplied PDF evidence.'
            ]
        });

        const imported = await createImportThroughUi(harness.page, {
            producerMode: 'pdf',
            files: [{ file: fixture('pdf-question.pdf'), roles: ['full'] }]
        });
        const batch = imported.snapshot.batches.find(
            row => row.id === imported.batchId
        );
        const drafts = imported.snapshot.drafts.filter(
            draft => draft.batchId === imported.batchId
        );
        assert.equal(batch.status, 'review', JSON.stringify({ batch, drafts }));
        assert.equal(drafts.length, 1);
        const draft = drafts[0];
        assert.equal(draft.source.format, 'pdf');
        assert.equal(draft.producer.mode, 'vision-ai');
        assert.equal(draft.producer.routeId, 'pdf-vision-controlled-write');
        assert.equal(draft.answer, 'A');
        assert.match(draft.solution, /supplied PDF evidence/);
        assert.equal(draft.controlledWrite.evaluated, true);
        assert.equal(draft.validation.ownershipValid, true);
        assert.equal(imported.snapshot.questions.length, 0);

        const stages = (await readImportStageTrace(
            harness.page,
            imported.batchId
        )).map(event => event.stage);
        const required = [
            'source-producer-entered',
            'page-rendered',
            'ocr-adapter-called',
            'parser-entered',
            'pdf-projection-entered',
            'controlled-write-evaluated',
            'validation-complete',
            'draft-persisted',
            'readback-verified'
        ];
        for (const stage of required) assert.ok(stages.includes(stage), stage);
        const indexes = required.map(stage => stages.indexOf(stage));
        assert.deepEqual(indexes, [...indexes].sort((left, right) => left - right));
        assert.ok(engine.calls.some(call =>
            call.endpoint === '/api/ai/chat' || call.endpoint === '/api/ai/ocr'
        ));
        assert.equal(engine.realApiCalled, false);
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
