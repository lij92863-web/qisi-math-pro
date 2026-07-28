'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const model = require('../qisi-handout-model.js');
const questionInstance = require('../qisi-handout-question-instance.js');
const editorState = require('../qisi-handout-editor-state.js');
const preview = require('../qisi-handout-preview.js');
const repositoryModule = require('../qisi-handout-repository.js');
const questionLibraryModule = require('../qisi-handout-question-library.js');

const NOW = '2026-07-28T10:00:00.000Z';

const makeQuestionBlock = (value = {}) => ({
    id: 'question-block-1',
    type: 'question',
    sourceQuestionId: 'source-question-1',
    sourceUpdatedAt: '2026-07-27T08:00:00.000Z',
    snapshot: {
        snapshotVersion: 1,
        sourceQuestionId: 'source-question-1',
        sourceUpdatedAt: '2026-07-27T08:00:00.000Z',
        capturedAt: NOW,
        stem: 'Solve $x^2=4$.',
        options: ['1', '2', '3', '4'],
        answer: 'SECRET_ANSWER_2',
        analysis: 'SECRET_ANALYSIS',
        solution: 'SECRET_SOLUTION',
        teacherNote: 'SECRET_TEACHER_NOTE',
        meta: {
            privateEvidence: 'SECRET_META'
        },
        sourceTrace: {
            privateEvidence: 'SECRET_TRACE'
        },
        images: []
    },
    contentOverrides: {},
    images: [],
    optionLayout: {
        mode: 'auto'
    },
    questionLabel: {
        preset: 'exercise',
        customText: ''
    },
    display: {
        showQuestionNumber: true,
        showOptions: true,
        answerPlacement: 'end',
        analysisPlacement: 'after-question',
        solutionPlacement: 'end',
        answerSpaceLines: 2
    },
    ...value
});

const makeHandout = (blocks = []) => model.createHandout({
    title: 'H3 handout',
    blocks
}, {
    id: 'handout-h3',
    now: NOW
});

test('H3 editor performs structured block operations with bounded undo and redo', () => {
    let state = editorState.createEditorState(makeHandout());
    const heading = editorState.createBlock('heading', {
        id: 'heading-1'
    });
    const body = editorState.createBlock('body', {
        id: 'body-1'
    });

    state = editorState.insertBlock(state, heading);
    state = editorState.insertBlock(state, body);
    assert.deepEqual(
        state.handout.blocks.map(block => block.id),
        ['heading-1', 'body-1']
    );

    state = editorState.updateBlock(
        state,
        'body-1',
        { content: 'First edit' },
        { mutationKey: 'body:body-1', now: 100 }
    );
    const historyAfterFirstEdit = state.undoStack.length;
    state = editorState.updateBlock(
        state,
        'body-1',
        { content: 'Second edit' },
        { mutationKey: 'body:body-1', now: 500 }
    );
    assert.equal(
        state.undoStack.length,
        historyAfterFirstEdit,
        'rapid edits of one field should coalesce'
    );

    state = editorState.copyBlock(state, 'body-1', {
        createId: () => 'body-2'
    });
    assert.deepEqual(
        state.handout.blocks.map(block => block.id),
        ['heading-1', 'body-1', 'body-2']
    );

    state = editorState.moveBlock(state, 'body-2', -2);
    assert.deepEqual(
        state.handout.blocks.map(block => block.id),
        ['body-2', 'heading-1', 'body-1']
    );

    state = editorState.deleteBlock(state, 'heading-1');
    assert.deepEqual(
        state.handout.blocks.map(block => block.id),
        ['body-2', 'body-1']
    );
    const deleted = state;
    state = editorState.undo(state);
    assert.ok(state.handout.blocks.some(block => block.id === 'heading-1'));
    state = editorState.redo(state);
    assert.deepEqual(state.handout.blocks, deleted.handout.blocks);
    assert.equal(state.dirty, true);
});

