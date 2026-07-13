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
        questions: [{ id: 'formal-1', stem: 'must survive review commands' }],
        draftImportBatches: [{
            id: 'batch-1', status: 'review', progress: 100,
            createdAt: 10, updatedAt: 10,
            draftPersistence: { version: 0 }
        }],
        draftImportFiles: [{ id: 'file-1', batchId: 'batch-1' }],
        draftQuestions: [{
            id: 'draft-1', batchId: 'batch-1', version: 1,
            order: 1, status: 'pending', stem: 'before', updatedAt: 10
        }],
        draftImages: [{
            id: 'image-1', batchId: 'batch-1', questionId: 'draft-1',
            status: 'need_confirm', updatedAt: 10
        }]
    });
    return {
        database,
        repository: Storage.createRepository(database, { clock: () => 100 })
    };
};

test('create command commits batch/files together and duplicate creation fails closed', async () => {
    const database = new FakeDatabase({
        questions: [{ id: 'formal-1', stem: 'formal' }]
    });
    const repository = Storage.createRepository(database, { clock: () => 100 });
    const command = {
        batch: { id: 'batch-new', status: 'pending', createdAt: 20, updatedAt: 20 },
        files: [{ id: 'file-new', batchId: 'batch-new', filename: 'paper.docx' }]
    };

    const result = await Persistence.createDraftBatch(command, repository);
    assert.equal(result.batch.id, 'batch-new');
    assert.deepEqual(result.files.map(row => row.id), ['file-new']);
    assert.equal((await repository.loadDraftBatch('batch-new')).files.length, 1);
    await assert.rejects(
        Persistence.createDraftBatch(command, repository),
        error => error.code === 'DRAFT_BATCH_CREATE_FAILED' &&
            error.causeCode === 'duplicate-id'
    );
    assert.equal((await repository.get('questions', 'formal-1')).id, 'formal-1');
});

test('review draft command updates draft and image atomically with verified readback', async () => {
    const { repository } = createFixture();
    const command = {
        batchId: 'batch-1',
        expectedDraftVersion: 1,
        idempotencyKey: 'review-command:draft-1:1:edit-a',
        draft: {
            id: 'draft-1', batchId: 'batch-1', version: 999,
            order: 1, status: 'reviewed', stem: 'after', updatedAt: 20
        },
        images: [{
            id: 'image-1', batchId: 'batch-1', questionId: 'draft-1',
            status: 'bound', updatedAt: 20
        }]
    };

    const result = await Persistence.persistReviewDraftCommand(command, repository);
    assert.equal(result.idempotent, false);
    assert.equal(result.draft.version, 2);
    assert.equal(result.draft.stem, 'after');
    assert.equal(result.images[0].status, 'bound');

    const replay = await Persistence.persistReviewDraftCommand(command, repository);
    assert.equal(replay.idempotent, true);
    assert.equal(replay.draft.version, 2);
    assert.equal((await repository.get('questions', 'formal-1')).stem,
        'must survive review commands');
});

test('stale, malformed, submitted, duplicate-image, and missing-repository commands fail closed', async () => {
    const { repository } = createFixture();
    const valid = {
        batchId: 'batch-1', expectedDraftVersion: 1,
        draft: {
            id: 'draft-1', batchId: 'batch-1', version: 1,
            order: 1, status: 'pending', stem: 'edited'
        }
    };

    await assert.rejects(
        Persistence.persistReviewDraftCommand({ ...valid, expectedDraftVersion: 0 }, repository),
        error => error.code === 'DRAFT_PERSISTENCE_VERSION_CONFLICT'
    );
    await assert.rejects(
        Persistence.persistReviewDraftCommand({ ...valid, draft: { id: 'draft-1' } }, repository),
        error => error.code === 'DRAFT_PERSISTENCE_ASSOCIATION_INVALID'
    );
    await assert.rejects(
        Persistence.persistReviewDraftCommand({
            ...valid,
            images: [
                { id: 'same', batchId: 'batch-1', questionId: 'draft-1' },
                { id: 'same', batchId: 'batch-1', questionId: 'draft-1' }
            ]
        }, repository),
        error => error.code === 'DRAFT_PERSISTENCE_DUPLICATE_ID'
    );
    await assert.rejects(
        Persistence.persistReviewDraftCommand({
            ...valid,
            images: [{
                id: 'image-1', batchId: 'batch-1',
                questionId: 'different-draft'
            }]
        }, repository),
        error => error.code === 'DRAFT_PERSISTENCE_ASSOCIATION_INVALID'
    );
    await assert.rejects(
        Persistence.persistReviewDraftCommand(valid, null),
        error => error.code === 'DRAFT_PERSISTENCE_REPOSITORY_REQUIRED'
    );

    await repository.put('draftQuestions', {
        ...(await repository.get('draftQuestions', 'draft-1')),
        status: 'submitted'
    });
    await assert.rejects(
        Persistence.persistReviewDraftCommand(valid, repository),
        error => error.code === 'DRAFT_PERSISTENCE_SUBMITTED_IMMUTABLE'
    );
});

