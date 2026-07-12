const test = require('node:test');
const assert = require('node:assert/strict');
const Shadow = require('../qisi-ocr-shadow-mode.js');

const candidate = (engine, blocks) => ({
    engine, engineVersion: 'mock', requestId: `${engine}-1`, sourceId: 's1',
    page: 1, rawText: 'private source text', rawEvidence: { private: true },
    blocks: Array.from({ length: blocks }, () => ({})), formulas: [], images: [],
    warnings: [], durationMs: 1
});

test('shadow comparison is structured, isolated, and omits raw content', () => {
    const report = Shadow.compareCandidates(candidate('prod', 1), candidate('shadow', 2));
    assert.equal(report.differences.blocks, 1);
    assert.equal(report.manualReviewRequired, true);
    assert.equal(report.eligibleForReview, false);
    assert.equal(report.eligibleForControlledWrite, false);
    assert.equal(report.autoSelectWinner, false);
    assert.equal(report.fieldMergeAllowed, false);
    assert.equal(JSON.stringify(report).includes('private source text'), false);
    assert.equal(JSON.stringify(report).includes('rawEvidence'), false);
});

test('runShadow preserves the production candidate and retains separate evidence', async () => {
    const production = candidate('prod', 1);
    const before = structuredClone(production);
    const shadow = candidate('shadow', 1);
    const result = await Shadow.runShadow({
        productionCandidate: production,
        shadowEngine: { recognizePage: async () => shadow },
        input: { bytes: 1 }
    });
    assert.deepEqual(production, before);
    assert.equal(result.productionCandidate, production);
    assert.equal(result.shadowCandidate, shadow);
    assert.notEqual(result.productionCandidate, result.shadowCandidate);
    assert.equal(result.productionCandidateUnchanged, true);
});
