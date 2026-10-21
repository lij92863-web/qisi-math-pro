const test = require('node:test'), assert = require('node:assert/strict');
const { compare } = require('../scripts/golden/compare.cjs');
const report = () => ({ schema: 'qisi.golden-report.v1', suiteSha256: 'fixed', ok: true,
    cases: [{ id: 'one', ok: true, counts: { identityMatched: 2, correctCandidateAnswers: 2,
        correctAutomaticAnswers: 1, matchedSolutionAnchors: 2, wrongAutomaticAnswers: 0, ungradedAutomaticAnswers: 0 } }] });
test('comparison refuses changed labels or sources rather than reporting a false improvement', () => {
    const changed = report(); changed.suiteSha256 = 'different';
    assert.throws(() => compare(report(), changed), /INPUT_CHANGED/);
});
test('unchanged cases pass while lower recall or unsafe bindings fail', () => {
    assert.equal(compare(report(), report()).ok, true);
    for (const metric of ['identityMatched', 'correctCandidateAnswers', 'matchedSolutionAnchors']) {
        const changed = report(); changed.cases[0].counts[metric]--;
        assert.equal(compare(report(), changed).ok, false);
    }
    const unsafe = report(); unsafe.cases[0].counts.wrongAutomaticAnswers = 1;
    assert.equal(compare(report(), unsafe).ok, false);
});
test('missing and duplicate cases cannot disappear from the denominator', () => {
    const changed = report(); changed.cases = [];
    assert.throws(() => compare(report(), changed), /CASES_CHANGED/);
});
test('missing counters cannot turn NaN into an apparently unchanged successful baseline', () => {
    const changed = report(); delete changed.cases[0].counts.identityMatched;
    assert.throws(() => compare(report(), changed), /COUNTS_INVALID/);
});
