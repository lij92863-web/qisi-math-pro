const test = require('node:test');
const assert = require('node:assert/strict');

const Maintenance = require('../qisi-draft-maintenance-service.js');

const clone = value => structuredClone(value);
const createHarness = ({ ignorePatch = false, writeError = null } = {}) => {
    let deleted = false;
    let state = {
        batch: {
            id: 'batch-1',
            status: 'review',
            draftPersistence: { version: 0 }
        },
        files: [{ id: 'file-1', batchId: 'batch-1' }],
        questions: [
            {
                id: 'draft-1', batchId: 'batch-1', version: 1,
                status: 'reviewed', type: '单选题',
                options: ['one', 'two'], stem: ' polluted ', answer: 'A',
                solution: 'solution', fieldProvenance: { stem: { status: 'manual' } }
            },
            {
                id: 'draft-2', batchId: 'batch-1', version: 1,
                status: 'submitted', type: '解答题', options: [], answer: ''
            }
        ],
        images: [{ id: 'image-1', batchId: 'batch-1', status: 'unassigned' }]
    };
    const persistence = {
        reloadDraftBatch: async () => {
            if (deleted) {
                throw Object.assign(new Error('missing'), {
                    code: 'DRAFT_BATCH_NOT_FOUND'
                });
            }
            return clone(state);
        },
        persistReviewDraftBatch: async command => {
            if (writeError) throw writeError;
            if (command.expectedVersion !== state.batch.draftPersistence.version) {
                throw Object.assign(new Error('version'), {
                    code: 'DRAFT_PERSISTENCE_VERSION_CONFLICT'
                });
            }
            state = {
                batch: {
                    ...state.batch,
                    ...(ignorePatch ? {} : command.batchPatch),
                    draftPersistence: {
                        version: command.expectedVersion + 1
                    }
                },
                files: clone(command.files),
                questions: clone(command.drafts),
                images: clone(command.images)
            };
            return { version: command.expectedVersion + 1 };
        },
        deleteDraftBatch: async () => {
            deleted = true;
            return { deleted: true, idempotent: false };
        }
    };
    const service = Maintenance.createDraftMaintenanceService({
        persistence,
        dedupeDrafts: (drafts, context) => ({
            drafts: drafts.slice(0, 1),
            draftImages: context.draftImages
        }),
        countOptions: options => options.length,
        problemsForDraft: draft => draft.options?.length === 2
            ? ['missing-options']
            : [],
        preserveRawEvidence: draft => {
            draft.rawEvidence = { stem: draft.stem };
        },
        cleanDisplayFields: draft => {
            if (typeof draft.stem === 'string') {
                draft.stem = draft.stem.trim();
            }
        },
        clock: () => 100
    });
    return { service, state: () => clone(state), deleted: () => deleted };
};

test('refreshBatchStats owns counts, patch persistence, and readback', async () => {
    const harness = createHarness();
    const result = await harness.service.refreshBatchStats({ batchId: 'batch-1' });

    assert.deepEqual(result.counts, {
        reviewedCount: 1,
        submittedCount: 1,
        problemCount: 1,
        unassignedImageCount: 1,
        status: 'review'
    });
    assert.equal(harness.state().batch.reviewedCount, 1);
    assert.equal(harness.state().batch.draftPersistence.version, 1);
});

test('dedupeBatchDrafts persists the single final-gate result', async () => {
    const harness = createHarness();
    const result = await harness.service.dedupeBatchDrafts({
        batchId: 'batch-1', files: []
    });

    assert.equal(result.beforeCount, 2);
    assert.equal(result.afterCount, 1);
    assert.equal(harness.state().questions.length, 1);
    assert.equal(harness.state().batch.problemCount, 1);
});

test('cleanup preserves raw evidence and field provenance', async () => {
    const harness = createHarness();
    const before = harness.state().questions[0].fieldProvenance;
    const result = await harness.service.cleanupDisplayFields({
        batchId: 'batch-1'
    });

    assert.equal(result.changedCount, 1);
    assert.equal(harness.state().questions[0].stem, 'polluted');
    assert.equal(harness.state().questions[0].rawEvidence.stem, ' polluted ');
    assert.deepEqual(harness.state().questions[0].fieldProvenance, before);
});

test('delete, cancellation, write failure, and readback mismatch fail closed', async () => {
    const harness = createHarness();
    await harness.service.deleteDraftBatch({ batchId: 'batch-1' });
    assert.equal(harness.deleted(), true);

    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
        createHarness().service.refreshBatchStats({
            batchId: 'batch-1', signal: cancelled.signal
        }),
        error => error.code === 'DRAFT_MAINTENANCE_CANCELLED'
    );
    await assert.rejects(
        createHarness({ writeError: new Error('write failed') })
            .service.refreshBatchStats({ batchId: 'batch-1' }),
        /write failed/
    );
    await assert.rejects(
        createHarness({ ignorePatch: true })
            .service.refreshBatchStats({ batchId: 'batch-1' }),
        error => error.code === 'DRAFT_MAINTENANCE_READBACK_MISMATCH'
    );
});
