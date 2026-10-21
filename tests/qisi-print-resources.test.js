const test = require('node:test');
const assert = require('node:assert/strict');
const resources = require('../qisi-print-resources.js');

const question = (overrides = {}) => ({
    id: 'q1', stem: 's', options: ['A'], meta: { tags: ['t'] }, images: [{ id: 'i1' }], ...overrides
});

test('collectImageIds dedupes and ignores missing ids', () => {
    assert.deepEqual(resources.collectImageIds([
        { images: [{ id: 'a' }, { id: 'b' }] },
        { images: [{ id: 'a' }, {}] },
        { images: null }
    ]), ['a', 'b']);
    assert.deepEqual(resources.collectImageIds(null), []);
});

test('hydrateQuestionsForPrint clones the question and attaches data urls', async () => {
    const source = question({ images: [{ id: 'i1' }, { id: 'i2' }] });
    const result = await resources.hydrateQuestionsForPrint({
        questions: [source],
        loadImageRows: async ids => {
            assert.deepEqual(ids, ['i1', 'i2']);
            return [{ id: 'i1', blob: 'blob-1' }, { id: 'i3', blob: 'blob-3' }];
        },
        blobToDataUrl: async blob => 'data:' + blob
    });
    assert.equal(result[0].id, 'q1');
    assert.equal(result[0].images[0].url, 'data:blob-1');
    assert.equal('url' in result[0].images[1], false);
    // clones are independent of the source row (meta keeps the original shallow-copy semantics)
    result[0].options.push('B');
    assert.notEqual(result[0].meta, source.meta);
    assert.deepEqual(source.options, ['A']);
    assert.equal(source.images[0].url, undefined);
});

test('hydrateQuestionsForPrint skips the database read without image ids', async () => {
    let called = false;
    const result = await resources.hydrateQuestionsForPrint({
        questions: [question({ images: [] })],
        loadImageRows: async () => { called = true; return []; },
        blobToDataUrl: async () => 'data:'
    });
    assert.equal(called, false);
    assert.deepEqual(result[0].images, []);
});

test('hydrateQuestionsForPrint tolerates an empty paper', async () => {
    const result = await resources.hydrateQuestionsForPrint({
        questions: null, loadImageRows: async () => [], blobToDataUrl: async () => 'data:'
    });
    assert.deepEqual(result, []);
});

test('hydrateQuestionsForPrint fails closed without its ports', async () => {
    await assert.rejects(resources.hydrateQuestionsForPrint({ questions: [] }),
        error => error.code === 'PRINT_RESOURCES_DEPENDENCY_REQUIRED');
    await assert.rejects(resources.hydrateQuestionsForPrint({ questions: [], loadImageRows: async () => [] }),
        error => error.code === 'PRINT_RESOURCES_DEPENDENCY_REQUIRED');
});
