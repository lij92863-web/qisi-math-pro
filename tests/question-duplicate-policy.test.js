const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-question-duplicate-policy.js');

const question = (overrides = {}) => ({
    id: 'question-1', stem: 'Find $x$.',
    options: ['One', 'Two', 'Three', 'Four'], answer: 'A',
    ...overrides
});

test('duplicate policy emits stable exact, similar, conflict, and none codes', () => {
    const existing = [question()];
    assert.equal(Policy.evaluate({
        candidate: question({ id: 'draft-1' }), existingQuestions: existing
    }).code, Policy.DECISIONS.EXACT);
    assert.equal(Policy.evaluate({
        candidate: question({ id: 'draft-2', answer: 'B' }),
        existingQuestions: existing
    }).code, Policy.DECISIONS.ANSWER_CONFLICT);
    assert.equal(Policy.evaluate({
        candidate: question({ id: 'draft-3', options: ['Different'] }),
        existingQuestions: existing
    }).code, Policy.DECISIONS.SIMILAR);
    assert.equal(Policy.evaluate({
        candidate: question({ id: 'draft-4', stem: 'Another question' }),
        existingQuestions: existing
    }).code, Policy.DECISIONS.NONE);
});

test('fingerprints are canonical and deleted rows do not block admission', () => {
    const candidate = question({
        id: 'draft-1', stem: ' Find \\left( x \\right) 。 ',
        options: ['Ａ', 'Ｂ']
    });
    const existing = question({
        stem: 'find(x)', options: ['A', 'B'], deletedAt: 1
    });
    const result = Policy.evaluate({
        candidate, existingQuestions: [existing]
    });
    assert.equal(result.code, Policy.DECISIONS.NONE);
    assert.equal(Object.isFrozen(result), true);
});

test('malformed input fails closed', () => {
    assert.throws(
        () => Policy.evaluate({ candidate: null }),
        error => error.code === 'DUPLICATE_POLICY_INPUT_INVALID'
    );
    assert.throws(
        () => Policy.evaluate({ candidate: question(), existingQuestions: {} }),
        error => error.code === 'DUPLICATE_POLICY_INPUT_INVALID'
    );
});

test('one pass preserves first exact precedence, first similar fallback and legacy delimiters', () => {
    const candidate = question({ stem: 's', options: ['one'], answer: 'A' });
    const similar = question({ id: 'similar-first', stem: 's', options: ['two'] });
    const exact = question({ id: 'exact-later', stem: 's', options: ['one'], answer: 'B' });
    const rows = [question({ ...exact, id: 'deleted', deletedAt: 1 }), similar, exact, question({ ...exact, id: 'exact-last', answer: 'A' })];
    const before = structuredClone(rows);
    assert.equal(Policy.evaluate({ candidate, existingQuestions: rows }).matchedQuestionId, 'exact-later');
    assert.equal(Policy.evaluate({ candidate, existingQuestions: rows }).code, Policy.DECISIONS.ANSWER_CONFLICT);
    assert.equal(Policy.evaluate({ candidate, existingQuestions: [similar, { ...similar, id: 'similar-last' }] }).matchedQuestionId, 'similar-first');
    // Legacy concatenation may collide across stem/options; retain its behavior in this optimization.
    const collision = Policy.evaluate({ candidate: question({ stem: 'a__b', options: [] }), existingQuestions: [question({ stem: 'a', options: ['b__'] })] });
    assert.equal(collision.code, Policy.DECISIONS.EXACT);
    assert.deepEqual(rows, before);
});
