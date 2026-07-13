const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Persistence = require('../qisi-draft-persistence-service.js');
const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const ROOT = path.resolve(__dirname, '..');

const createFixture = () => {
    const database = new FakeDatabase({
        questions: [{ id: 'formal-1', stem: 'formal question' }],
        draftImportBatches: [{
            id: 'batch-1', status: 'processing', createdAt: 10, updatedAt: 10
        }]
    });
    return {
        database,
        repository: Storage.createRepository(database, { clock: () => 100 })
    };
};

const command = (overrides = {}) => ({
    idempotencyKey: 'review:batch-1:1',
    expectedVersion: 0,
    batch: {
        id: 'batch-1', status: 'review', progress: 100,
        createdAt: 10, updatedAt: 20
    },
    files: [{
        id: 'file-1', batchId: 'batch-1', parseStatus: 'success'
    }],
    drafts: [{
        id: 'draft-1', batchId: 'batch-1', version: 1,
        order: 1, status: 'pending', stem: 'PRIVATE DRAFT CONTENT'
    }],
    ...overrides
});

test('persists, reloads, and replays a review batch idempotently', async () => {
    const { repository } = createFixture();
    const input = command();
    const snapshot = structuredClone(input);
    const first = await Persistence.persistDraftBatch(input, repository);

    assert.deepEqual(input, snapshot);
    assert.equal(first.idempotent, false);
    assert.equal(first.version, 1);
    const loaded = await Persistence.reloadDraftBatch('batch-1', repository);
    assert.equal(loaded.batch.draftPersistence.version, 1);
    assert.equal(loaded.batch.draftPersistence.idempotencyKey, input.idempotencyKey);
    assert.equal(loaded.questions[0].id, 'draft-1');
    assert.equal(loaded.files[0].batchId, 'batch-1');
    loaded.questions[0].stem = 'local editable projection';
    assert.equal(
        (await repository.loadDraftBatch('batch-1')).questions[0].stem,
        'PRIVATE DRAFT CONTENT'
    );

    const replay = await Persistence.persistDraftBatch(input, repository);
    assert.equal(replay.idempotent, true);
    assert.equal(replay.version, 1);
    assert.equal((await repository.loadDraftBatch('batch-1')).questions.length, 1);
});

test('rejects wrong association, duplicate ids, and idempotency key reuse', async () => {
    const { repository } = createFixture();
    await assert.rejects(
        Persistence.persistDraftBatch(command({
            drafts: [{ id: 'draft-1', batchId: 'wrong-batch' }]
        }), repository),
        error => error.code === 'DRAFT_PERSISTENCE_ASSOCIATION_INVALID'
    );
    await assert.rejects(
        Persistence.persistDraftBatch(command({
            drafts: [
                { id: 'same', batchId: 'batch-1' },
                { id: 'same', batchId: 'batch-1' }
            ]
        }), repository),
        error => error.code === 'DRAFT_PERSISTENCE_DUPLICATE_ID'
    );

    await Persistence.persistDraftBatch(command(), repository);
    await assert.rejects(
        Persistence.persistDraftBatch(command({
            drafts: [{ id: 'different', batchId: 'batch-1' }]
        }), repository),
        error => error.code === 'DRAFT_PERSISTENCE_IDEMPOTENCY_CONFLICT'
    );
});

test('transaction interruption rolls back every review table', async () => {
    const { database, repository } = createFixture();
    database.failAfterWork = true;
    await assert.rejects(
        Persistence.persistDraftBatch(command(), repository),
        error => error.code === 'DRAFT_PERSISTENCE_WRITE_FAILED' &&
            !/PRIVATE DRAFT CONTENT/.test(error.message)
    );
    database.failAfterWork = false;
    const raw = await repository.loadDraftBatch('batch-1');
    assert.equal(raw.batch.status, 'processing');
    assert.equal(raw.questions.length, 0);
    assert.equal(raw.files.length, 0);
});

test('two concurrent writers allow one version and reject the stale writer', async () => {
    const { repository } = createFixture();
    const results = await Promise.allSettled([
        Persistence.persistDraftBatch(command(), repository),
        Persistence.persistDraftBatch(command({
            idempotencyKey: 'review:batch-1:other',
            drafts: [{ id: 'draft-other', batchId: 'batch-1', order: 1 }]
        }), repository)
    ]);
    assert.deepEqual(results.map(result => result.status).sort(), [
        'fulfilled', 'rejected'
    ]);
    const rejected = results.find(result => result.status === 'rejected');
    assert.equal(rejected.reason.code, 'DRAFT_PERSISTENCE_VERSION_CONFLICT');
});

test('delete is version-aware, idempotent, and never deletes formal questions', async () => {
    const { repository } = createFixture();
    await Persistence.persistDraftBatch(command(), repository);
    await assert.rejects(
        Persistence.deleteDraftBatch('batch-1', repository, {
            expectedVersion: 0
        }),
        error => error.code === 'DRAFT_PERSISTENCE_VERSION_CONFLICT'
    );
    const deleted = await Persistence.deleteDraftBatch('batch-1', repository, {
        expectedVersion: 1
    });
    assert.equal(deleted.idempotent, false);
    assert.equal((await repository.get('questions', 'formal-1')).id, 'formal-1');
    await assert.rejects(
        Persistence.reloadDraftBatch('batch-1', repository),
        error => error.code === 'DRAFT_BATCH_NOT_FOUND'
    );
    assert.equal(
        (await Persistence.deleteDraftBatch('batch-1', repository)).idempotent,
        true
    );
});

test('production paths use the service and the owner has no formal authority', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const injected = fs.readFileSync(path.join(ROOT, 'qisi-injected-import-path.js'), 'utf8');
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-draft-persistence-service.js'), 'utf8'
    );
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');

    assert.match(app, /Qisi\.DraftPersistenceService\.persistDraftBatch/);
    assert.match(app, /Qisi\.DraftPersistenceService\.reloadDraftBatch/);
    assert.match(app, /Qisi\.DraftPersistenceService\.deleteDraftBatch/);
    assert.match(injected, /await persistDraftBatch\s*\(/);
    assert.doesNotMatch(injected, /repository\.persistReviewDraftBatch\s*\(/);
    assert.ok(html.indexOf('qisi-draft-persistence-service.js') < html.indexOf('app.js'));
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|fetch\s*\(|XMLHttpRequest/);
    assert.doesNotMatch(
        implementation,
        /FormalAdmission|evaluateDraftAdmission|confirmDraftToQuestion|saveQuestion|put\s*\(\s*['"]questions/i
    );
    assert.doesNotMatch(implementation, /\bdb\.|indexedDB|Dexie/);
});
