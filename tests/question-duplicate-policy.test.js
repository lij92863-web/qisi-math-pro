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
