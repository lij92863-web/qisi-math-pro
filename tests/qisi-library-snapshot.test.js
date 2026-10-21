const test = require('node:test');
const assert = require('node:assert/strict');
const snapshot = require('../qisi-library-snapshot.js');

const makeStorage = (calls, overrides = {}) => ({
    async loadLibrary() { calls.push('library'); return overrides.library ?? [{ id: 'q1' }, null, 'bad']; },
    async listTable(name) { calls.push('table:' + name); return overrides[name] ?? [{ id: name }]; },
    async listRecentTasks() { calls.push('recent'); return [{ id: 't1' }]; },
    async get(name, key) { calls.push('get:' + name + ':' + key); return 'personal' in overrides ? overrides.personal : { nodes: [{ id: 'k' }] }; }
});

const draftPersistence = (calls, draft = { files: [], questions: [], images: [] }) => ({
    async reloadDraftBatch(id) { calls.push('draft:' + id); return draft; }
});

test('loadLibrarySnapshot reads domains in the original order', async () => {
    const calls = [];
    const result = await snapshot.loadLibrarySnapshot({
        storage: makeStorage(calls), draftPersistence: draftPersistence(calls), batchId: 'b1',
        attachImages: async list => calls.push('attach:' + list.length)
    });
    assert.deepEqual(calls, [
        'library', 'attach:3', 'table:externalQuestions', 'attach:1',
        'table:importBatches', 'recent', 'draft:b1',
        'table:customTemplates', 'get:personalKnowledge:tree'
    ]);
    assert.deepEqual(result.questions.map(q => q.id), ['q1']);
    assert.deepEqual(result.personalKnowledgeTree, [{ id: 'k' }]);
});

test('loadLibrarySnapshot skips the draft read when no batch is active', async () => {
    const calls = [];
    const result = await snapshot.loadLibrarySnapshot({ storage: makeStorage(calls), draftPersistence: draftPersistence(calls) });
    assert.equal(result.activeDraft, null);
    assert.equal(calls.some(call => call.startsWith('draft:')), false);
});

test('loadLibrarySnapshot falls back to an empty personal knowledge tree', async () => {
    const calls = [];
    const result = await snapshot.loadLibrarySnapshot({ storage: makeStorage(calls, { personal: null }) });
    assert.deepEqual(result.personalKnowledgeTree, []);
});

test('loadLibrarySnapshot fails closed without storage', async () => {
    await assert.rejects(snapshot.loadLibrarySnapshot({}), error => error.code === 'LIBRARY_SNAPSHOT_STORAGE_REQUIRED');
});

test('loadLibrarySnapshot requires draft persistence when a batch is active', async () => {
    await assert.rejects(snapshot.loadLibrarySnapshot({ storage: makeStorage([]), batchId: 'b1' }),
        error => error.code === 'LIBRARY_SNAPSHOT_DRAFT_PERSISTENCE_REQUIRED');
});

test('loadLibrarySnapshot propagates storage errors', async () => {
    const storage = makeStorage([]);
    storage.loadLibrary = async () => { throw new Error('db-down'); };
    await assert.rejects(snapshot.loadLibrarySnapshot({ storage }), /db-down/);
});
