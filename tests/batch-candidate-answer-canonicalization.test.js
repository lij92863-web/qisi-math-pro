const test = require('node:test');
const assert = require('node:assert/strict');

const merge = require('../qisi-batch-candidate-merge.js');

const cleanText = value => String(value ?? '').trim();
const badCharCount = value => (String(value || '').match(/[�锟斤拷]/g) || []).length;
const latexSignalCount = value => (String(value || '').match(/\\[a-zA-Z]+|\$/g) || []).length;
const optionCount = options => (Array.isArray(options) ? options : [])
    .filter(option => cleanText(option)).length;
const qualityScore = item => optionCount(item?.options) * 60 + cleanText(item?.stem).length;
const mergeImages = (...lists) => lists.flat().filter(Boolean);
const allText = item => [item?.stem, item?.answer, item?.solution].map(cleanText).join('\n');
const betterText = (current, candidate) => (
    cleanText(candidate).length > cleanText(current).length ? candidate : current
);

const merger = merge.createBatchCandidateMerge({
    text: cleanText,
    badCharCount,
    latexSignalCount,
    optionCount,
    qualityScore,
    mergeImages,
    allText,
    betterText
});

const answerCandidate = (id, answer) => ({
    id,
    questionNumber: '7',
    stem: '求满足条件的取值范围（    ）',
    options: ['1', '2', '3', '4'],
    answer,
    solution: '解析。',
    images: [],
    warnings: []
});

const mergeAnswers = (left, right) => merger.mergeCandidate(
    answerCandidate('draft-left', left),
    answerCandidate('draft-right', right)
);

test('an option answer survives its own decoration', () => {
    for (const [left, right] of [
        ['B', '(B)'],
        ['B', 'B.'],
        ['B', '（B）'],
        ['B', ' B '],
        ['C', '[C]'],
        ['AB', 'A,B'],
        ['AB', 'A、B']
    ]) {
        const merged = mergeAnswers(left, right);
        assert.notEqual(
            merged.duplicateStatus,
            'answerConflict',
            `"${left}" and "${right}" are the same option answer`
        );
        assert.equal(cleanText(merged.answer), left, `"${left}" must survive the merge`);
    }
});

test('mathematical answers are never made equal by deleting punctuation', () => {
    const cases = [
        ['(0,1)', '01'],
        ['1,2', '12'],
        ['[0,1]', '01'],
        ['(0,1)', '0 1'],
        ['{1,2}', '12']
    ];

    for (const [left, right] of cases) {
        const merged = mergeAnswers(left, right);
        assert.equal(
            merged.answer,
            '',
            `"${left}" and "${right}" are different mathematical answers and must conflict`
        );
        assert.equal(merged.fieldProvenance.answer.status, 'rejected');
        assert.equal(merged.duplicateStatus, 'answerConflict');
        assert.deepEqual(
            (merged.fieldConflicts.answer.candidates || []).map(item => item.value),
            [left, right]
        );
    }
});

test('only presentation differences are ignored for a non-option answer', () => {
    // Fullwidth digits and punctuation are the same characters written differently.
    assert.notEqual(mergeAnswers('１２', '12').duplicateStatus, 'answerConflict');
    assert.notEqual(mergeAnswers('(0,1)', '（0,1）').duplicateStatus, 'answerConflict');
    assert.notEqual(mergeAnswers('1, 2', '1,2').duplicateStatus, 'answerConflict');

    // And a genuinely different value stays a conflict.
    assert.equal(mergeAnswers('(0,1)', '(0,2)').answer, '');
});

test('option-label canonicalisation only applies when both sides are pure labels', () => {
    assert.equal(merger.canonicalOptionAnswer('(B)'), 'B');
    assert.equal(merger.canonicalOptionAnswer('b'), 'B');
    assert.equal(merger.canonicalOptionAnswer('A,C'), 'AC');
    assert.equal(merger.canonicalOptionAnswer('(0,1)'), null, 'a set is not an option label');
    assert.equal(merger.canonicalOptionAnswer('01'), null);
    assert.equal(merger.canonicalOptionAnswer('12'), null);
    assert.equal(merger.canonicalOptionAnswer(''), null);

    assert.equal(merger.valuesAreEquivalent('answer', 'B', '(B)'), true);
    assert.equal(merger.valuesAreEquivalent('answer', '(0,1)', '01'), false);
    assert.equal(merger.valuesAreEquivalent('answer', '1,2', '12'), false);
    assert.equal(merger.valuesAreEquivalent('answer', '１２', '12'), true);
});

test('the presentation-only rule does not weaken the solution comparison', () => {
    const left = {
        id: 's1',
        solution: '由 $x^2-3x+2\\le 0$ 得 $1\\le x\\le 2$，故 $A=[1,2]$。',
        answer: 'A'
    };
    const right = {
        id: 's2',
        solution: '由 $x^2-3x+1\\le 0$ 得 $1\\le x\\le 3$，故 $A=[1,3]$。',
        answer: 'A'
    };

    const merged = merger.mergeCandidate(left, right);
    assert.equal(merged.solution, '', 'two different solutions must still conflict');
    assert.equal(merged.fieldProvenance.solution.status, 'rejected');
});
