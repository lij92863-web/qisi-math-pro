const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const {
    makeDraft,
    createRepository
} = require('./fixtures/formal-admission-transaction.js');

const attempt = (repository, draft, suffix) => {
    const requestId = `race-${suffix}`;
    const context = Policy.createAdmissionContext({
        mode: 'pdf-ai',
        actorId: 'teacher-1',
        explicitConfirmation: true,
        requestId,
        idempotencyKey: requestId,
        evaluatedAt: '2026-07-13T02:00:00.000Z',
        source: { sourceId: 'source-1', batchId: 'batch-1' }
    });
    const decision = Policy.evaluateDraftAdmission(draft, context);
    return repository.confirmDraftToQuestion(draft.id, decision, {
        expectedDraftVersion: draft.version,
        idempotencyKey: requestId,
        actorId: 'teacher-1',
        requestId,
        questionId: `question-${suffix}`,
        context
    });
};

test('concurrent equal drafts produce one commit and one stable duplicate rejection', async () => {
    const left = makeDraft({ id: 'draft-left' });
    const right = makeDraft({ id: 'draft-right', questionNumber: '2' });
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [left, right]
    }));

    const results = await Promise.allSettled([
        attempt(repository, left, 'left'),
        attempt(repository, right, 'right')
    ]);
    const fulfilled = results.filter(item => item.status === 'fulfilled');
    const rejected = results.filter(item => item.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, 'DUPLICATE_EXACT');
    assert.equal((await repository.listTable('questions')).length, 1);
    const drafts = await repository.listTable('draftQuestions');
    assert.equal(drafts.filter(item => item.status === 'submitted').length, 1);
    assert.equal(drafts.filter(item => item.status === 'reviewed').length, 1);
});