test('H3 question editing remains sparse and can restore snapshot content and images', () => {
    let state = editorState.createEditorState(
        makeHandout([makeQuestionBlock({
            snapshot: {
                ...makeQuestionBlock().snapshot,
                images: [{
                    sourceImageId: 'source-image-1',
                    assetId: 'asset-1'
                }]
            },
            images: [{
                id: 'question-image-1',
                sourceImageId: 'source-image-1',
                assetId: 'asset-1',
                placement: 'below-stem',
                width: {
                    value: 60,
                    unit: 'percent'
                },
                alignment: 'center'
            }]
        })])
    );

    state = editorState.updateQuestionOverride(
        state,
        'question-block-1',
        'stem',
        'Locally edited stem'
    );
    assert.deepEqual(
        state.handout.blocks[0].contentOverrides,
        { stem: 'Locally edited stem' }
    );

    state = editorState.updateQuestionOverride(
        state,
        'question-block-1',
        'stem',
        state.handout.blocks[0].snapshot.stem
    );
    assert.deepEqual(state.handout.blocks[0].contentOverrides, {});

    state = editorState.updateBlock(
        state,
        'question-block-1',
        block => ({
            ...block,
            images: []
        })
    );
    assert.equal(state.handout.blocks[0].images.length, 0);

    state = editorState.restoreQuestionImages(
        state,
        'question-block-1'
    );
    assert.equal(state.handout.blocks[0].images.length, 1);
    assert.equal(state.handout.blocks[0].images[0].assetId, 'asset-1');
});

test('H3 preview physically removes teacher content from student projection', () => {
    const handout = editorState.normalizeForEditing(
        makeHandout([
            {
                id: 'teacher-callout',
                type: 'callout',
                variant: 'teacher',
                title: 'Teacher only',
                content: 'SECRET_CALLOUT'
            },
            makeQuestionBlock()
        ])
    );
    const student = preview.projectHandoutForPreview(
        handout,
        'student'
    );
    const teacher = preview.projectHandoutForPreview(
        handout,
        'teacher'
    );
    const protectedNeedles = [
        'SECRET_ANSWER_2',
        'SECRET_ANALYSIS',
        'SECRET_SOLUTION',
        'SECRET_TEACHER_NOTE',
        'SECRET_META',
        'SECRET_TRACE',
        'SECRET_CALLOUT'
    ];

    assert.equal(
        preview.containsProtectedContent(student, protectedNeedles),
        false
    );
    assert.equal(JSON.stringify(student).includes('"snapshot"'), false);
    assert.equal(JSON.stringify(student).includes('"sourceTrace"'), false);
    assert.equal(student.blocks.length, 1);
    assert.equal(
        student.blocks[0].question.display.answerPlacement,
        'hidden'
    );

    assert.equal(
        preview.containsProtectedContent(teacher, protectedNeedles),
        true
    );
    assert.equal(teacher.endSections.length, 2);
    assert.deepEqual(
        teacher.endSections.map(item => item.field),
        ['answer', 'solution']
    );
});

test('H3 HTML preview uses deterministic option layouts and escapes untrusted text', () => {
    assert.equal(preview.resolveOptionColumns('one-row', ['a']), 4);
    assert.equal(preview.resolveOptionColumns('two-columns', ['a']), 2);
    assert.equal(preview.resolveOptionColumns('one-column', ['a']), 1);
    assert.equal(preview.resolveOptionColumns('auto', ['a', 'b', 'c', 'd']), 4);
    assert.equal(
        preview.resolveOptionColumns('auto', [
            'Moderately long option A',
            'Moderately long option B'
        ]),
        2
    );
    assert.equal(
        preview.resolveOptionColumns('auto', [
            'A very long option whose text cannot safely share a narrow column with another answer'
        ]),
        1
    );

    const calls = [];
    const html = preview.renderMathHtml(
        '<script>bad()</script> and $x+1$',
        {
            renderToString(latex, options) {
                calls.push({ latex, options });
                return '<span class="safe-math">math</span>';
            }
        }
    );

    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /safe-math/);
    assert.equal(calls[0].latex, 'x+1');
    assert.equal(calls[0].options.trust, false);
    assert.equal(calls[0].options.throwOnError, false);
});

class MemoryCollection {
    constructor(table, rows) {
        this.table = table;
        this.rows = rows;
        this.maximum = Infinity;
    }

    equals(value) {
        this.rows = this.rows.filter(row => row?.[this.field] === value);
        return this;
    }

    reverse() {
        this.rows.reverse();
        return this;
    }

    limit(value) {
        this.maximum = Number(value);
        return this;
    }

    async toArray() {
        return structuredClone(this.rows.slice(0, this.maximum));
    }

    async delete() {
        for (const row of this.rows) {
            this.table.rows.delete(row.id);
        }
        return this.rows.length;
    }
}

class MemoryTable {
    constructor(name) {
        this.name = name;
        this.rows = new Map();
    }

    async add(value) {
        if (this.rows.has(value.id)) throw new Error('duplicate');
        return this.put(value);
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
        return structuredClone([...this.rows.values()]);
    }

    where(field) {
        const collection = new MemoryCollection(
            this,
            [...this.rows.values()]
        );
        collection.field = field;
        return collection;
    }

