const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
    startBrowserApp,
    callProxy,
    installBrowserEngineInjection,
    createImportThroughUi,
    getDbSnapshot,
    clearE2eData
} = require('./browser-harness.js');

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'true-import');
const fixture = name => path.join(FIXTURES, name);
const pdfFile = () => ({ file: fixture('pdf-question.pdf'), roles: ['full'] });
const pdfQuestion = (question_no='1', stem='Production question 1.') => ({question_no,type:'single',stem,options:['First','Second','Third','Fourth'].map((text,i)=>({label:String.fromCharCode(65+i),text})),figures:[],source_pages:[1],status:'complete',warnings:[]});
const pdfAnswer = (question_no='1',answer='A',status='complete') => ({question_no,answer,figures:[],source_pages:[1],status,warnings:[]});
const pdfSolution = (question_no='1',solution='First is correct.') => ({question_no,solution,figures:[],source_pages:[1],status:'complete',warnings:[]});
const pdfResponse=(questions=[],answers=[],solutions=[])=>({value:{questions,answers,solutions}});
const validResponses=()=>[pdfResponse([pdfQuestion()],[pdfAnswer()],[pdfSolution('1','First is supported by evidence.')])];

test('malformed raw engine JSON is rejected before ReviewDraft persistence', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32314);
    try {
        await clearE2eData(harness.page);
        const engine = await installBrowserEngineInjection(harness.page, {
            responses: ['{"questions": [malformed]']
        });
        const { batchId, snapshot } = await createImportThroughUi(
            harness.page,
            { producerMode: 'pdf', files: [pdfFile()] }
        );
        assert.equal(
            snapshot.batches.find(item => item.id === batchId).status,
            'failed'
        );
        assert.equal(snapshot.drafts.some(item => item.batchId === batchId), false);
        assert.equal(snapshot.questions.length, 0);
        assert.equal(engine.realApiCalled, false);
    } finally {
        await harness.close();
    }
});

test('a manual answer edit is the only field that becomes manual', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32315);
    try {
        await clearE2eData(harness.page);
        await installBrowserEngineInjection(harness.page, {
            responses: validResponses()
        });
        const { batchId } = await createImportThroughUi(harness.page, {
            producerMode: 'pdf', files: [pdfFile()]
        });
        await callProxy(harness.page, 'openBatchReview', batchId);
        await callProxy(harness.page, 'updateDraftQuestionField', 'answer', 'B');
        const edited = await getDbSnapshot(harness.page);
        const draft = edited.drafts.find(item => item.batchId === batchId);
        assert.equal(draft.fieldProvenance.answer.status, 'manual');
        // Machine candidates that the teacher did not touch keep their pending
        // machine status; an edit never silently upgrades another field.
        assert.equal(draft.fieldProvenance.stem.status, 'rejected');
        assert.notEqual(draft.fieldProvenance.stem.status, 'manual');
        assert.equal(
            await callProxy(harness.page, 'submitDraftQuestion', draft.id, true),
            false,
            'a draft with unadopted fields must not enter the question bank'
        );
        assert.equal((await getDbSnapshot(harness.page)).questions.length, 0);
    } finally {
        await harness.close();
    }
});

test('untouched confirmation keeps machine provenance and blocks formal admission', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32319);
    try {
        await clearE2eData(harness.page);
        await installBrowserEngineInjection(harness.page, {
            responses: validResponses()
        });
        const { batchId, snapshot } = await createImportThroughUi(
            harness.page,
            { producerMode: 'pdf', files: [pdfFile()] }
        );
        const before = snapshot.drafts.find(item => item.batchId === batchId);
        await callProxy(harness.page, 'openBatchReview', batchId);
        const after = (await getDbSnapshot(harness.page)).drafts.find(item => item.id === before.id);
        assert.deepEqual(after.fieldProvenance, before.fieldProvenance);
        assert.equal(
            await callProxy(harness.page, 'submitDraftQuestion', after.id, true),
            false
        );
        const submitted = await getDbSnapshot(harness.page);
        assert.equal(submitted.questions.length, 0);
        assert.equal(harness.forbiddenRequests.length, 0);
    } finally {
        await harness.close();
    }
});
