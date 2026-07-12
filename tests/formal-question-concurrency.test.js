const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const {
    makeDraft,
    makeContext,
    createRepository,
    options
} = require('./fixtures/formal-admission-transaction.js');

test('same idempotency key returns the original committed question', async () => {
    const draft = makeDraft();
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [draft]
    }));
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    const first = await repository.confirmDraftToQuestion(
        draft.id, decision, options()
    );
    const second = await repository.confirmDraftToQuestion(
        draft.id, decision, options()
    );
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.equal(second.question.id, first.question.id);
    assert.equal((await repository.listTable('questions')).length, 1);
});

test('stale draft version is rejected before admission or write', async () => {
    const draft = makeDraft({ version: 2 });
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [draft]
    }));
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(
        repository.confirmDraftToQuestion(
            draft.id,
            decision,
            options({ expectedDraftVersion: 1 })
        ),
        error => error.code === 'draft-version-conflict'
    );
    assert.deepEqual(await repository.listTable('questions'), []);
});

test('second tab with a different key cannot submit the same draft twice', async () => {
    const draft = makeDraft();
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [draft]
    }));
    const firstContext = makeContext('tab-1');
    const firstDecision = Policy.evaluateDraftAdmission(draft, firstContext);
    await repository.confirmDraftToQuestion(
        draft.id,
        firstDecision,
        options({
            idempotencyKey: 'tab-1',
            context: firstContext
        })
    );

    const secondContext = makeContext('tab-2');
    const secondDecision = Policy.evaluateDraftAdmission(draft, secondContext);
    await assert.rejects(
        repository.confirmDraftToQuestion(
            draft.id,
            secondDecision,
            options({
                idempotencyKey: 'tab-2',
                questionId: 'question-2',
                context: secondContext
            })
        ),
        error => error.code === 'draft-already-confirmed'
    );
    assert.equal((await repository.listTable('questions')).length, 1);
});
