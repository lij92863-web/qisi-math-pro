const test = require('node:test');
const assert = require('node:assert/strict');
const Storage = require('../qisi-storage-repository');
const { FakeDatabase } = require('./storage-test-harness');
// IndexedDB serializes read-write transactions touching the same object stores.
class SerialDatabase extends FakeDatabase {
    tail = Promise.resolve();
    transaction(...args) {
        const run = this.tail.then(() => super.transaction(...args));
        this.tail = run.catch(() => {}); return run;
    }
}
test('concurrent saves with one ID cannot both pass the existence check', async () => {
    const database = new SerialDatabase();
    const repository = Storage.createRepository(database, { clock: () => 20 });
    const results = await Promise.allSettled([
        repository.saveQuestion({ id: 'same', stem: 'first' }),
        repository.saveQuestion({ id: 'same', stem: 'second' })
    ]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.code, 'duplicate-id');
    assert.equal((await repository.get('questions', 'same')).stem, 'first');
});
test('concurrent optimistic updates cannot overwrite the fresh transaction version', async () => {
    let clock = 10;
    const database = new SerialDatabase({ questions: [{ id: 'q', stem: 'old', updatedAt: 1 }] });
    const repository = Storage.createRepository(database, { clock: () => ++clock });
    const results = await Promise.allSettled([
        repository.updateQuestion('q', { stem: 'first' }, { expectedUpdatedAt: 1 }),
        repository.updateQuestion('q', { stem: 'second' }, { expectedUpdatedAt: 1 })
    ]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.code, 'write-conflict');
    assert.equal((await repository.get('questions', 'q')).stem, 'first');
});
test('same confirmation token is idempotent across concurrent saves', async () => {
    const repository = Storage.createRepository(new SerialDatabase(), { clock: () => 10 });
    const results = await Promise.all([
        repository.saveQuestion({ id: 'q', stem: 'first' }, { confirmationToken: 'same-token' }),
        repository.saveQuestion({ id: 'q', stem: 'second' }, { confirmationToken: 'same-token' })
    ]);
    assert.equal(results[0].idempotent, false); assert.equal(results[1].idempotent, true);
    assert.equal(results[1].question.stem, 'first');
});
