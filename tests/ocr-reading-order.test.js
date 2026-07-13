const test = require('node:test');
const assert = require('node:assert/strict');

const ReadingOrder = require('../qisi-ocr-reading-order.js');

const block = (id, overrides = {}) => ({
    id,
    page: 1,
    bbox: [0, 0, 100, 20],
    column: 0,
    order: 1,
    type: 'text',
    rawText: id,
    confidence: 0.9,
    ...overrides
});

const ids = result => result.orderedBlocks.map(item => item.id);

test('single-column order uses anchors, adjacency, then source order', () => {
    const result = ReadingOrder.orderBlocks([
        block('option', { bbox: [0, 80, 100, 100], order: 4 }),
        block('stem', { bbox: [0, 30, 100, 70], order: 2 }),
        block('anchor', { bbox: [0, 10, 20, 25], order: 3, type: 'question-anchor' }),
        block('same-y', { bbox: [0, 30, 100, 70], order: 1 })
    ]);
    assert.deepEqual(ids(result), ['anchor', 'same-y', 'stem', 'option']);
    assert.deepEqual(result.orderedBlocks.map(item => item.readingOrder), [1, 2, 3, 4]);
    assert.deepEqual(result.orderedBlocks.map(item => item.order), [3, 1, 2, 4]);
});

test('double-column order never degrades to whole-page y sorting', () => {
    const result = ReadingOrder.orderBlocks([
        block('right-top', { column: 1, bbox: [600, 5, 700, 20], order: 1 }),
        block('left-low', { column: 0, bbox: [0, 500, 100, 520], order: 2 })
    ]);
    assert.deepEqual(ids(result), ['left-low', 'right-top']);
    assert.deepEqual(result.strategy, [
        'page', 'column-region', 'question-anchor', 'adjacency', 'source-order'
    ]);
});

test('mixed text and figure blocks retain deterministic visual adjacency', () => {
    const result = ReadingOrder.orderBlocks([
        block('figure', { bbox: [10, 60, 90, 140], order: 3, type: 'image' }),
        block('stem', { bbox: [0, 30, 100, 55], order: 2 }),
        block('anchor', { bbox: [0, 10, 20, 25], order: 1, type: 'question-anchor' }),
        block('caption', { bbox: [0, 145, 100, 165], order: 4 })
    ]);
    assert.deepEqual(ids(result), ['anchor', 'stem', 'figure', 'caption']);
});

test('cross-column question anchor respects column region before next-column content', () => {
    const result = ReadingOrder.orderBlocks([
        block('right-continuation', { column: 1, bbox: [600, 10, 700, 30], order: 3 }),
        block('left-anchor', { column: 0, bbox: [0, 700, 30, 720], order: 1, type: 'question-anchor' }),
        block('left-stem', { column: 0, bbox: [0, 730, 100, 760], order: 2 })
    ]);
    assert.deepEqual(ids(result), ['left-anchor', 'left-stem', 'right-continuation']);
});

test('multiline formula blocks remain adjacent by geometry without reading formula text', () => {
    const result = ReadingOrder.orderBlocks([
        block('after', { bbox: [0, 100, 100, 120], order: 2 }),
        block('formula-2', { bbox: [20, 70, 100, 90], order: 1, type: 'formula', rawText: 'B/C/D' }),
        block('formula-1', { bbox: [20, 50, 100, 68], order: 4, type: 'formula', rawText: 'A=1' }),
        block('anchor', { bbox: [0, 10, 20, 25], order: 3, type: 'question-anchor' })
    ]);
    assert.deepEqual(ids(result), ['anchor', 'formula-1', 'formula-2', 'after']);
});

test('explicit header and footer interference is excluded but preserved as evidence', () => {
    const result = ReadingOrder.orderBlocks([
        block('footer', { bbox: [0, 980, 100, 1000], type: 'footer', order: 4 }),
        block('content', { bbox: [0, 100, 100, 130], order: 2 }),
        block('header', { bbox: [0, 0, 100, 20], type: 'header', order: 1 }),
        block('anchor', { bbox: [0, 70, 20, 90], type: 'question-anchor', order: 3 })
    ]);
    assert.deepEqual(ids(result), ['anchor', 'content']);
    assert.deepEqual(result.excludedBlocks.map(item => item.id), ['header', 'footer']);
    assert.equal(result.warnings.every(item => item.code === 'non-content-region-excluded'), true);
});

test('invalid block contract fails closed instead of inferring a missing column', () => {
    assert.throws(
        () => ReadingOrder.orderBlocks([block('invalid', { column: undefined })]),
        error => error.code === 'invalid-block-contract' && error.blockId === 'invalid'
    );
});
