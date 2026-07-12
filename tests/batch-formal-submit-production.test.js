const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    startBrowserApp,
    callProxy,
    seedReviewBatch,
    getDbSnapshot,
    clearE2eData,
    assertNoRuntimeErrors
} = require('./e2e/browser-harness.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const productionSubmitSource = () => {
    const source = read('app.js');
    const start = source.indexOf('const submitDraftQuestion = async');
    const end = source.indexOf('\n                const refreshBatchStats', start);
    assert.ok(start >= 0 && end > start, 'production submit function is present');
    return source.slice(start, end);
};

test('batch production submit delegates admission and persistence to owners', () => {
    const submit = productionSubmitSource();
    const owner = read('qisi-batch-formal-submit.js');
    assert.doesNotMatch(submit, /db\.questions\.(?:put|add|bulkPut|bulkAdd)\s*\(/);
    assert.match(submit, /batchFormalSubmit\.submit\s*\(/);
    assert.match(owner, /policy\.evaluateDraftAdmission\s*\(/);
    assert.match(owner, /repository\.confirmDraftToQuestion\s*\(/);
    assert.match(read('main.html'), /qisi-formal-admission-policy\.js/);
    assert.match(read('main.html'), /qisi-batch-formal-submit\.js/);
});

test('real AppProxy batch submit writes an admitted question v2 transactionally', {
    timeout: 90000
}, async () => {
    const harness = await startBrowserApp(32110);
    const { page } = harness;
    const batchId = 'formal_submit_production';

    try {
        await seedReviewBatch(page, { batchId, title: 'Formal submit production' });
        await page.evaluate(async id => {
            const db = new window.Dexie('QisiMathVueDB');
            await db.open();
            try {
                const draft = await db.table('draftQuestions').get(`${id}_q1`);
                const sourceId = `${id}_pdf`;
                draft.version = 1;
                draft.userEdited = true;
                draft.manualEdited = true;
                draft.source = {
                    mode: 'pdf-ai',
                    sourceId,
                    batchId: id,
                    filename: 'mock-support.pdf'
                };
                draft.fieldProvenance = Object.fromEntries([
                    'questionNumber', 'stem', 'options', 'answer', 'solution'
                ].map(field => [field, {
                    status: 'controlled-write',
                    sourceId,
                    controlledWriteAccepted: true,
                    controlledWriteDecisionId: `cw:${sourceId}:${field}`
                }]));
                draft.fieldProvenance.stem = {
                    status: 'manual',
                    sourceId,
                    manualEditRevision: 2
                };
                draft.fieldProvenance.images = { status: 'missing' };
                await db.table('draftQuestions').put(draft);
            } finally {
                db.close();
            }
        }, batchId);

        await callProxy(page, 'openBatchReview', batchId);
        await callProxy(page, 'markDraftReviewed');
        assert.equal(
            await callProxy(page, 'submitDraftQuestion', `${batchId}_q1`, true),
            true
        );

        const snapshot = await getDbSnapshot(page);
        const question = snapshot.questions.at(0);
        const draft = snapshot.drafts.find(item => item.id === `${batchId}_q1`);

        assert.equal(snapshot.questions.length, 1);
        assert.equal(question.schemaVersion, 'qisi.question.v2');
        assert.equal(question.source.mode, 'pdf-ai');
        assert.equal(question.admission.draftId, draft.id);
        assert.equal(question.admission.mode, 'pdf-ai');
        assert.equal(question.provenance.stem.status, 'manual');
        assert.equal(question.provenance.stem.manualEditRevision, 2);
        assert.equal(question.provenance.answer.status, 'controlled-write');
        assert.equal(
            question.provenance.answer.controlledWriteDecisionId,
            `cw:${batchId}_pdf:answer`
        );
        assert.equal(question.provenance.images.status, 'missing');
        assert.equal(draft.status, 'submitted');
        assert.equal(draft.admissionDecisionId, question.admission.decisionId);
        assert.ok(draft.admissionAudit.idempotencyKey);

        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally {
        await harness.close();
    }
});
