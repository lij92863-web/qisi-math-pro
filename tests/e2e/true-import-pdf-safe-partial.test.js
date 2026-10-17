const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    installBrowserEngineInjection,
    createImportThroughUi,
    clearE2eData,
    readImportStageTrace
} = require('./browser-harness.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);
const pdfQuestion = (question_no='1', stem='Production question 1.') => ({question_no,type:'single',stem,options:['First','Second','Third','Fourth'].map((text,i)=>({label:String.fromCharCode(65+i),text})),figures:[],source_pages:[1],status:'complete',warnings:[]});
const pdfAnswer = (question_no='1',answer='A',status='complete') => ({question_no,answer,figures:[],source_pages:[1],status,warnings:[]});
const pdfSolution = (question_no='1',solution='First is correct.') => ({question_no,solution,figures:[],source_pages:[1],status:'complete',warnings:[]});
const pdfResponse=(questions=[],answers=[],solutions=[])=>({value:{questions,answers,solutions}});
test('true dual PDF V2 directly structures and exact-key attaches support without a parser', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32313);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: [
                pdfResponse([pdfQuestion()]),
                pdfResponse([], [pdfAnswer()], [pdfSolution('1','First is structured support.')])
            ]
        });
        const { batchId, snapshot } = await createImportThroughUi(
            harness.page,
            {
                producerMode: 'pdf',
                files: [
                    { file: fixture('pdf-question.pdf'), roles: ['question'] },
                    {
                        file: fixture('pdf-solution.pdf'),
                        roles: ['answer', 'solution']
                    }
                ]
            }
        );
        const drafts = snapshot.drafts.filter(item => item.batchId === batchId);
        assert.equal(drafts.length, 1);
        assert.equal(drafts[0].producer.routeId, 'pdf-external-v2');
        assert.equal(drafts[0].answer, 'A');
        assert.equal(drafts[0].fieldProvenance.answer.controlledWriteAccepted, true);
        assert.notEqual(drafts[0].fieldProvenance.answer.sourceId, drafts[0].source.sourceId);
        assert.equal(snapshot.questions.length, 0);
        const stages = (await readImportStageTrace(harness.page, batchId))
            .map(event => event.stage);
        assert.ok(stages.includes('pdf-external-contract-validated'));
        assert.equal(stages.includes('pdf-projection-entered'), false);
        assert.equal(stages.includes('parser-entered'), false);
        assert.equal(engine.realApiCalled, false);
        assert.equal(harness.forbiddenRequests.length, 0);
    } finally {
        await harness.close();
    }
});
