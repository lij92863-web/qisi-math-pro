const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    createImportThroughUi,
    clearE2eData,
    installBrowserEngineInjection,
    readImportStageTrace
} = require('./browser-harness.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);

test('true producer smoke enters deterministic DOCX+DOCX stable chain from normal UI', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32316);
    try {
        await clearE2eData(harness.page);
        const result = await createImportThroughUi(harness.page, {
            producerMode: 'docx-deterministic',
            files: [
                { file: fixture('docx-question.docx'), roles: ['question'] },
                { file: fixture('docx-answer.docx'), roles: ['answer'] },
                { file: fixture('docx-solution.docx'), roles: ['solution'] }
            ]
        });
        const batch = result.snapshot.batches.find(row =>
            row.id === result.batchId
        );
        assert.equal(
            batch.status,
            'review',
            JSON.stringify({ batch, drafts: result.snapshot.drafts })
        );
        const drafts = result.snapshot.drafts.filter(draft =>
            draft.batchId === result.batchId
        );
        assert.equal(drafts.length, 1);
        assert.equal(drafts[0].answer, 'A');
        assert.match(drafts[0].solution, /declared stable answer/);
        assert.notEqual(
            drafts[0].fieldProvenance.answer.sourceId,
            drafts[0].source.sourceId
        );
        const stages = (await readImportStageTrace(
            harness.page,
            result.batchId
        )).map(event => event.stage);
        assert.ok(
            stages.includes('source-producer-entered'),
            JSON.stringify(await readImportStageTrace(harness.page))
        );
        assert.ok(stages.includes('parser-entered'));
        assert.ok(stages.includes('draft-persisted'));
        assert.ok(stages.includes('readback-verified'));
    } finally {
        await harness.close();
    }
});

test('true producer smoke enters DOCX conversion and vision adapter', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32317);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [{ value: {
                questions: [{
                    questionNumber: '1',
                    type: '\u5355\u9009\u9898',
                    stem: 'Which vision statement is correct?',
                    options: {
                        A: 'First', B: 'Second', C: 'Third', D: 'Fourth'
                    },
                    answer: '', solution: '', images: [],
                    isFragment: false,
                    question_bbox: [0, 0, 1000, 1000]
                }]
            } }]
        });
        const result = await createImportThroughUi(harness.page, {
            producerMode: 'docx-vision',
            files: [{
                file: fixture('docx-vision.docx'),
                roles: ['question']
            }]
        });
        const batch = result.snapshot.batches.find(row =>
            row.id === result.batchId
        );
        assert.equal(batch.status, 'review', JSON.stringify({
            batch,
            calls: engine.calls,
            forbiddenRequests: harness.forbiddenRequests,
            stages: await readImportStageTrace(harness.page, result.batchId)
        }));
        assert.ok(engine.calls.some(call =>
            ['chat', 'ocr'].includes(call.endpoint.split('/').at(-1))
        ));
        const stages = (await readImportStageTrace(
            harness.page,
            result.batchId
        )).map(event => event.stage);
        assert.ok(stages.includes('document-converted'));
        assert.ok(stages.includes('page-rendered'));
        assert.ok(stages.includes('ocr-adapter-called'));
        assert.equal(engine.realApiCalled, false);
    } finally {
        await harness.close();
    }
});

test('true producer smoke enters PDF projection and controlled-write', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32318);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [
                { value: { questions: [{
                    questionNumber: '1', type: '\u5355\u9009\u9898',
                    stem: 'Prove the PDF production statement.',
                    options: {
                        A: 'First', B: 'Second', C: 'Third', D: 'Fourth'
                    },
                    answer: '', solution: '', images: [], isFragment: false,
                    question_bbox: [0, 0, 1000, 1000]
                }] } },
                '1. \u3010\u7b54\u6848\u3011A\n\u3010\u89e3\u6790\u3011Alpha is correct by the supplied evidence.'
            ]
        });
        const result = await createImportThroughUi(harness.page, {
            producerMode: 'pdf',
            files: [{
                file: fixture('pdf-question.pdf'),
                roles: ['full']
            }]
        });
        const batch = result.snapshot.batches.find(row =>
            row.id === result.batchId
        );
        const drafts = result.snapshot.drafts.filter(draft =>
            draft.batchId === result.batchId
        );
        assert.equal(batch.status, 'review', JSON.stringify({
            batch, drafts, calls: engine.calls,
            stages: await readImportStageTrace(harness.page, result.batchId)
        }));
        assert.equal(drafts.length, 1);
        assert.equal(drafts[0].answer, 'A');
        assert.match(drafts[0].solution, /Alpha is correct/);
        assert.equal(drafts[0].controlledWrite?.evaluated, true);
        const stages = (await readImportStageTrace(
            harness.page,
            result.batchId
        )).map(event => event.stage);
        assert.ok(stages.includes('page-rendered'));
        assert.ok(stages.includes('ocr-adapter-called'));
        assert.ok(stages.includes('pdf-projection-entered'));
        assert.ok(stages.includes('controlled-write-evaluated'));
        assert.equal(engine.realApiCalled, false);
    } finally {
        await harness.close();
    }
});
