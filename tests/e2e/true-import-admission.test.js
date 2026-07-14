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
const questionEnvelope = {
    value: { questions: [{
        questionNumber: '1', type: '单选题',
        stem: 'Admission production question.',
        options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth' },
        answer: '', solution: '', images: [], isFragment: false,
        question_bbox: [0, 0, 1000, 1000]
    }] }
};
const validResponses = () => [
    questionEnvelope,
    '1. 【答案】A\n【解析】First is supported by evidence.'
];

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

test('actual manual answer edit becomes the only manual formal provenance', {
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
        await callProxy(harness.page, 'markDraftReviewed');
        const reviewed = await getDbSnapshot(harness.page);
        const draft = reviewed.drafts.find(item => item.batchId === batchId);
        assert.equal(draft.fieldProvenance.answer.status, 'manual');
        assert.equal(draft.fieldProvenance.stem.status, 'controlled-write');
        assert.equal(
            await callProxy(harness.page, 'submitDraftQuestion', draft.id, true),
            true
        );
        const submitted = await getDbSnapshot(harness.page);
        assert.equal(submitted.questions[0].provenance.answer.status, 'manual');
        assert.equal(
            submitted.questions[0].provenance.stem.status,
            'controlled-write'
        );
    } finally {
        await harness.close();
    }
});

test('untouched confirmation preserves controlled-write evidence', {
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
        await callProxy(harness.page, 'markDraftReviewed');
        const reviewed = await getDbSnapshot(harness.page);
        const after = reviewed.drafts.find(item => item.batchId === batchId);
        assert.equal(after.manualConfirmed, true);
        assert.notEqual(after.manualEdited, true);
        assert.deepEqual(after.fieldProvenance, before.fieldProvenance);
        assert.equal(
            await callProxy(harness.page, 'submitDraftQuestion', after.id, true),
            true
        );
        const submitted = await getDbSnapshot(harness.page);
        assert.equal(submitted.questions.length, 1);
        assert.equal(
            submitted.questions[0].provenance.stem.status,
            'controlled-write'
        );
        assert.equal(harness.forbiddenRequests.length, 0);
    } finally {
        await harness.close();
    }
});
