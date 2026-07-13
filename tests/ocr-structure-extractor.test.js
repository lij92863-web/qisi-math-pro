const test = require('node:test');
const assert = require('node:assert/strict');

const ReadingOrder = require('../qisi-ocr-reading-order.js');
const Structure = require('../qisi-ocr-structure-extractor.js');

const block = (id, type, rawText, overrides = {}) => ({
    id,
    page: 1,
    bbox: [0, 0, 100, 20],
    column: 0,
    order: 1,
    type,
    rawText,
    confidence: 0.9,
    ...overrides
});

const extract = (blocks, options) => Structure.extractQuestionStructures(
    ReadingOrder.orderBlocks(blocks),
    options
);

test('extracts anchor, stem, and option evidence with complete option fields', () => {
    const result = extract([
        block('q1', 'question-anchor', '1.', { bbox: [0, 0, 20, 20], order: 1 }),
        block('stem', 'stem', '  求 x 的值  ', { bbox: [0, 30, 100, 50], order: 2 }),
        block('a', 'option', 'A. 1', { bbox: [0, 60, 100, 80], order: 3 }),
        block('b', 'option', 'B．2', { bbox: [0, 90, 100, 110], order: 4 })
    ]);
    assert.equal(result.questions.length, 1);
    const question = result.questions[0];
    assert.equal(question.questionNumber, '1');
    assert.equal(question.stem.rawText, '  求 x 的值  ');
    assert.equal(question.stem.normalizedText, '求 x 的值');
    assert.deepEqual(question.options.map(option => ({
        label: option.label,
        rawText: option.rawText,
        normalizedText: option.normalizedText,
        bbox: option.bbox,
        confidence: option.confidence,
        missing: option.missing
    })), [
        { label: 'A', rawText: 'A. 1', normalizedText: '1', bbox: [0, 60, 100, 80], confidence: 0.9, missing: false },
        { label: 'B', rawText: 'B．2', normalizedText: '2', bbox: [0, 90, 100, 110], confidence: 0.9, missing: false }
    ]);
});

test('raw JSON wrapper is rejected as an option and retained as rejected evidence', () => {
    const result = extract([
        block('q1', 'question-anchor', '1', { order: 1 }),
        block('json', 'option', 'A. {"answer":"B"}', { bbox: [0, 30, 100, 50], order: 2 })
    ]);
    assert.deepEqual(result.questions[0].options, []);
    assert.equal(result.rejectedEvidence[0].id, 'json');
    assert.equal(result.rejectedEvidence[0].rawText, 'A. {"answer":"B"}');
    assert.equal(result.warnings.some(item => item.code === 'unsafe-option-wrapper'), true);
});

test('solution-shaped evidence never becomes an option even when it starts with A', () => {
    const result = extract([
        block('q1', 'question-anchor', '1', { order: 1 }),
        block('solution', 'solution', 'A. 因为 x=1', { bbox: [0, 30, 100, 50], order: 2 })
    ]);
    assert.deepEqual(result.questions[0].options, []);
    assert.equal(result.questions[0].solution.rawText, 'A. 因为 x=1');
});

test('answer evidence cannot fabricate a missing stem or inferred option', () => {
    const result = extract([
        block('q1', 'question-anchor', '1', { order: 1 }),
        block('answer', 'answer', 'B', { bbox: [0, 30, 100, 50], order: 2 })
    ]);
    const question = result.questions[0];
    assert.equal(question.stem.rawText, '');
    assert.equal(question.stem.normalizedText, '');
    assert.deepEqual(question.options, []);
    assert.equal(question.answer.rawText, 'B');
});

test('formula and image evidence preserve geometry and block identity', () => {
    const result = extract([
        block('q1', 'question-anchor', '1', { order: 1 }),
        block('formula', 'formula', 'x^2=1', { bbox: [10, 30, 80, 50], order: 2, latex: 'x^2=1' }),
        block('figure', 'image', '', { bbox: [10, 60, 90, 140], order: 3, imageId: 'figure-1' })
    ]);
    assert.deepEqual(result.questions[0].formulas, [{
        rawText: 'x^2=1', latex: 'x^2=1', bbox: [10, 30, 80, 50],
        confidence: 0.9, blockId: 'formula'
    }]);
    assert.deepEqual(result.questions[0].images, [{
        imageId: 'figure-1', bbox: [10, 60, 90, 140],
        role: 'unclassified', confidence: 0.9, blockId: 'figure'
    }]);
});

test('missing option markers are emitted only from explicit expected labels', () => {
    const result = extract([
        block('q1', 'question-anchor', '1', { order: 1 }),
        block('a', 'option', 'A. one', { bbox: [0, 30, 100, 50], order: 2 })
    ], { expectedOptionLabelsByQuestion: { 1: ['A', 'B'] } });
    assert.deepEqual(result.questions[0].options.map(option => [
        option.label, option.normalizedText, option.bbox, option.confidence, option.missing
    ]), [
        ['A', 'one', [0, 30, 100, 50], 0.9, false],
        ['B', '', null, null, true]
    ]);
});

test('unanchored blocks remain unassigned and no question gains write authority', () => {
    const result = extract([
        block('orphan', 'stem', 'orphan text', { order: 1 }),
        block('q1', 'question-anchor', '1', { bbox: [0, 30, 20, 50], order: 2 }),
        block('stem', 'stem', 'valid', { bbox: [0, 60, 100, 80], order: 3 })
    ]);
    assert.deepEqual(result.unassignedBlocks.map(item => item.id), ['orphan']);
    assert.equal(result.questions[0].ownershipStatus, 'unvalidated');
    assert.equal(result.questions[0].eligibleForControlledWrite, false);
    assert.equal(result.questions[0].eligibleForFormalAdmission, false);
});
