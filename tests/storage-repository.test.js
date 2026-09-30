const test = require('node:test');
const assert = require('node:assert/strict');

const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

test('library load, soft delete, and restore preserve records', async () => {
    let now = 100;
    const database = new FakeDatabase({
        questions: [
            { id: 'q1', stem: 'one', createdAt: 1, updatedAt: 1 },
            { id: 'q2', stem: 'two', createdAt: 2, updatedAt: 2 }
        ]
    });
    const repository = Storage.createRepository(database, {
        clock: () => ++now
    });

    assert.deepEqual(
        (await repository.loadLibrary()).map(row => row.id),
        ['q2', 'q1']
    );
    assert.deepEqual(
        await repository.softDeleteQuestion('q2'),
        { deleted: true, idempotent: false }
    );
    assert.deepEqual(
        (await repository.loadLibrary()).map(row => row.id),
        ['q1']
    );
    const restored = await repository.restoreQuestion('q2');
    assert.equal(restored.deletedAt, undefined);
    assert.deepEqual(
        (await repository.loadLibrary()).map(row => row.id),
        ['q2', 'q1']
    );
});

test('question and image records save atomically and inputs stay unchanged', async () => {
    const database = new FakeDatabase();
    const repository = Storage.createRepository(database, { clock: () => 50 });
    const question = { id: 'q1', stem: 'original', images: [{ id: 'i1' }] };
    const before = structuredClone(question);

    const result = await repository.saveQuestion(question, {
        imageRecords: [{ id: 'i1', blob: 'bytes' }],
        confirmationToken: 'confirm-1'
    });

    assert.deepEqual(question, before);
    assert.equal(result.idempotent, false);
    assert.equal((await repository.get('questions', 'q1')).updatedAt, 50);
    assert.equal((await repository.get('images', 'i1')).blob, 'bytes');
});

test('recent tasks and draft records use repository APIs', async () => {
    const database = new FakeDatabase({
        draftImportBatches: [
            { id: 'b1', createdAt: 1 },
            { id: 'b2', createdAt: 2 }
        ]
    });
    const repository = Storage.createRepository(database, { clock: () => 77 });

    assert.deepEqual(
        (await repository.listRecentTasks()).map(row => row.id),
        ['b2', 'b1']
    );
    await repository.saveDraft({
        id: 'd1',
        batchId: 'b2',
        order: 1,
        stem: 'draft'
    });
    assert.equal((await repository.loadDraft('d1')).updatedAt, 77);
    assert.equal(
        (await repository.loadDraftBatch('b2')).questions[0].id,
        'd1'
    );
    await repository.deleteDraftBatch('b2');
    assert.equal(await repository.get('draftImportBatches', 'b2'), undefined);
    assert.equal(await repository.loadDraft('d1'), undefined);
    assert.deepEqual(
        (await repository.listRecentTasks()).map(row => row.id),
        ['b1']
    );
});

test('targeted review view uses one readonly transaction and only requested keys', async () => {
    const database = new FakeDatabase({
        draftImportBatches: [{ id: 'b1' }],
        draftQuestions: [{ id: 'd1', batchId: 'b1', version: 1 }, { id: 'd2', batchId: 'b1' }],
        draftImages: [{ id: 'i1', batchId: 'b1', questionId: 'd1' }, { id: 'i2', batchId: 'b1', questionId: 'd2' }]
    });
    const reads = [];
    for (const name of ['draftImportBatches', 'draftQuestions']) {
        const table = database.table(name);
        const get = table.get.bind(table);
        table.get = async id => { reads.push([name, id]); return get(id); };
        table.toArray = () => { throw new Error('full table read'); };
    }
    database.table('draftImportFiles').where = () => { throw new Error('unused files'); };
    database.table('draftQuestions').where = () => { throw new Error('full batch questions'); };
    const imageTable = database.table('draftImages');
    const where = imageTable.where.bind(imageTable);
    imageTable.where = index => { reads.push(['draftImages', index]); return where(index); };
    const transactions = [];
    const transact = database.transaction.bind(database);
    database.transaction = (mode, ...args) => {
        transactions.push([mode, args.slice(0, -1).map(table => table.name)]);
        return transact(mode, ...args);
    };
    const repository = Storage.createRepository(database);
    const loaded = await repository.loadDraftReview('b1', 'd1');
    assert.deepEqual(transactions, [['r', ['draftImportBatches', 'draftQuestions', 'draftImages']]]);
    assert.deepEqual(reads, [['draftImportBatches', 'b1'], ['draftQuestions', 'd1'], ['draftImages', 'questionId']]);
    assert.equal(loaded.draft.id, 'd1');
    assert.deepEqual(loaded.images.map(row => row.id), ['i1']);
    loaded.draft.version = 99;
    assert.equal((await repository.loadDraftReview('b1', 'd1')).draft.version, 1);
    await database.table('draftQuestions').delete('d1');
    assert.equal((await repository.loadDraftReview('b1', 'd1')).draft, undefined);
});
