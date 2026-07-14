const test = require('node:test');
const assert = require('node:assert/strict');

const Workflow = require('../qisi-review-workflow-service.js');

test('reviewed batch submit is partial, retryable, and per-item idempotent', async () => {
    const drafts = [
        { id: 'draft-1', batchId: 'batch-1', version: 1, status: 'reviewed', answer: 'A' },
        { id: 'draft-2', batchId: 'batch-1', version: 1, status: 'reviewed', answer: 'B' }
    ];
    let failSecond = true;
    const calls = [];
    const persistence = {
        reloadDraftBatch: async () => ({
            batch: { id: 'batch-1' }, files: [], images: [],
            questions: structuredClone(drafts)
        }),
        persistReviewDraftCommand: async () => {
            throw new Error('not used');
        }
    };
    const service = Workflow.createReviewWorkflowService({
        persistence,
        reviewController: { confirm: () => ({ accepted: false }) },
        validateDraft: () => ({ valid: true, errors: [], warnings: [] }),
        normalizeDraft: value => value,
        formalSubmit: {
            submit: async command => {
                calls.push(command.draftId);
                if (command.draftId === 'draft-2' && failSecond) {
                    failSecond = false;
                    throw Object.assign(new Error('temporary'), {
                        code: 'TEMPORARY_FORMAL_FAILURE'
                    });
                }
                const target = drafts.find(item => item.id === command.draftId);
                target.status = 'submitted';
                target.submittedQuestionId = `question-${target.id}`;
                target.admissionAudit = {
                    requestId: command.requestId,
                    idempotencyKey: command.idempotencyKey
                };
                return { accepted: true, committed: { idempotent: false } };
            }
        },
        refreshBatchStats: async () => ({ counts: {} }),
        mergeImages: (left, right) => [...left, ...right],
        dataUrlToBlob: async value => value
    });

    const first = await service.submitReviewedBatch({
        batchId: 'batch-1',
        draftIds: ['draft-1', 'draft-2'],
        requestId: 'batch-request'
    });
    assert.equal(first.okCount, 1);
    assert.equal(first.failedCount, 1);
    assert.equal(first.results[1].code, 'TEMPORARY_FORMAL_FAILURE');

    const retry = await service.submitReviewedBatch({
        batchId: 'batch-1',
        draftIds: ['draft-1', 'draft-2'],
        requestId: 'batch-request'
    });
    assert.equal(retry.okCount, 2);
    assert.equal(retry.failedCount, 0);
    assert.equal(retry.results[0].idempotent, true);
    assert.deepEqual(calls, ['draft-1', 'draft-2', 'draft-2']);
});
