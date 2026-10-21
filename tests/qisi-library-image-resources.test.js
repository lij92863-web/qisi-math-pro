const test = require('node:test');
const assert = require('node:assert/strict');
const resources = require('../qisi-library-image-resources.js');

const applyOptionSplit = question => {
    question.splitApplied = true;
    return question;
};

const storage = rows => {
    const handle = { ids: null, async loadImageRecords(ids) { handle.ids = ids; return rows; } };
    return handle;
};

test('normalizeRows fills option/image arrays and knowledge defaults', () => {
    const list = resources.normalizeRows([{ id: 'q1' }, { id: 'q2', knowledge: 'K', knowledgeType: 'personal', meta: { knowledgeType: 'personal' } }], applyOptionSplit);
    assert.deepEqual(list[0].options, ['', '', '', '']);
    assert.deepEqual(list[0].images, []);
    assert.equal(list[0].knowledge, '');
    assert.equal(list[0].knowledgeType, 'system');
    assert.equal(list[0].systemKnowledge, '');
    assert.equal(list[0].splitApplied, true);
    assert.equal(list[1].personalKnowledge, 'K');
    assert.equal(list[1].systemKnowledge, '');
});

test('normalizeRows keeps existing values and meta knowledge', () => {
    const list = resources.normalizeRows([{
        id: 'q', options: ['A'], images: [{ id: 'i' }], knowledge: 'K', meta: { knowledge: 'K', knowledgeType: 'personal' }
    }], applyOptionSplit);
    assert.deepEqual(list[0].options, ['A']);
    assert.equal(list[0].knowledgeType, 'personal');
    assert.equal(list[0].personalKnowledge, 'K');
});

test('attachImageUrls loads every id once and attaches display urls', async () => {
    const remembered = [];
    const created = [];
    const store = storage([{ id: 'i1', blob: 'blob-1' }, { id: 'i2', blob: 'blob-2' }]);
    const list = [{
        id: 'q1',
        options: ['', '', '', ''],
        images: [{ id: 'i1' }, { id: 'i2' }, { id: 'i1' }]
    }];
    await resources.attachImageUrls({
        items: list, storage: store, applyOptionSplit,
        createObjectUrl: blob => { created.push(blob); return 'url:' + blob; },
        rememberUrl: url => remembered.push(url)
    });
    assert.deepEqual(store.ids.sort(), ['i1', 'i2']);
    assert.deepEqual(created, ['blob-1', 'blob-2', 'blob-1']);
    assert.deepEqual(list[0].images.map(image => image.url), ['url:blob-1', 'url:blob-2', 'url:blob-1']);
    assert.equal(list[0].images[0].displayable, true);
    assert.equal(list[0].images[0].missingBlob, false);
    assert.equal(remembered.length, 3);
});

test('attachImageUrls marks missing blobs and warns with the owning identity', async () => {
    const warnings = [];
    const list = [{ id: 'q1', options: ['', '', '', ''], images: [{ id: 'gone' }] }];
    await resources.attachImageUrls({
        items: list, storage: storage([]), applyOptionSplit,
        createObjectUrl: () => { throw new Error('must not create'); },
        warn: (message, payload) => warnings.push([message, payload])
    });
    assert.equal(list[0].images[0].url, '');
    assert.equal(list[0].images[0].displayable, false);
    assert.equal(list[0].images[0].missingBlob, true);
    assert.deepEqual(warnings, [['[QUESTION_IMAGE][missing-blob]', { questionId: 'q1', imageId: 'gone' }]]);
});

test('attachImageUrls does not query storage when no image ids exist', async () => {
    let called = false;
    const list = [{ id: 'q1', options: ['', '', '', ''], images: [] }];
    await resources.attachImageUrls({
        items: list, storage: { async loadImageRecords() { called = true; return []; } },
        applyOptionSplit, createObjectUrl: () => 'url'
    });
    assert.equal(called, false);
});

test('attachImageUrls fails closed without storage or a url factory', async () => {
    await assert.rejects(resources.attachImageUrls({ items: [], applyOptionSplit, createObjectUrl: () => 'u' }),
        error => error.code === 'LIBRARY_IMAGE_RESOURCES_STORAGE_REQUIRED');
    await assert.rejects(resources.attachImageUrls({ items: [], applyOptionSplit, storage: { loadImageRecords: async () => [] } }),
        error => error.code === 'LIBRARY_IMAGE_RESOURCES_URL_FACTORY_REQUIRED');
});
