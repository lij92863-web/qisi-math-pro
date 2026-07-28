'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const repositoryModule = require('../qisi-handout-repository.js');

class MemoryWhere {
    constructor(table, field) {
        this.table = table;
        this.field = field;
        this.value = undefined;
    }

    equals(value) {
        this.value = value;
        return this;
    }

    async toArray() {
        return this.table.values().filter(
            row => row?.[this.field] === this.value
        );
    }

    async delete() {
        const ids = (await this.toArray()).map(row => row.id);
        await this.table.bulkDelete(ids);
        return ids.length;
    }
}

class MemoryTable {
    constructor(name) {
        this.name = name;
        this.rows = new Map();
    }

    values() {
        return [...this.rows.values()];
    }

    async add(value) {
        if (this.rows.has(value.id)) {
            throw new Error(`duplicate key ${value.id}`);
        }
        this.rows.set(value.id, structuredClone(value));
        return value.id;
    }

    async put(value) {
        this.rows.set(value.id, structuredClone(value));
        return value.id;
    }

    async bulkPut(values) {
        for (const value of values) await this.put(value);
    }

    async get(id) {
        const value = this.rows.get(id);
        return value == null ? undefined : structuredClone(value);
    }

    async delete(id) {
        this.rows.delete(id);
    }

    async bulkDelete(ids) {
        for (const id of ids) this.rows.delete(id);
    }

    async toArray() {
        return structuredClone(this.values());
    }

    where(field) {
        return new MemoryWhere(this, field);
    }
}

class MemoryDatabase {
    constructor() {
        for (const name of [
            'questions',
            'images',
            'handouts',
            'handoutAssets',
            'handoutRevisions'
        ]) {
            this[name] = new MemoryTable(name);
        }
        this.tables = Object.values(this)
            .filter(value => value instanceof MemoryTable);
    }

    table(name) {
        return this[name];
    }

    async transaction(mode, ...args) {
        assert.equal(mode, 'rw');
        const callback = args.pop();
        return callback();
    }
}

const makeHarness = ({ revisionLimit = 20 } = {}) => {
    const db = new MemoryDatabase();
    const counters = new Map();
    let tick = 0;
    const repository = repositoryModule.createHandoutRepository({
        db,
        revisionLimit,
        clock: () => new Date(
            Date.UTC(2026, 6, 28, 10, 0, tick++)
        ).toISOString(),
        idFactory(prefix) {
            const next = (counters.get(prefix) || 0) + 1;
            counters.set(prefix, next);
            return `${prefix}-${next}`;
        }
    });

    return {
        db,
        repository
    };
};

test('H2 repository provides CRUD with optimistic concurrency', async () => {
    const { db, repository } = makeHarness();
    const created = await repository.create({
        title: '数列专题'
    });
    const opened = await repository.get(created.id);
    const saved = await repository.save({
        ...opened,
        title: '数列专题（修订）'
    }, {
        expectedUpdatedAt: opened.updatedAt
    });

    assert.equal(saved.revision, 1);
    assert.equal(saved.title, '数列专题（修订）');
    assert.equal((await repository.list()).length, 1);
    await assert.rejects(() => repository.save({
        ...opened,
        title: '过期页面写入'
    }, {
        expectedUpdatedAt: opened.updatedAt
    }), error => error.code === 'HANDOUT_CONFLICT');

    await repository.remove(created.id);
    assert.equal(await repository.get(created.id), null);
    assert.equal((await db.handoutRevisions.toArray()).length, 0);
});

test('H2 autosave keeps bounded recoverable revisions and restore creates a new revision', async () => {
    const { repository } = makeHarness({
        revisionLimit: 2
    });
    let current = await repository.create({
        title: '自动保存'
    });

    for (const title of ['第一次', '第二次', '第三次']) {
        current = await repository.autosave({
            ...current,
            title
        }, {
            expectedUpdatedAt: current.updatedAt
        });
    }

    const revisions = await repository.listRevisions(current.id);
    assert.equal(revisions.length, 2);
    assert.deepEqual(
        revisions.map(record => record.snapshot.title),
        ['第二次', '第一次']
    );

    const restored = await repository.restoreRevision(
        current.id,
        revisions[1].id,
        {
            expectedUpdatedAt: current.updatedAt
        }
    );

    assert.equal(restored.title, '第一次');
    assert.equal(restored.revision, 4);
    assert.equal((await repository.listRevisions(current.id)).length, 2);
});

test('H2 unchanged autosave is a true no-op without timestamp or revision churn', async () => {
    const { repository } = makeHarness();
    const created = await repository.create({
        title: '无变化'
    });
    const autosaved = await repository.autosave(
        structuredClone(created),
        {
            expectedUpdatedAt: created.updatedAt
        }
    );

    assert.deepEqual(autosaved, created);
    assert.deepEqual(
        await repository.listRevisions(created.id),
        []
    );
});

test('H2 question insertion atomically snapshots source evidence and copies assets', async () => {
    const { db, repository } = makeHarness();
    const question = {
        id: 'formal-question-1',
        updatedAt: '2026-07-28T01:00:00.000Z',
        type: '单选题',
        stem: '源题题干',
        options: ['A1', 'B1', 'C1', 'D1'],
        answer: 'A',
        solution: '源题解析',
        images: [{
            id: 'formal-image-1',
            align: 'center'
        }]
    };
    const image = {
        id: 'formal-image-1',
        blob: new Blob(['formal-image'], {
            type: 'image/png'
        })
    };

    await db.questions.put(question);
    await db.images.put(image);

    const formalQuestionBefore = await db.questions.get(question.id);
    const formalImageBefore = await db.images.get(image.id);
    const handout = await repository.create({
        title: '源题快照'
    });
    const inserted = await repository.insertQuestionSnapshot(
        handout.id,
        {
            question: await db.questions.get(question.id),
            sourceImages: [await db.images.get(image.id)],
            expectedUpdatedAt: handout.updatedAt
        }
    );
    const asset = (await db.handoutAssets.toArray())[0];

    assert.equal(inserted.handout.blocks.length, 1);
    assert.equal(inserted.handout.blocks[0].sourceQuestionId, question.id);
    assert.equal(
        inserted.handout.blocks[0].snapshot.images[0].assetId,
        asset.id
    );
    assert.equal(asset.handoutId, handout.id);
    assert.equal(asset.sourceImageId, image.id);
    assert.notEqual(asset.blob, formalImageBefore.blob);
    assert.equal(await asset.blob.text(), await formalImageBefore.blob.text());
    assert.deepEqual(await db.questions.get(question.id), formalQuestionBefore);
    assert.deepEqual(await db.images.get(image.id), formalImageBefore);
});

test('H2 repository refuses saves that introduce dangling asset references', async () => {
    const { repository } = makeHarness();
    const handout = await repository.create({
        title: '悬空资产'
    });

    await assert.rejects(() => repository.save({
        ...handout,
        blocks: [{
            id: 'question-dangling',
            type: 'question',
            sourceQuestionId: 'source-1',
            snapshot: {
                snapshotVersion: 1,
                sourceQuestionId: 'source-1',
                sourceUpdatedAt: '',
                capturedAt: '2026-07-28T10:00:00.000Z',
                images: [{
                    sourceImageId: 'source-image-missing',
                    assetId: 'asset-missing'
                }]
            },
            contentOverrides: {}
        }]
    }, {
        expectedUpdatedAt: handout.updatedAt
    }), error => error.code === 'HANDOUT_ASSET_GRAPH_INVALID');
});
