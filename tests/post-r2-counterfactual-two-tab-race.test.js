const test = require('node:test');
const assert = require('node:assert/strict');
const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const { makeDraft, makeContext, createRepository, options } = require('./fixtures/formal-admission-transaction.js');

test('Phase 3 two-tab race cannot confirm a draft twice', async () => {
    const draft = makeDraft();
    const repository = createRepository(new FakeDatabase({ draftQuestions: [draft] }));
    const firstContext = makeContext('tab-1');
    await repository.confirmDraftToQuestion(draft.id, Policy.evaluateDraftAdmission(draft, firstContext), options({ idempotencyKey: 'tab-1', context: firstContext }));
    const secondContext = makeContext('tab-2');
    await assert.rejects(
        repository.confirmDraftToQuestion(draft.id, Policy.evaluateDraftAdmission(draft, secondContext), options({ idempotencyKey: 'tab-2', questionId: 'question-2', context: secondContext })),
        error => error.code === 'draft-already-confirmed'
    );
    assert.equal((await repository.listTable('questions')).length, 1);
});
