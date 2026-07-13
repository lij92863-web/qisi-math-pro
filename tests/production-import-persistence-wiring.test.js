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
            id: 'batch-1', status: 'processing', progress: 40,
            createdAt: 10, updatedAt: 10
        }],
        draftImportFiles: [{
            id: 'file-1', batchId: 'batch-1', parseStatus: 'processing'
        }],
        draftQuestions: [{
            id: 'stale-draft', batchId: 'batch-1', order: 1
        }],
        draftImages: [{
            id: 'stale-image', batchId: 'batch-1', questionId: 'stale-draft'
        }]
    });
    return {
        database,
        repository: Storage.createRepository(database, { clock: () => 100 })
    };
};

const input = (overrides = {}) => ({
    batchId: 'batch-1',
    batchPatch: {
        status: 'review', progress: 100, totalCount: 1, updatedAt: 20
    },
    files: [{
        id: 'file-1', batchId: 'batch-1', parseStatus: 'success'
    }],
    drafts: [{
        id: 'draft-1', batchId: 'batch-1', version: 1,
        order: 1, status: 'pending', stem: 'review draft'
    }],
    images: [{
        id: 'image-1', batchId: 'batch-1', questionId: 'draft-1',
        status: 'assigned'
    }],
    ...overrides
});

test('production review persistence replaces drafts and images atomically', async () => {
    const { repository } = createFixture();
    const command = input();
    const snapshot = structuredClone(command);

    const result = await Persistence.persistReviewDraftBatch(command, repository);
    const loaded = await Persistence.reloadDraftBatch('batch-1', repository);

    assert.deepEqual(command, snapshot);
    assert.equal(result.idempotent, false);
    assert.equal(result.version, 1);
    assert.equal(loaded.batch.status, 'review');
    assert.equal(loaded.batch.draftPersistence.version, 1);
    assert.deepEqual(loaded.questions.map(row => row.id), ['draft-1']);
    assert.deepEqual(loaded.images.map(row => row.id), ['image-1']);
    assert.equal(loaded.images[0].questionId, 'draft-1');
    assert.equal(loaded.files[0].parseStatus, 'success');
    assert.equal((await repository.get('questions', 'formal-1')).id, 'formal-1');
});

test('omitted files preserve current parse states and empty output remains atomic', async () => {
    const { repository } = createFixture();

    await Persistence.persistReviewDraftBatch(input({
        files: undefined,
        drafts: [],
        images: [],
        batchPatch: {
            status: 'review', progress: 100, totalCount: 0,
            updatedAt: 21, errorMessage: 'no-review-drafts'
        }
    }), repository);

    const loaded = await repository.loadDraftBatch('batch-1');
    assert.equal(loaded.files[0].parseStatus, 'processing');
    assert.deepEqual(loaded.questions, []);
    assert.deepEqual(loaded.images, []);
    assert.equal(loaded.batch.totalCount, 0);
    assert.equal(loaded.batch.errorMessage, 'no-review-drafts');
});

test('image associations and duplicate image ids fail before persistence', async () => {
    const first = createFixture();
    await assert.rejects(
        Persistence.persistReviewDraftBatch(input({
            images: [{ id: 'image-1', batchId: 'wrong-batch' }]
        }), first.repository),
        error => error.code === 'DRAFT_PERSISTENCE_ASSOCIATION_INVALID'
    );
    assert.equal(
        (await first.repository.loadDraftBatch('batch-1')).batch.status,
        'processing'
    );

    const second = createFixture();
    await assert.rejects(
        Persistence.persistReviewDraftBatch(input({
            images: [
                { id: 'same-image', batchId: 'batch-1' },
                { id: 'same-image', batchId: 'batch-1' }
            ]
        }), second.repository),
        error => error.code === 'DRAFT_PERSISTENCE_DUPLICATE_ID'
    );
});

test('image, draft, file, and batch writes roll back together', async () => {
    const { database, repository } = createFixture();
    database.failAfterWork = true;

    await assert.rejects(
        Persistence.persistReviewDraftBatch(input(), repository),
        error => error.code === 'DRAFT_PERSISTENCE_WRITE_FAILED'
    );

    database.failAfterWork = false;
    const loaded = await repository.loadDraftBatch('batch-1');
    assert.equal(loaded.batch.status, 'processing');
    assert.deepEqual(loaded.questions.map(row => row.id), ['stale-draft']);
    assert.deepEqual(loaded.images.map(row => row.id), ['stale-image']);
    assert.equal(loaded.files[0].parseStatus, 'processing');
});

test('legacy low-level replay keeps its pre-image signature and image rows', async () => {
    const { repository } = createFixture();
    const legacyCommand = {
        idempotencyKey: 'legacy-review-key',
        expectedVersion: 0,
        batch: {
            id: 'batch-1', status: 'review', progress: 100,
            createdAt: 10, updatedAt: 20
        },
        files: [{
            id: 'file-1', batchId: 'batch-1', parseStatus: 'processing'
        }],
        drafts: [{
            id: 'stale-draft', batchId: 'batch-1', order: 1
        }]
    };
    const legacySignature = JSON.stringify({
        batch: {
            id: 'batch-1', status: 'review', progress: 100, updatedAt: 20
        },
        files: [{
            id: 'file-1', batchId: 'batch-1', parseStatus: 'processing'
        }],
        drafts: [{
            id: 'stale-draft', batchId: 'batch-1', order: 1
        }]
    });
    await repository.update('draftImportBatches', 'batch-1', {
        status: 'review', progress: 100, updatedAt: 20,
        draftPersistence: {
            version: 1,
            idempotencyKey: legacyCommand.idempotencyKey,
            signature: legacySignature
        }
    });

    const replay = await Persistence.persistDraftBatch(
        legacyCommand,
        repository
    );
    const loaded = await repository.loadDraftBatch('batch-1');

    assert.equal(replay.idempotent, true);
    assert.equal(replay.version, 1);
    assert.deepEqual(loaded.images.map(row => row.id), ['stale-image']);
});

test('all production final review writes delegate to the persistence owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-draft-persistence-service.js'), 'utf8'
    );
    const calls = app.match(
        /draftPersistenceService\.persistReviewDraftBatch\s*\(/g
    ) || [];

    assert.equal(calls.length, 2);
    assert.doesNotMatch(app, /processDraftImportBatchV2/);
    assert.doesNotMatch(
        app,
        /db\.draftQuestions\.(?:bulkPut|bulkDelete)\((?:drafts|finalDrafts|oldDrafts)/
    );
    assert.doesNotMatch(
        app,
        /db\.draftImages\.(?:bulkPut|bulkDelete)\((?:finalDraftImages|oldImages)/
    );
    assert.doesNotMatch(
        implementation,
        /document\.|window\.|Vue|FormalAdmission|controlledWrite|\bfetch\s*\(|\brecognize[A-Z_$][\w$]*\s*\(/i
    );
});
