const test = require('node:test');
const assert = require('node:assert/strict');

const Review = require('../qisi-review-controller.js');
const Workflow = require('../qisi-review-workflow-service.js');

const clone = value => structuredClone(value);
const draft = (overrides = {}) => ({
    id: 'draft-1', batchId: 'batch-1', version: 1,
    status: 'pending', stem: 'Question', answer: 'A', images: [],
    ...overrides
});
const createHarness = ({
    initialDraft = draft(),
    validator = () => ({ valid: true, errors: [], warnings: [] }),
    mutateOnSubmit = true
} = {}) => {
    let state = {
        batch: { id: 'batch-1', draftPersistence: { version: 0 } },
        files: [],
        questions: [clone(initialDraft)],
        images: [{
            id: 'bound-image', batchId: 'batch-1',
            questionId: 'draft-1', status: 'bound', url: 'data:image/png;base64,AA=='
        }]
    };
    const persistence = {
        reloadDraftBatch: async () => clone(state),
        persistReviewDraftCommand: async command => {
            const index = state.questions.findIndex(item =>
                item.id === command.draft.id
            );
            state.questions[index] = {
                ...clone(command.draft),
                version: command.expectedDraftVersion + 1
            };
            return { draft: clone(state.questions[index]) };
        }
    };
    const reviewController = Review.createReviewController({
        validateDraft: validator,
        formalFields: ['stem', 'answer'],
        clock: () => 100
    });
    const formalCalls = [];
    const formalSubmit = {
        submit: async command => {
            formalCalls.push(clone({ ...command, signal: undefined }));
            if (mutateOnSubmit) {
                const target = state.questions.find(item =>
                    item.id === command.draftId
                );
                target.status = 'submitted';
                target.submittedQuestionId = 'question-1';
                target.admissionAudit = {
                    requestId: command.requestId,
                    idempotencyKey: command.idempotencyKey
                };
            }
            return {
                accepted: true,
                committed: { idempotent: false }
            };
        }
    };
    const service = Workflow.createReviewWorkflowService({
        persistence,
        reviewController,
        validateDraft: validator,
        normalizeDraft: value => ({ ...value, stem: value.stem.trim() }),
        formalSubmit,
        refreshBatchStats: async () => ({ counts: {} }),
        mergeImages: (left, right) => [...left, ...right],
        dataUrlToBlob: async value => `blob:${value}`,
        clock: () => 100
    });
    return { service, state: () => clone(state), formalCalls };
};

test('confirm reloads fresh draft, persists confirmation, and verifies readback', async () => {
    const harness = createHarness();
    const result = await harness.service.confirmDraft({
        batchId: 'batch-1', draftId: 'draft-1', expectedDraftVersion: 1
    });

    assert.equal(result.accepted, true);
    assert.equal(result.draft.status, 'reviewed');
    assert.equal(result.draft.version, 2);
});

test('confirm rejects stale and submitted drafts without mutation', async () => {
    await assert.rejects(
        createHarness().service.confirmDraft({
            batchId: 'batch-1', draftId: 'draft-1', expectedDraftVersion: 9
        }),
        error => error.code === 'REVIEW_WORKFLOW_STALE_DRAFT'
    );
    await assert.rejects(
        createHarness({ initialDraft: draft({ status: 'submitted' }) })
            .service.confirmDraft({
                batchId: 'batch-1', draftId: 'draft-1',
                expectedDraftVersion: 1
            }),
        error => error.code === 'REVIEW_WORKFLOW_SUBMITTED_IMMUTABLE'
    );
});

test('malformed validator fails closed before formal submission', async () => {
    const harness = createHarness({
        initialDraft: draft({ status: 'reviewed' }),
        validator: () => ({ valid: true, errors: 'not-an-array' })
    });
    await assert.rejects(
        harness.service.submitDraft({
            batchId: 'batch-1', draftId: 'draft-1', expectedDraftVersion: 1
        }),
        error => error.code === 'REVIEW_WORKFLOW_VALIDATOR_MALFORMED'
    );
    assert.equal(harness.formalCalls.length, 0);
});

test('single submit owns image payload, formal command, stats, and readback', async () => {
    const harness = createHarness({
        initialDraft: draft({
            status: 'reviewed',
            images: [{
                id: 'inline-image', url: 'data:image/png;base64,BB=='
            }]
        })
    });
    const result = await harness.service.submitDraft({
        batchId: 'batch-1', draftId: 'draft-1',
        expectedDraftVersion: 1, requestId: 'submit-1'
    });

    assert.equal(result.accepted, true);
    assert.equal(result.draft.status, 'submitted');
    assert.equal(harness.formalCalls.length, 1);
    assert.deepEqual(
        harness.formalCalls[0].imageRecords.map(image => image.id),
        ['inline-image', 'bound-image']
    );
    assert.equal(harness.formalCalls[0].draft, undefined);
});

test('cancellation and formal readback mismatch fail closed', async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
        createHarness({ initialDraft: draft({ status: 'reviewed' }) })
            .service.submitDraft({
                batchId: 'batch-1', draftId: 'draft-1',
                expectedDraftVersion: 1, signal: cancelled.signal
            }),
        error => error.code === 'REVIEW_WORKFLOW_CANCELLED'
    );
    await assert.rejects(
        createHarness({
            initialDraft: draft({ status: 'reviewed' }),
            mutateOnSubmit: false
        }).service.submitDraft({
            batchId: 'batch-1', draftId: 'draft-1', expectedDraftVersion: 1
        }),
        error => error.code === 'REVIEW_WORKFLOW_READBACK_MISMATCH'
    );
});