    orderBy(field) {
        return new MemoryCollection(
            this,
            [...this.rows.values()].sort((left, right) =>
                String(left?.[field] || '').localeCompare(
                    String(right?.[field] || '')
                )
            )
        );
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
        return args.pop()();
    }
}

const makeRepositoryHarness = () => {
    const db = new MemoryDatabase();
    const counters = new Map();
    let tick = 0;
    const repository = repositoryModule.createHandoutRepository({
        db,
        clock: () => new Date(
            Date.UTC(2026, 6, 28, 10, 0, tick++)
        ).toISOString(),
        idFactory(prefix) {
            const next = (counters.get(prefix) || 0) + 1;
            counters.set(prefix, next);
            return `${prefix}-${next}`;
        }
    });
    return { db, repository };
};

test('H3 repository duplicates handouts and owned Blob assets without aliasing', async () => {
    const { db, repository } = makeRepositoryHarness();
    let source = await repository.create({
        title: 'Original'
    });
    const imported = await repository.importAsset(source.id, {
        blob: new Blob(['asset-bytes'], {
            type: 'image/png'
        })
    });
    source = await repository.save({
        ...source,
        blocks: [{
            id: 'image-block-1',
            type: 'image',
            assetId: imported.id,
            placement: 'block',
            width: {
                value: 50,
                unit: 'percent'
            },
            alignment: 'center'
        }]
    }, {
        expectedUpdatedAt: source.updatedAt
    });

    const duplicate = await repository.duplicate(source.id);
    const sourceAsset = await repository.getAsset(imported.id);
    const copiedAssets = await repository.listAssets(duplicate.id);

    assert.notEqual(duplicate.id, source.id);
    assert.equal(duplicate.title, 'Original（副本）');
    assert.equal(copiedAssets.length, 1);
    assert.notEqual(copiedAssets[0].id, sourceAsset.id);
    assert.notEqual(copiedAssets[0].blob, sourceAsset.blob);
    assert.equal(
        await copiedAssets[0].blob.text(),
        await sourceAsset.blob.text()
    );
    assert.equal(duplicate.blocks[0].assetId, copiedAssets[0].id);
    assert.equal((await db.handouts.toArray()).length, 2);
    assert.equal(
        (await repository.get(source.id)).blocks[0].assetId,
        sourceAsset.id
    );
    await assert.rejects(
        () => repository.importAsset(source.id, {
            blob: new Blob([])
        }),
        /non-empty Blob|must contain a Blob/i
    );
});

test('H3 question library is read-only, bounded and returns only referenced assets', async () => {
    const { db } = makeRepositoryHarness();
    const question = {
        id: 'formal-question-1',
        createdAt: '2026-07-27T07:00:00.000Z',
        updatedAt: '2026-07-27T08:00:00.000Z',
        grade: 'Senior 2',
        type: 'Multiple choice',
        diff: 'Medium',
        systemKnowledge: 'Sets',
        stem: 'Find the union',
        options: ['A', 'B', 'C', 'D'],
        answer: 'B',
        images: [{
            id: 'formal-image-1'
        }]
    };
    await db.questions.put(question);
    await db.images.put({
        id: 'formal-image-1',
        blob: new Blob(['used'])
    });
    await db.images.put({
        id: 'unreferenced-image',
        blob: new Blob(['unused'])
    });
    const beforeQuestion = await db.questions.get(question.id);
    const beforeImages = await db.images.toArray();
    const library = questionLibraryModule.createHandoutQuestionLibrary({
        db
    });

    const results = await library.search({
        grade: 'Senior 2',
        query: 'union',
        limit: 5000
    });
    const bundle = await library.getQuestionBundle(question.id);
    const captured = questionInstance.captureQuestionForHandout({
        handoutId: 'handout-library',
        question: bundle.question,
        sourceImages: bundle.sourceImages,
        createAssetId: () => 'copied-asset-1',
        now: NOW
    });
    const comparison = await library.compareBlockSource({
        sourceQuestionId: question.id,
        snapshot: captured.snapshot,
        contentOverrides: {}
    });

    assert.equal(results.length, 1);
    assert.equal(results[0].id, question.id);
    assert.equal(bundle.sourceImages.length, 1);
    assert.deepEqual(bundle.missingImageIds, []);
    assert.equal(comparison.status, 'unchanged');
    assert.deepEqual(await db.questions.get(question.id), beforeQuestion);
    assert.deepEqual(await db.images.toArray(), beforeImages);
});