test('cancellation and transaction interruption roll back every review mutation', async () => {
    const { database, repository } = createFixture();
    const command = {
        batchId: 'batch-1', expectedDraftVersion: 1,
        draft: {
            id: 'draft-1', batchId: 'batch-1', version: 1,
            order: 1, status: 'reviewed', stem: 'must rollback'
        },
        images: [{
            id: 'image-1', batchId: 'batch-1', questionId: 'draft-1',
            status: 'bound', updatedAt: 20
        }]
    };

    const abortController = new AbortController();
    abortController.abort();
    await assert.rejects(
        Persistence.persistReviewDraftCommand({
            ...command, signal: abortController.signal
        }, repository),
        error => error.code === 'DRAFT_PERSISTENCE_CANCELLED'
    );

    database.failAfterWork = true;
    await assert.rejects(
        Persistence.persistReviewDraftCommand(command, repository),
        error => error.code === 'DRAFT_PERSISTENCE_WRITE_FAILED'
    );
    database.failAfterWork = false;
    const loaded = await repository.loadDraftBatch('batch-1');
    assert.equal(loaded.questions[0].stem, 'before');
    assert.equal(loaded.images[0].status, 'need_confirm');
    assert.equal((await repository.get('questions', 'formal-1')).id, 'formal-1');
});

test('image-only command is version-aware and reload/delete remain service-owned', async () => {
    const { repository } = createFixture();
    const result = await Persistence.persistReviewImageCommand({
        batchId: 'batch-1', imageId: 'image-1',
        expectedUpdatedAt: 10,
        patch: { status: 'deleted' },
        updatedAt: 100,
        idempotencyKey: 'review-image:image-1:10:delete'
    }, repository);
    assert.equal(result.image.status, 'deleted');
    assert.equal(result.image.updatedAt, 100);

    await assert.rejects(
        Persistence.persistReviewImageCommand({
            batchId: 'batch-1', imageId: 'image-1',
            expectedUpdatedAt: 10,
            patch: { status: 'bound' },
            idempotencyKey: 'review-image:image-1:10:different'
        }, repository),
        error => error.code === 'DRAFT_PERSISTENCE_VERSION_CONFLICT'
    );
    assert.equal((await Persistence.reloadDraftBatch('batch-1', repository)).images[0].status,
        'deleted');
    assert.equal((await Persistence.deleteDraftBatch('missing', repository)).idempotent,
        true);
});

test('app delegates draft writes and exposes visible reload-based UI error recovery', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-draft-persistence-service.js'), 'utf8'
    );

    assert.doesNotMatch(app, /db\.draft(?:ImportBatches|ImportFiles|Questions|Images)/);
    assert.doesNotMatch(app, /db\.transaction\([^\n]*db\.draft/);
    assert.match(app, /Qisi\.DraftPersistenceService\.createDraftBatch/);
    assert.match(app, /Qisi\.DraftPersistenceService\.persistReviewDraftCommand/);
    assert.match(app, /Qisi\.DraftPersistenceService\.persistReviewImageCommand/);
    assert.match(app, /const runReviewDraftPersistenceCommand\s*=\s*async/);
    assert.match(app, /catch\s*\(error\)[\s\S]{0,500}loadBatchImportData/);
    assert.match(app, /catch\s*\(error\)[\s\S]{0,700}showBatchToast/);
    assert.doesNotMatch(
        implementation,
        /FormalAdmission|confirmDraftToQuestion|saveQuestion|put\s*\(\s*['"]questions/i
    );
});
