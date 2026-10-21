const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../qisi-manual-entry-model.js');

const splitQuestion = (stem, type, options) => ({ stem: 'split:' + stem, type: type || '解答题', options: options || [] });

const form = (overrides = {}) => ({
    grade: '高一', diff: '中等', type: '单选题',
    stem: 'stem', options: ['A', 'B', 'C', 'D'], answer: 'A', solution: 'S',
    tags: ' a, b ,, c ',
    systemKnowledge: 'SY', personalKnowledge: '', ...overrides
});

test('buildManualQuestion builds the formal question shape', () => {
    const { question, prepared } = model.buildManualQuestion({
        form: form(), now: 1234, splitQuestion,
        images: [{ id: 'i1' }, { id: 'i2', align: 'left' }, { id: '' }, null]
    });
    assert.deepEqual(prepared, { stem: 'split:stem', type: '单选题', options: ['A', 'B', 'C', 'D'] });
    assert.deepEqual(question, {
        id: '1234', grade: '高一', diff: '中等', type: '单选题',
        knowledge: 'SY', knowledgeType: 'system', systemKnowledge: 'SY', personalKnowledge: '',
        stem: 'split:stem', options: ['A', 'B', 'C', 'D'], answer: 'A', solution: 'S',
        images: [{ id: 'i1', align: 'center' }, { id: 'i2', align: 'left' }],
        meta: { grade: '高一', diff: '中等', knowledge: 'SY', knowledgeType: 'system', systemKnowledge: 'SY', personalKnowledge: '', tags: ['a', 'b', 'c'] },
        createdAt: 1234, updatedAt: 1234
    });
});

test('personal knowledge wins over system knowledge', () => {
    const { question } = model.buildManualQuestion({
        form: form({ systemKnowledge: 'SY', personalKnowledge: 'PK' }), now: 1, splitQuestion
    });
    assert.equal(question.knowledge, 'PK');
    assert.equal(question.knowledgeType, 'personal');
    assert.equal(question.meta.knowledgeType, 'personal');
});

test('missing knowledge falls back to an empty system value', () => {
    const { question } = model.buildManualQuestion({ form: form({ systemKnowledge: '', personalKnowledge: '' }), now: 1, splitQuestion });
    assert.equal(question.knowledge, '');
    assert.equal(question.knowledgeType, 'system');
});

test('cleanEntryImages keeps only identified images with a default alignment', () => {
    assert.deepEqual(model.cleanEntryImages([{ id: 'a' }, { id: 'b', align: 'right' }, { id: null }, null]), [
        { id: 'a', align: 'center' }, { id: 'b', align: 'right' }
    ]);
    assert.deepEqual(model.cleanEntryImages(null), []);
});

test('splitTags trims, drops blanks and tolerates non-strings', () => {
    assert.deepEqual(model.splitTags(' a , b ,, '), ['a', 'b']);
    assert.deepEqual(model.splitTags(null), []);
});

test('buildManualQuestion fails closed on missing input', () => {
    assert.throws(() => model.buildManualQuestion({ form: form(), now: 1 }), error => error.code === 'MANUAL_ENTRY_SPLIT_HELPER_REQUIRED');
    assert.throws(() => model.buildManualQuestion({ form: null, now: 1, splitQuestion }), error => error.code === 'MANUAL_ENTRY_INPUT_INVALID');
    assert.throws(() => model.buildManualQuestion({ form: form(), now: NaN, splitQuestion }), error => error.code === 'MANUAL_ENTRY_INPUT_INVALID');
});
