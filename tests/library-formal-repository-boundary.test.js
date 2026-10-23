const test = require('node:test');
const assert = require('node:assert/strict');

const Library = require('../qisi-library-service.js');
const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const createService = database => Library.createLibraryService({
    repository: Storage.createRepository(database, { clock: () => 100 }),
    matchesFilters: () => true
});

test('library save command is atomic, duplicate-safe, and returns repository readback', async () => {
    const database = new FakeDatabase();
    const service = createService(database);
    const blob = new Blob(['bytes']);
    const result = await service.saveQuestion(
        { id: 'q1', stem: 'manual', images: [{ id: 'i1' }] },
        {
            imageRecords: [{ id: 'i1', blob }],
            confirmationToken: 'manual:q1'
        }
    );
    assert.equal(result.question.id, 'q1');
    assert.equal(database.table('questions').rows.get('q1').stem, 'manual');
    assert.equal(
        await database.table('images').rows.get('i1').blob.text(),
        'bytes'
    );

    const retry = await service.saveQuestion(
        { id: 'q1', stem: 'ignored' },
        { confirmationToken: 'manual:q1' }
    );
    assert.equal(retry.idempotent, true);
    assert.equal(retry.question.stem, 'manual');

    const edited = await service.replaceQuestion(
        { ...retry.question, stem: 'edited', images: [{ id: 'i2' }] },
        {
            expectedUpdatedAt: retry.question.updatedAt,
            imageRecords: [{ id: 'i2', blob: new Blob(['edited']) }]
        }
    );
    assert.equal(edited.question.stem, 'edited');
    assert.equal(
        await database.table('images').rows.get('i2').blob.text(),
        'edited'
    );

    await assert.rejects(
        service.saveQuestion({ id: 'q1', stem: 'duplicate' }),
        error => error.code === 'duplicate-id'
    );
});

test('library save command rolls back question and images on transaction failure', async () => {
    const database = new FakeDatabase();
    database.failAfterWork = true;
    const service = createService(database);
    await assert.rejects(
        service.saveQuestion(
            { id: 'q1', stem: 'manual' },
            { imageRecords: [{ id: 'i1', blob: 'bytes' }] }
        ),
        error => error.code === 'interrupted-write'
    );
    assert.equal(database.table('questions').rows.size, 0);
    assert.equal(database.table('images').rows.size, 0);
});

test('external merge commit and undo are repository-owned and read back atomically', async () => {
    const database = new FakeDatabase({
        questions: [{ id: 'q1', stem: 'before', updatedAt: 1 }],
        externalQuestions: [
            { id: 'e1', processStatus: 'unprocessed' },
            { id: 'e2', processStatus: 'unprocessed' },
            { id: 'e3', processStatus: 'unprocessed' }
        ]
    });
    const service = createService(database);
    const committed = await service.commitExternalMerge({
        id: 'merge-1',
        createdAt: 10,
        operations: [
            {
                action: 'fill', externalId: 'e1',
                question: { id: 'q1', stem: 'after', updatedAt: 10 },
                expectedUpdatedAt: 1
            },
            {
                action: 'add', externalId: 'e2',
                question: { id: 'q2', stem: 'added', updatedAt: 10 }
            },
            { action: 'skip', externalId: 'e3' }
        ]
    });
    assert.deepEqual(committed.summary, { added: 1, filled: 1, skipped: 1 });
    assert.equal(database.table('questions').rows.get('q1').stem, 'after');
    assert.equal(database.table('questions').rows.get('q2').stem, 'added');
    assert.equal(
        (await service.getLatestReversibleExternalMerge()).id,
        'merge-1'
    );
    await assert.rejects(service.commitExternalMerge({
        id: 'merge-1',
        createdAt: 11,
        operations: [{ action: 'skip', externalId: 'e3' }]
    }));
    assert.equal(database.table('mergeBatches').rows.size, 1);
    assert.equal(database.table('questions').rows.get('q2').stem, 'added');

    const undone = await service.undoExternalMerge({
        mergeBatchId: 'merge-1',
        revertedAt: 20
    });
    assert.equal(undone.reverted, true);
    assert.equal(database.table('questions').rows.get('q1').stem, 'before');
    assert.equal(database.table('questions').rows.has('q2'), false);
    for (const id of ['e1', 'e2', 'e3']) {
        assert.equal(
            database.table('externalQuestions').rows.get(id).processStatus,
            'unprocessed'
        );
    }
    await assert.rejects(
        service.undoExternalMerge({
            mergeBatchId: 'merge-1',
            revertedAt: 30
        })
    );
});

test('external merge rejects malformed, duplicate, stale, and interrupted commands without residue', async () => {
    const database = new FakeDatabase({
        questions: [{ id: 'q1', stem: 'before', updatedAt: 2 }],
        externalQuestions: [{ id: 'e1', processStatus: 'unprocessed' }]
    });
    const service = createService(database);
    await assert.rejects(
        service.commitExternalMerge({ id: 'bad', createdAt: 1, operations: [] }),
        error => error.code === 'EXTERNAL_MERGE_COMMAND_INVALID'
    );
    await assert.rejects(
        service.commitExternalMerge({
            id: 'stale', createdAt: 2,
            operations: [{
                action: 'fill', externalId: 'e1',
                question: { id: 'q1', stem: 'after' },
                expectedUpdatedAt: 1
            }]
        })
    );
    assert.equal(database.table('questions').rows.get('q1').stem, 'before');
    assert.equal(database.table('mergeBatches').rows.size, 0);

    database.failAfterWork = true;
    await assert.rejects(
        service.commitExternalMerge({
            id: 'interrupted', createdAt: 3,
            operations: [{
                action: 'add', externalId: 'e1',
                question: { id: 'q2', stem: 'added' }
            }]
        }),
        error => error.code === 'interrupted-write'
    );
    assert.equal(database.table('questions').rows.has('q2'), false);
    assert.equal(database.table('mergeBatches').rows.size, 0);
});

