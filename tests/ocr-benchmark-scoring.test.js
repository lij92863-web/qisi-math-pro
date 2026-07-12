const test = require('node:test');
const assert = require('node:assert/strict');

const Scoring = require('../scripts/benchmark/score-ocr-result.js');
const { validate } = require('../benchmarks/ocr/scripts/validate-ground-truth.js');
const synthetic = require('../benchmarks/ocr/fixtures/synthetic-ground-truth.json');

test('normalization, CER, and LaTeX token F1 are deterministic', () => {
    assert.equal(Scoring.normalized('Ａ  B'), 'A B');
    assert.equal(Scoring.cer('abc', 'adc'), 1 / 3);
    assert.deepEqual(
        Scoring.multisetF1(['x', 'x'], ['x']),
        { precision: 1, recall: 0.5, f1: 2 / 3 }
    );
    assert.deepEqual(Scoring.latexTokens('\\frac{1}{2}'), [
        '\\frac', '{', '1', '}', '{', '2', '}'
    ]);
});

test('structure matches only questionNumber and sourceOrder', () => {
    const truth = [{
        questionNumber: '1', sourceOrder: 1, stem: 'alpha', options: ['a'],
        answer: 'A', solution: 's', formulas: []
    }];
    const semanticallySimilarWrongKey = [{
        questionNumber: '2', sourceOrder: 1, stem: 'alpha', options: ['a'],
        answer: 'A', solution: 's', formulas: []
    }];
    const result = Scoring.score(truth, semanticallySimilarWrongKey);
    assert.equal(result.matchedQuestions, 0);
    assert.equal(result.ownershipSafety.fabricatedQuestions, 1);
});

test('perfect result scores exactly and wrong attachment is fatal evidence', () => {
    const truth = [{
        questionNumber: '1', sourceOrder: 1, stem: 'x', options: ['1', '2'],
        answer: 'A', solution: 'because', formulas: ['x^2']
    }];
    const perfect = Scoring.score(truth, structuredClone(truth));
    assert.equal(perfect.rawCer, 0);
    assert.equal(perfect.formulaExact, 1);
    assert.equal(perfect.optionCompleteness, 1);
    assert.equal(perfect.ownershipSafety.wrongAttachments, 0);

    const wrong = structuredClone(truth);
    wrong[0].answer = 'B';
    assert.equal(Scoring.score(truth, wrong).ownershipSafety.wrongAttachments, 1);
});

test('synthetic public corpus covers ten declared categories and validates', () => {
    assert.equal(synthetic.length, 10);
    assert.deepEqual(validate(synthetic), []);
    assert.equal(synthetic.every(row => row.notes.includes('synthetic')), true);
});
