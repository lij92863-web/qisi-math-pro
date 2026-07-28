'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const model = require('../qisi-handout-model.js');
const questionInstance = require('../qisi-handout-question-instance.js');
const assetModule = require('../qisi-handout-asset-repository.js');

const NOW = '2026-07-28T10:00:00.000Z';
const makeSnapshot = (value = {}) => ({
    snapshotVersion: 1,
    sourceQuestionId: 'source-1',
    sourceUpdatedAt: '2026-07-27T08:00:00.000Z',
    capturedAt: NOW,
    images: [],
    ...value
});

const makeQuestion = () => ({
    id: 'question-17',
    updatedAt: '2026-07-27T08:00:00.000Z',
    grade: '高二',
    diff: '中等',
    type: '单选题',
    stem: '已知 $a^2+b^2=1$，则（ ）',
    options: ['1', '2', '3', '4'],
    answer: 'A',
    analysis: '',
    solution: '由条件直接得到。',
    images: [{
        id: 'image-17',
        align: 'center',
        dimensions: {
            width: 42,
            unit: 'percent'
        }
    }],
    meta: {
        source: 'fixture'
    }
});

test('H2 handout model migrates legacy records without accepting future schemas', () => {
    const migrated = model.normalizeHandout({
        id: 'handout-legacy',
        name: '  函数   专题  ',
        items: [{
            id: 'body-1',
            type: 'body',
            text: '内容'
        }],
        createdAt: NOW
    });

    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.title, '函数 专题');
    assert.equal(migrated.status, 'draft');
    assert.equal(migrated.blocks.length, 1);
    assert.equal(migrated.blocks[0].content, '内容');
    assert.equal(migrated.updatedAt, NOW);
    assert.throws(() => model.normalizeHandout({
        ...migrated,
        schemaVersion: 2
    }), /newer than supported/i);
});

test('H2 validation rejects duplicate blocks and incomplete question snapshots', () => {
    const common = {
        schemaVersion: 1,
        id: 'handout-validation',
        title: '验证',
        status: 'draft',
        settings: {},
        createdAt: NOW,
        updatedAt: NOW,
        revision: 0
    };

    assert.equal(model.validateHandout({
        ...common,
        blocks: [
            { id: 'same', type: 'body', content: '正文' },
            { id: 'same', type: 'heading', level: 1, text: '标题' }
        ]
    }).ok, false);
    assert.equal(model.validateHandout({
        ...common,
        blocks: [{
            id: 'question-1',
            type: 'question',
            sourceQuestionId: 'source-1'
        }]
    }).ok, false);
    assert.equal(model.validateHandout({
        ...common,
        blocks: [{
            id: 'question-2',
            type: 'question',
            sourceQuestionId: 'source-1',
            snapshot: makeSnapshot({
                sourceQuestionId: 'source-2'
            }),
            contentOverrides: {}
        }]
    }).ok, false);
});

test('H2 block validation is type-specific and rejects malformed content', () => {
    const create = blocks => model.validateHandout({
        schemaVersion: 1,
        id: 'handout-block-schema',
        title: '块验证',
        status: 'draft',
        settings: {},
        blocks,
        createdAt: NOW,
        updatedAt: NOW,
        revision: 0
    });

    assert.equal(create([{
        id: 'heading-invalid',
        type: 'heading',
        level: 4,
        text: '越界'
    }]).ok, false);
    assert.equal(create([{
        id: 'body-invalid',
        type: 'body',
        content: ''
    }]).ok, false);
    assert.equal(create([{
        id: 'callout-invalid',
        type: 'callout',
        variant: 'arbitrary',
        content: '内容'
    }]).ok, false);
    assert.equal(create([{
        id: 'image-invalid',
        type: 'image',
        assetId: ''
    }]).ok, false);
    assert.equal(create([{
        id: 'question-invalid',
        type: 'question',
        sourceQuestionId: 'source-1',
        snapshot: makeSnapshot(),
        contentOverrides: {
            meta: {
                unsafe: true
            }
        }
    }]).ok, false);

    const cyclicSettings = {};
    cyclicSettings.self = cyclicSettings;
    assert.equal(model.validateHandout({
        schemaVersion: 1,
        id: 'handout-cyclic',
        title: '循环数据',
        status: 'draft',
        settings: cyclicSettings,
        blocks: [],
        createdAt: NOW,
        updatedAt: NOW,
        revision: 0
    }).ok, false);
});

test('H2 question capture copies Blob assets and never aliases source records', async () => {
    const question = makeQuestion();
    const sourceBlob = new Blob(['image-bytes'], {
        type: 'image/png'
    });
    const sourceImages = [{
        id: 'image-17',
        blob: sourceBlob,
        createdAt: NOW
    }];
    const originalQuestion = structuredClone(question);
    const captured = questionInstance.captureQuestionForHandout({
        handoutId: 'handout-capture',
        question,
        sourceImages,
        createAssetId: () => 'asset-17',
        now: NOW
    });

    assert.deepEqual(question, originalQuestion);
    assert.equal(captured.assets.length, 1);
    assert.equal(captured.assets[0].id, 'asset-17');
    assert.equal(captured.assets[0].sourceQuestionId, 'question-17');
    assert.equal(captured.assets[0].sourceImageId, 'image-17');
    assert.notEqual(captured.assets[0].blob, sourceBlob);
    assert.equal(
        await captured.assets[0].blob.text(),
        await sourceBlob.text()
    );
    assert.deepEqual(captured.snapshot.images, [{
        align: 'center',
        dimensions: {
            width: 42,
            unit: 'percent'
        },
        sourceImageId: 'image-17',
        assetId: 'asset-17'
    }]);
    assert.equal(captured.snapshot.meta.source, 'fixture');
    assert.equal('blob' in captured.snapshot.images[0], false);
});

