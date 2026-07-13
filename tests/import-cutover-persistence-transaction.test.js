const test = require('node:test');
const assert = require('node:assert/strict');

const Persistence = require('../qisi-draft-persistence-service.js');
const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const command = signal => ({
    idempotencyKey: 'normal-ui:batch-1:source:1:draft:1',
    expectedVersion: 0,
    signal,
    batch: {
        id: 'batch-1', status: 'review', progress: 100,
        createdAt: 1, updatedAt: 2
    },
    files: [{
        id: 'file-1', batchId: 'batch-1', parseStatus: 'success'
    }],
    drafts: [{
        id: 'draft-1', batchId: 'batch-1', version: 1,
        order: 1, status: 'pending', stem: 'transaction candidate'
    }]
});

test('cancellation inside review persistence rolls back every draft table', async () => {
    const database = new FakeDatabase({
        draftImportBatches: [{
            id: 'batch-1', status: 'processing', progress: 85,
            draftPersistence: { version: 0 }
        }]
    });
    const repository = Storage.createRepository(database, { clock: () => 100 });
    const abortController = new AbortController();
    const table = database.table('draftQuestions');
    const originalBulkPut = table.bulkPut.bind(table);
    table.bulkPut = async values => {
        await originalBulkPut(values);
        abortController.abort();
    };

    await assert.rejects(
        Persistence.persistDraftBatch(
            command(abortController.signal), repository
        ),
        error => error.code === 'DRAFT_PERSISTENCE_WRITE_FAILED'
    );

    const loaded = await repository.loadDraftBatch('batch-1');
    assert.equal(loaded.batch.status, 'processing');
    assert.equal(loaded.batch.draftPersistence.version, 0);
    assert.deepEqual(loaded.questions, []);
    assert.deepEqual(loaded.files, []);
    assert.deepEqual(loaded.images, []);
});

test('a signal cancelled before persistence performs zero mutations', async () => {
    const database = new FakeDatabase({
        draftImportBatches: [{
            id: 'batch-1', status: 'processing', progress: 85,
            draftPersistence: { version: 0 }
        }]
    });
    const repository = Storage.createRepository(database);
    const abortController = new AbortController();
    abortController.abort();

    await assert.rejects(
        Persistence.persistDraftBatch(
            command(abortController.signal), repository
        ),
        error => error.code === 'DRAFT_PERSISTENCE_CANCELLED'
    );
    const loaded = await repository.loadDraftBatch('batch-1');
    assert.equal(loaded.batch.status, 'processing');
    assert.deepEqual(loaded.questions, []);
});
