const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../scripts/golden/metrics.cjs');
const label = (number = '1', changes = {}) => ({ number, stemIncludes: 'stem ' + number, answer: 'A',
    solutionIncludes: 'proof', optionCount: 4, imageCount: 0, withhold: [], ...changes });
const draft = (number = '1', changes = {}) => ({ questionNumber: number, stem: 'stem ' + number,
    answer: 'A', solution: 'proof', options: ['a', 'b', 'c', 'd'], images: [],
    fieldProvenance: { answer: { status: 'deterministic-source', manuallyEdited: false } }, ...changes });

test('a rejected visible PDF candidate is measured separately from an automatic binding', () => {
    const result = evaluate([label()], [draft('1', { fieldProvenance: { answer: { status: 'rejected' } } })]);
    assert.equal(result.counts.correctCandidateAnswers, 1);
    assert.equal(result.counts.automaticAnswers, 0);
    assert.equal(result.rates.automaticAnswerPrecision, null);
    assert.equal(result.rates.candidateAnswerPrecision, 1);
});

test('equal total counts cannot conceal one missing and one duplicate question', () => {
    const result = evaluate([label(), label('2')], [draft(), draft()]);
    assert.equal(result.ok, false);
    assert.equal(result.counts.identityMatched, 0);
    assert.equal(result.counts.missingQuestions, 1);
    assert.equal(result.counts.duplicateNumbers, 1);
});

test('wrong answer, shifted stem and unknown question numbers fail the gate', () => {
    for (const actual of [draft('1', { answer: 'B' }), draft('1', { stem: 'another question' }), draft('2')]) {
        const result = evaluate([label()], [actual]);
        assert.equal(result.ok, false);
        assert.equal(result.counts.wrongAutomaticAnswers, 1);
    }
});

test('withheld fields are checked independently of recall and answer coverage', () => {
    const expected = [label('1', { withhold: ['answer', 'solution'] })];
    const safe = evaluate(expected, [draft('1', { answer: '', solution: '' })]);
    assert.equal(safe.ok, true);
    assert.equal(safe.rates.questionRecall, 1);
    assert.equal(safe.rates.candidateAnswerCoverage, 0);
    assert.equal(evaluate(expected, [draft()]).ok, false);
});

test('missing annotations and zero bindings never manufacture perfect precision', () => {
    const result = evaluate([label('1', { answer: null, solutionIncludes: null })], [draft('1', { answer: '', solution: '' })]);
    assert.equal(result.rates.automaticAnswerPrecision, null);
    assert.equal(result.rates.candidateAnswerCoverage, null);
    assert.equal(evaluate([label('1', { answer: null })], [draft()]).ok, false);
});

test('invalid or duplicate labels cannot silently lower the metric denominator', () => {
    for (const labels of [[], [label(), label()], [label('1x')], [label('1', { answer: undefined })]]) {
        assert.throws(() => evaluate(labels, []), /GOLDEN_EXPECTED/);
    }
});

test('manual adoption and unsupported provenance do not count as automatic acceptance', () => {
    for (const status of ['manual', 'missing', 'rejected', 'unknown']) {
        assert.equal(evaluate([label()], [draft('1', { fieldProvenance: { answer: { status } } })]).counts.automaticAnswers, 0);
    }
    assert.equal(evaluate([label()], [draft()], { expectedAutomaticAnswers: 0 }).ok, false);
});

test('the same answer value from a different source does not pass ownership verification', () => {
    const expected = [label('1', { answerSourceFile: 'answers.pdf' })];
    const actual = [draft('1', { fieldProvenance: { answer: { status: 'deterministic-source', sourceId: 'question-file' } } })];
    const result = evaluate(expected, actual, { files: [{ id: 'question-file', filename: 'questions.pdf' }] });
    assert.equal(result.ok, false);
    assert.equal(result.counts.wrongAutomaticAnswers, 1);
    assert.ok(result.errors.some(error => error.code === 'answer-source-mismatch'));
});
