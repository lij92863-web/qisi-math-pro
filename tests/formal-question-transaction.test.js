const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-formal-admission-policy.js');
const Contracts = require('../qisi-recognition-contracts.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const {
    makeDraft,
    makeContext,
    createRepository,
    options
} = require('./fixtures/formal-admission-transaction.js');

test('confirmDraftToQuestion atomically writes v2 and marks the draft', async () => {
    const draft = makeDraft();
    const database = new FakeDatabase({
        draftQuestions: [draft],
        draftImportBatches: [{ id: 'batch-1', submittedCount: 0 }]
    });
    const repository = createRepository(database);
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    const result = await repository.confirmDraftToQuestion(
        draft.id,
        decision,
        options()
    );
    assert.equal(result.idempotent, false);
    assert.equal(result.question.schemaVersion, 'qisi.question.v2');
    assert.equal(Contracts.validateQuestionV2(result.question).valid, true);
    assert.equal((await repository.get('draftQuestions', draft.id)).status, 'submitted');
    assert.equal((await repository.get('draftQuestions', draft.id)).submittedQuestionId, 'question-1');
    assert.equal((await repository.get('draftImportBatches', 'batch-1')).submittedCount, 1);
});

test('missing draft fails without a formal write', async () => {
    const repository = createRepository(new FakeDatabase());
    await assert.rejects(
        repository.confirmDraftToQuestion(
            'missing',
            { accepted: true },
            options()
        ),
        error => error.code === 'draft-missing'
    );
    assert.equal(await repository.get('questions', 'question-1'), undefined);
});

test('invalid admission fails before any write', async () => {
    const draft = makeDraft();
    draft.fieldProvenance.answer = {
        status: 'rejected', reasonCode: 'ownership-invalid'
    };
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [draft]
    }));
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(
        repository.confirmDraftToQuestion(draft.id, decision, options()),
        error => error.code === 'admission-invalid'
    );
    assert.equal(await repository.get('questions', 'question-1'), undefined);
    assert.equal((await repository.get('draftQuestions', draft.id)).status, 'reviewed');
});

test('quota failure rolls back question, image, and draft state', async () => {
    const draft = makeDraft({ images: [{ id: 'image-1' }] });
    draft.fieldProvenance.images = {
        status: 'controlled-write',
        sourceId: 'source-1',
        controlledWriteAccepted: true,
        controlledWriteDecisionId: 'cw-images'
    };
    const database = new FakeDatabase({ draftQuestions: [draft] });
    const questions = database.table('questions');
    questions.put = async () => {
        const error = new Error('quota full');
        error.name = 'QuotaExceededError';
        throw error;
    };
    const repository = createRepository(database);
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(
        repository.confirmDraftToQuestion(draft.id, decision, options({
            imageRecords: [{ id: 'image-1', blob: 'bytes' }]
        })),
        error => error.code === 'quota-exceeded'
    );
    assert.equal(await repository.get('questions', 'question-1'), undefined);
    assert.equal(await repository.get('images', 'image-1'), undefined);
    assert.equal((await repository.get('draftQuestions', draft.id)).status, 'reviewed');
});

test('transaction abort rolls back every partial write', async () => {
    const draft = makeDraft();
    const database = new FakeDatabase({ draftQuestions: [draft] });
    database.failAfterWork = true;
    const repository = createRepository(database);
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(
        repository.confirmDraftToQuestion(draft.id, decision, options()),
        error => error.code === 'interrupted-write'
    );
    database.failAfterWork = false;
    assert.equal(await repository.get('questions', 'question-1'), undefined);
    assert.equal((await repository.get('draftQuestions', draft.id)).status, 'reviewed');
});

test('duplicate question ID fails and leaves the draft unsubmitted', async () => {
    const draft = makeDraft();
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [draft],
        questions: [{ id: 'question-1', stem: 'existing' }]
    }));
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(
        repository.confirmDraftToQuestion(draft.id, decision, options()),
        error => error.code === 'duplicate-id'
    );
    assert.equal((await repository.get('questions', 'question-1')).stem, 'existing');
    assert.equal((await repository.get('draftQuestions', draft.id)).status, 'reviewed');
});