test('H2 repeated references reuse one copied asset and missing source images fail closed', () => {
    const question = makeQuestion();
    question.images.push({
        id: 'image-17',
        align: 'right'
    });
    let sequence = 0;
    const captured = questionInstance.captureQuestionForHandout({
        handoutId: 'handout-repeat',
        question,
        sourceImages: [{
            id: 'image-17',
            blob: new Blob(['same'], {
                type: 'image/png'
            })
        }],
        createAssetId: () => `asset-${++sequence}`,
        now: NOW
    });

    assert.equal(captured.assets.length, 1);
    assert.equal(captured.snapshot.images.length, 2);
    assert.deepEqual(
        captured.snapshot.images.map(image => image.assetId),
        ['asset-1', 'asset-1']
    );
    assert.throws(() => questionInstance.captureQuestionForHandout({
        handoutId: 'handout-missing',
        question: makeQuestion(),
        sourceImages: [],
        createAssetId: () => 'asset-never',
        now: NOW
    }), error => error.code === 'HANDOUT_ASSET_MISSING');
});

test('H2 sparse overrides replace only explicit fields and reject unknown data', () => {
    const snapshot = {
        sourceQuestionId: 'question-1',
        stem: '原题',
        options: ['A', 'B'],
        answer: 'A',
        solution: '原解析'
    };
    const edited = {
        ...snapshot,
        stem: '讲义中的改写',
        answer: ''
    };
    const overrides = questionInstance.deriveQuestionOverrides(
        snapshot,
        edited
    );
    const resolved = questionInstance.applyQuestionOverrides(
        snapshot,
        overrides
    );

    assert.deepEqual(overrides, {
        stem: '讲义中的改写',
        answer: ''
    });
    assert.equal(resolved.stem, '讲义中的改写');
    assert.equal(resolved.answer, '');
    assert.equal(resolved.solution, '原解析');
    assert.equal(snapshot.stem, '原题');
    assert.throws(() => questionInstance.applyQuestionOverrides(
        snapshot,
        { arbitraryTypst: '#eval(...)' }
    ), /unsupported question override/i);
});

test('H2 source comparison is exact, field-level, and exposes override conflicts', () => {
    const question = makeQuestion();
    const snapshot = questionInstance.createQuestionSnapshot(question, {
        capturedAt: NOW,
        assetIdBySourceImageId: {
            'image-17': 'asset-17'
        }
    });
    const timestampOnly = {
        ...structuredClone(question),
        updatedAt: '2026-07-28T08:00:00.000Z'
    };
    const changed = {
        ...timestampOnly,
        stem: '源题已经修改',
        solution: '源题解析已经修改'
    };

    assert.deepEqual(
        questionInstance.compareQuestionSource(snapshot, timestampOnly),
        {
            status: 'unchanged',
            changedFields: [],
            conflictFields: [],
            sourceTimestampChanged: true
        }
    );
    assert.deepEqual(
        questionInstance.compareQuestionSource(snapshot, changed, {
            stem: '讲义局部改写'
        }),
        {
            status: 'updated',
            changedFields: ['stem', 'solution'],
            conflictFields: ['stem'],
            sourceTimestampChanged: true
        }
    );
    assert.equal(
        questionInstance.compareQuestionSource(snapshot, null).status,
        'missing'
    );
    assert.throws(() => questionInstance.compareQuestionSource(
        snapshot,
        {
            ...question,
            id: 'question-other'
        }
    ), error => error.code === 'HANDOUT_SOURCE_ID_MISMATCH');
});

test('H2 asset graph distinguishes blocking defects from removable orphans', () => {
    const handout = model.createHandout({
        title: '资产验证',
        blocks: [{
            id: 'question-block',
            type: 'question',
            sourceQuestionId: 'question-17',
            snapshot: makeSnapshot({
                sourceQuestionId: 'question-17',
                images: [{
                    sourceImageId: 'source-image-required',
                    assetId: 'asset-required'
                }]
            }),
            contentOverrides: {}
        }]
    }, {
        id: 'handout-assets',
        now: NOW
    });
    const valid = assetModule.verifyHandoutAssetGraph(handout, [{
        id: 'asset-required',
        handoutId: handout.id,
        blob: new Blob(['required'])
    }, {
        id: 'asset-orphan',
        handoutId: handout.id,
        blob: new Blob(['orphan'])
    }]);
    const missing = assetModule.verifyHandoutAssetGraph(handout, []);
    const wrongOwner = assetModule.verifyHandoutAssetGraph(handout, [{
        id: 'asset-required',
        handoutId: 'handout-other',
        blob: new Blob(['required'])
    }]);

    assert.equal(valid.ok, true);
    assert.deepEqual(valid.orphanIds, ['asset-orphan']);
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missingIds, ['asset-required']);
    assert.equal(wrongOwner.ok, false);
    assert.deepEqual(
        wrongOwner.ownershipMismatchIds,
        ['asset-required']
    );
});

test('H2 asset graph reads only schema-owned image paths', () => {
    const handout = model.createHandout({
        title: '来源证据不是资产引用',
        blocks: [{
            id: 'question-meta',
            type: 'question',
            sourceQuestionId: 'source-1',
            snapshot: makeSnapshot({
                meta: {
                    assetId: 'plain-source-evidence'
                }
            }),
            contentOverrides: {}
        }]
    }, {
        id: 'handout-meta',
        now: NOW
    });

    assert.deepEqual(
        assetModule.collectHandoutAssetIds(handout),
        []
    );
    assert.equal(
        assetModule.verifyHandoutAssetGraph(handout, []).ok,
        true
    );
});
