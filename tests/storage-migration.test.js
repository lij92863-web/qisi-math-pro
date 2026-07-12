const test = require('node:test');
const assert = require('node:assert/strict');

const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const memoryStorage = () => {
    const values = new Map();
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
};

test('preference facade owns JSON serialization without mutating values', () => {
    const preferences = Storage.createPreferenceFacade(memoryStorage());
    const value = { cart: ['q1'], nested: { enabled: true } };
    const before = structuredClone(value);

    assert.equal(preferences.setJson('settings', value), true);
    value.nested.enabled = false;

    assert.deepEqual(preferences.json('settings'), before);
    preferences.remove('settings');
    assert.deepEqual(preferences.json('settings', { fallback: true }), {
        fallback: true
    });
});

test('versioned backup round-trip restores every known table', async () => {
    const source = Storage.createRepository(new FakeDatabase({
        questions: [{ id: 'q1', stem: 'backup' }],
        images: [{ id: 'i1', blob: 'bytes' }]
    }), { clock: () => 0 });
    const backup = await source.createBackup();

    assert.equal(backup.schemaVersion, Storage.BACKUP_SCHEMA_VERSION);
    const target = Storage.createRepository(new FakeDatabase({
        questions: [{ id: 'old', stem: 'replace' }]
    }));
    const result = await target.restoreBackup(backup);

    assert.equal(result.tableCount, Storage.BACKUP_TABLES.length);
    assert.deepEqual(await target.get('questions', 'q1'), {
        id: 'q1',
        stem: 'backup'
    });
    assert.equal(await target.get('questions', 'old'), undefined);
    assert.equal((await target.get('images', 'i1')).blob, 'bytes');
});

test('backup validation adds missing known tables but never rewrites content', () => {
    const backup = {
        schemaVersion: Storage.BACKUP_SCHEMA_VERSION,
        createdAt: '2026-07-12T00:00:00.000Z',
        tables: { questions: [{ id: 'q1', answer: '' }] }
    };
    const normalized = Storage.validateBackup(backup);

    assert.deepEqual(normalized.tables.questions, backup.tables.questions);
    assert.deepEqual(normalized.tables.images, []);
    assert.equal(normalized.tables.questions[0].answer, '');
});
