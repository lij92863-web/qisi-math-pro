const test = require('node:test');
const assert = require('node:assert/strict');

const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

test('batch writes never drop a submitted draft row', async () => {
    const submitted = {
        id: 'draft-1', batchId: 'batch-1', status: 'submitted',
        submittedQuestionId: 'formal-1', questionNumber: 7, order: 1
    };
    const reviewed = {
        id: 'draft-2', batchId: 'batch-1', status: 'reviewed', order: 2
    };
    const database = new FakeDatabase({
        draftImportBatches: [{ id: 'batch-1', draftPersistence: { version: 0 } }],
        draftQuestions: [submitted, reviewed]
    });
    const repository = Storage.createRepository(database, { clock: () => 100 });
    const batch = { id: 'batch-1', draftPersistence: { version: 1 } };

    await assert.rejects(
        repository.persistReviewDraftBatch({
            batch, drafts: [reviewed], images: [], expectedVersion: 0
        }),
        error => error.code === 'draft-submitted-row-loss' &&
            error.details.lost.length === 1 &&
            error.details.lost[0].id === 'draft-1' &&
            error.details.lost[0].questionNumber === 7 &&
            error.details.lost[0].submittedQuestionId === 'formal-1'
    );
    assert.equal((await repository.loadDraft('draft-1')).status, 'submitted');

    const kept = await repository.persistReviewDraftBatch({
        batch, drafts: [submitted, reviewed], images: [], expectedVersion: 0
    });
    assert.equal(kept.draftCount, 2);
    assert.equal((await repository.loadDraft('draft-1')).status, 'submitted');
});