test('question migration delegates version-aware replacements and rejects malformed input', async () => {
    const database = new FakeDatabase({
        questions: [
            {
                id: 'q1',
                stem: '_MATHPROTECT_1_\\includegraphics{img-1}',
                answer: '@@QISI_MATH_2@@answer',
                solution: 'keep \\includegraphics{missing}',
                options: ['@@QISI_MATH_SEGMENT_3@@A'],
                images: [{ id: 'img-1' }],
                deletedAt: 9,
                deletedBy: 'user',
                updatedAt: 1
            },
            { id: 'q2', stem: 'keep', updatedAt: 2 }
        ]
    });
    const service = createService(database);
    const count = await service.migrateSafeQuestionLatexData();
    assert.equal(count, 2);
    const migrated = database.table('questions').rows.get('q1');
    assert.equal(migrated.stem, '[[IMAGE:img-1]]');
    assert.equal(migrated.answer, 'answer');
    assert.equal(migrated.solution, 'keep \\includegraphics{missing}');
    assert.deepEqual(migrated.options, ['A']);
    assert.equal(migrated.deletedAt, 9);
    assert.equal(migrated.deletedBy, 'user');
    assert.equal(database.table('questions').rows.get('q2').stem, 'keep');
    await assert.rejects(
        service.migrateQuestions(null),
        error => error.code === 'LIBRARY_MIGRATION_TRANSFORM_REQUIRED'
    );
});

test('stale external confirmation cannot add an already processed source under a fresh command ID', async () => {
    const database = new FakeDatabase({ externalQuestions: [{ id: 'e1' }] });
    const service = createService(database);
    await service.commitExternalMerge({ id: 'first', createdAt: 10, operations: [
        { action: 'add', externalId: 'e1', question: { id: 'q1', stem: 'first' } }
    ] });
    await assert.rejects(service.commitExternalMerge({ id: 'second', createdAt: 11, operations: [
        { action: 'add', externalId: 'e1', question: { id: 'q2', stem: 'duplicate' } }
    ] }), error => error.code === 'EXTERNAL_MERGE_SOURCE_PROCESSED');
    assert.equal(database.table('questions').rows.size, 1);
    assert.equal(database.table('mergeBatches').rows.size, 1);
});

for (const action of ['add', 'fill']) test(`undo ${action} refuses to erase a subsequent teacher edit and rolls back the whole undo`, async () => {
    const database = new FakeDatabase({ questions: action === 'fill' ? [{ id: 'q1', stem: 'before' }] : [],
        externalQuestions: [{ id: 'e1' }, { id: 'e2' }] });
    const service = createService(database);
    await service.commitExternalMerge({ id: 'first', createdAt: 10, operations: [
        { action: 'add', externalId: 'e2', question: { id: 'q2', stem: 'untouched' } },
        { action, externalId: 'e1', question: { id: 'q1', stem: 'merged', updatedAt: 10 } }
    ] });
    // Same timestamp deliberately: field evidence, not only wall-clock version, must protect edits.
    await database.table('questions').put({ id: 'q1', stem: 'teacher edit', updatedAt: 10 });
    const before = await database.table('externalQuestions').toArray();
    await assert.rejects(service.undoExternalMerge({ mergeBatchId: 'first', revertedAt: 20 }),
        error => error.code === 'EXTERNAL_MERGE_UNDO_TARGET_CHANGED');
    assert.equal(database.table('questions').rows.get('q1').stem, 'teacher edit');
    assert.equal(database.table('questions').rows.get('q2').stem, 'untouched');
    assert.deepEqual(await database.table('externalQuestions').toArray(), before);
    assert.equal(database.table('mergeBatches').rows.get('first').revertedAt, 0);
});

test('legacy undo without after-write proof refuses safely and remains readable', async () => {
    const database = new FakeDatabase({ questions: [{ id: 'q1', stem: 'keep' }],
        mergeBatches: [{ id: 'legacy', createdAt: 1, addedQuestionIds: ['q1'], revertedAt: 0 }] });
    const service = createService(database);
    assert.equal((await service.getLatestReversibleExternalMerge()).id, 'legacy');
    await assert.rejects(service.undoExternalMerge({ mergeBatchId: 'legacy', revertedAt: 20 }),
        error => error.code === 'EXTERNAL_MERGE_UNDO_SNAPSHOT_REQUIRED');
    assert.equal(database.table('questions').rows.get('q1').stem, 'keep');
});

test('undo checks external status ownership before restoring older status', async () => {
    const database = new FakeDatabase({ externalQuestions: [{ id: 'e1' }] });
    const service = createService(database);
    await service.commitExternalMerge({ id: 'first', createdAt: 10, operations: [{ action: 'skip', externalId: 'e1' }] });
    await service.commitExternalMerge({ id: 'second', createdAt: 11, operations: [
        { action: 'add', externalId: 'e1', question: { id: 'q1', stem: 'added later' } }
    ] });
    await assert.rejects(service.undoExternalMerge({ mergeBatchId: 'first', revertedAt: 20 }),
        error => error.code === 'EXTERNAL_MERGE_UNDO_SOURCE_CHANGED');
    assert.equal(database.table('externalQuestions').rows.get('e1').processStatus, 'added');
    await service.undoExternalMerge({ mergeBatchId: 'second', revertedAt: 21 });
    await service.undoExternalMerge({ mergeBatchId: 'first', revertedAt: 22 });
    assert.equal(database.table('externalQuestions').rows.get('e1').processStatus, 'unprocessed');
});
