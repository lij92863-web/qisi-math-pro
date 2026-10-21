const test = require('node:test'), assert = require('node:assert/strict');
const { evaluate } = require('../scripts/golden/metrics.cjs');
const expected = (number = '1', changes = {}) => ({ number, stemIncludes: 'identity ' + number, answer: 'A',
    solutionIncludes: 'proof', optionCount: 4, imageCount: 0, withhold: [], ...changes });
const actual = (number = '1', changes = {}) => ({ questionNumber: number, stem: 'identity ' + number, answer: 'A',
    solution: 'proof', options: ['one', 'two', 'three', 'four'], images: [],
    fieldProvenance: { answer: { status: 'deterministic-source' } }, ...changes });
function closed(result) {
    const c = result.counts;
    assert.equal(c.correctAutomaticAnswers + c.wrongAutomaticAnswers + c.ungradedAutomaticAnswers, c.automaticAnswers,
        'Every automatically accepted answer must belong to exactly one accounting bucket');
}

test('duplicate expected identities stay ungraded rather than disappearing from accepted-answer accounting', () => {
    for (const answer of ['A', null]) {
        const result = evaluate([expected('1', { answer })], [actual(), actual()]);
        assert.equal(result.ok, false);
        assert.equal(result.counts.automaticAnswers, 2);
        assert.equal(result.counts.ambiguousAutomaticAnswers, 2);
        assert.equal(result.counts.ungradedAutomaticAnswers, 2);
        assert.equal(result.counts.correctAutomaticAnswers, 0);
        assert.equal(result.counts.wrongAutomaticAnswers, 0);
        assert.equal(result.rates.automaticAnswerPrecision, null);
        closed(result);
    }
});

test('a known wrong identity is not counted again as ungraded when its answer is unannotated', () => {
    const result = evaluate([expected('1', { answer: null })], [actual('1', { stem: 'different identity' })]);
    assert.equal(result.counts.wrongAutomaticAnswers, 1);
    assert.equal(result.counts.ungradedAutomaticAnswers, 0);
    assert.equal(result.rates.automaticAnswerPrecision, 0);
    closed(result);
});

test('a known wrong source remains a wrong binding even without an annotated answer value', () => {
    const result = evaluate([expected('1', { answer: null, answerSourceFile: 'answers.docx' })], [actual()]);
    assert.equal(result.counts.wrongAutomaticAnswers, 1);
    assert.equal(result.counts.ungradedAutomaticAnswers, 0);
    assert.equal(result.rates.automaticAnswerPrecision, 0);
    closed(result);
});

test('a forbidden automatic answer cannot be counted as correct merely because its text matches', () => {
    const result = evaluate([expected('1', { withhold: ['answer'] })], [actual()]);
    assert.equal(result.ok, false);
    assert.equal(result.counts.wrongAutomaticAnswers, 1);
    assert.equal(result.counts.correctAutomaticAnswers, 0);
    assert.equal(result.counts.ungradedAutomaticAnswers, 0);
    assert.equal(result.rates.automaticAnswerPrecision, 0);
    closed(result);
});

test('duplicate unexpected numbers remain individually wrong and cannot be laundered into ambiguity', () => {
    const result = evaluate([expected()], [actual('2'), actual('2')]);
    assert.equal(result.counts.wrongAutomaticAnswers, 2);
    assert.equal(result.counts.ungradedAutomaticAnswers, 0);
    assert.equal(result.counts.ambiguousAutomaticAnswers, 0);
    closed(result);
});

test('one uniquely identified unannotated accepted value stays unknown', () => {
    const result = evaluate([expected('1', { answer: null })], [actual()]);
    assert.equal(result.counts.correctAutomaticAnswers, 0);
    assert.equal(result.counts.wrongAutomaticAnswers, 0);
    assert.equal(result.counts.ungradedAutomaticAnswers, 1);
    assert.equal(result.counts.ambiguousAutomaticAnswers, 0);
    assert.equal(result.rates.automaticAnswerPrecision, null);
    closed(result);
});

test('mixed correct, wrong-source, unexpected and duplicate answers close the full denominator', () => {
    const result = evaluate([expected(), expected('2', { answer: null }), expected('3', { answerSourceFile: 'answers.docx' })],
        [actual(), actual('2'), actual('2'), actual('3'), actual('4')]);
    assert.equal(result.ok, false);
    assert.equal(result.counts.automaticAnswers, 5);
    assert.equal(result.counts.correctAutomaticAnswers, 1);
    assert.equal(result.counts.wrongAutomaticAnswers, 2);
    assert.equal(result.counts.ungradedAutomaticAnswers, 2);
    assert.equal(result.counts.ambiguousAutomaticAnswers, 2);
    assert.equal(result.rates.automaticAnswerPrecision, null);
    closed(result);
});

test('duplicate identities cannot hide the known policy error of accepting explicitly withheld answers', () => {
    const result = evaluate([expected('1', { withhold: ['answer'] })], [actual(), actual()]);
    assert.equal(result.counts.wrongAutomaticAnswers, 2);
    assert.equal(result.counts.ungradedAutomaticAnswers, 0);
    assert.equal(result.counts.ambiguousAutomaticAnswers, 0);
    closed(result);
});

test('independently provable wrong duplicate records are separated from the remaining unresolved duplicate', () => {
    const result = evaluate([expected('1', { answerSourceFile: 'answers.docx' })], [
        actual('1', { fieldProvenance: { answer: { status: 'deterministic-source', sourceId: 'owner' } } }),
        actual('1', { stem: 'wrong identity' }), actual('1', { answer: 'B' }), actual()
    ], { files: [{ id: 'owner', filename: 'answers.docx' }] });
    assert.equal(result.counts.automaticAnswers, 4);
    assert.equal(result.counts.wrongAutomaticAnswers, 3);
    assert.equal(result.counts.correctAutomaticAnswers, 0);
    assert.equal(result.counts.ungradedAutomaticAnswers, 1);
    assert.equal(result.counts.ambiguousAutomaticAnswers, 1);
    assert.equal(result.rates.automaticAnswerPrecision, null);
    closed(result);
});
