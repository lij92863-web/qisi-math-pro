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

const pdfQuestion = (question_no='1', stem='Production question 1.') => ({question_no,type:'single',stem,options:['First','Second','Third','Fourth'].map((text,i)=>({label:String.fromCharCode(65+i),text})),figures:[],source_pages:[1],status:'complete',warnings:[]});
const pdfAnswer = (question_no='1',answer='A',status='complete') => ({question_no,answer,figures:[],source_pages:[1],status,warnings:[]});
const pdfSolution = (question_no='1',solution='First is correct.') => ({question_no,solution,figures:[],source_pages:[1],status:'complete',warnings:[]});
const pdfResponse=(questions=[],answers=[],solutions=[])=>({value:{questions,answers,solutions}});
test('true producer smoke enters PDF V2 structured canonical validation', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32318);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [pdfResponse([pdfQuestion('1','Prove the PDF production statement.')],[pdfAnswer()],[pdfSolution('1','Alpha is correct by the supplied evidence.')])]
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
        assert.equal(drafts[0].fieldProvenance.stem.controlledWriteAccepted, true);
        const stages = (await readImportStageTrace(
            harness.page,
            result.batchId
        )).map(event => event.stage);
        assert.equal(stages.includes('page-rendered'), false);
        assert.equal(stages.includes('ocr-adapter-called'), false);
        assert.equal(stages.includes('pdf-projection-entered'), false);
        assert.equal(stages.includes('controlled-write-evaluated'), false);
        assert.ok(stages.includes('pdf-external-contract-validated'));
        assert.equal(engine.realApiCalled, false);
    } finally {
        await harness.close();
    }
});
