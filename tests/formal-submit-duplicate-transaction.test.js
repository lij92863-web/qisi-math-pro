const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const {
    makeDraft,
    createRepository
} = require('./fixtures/formal-admission-transaction.js');

const context = requestId => Policy.createAdmissionContext({
    mode: 'pdf-ai',
    actorId: 'teacher-1',
    explicitConfirmation: true,
    requestId,
    idempotencyKey: requestId,
    evaluatedAt: '2026-07-13T02:00:00.000Z',
    source: { sourceId: 'source-1', batchId: 'batch-1' }
});
const confirmation = (draft, requestId, questionId) => {
    const admissionContext = context(requestId);
    return {
        decision: Policy.evaluateDraftAdmission(draft, admissionContext),
        options: {
            expectedDraftVersion: draft.version,
            idempotencyKey: requestId,
            actorId: 'teacher-1',
            requestId,
            questionId,
            context: admissionContext
        }
    };
};

const commit = (repository, draft, requestId, questionId) => {
    const input = confirmation(draft, requestId, questionId);
    return repository.confirmDraftToQuestion(
        draft.id,
        input.decision,
        input.options
    );
};

test('transaction boundary rejects exact, similar, and answer-conflict duplicates', async () => {
    const first = makeDraft({ id: 'draft-first' });
    const exact = makeDraft({ id: 'draft-exact', questionNumber: '2' });
    const similar = makeDraft({
        id: 'draft-similar',
        questionNumber: '3',
        options: ['one', 'two', 'three']
    });
    const conflict = makeDraft({
        id: 'draft-conflict',
        questionNumber: '4',
        answer: 'B'
    });
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [first, exact, similar, conflict]
    }));

    await commit(repository, first, 'request-first', 'question-first');
    await assert.rejects(
        commit(repository, exact, 'request-exact', 'question-exact'),
        error => error.code === 'DUPLICATE_EXACT'
    );
    await assert.rejects(
        commit(repository, similar, 'request-similar', 'question-similar'),
        error => error.code === 'DUPLICATE_SIMILAR'
    );
    await assert.rejects(
        commit(repository, conflict, 'request-conflict', 'question-conflict'),
        error => error.code === 'DUPLICATE_ANSWER_CONFLICT'
    );

    assert.equal((await repository.listTable('questions')).length, 1);
    for (const id of ['draft-exact', 'draft-similar', 'draft-conflict']) {
        assert.equal((await repository.loadDraft(id)).status, 'reviewed');
    }
});

test('repository ignores a stale pre-commit duplicate view and checks fresh rows', async () => {
    const first = makeDraft({ id: 'draft-first' });
    const second = makeDraft({ id: 'draft-second', questionNumber: '2' });
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [first, second]
    }));
    const staleSecond = confirmation(
        second,
        'request-second',
        'question-second'
    );

    await commit(repository, first, 'request-first', 'question-first');
    await assert.rejects(
        repository.confirmDraftToQuestion(
            second.id,
            staleSecond.decision,
            staleSecond.options
        ),
        error => error.code === 'DUPLICATE_EXACT'
    );
    assert.equal((await repository.listTable('questions')).length, 1);
});

test('idempotent retry wins before duplicate evaluation', async () => {
    const draft = makeDraft();
    const repository = createRepository(new FakeDatabase({
        draftQuestions: [draft]
    }));
    const first = await commit(repository, draft, 'request-one', 'question-one');
    const retry = await commit(repository, draft, 'request-one', 'question-other');

    assert.equal(first.idempotent, false);
    assert.equal(retry.idempotent, true);
    assert.equal(retry.question.id, 'question-one');
    assert.equal((await repository.listTable('questions')).length, 1);
});
