const test = require('node:test');
const assert = require('node:assert/strict');

const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

test('quota exceeded and corrupt preference data have stable errors', () => {
    const quota = Storage.createPreferenceFacade({
        getItem: () => null,
        setItem() {
            const error = new Error('quota full');
            error.name = 'QuotaExceededError';
            throw error;
        },
        removeItem() {}
    });
    assert.throws(
        () => quota.setJson('large', { value: 'x' }),
        error => error.code === 'quota-exceeded'
    );

    const corrupt = Storage.createPreferenceFacade({
        getItem: () => '{broken',
        setItem() {},
        removeItem() {}
    });
    assert.throws(
        () => corrupt.json('broken'),
        error => error.code === 'corrupt-data'
    );
});

test('backup version mismatch and corrupt table fail closed', () => {
    assert.throws(
        () => Storage.validateBackup({
            schemaVersion: 'qisi.storage.v999',
            tables: {}
        }),
        error => error.code === 'version-mismatch'
    );
    assert.throws(
        () => Storage.validateBackup({
            schemaVersion: Storage.BACKUP_SCHEMA_VERSION,
            tables: { questions: 'not-an-array' }
        }),
        error => error.code === 'corrupt-data'
    );
});

test('interrupted transaction rolls back question and image writes', async () => {
    const database = new FakeDatabase();
    database.failAfterWork = true;
    const repository = Storage.createRepository(database);

    await assert.rejects(
        repository.saveQuestion(
            { id: 'q1', stem: 'should rollback' },
            { imageRecords: [{ id: 'i1', blob: 'bytes' }] }
        ),
        error => error.code === 'interrupted-write'
    );
    assert.equal(await repository.get('questions', 'q1'), undefined);
    assert.equal(await repository.get('images', 'i1'), undefined);
});

test('duplicate id, stale two-tab update, and double confirm are distinct', async () => {
    let now = 10;
    const repository = Storage.createRepository(new FakeDatabase(), {
        clock: () => ++now
    });
    await repository.saveQuestion(
        { id: 'q1', stem: 'first' },
        { confirmationToken: 'confirm-1' }
    );

    await assert.rejects(
        repository.saveQuestion({ id: 'q1', stem: 'duplicate' }),
        error => error.code === 'duplicate-id'
    );
    await assert.rejects(
        repository.updateQuestion(
            'q1',
            { stem: 'stale writer' },
            { expectedUpdatedAt: 1 }
        ),
        error => error.code === 'write-conflict'
    );

    const secondConfirm = await repository.saveQuestion(
        { id: 'q1', stem: 'must not overwrite' },
        { confirmationToken: 'confirm-1' }
    );
    assert.equal(secondConfirm.idempotent, true);
    assert.equal(secondConfirm.question.stem, 'first');
});
