const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-ocr-candidate-selection-policy.js');

const candidate = (engine, overrides = {}) => ({
    engine,
    engineVersion: '1.0.0',
    requestId: `${engine}-request`,
    rawText: `${engine} PRIVATE RAW TEXT`,
    rawEvidenceRef: `${engine}://evidence`,
    validation: {
        schemaValid: true,
        sequenceValid: true,
        ownershipValid: true,
        formulaValid: true,
        provenanceComplete: true
    },
    metrics: {
        completeness: 0.9,
        engineConfidence: 0.8,
        safetyErrors: []
    },
    ...overrides
});

const promotion = (engine, engineVersion = '1.0.0') => ({
    engine,
    engineVersion,
    productionPromoted: true,
    holdoutDecisionId: `${engine}-holdout-r1`
});

test('unpromoted engine cannot become a production candidate', () => {
    const input = candidate('research-engine');
    const result = Policy.selectProductionCandidate([input], { promotions: [] });
    assert.equal(result.decision, 'manual-review');
    assert.equal(result.selectedCandidate, null);
    assert.equal(result.evaluations[0].eligible, false);
    assert.ok(result.evaluations[0].reasons.includes('engine-not-production-promoted'));
});

test('single promoted candidate must pass every deterministic gate', () => {
    const input = candidate('engine-a');
    const result = Policy.selectProductionCandidate([input], {
        promotions: [promotion('engine-a')]
    });
    assert.equal(result.decision, 'selected');
    assert.equal(result.selectedCandidate, input);
    assert.equal(result.manualReviewRequired, false);
    assert.equal(result.evaluations[0].eligible, true);
    assert.equal(result.eligibleForControlledWrite, false);
    assert.equal(result.eligibleForFormalAdmission, false);
});

test('schema, sequence, ownership, formula, provenance, completeness, confidence, and safety fail closed', () => {
    const cases = [
        ['schemaValid', false, 'schema-invalid'],
        ['sequenceValid', false, 'sequence-invalid'],
        ['ownershipValid', false, 'ownership-invalid'],
        ['formulaValid', false, 'formula-invalid'],
        ['provenanceComplete', false, 'provenance-incomplete']
    ];
    for (const [field, value, reason] of cases) {
        const input = candidate('engine-a', {
            validation: { ...candidate('x').validation, [field]: value }
        });
        const result = Policy.selectProductionCandidate([input], {
            promotions: [promotion('engine-a')]
        });
        assert.ok(result.evaluations[0].reasons.includes(reason), field);
    }
    for (const [metrics, reason] of [
        [{ completeness: 0.4, engineConfidence: 0.8, safetyErrors: [] }, 'completeness-below-threshold'],
        [{ completeness: 0.9, engineConfidence: null, safetyErrors: [] }, 'engine-confidence-missing'],
        [{ completeness: 0.9, engineConfidence: 0.8, safetyErrors: ['wrong-answer'] }, 'fatal-safety-errors']
    ]) {
        const result = Policy.selectProductionCandidate([
            candidate('engine-a', { metrics })
        ], { promotions: [promotion('engine-a')], minCompleteness: 0.8 });
        assert.ok(result.evaluations[0].reasons.includes(reason), reason);
        assert.equal(result.selectedCandidate, null);
    }
});

test('one complete candidate may dominate another only on allowed numeric metrics', () => {
    const weaker = candidate('engine-a', {
        metrics: { completeness: 0.85, engineConfidence: 0.7, safetyErrors: [] }
    });
    const stronger = candidate('engine-b', {
        metrics: { completeness: 0.95, engineConfidence: 0.9, safetyErrors: [] }
    });
    const result = Policy.selectProductionCandidate([weaker, stronger], {
        promotions: [promotion('engine-a'), promotion('engine-b')]
    });
    assert.equal(result.decision, 'selected');
    assert.equal(result.selectedCandidate, stronger);
    assert.deepEqual(result.rankingBasis, ['completeness', 'engineConfidence']);
});

test('metric tradeoff or tie requires manual review and retains both evidence objects', () => {
    const complete = candidate('engine-a', {
        metrics: { completeness: 0.95, engineConfidence: 0.7, safetyErrors: [] }
    });
    const confident = candidate('engine-b', {
        metrics: { completeness: 0.9, engineConfidence: 0.9, safetyErrors: [] }
    });
    const result = Policy.selectProductionCandidate([complete, confident], {
        promotions: [promotion('engine-a'), promotion('engine-b')]
    });
    assert.equal(result.decision, 'manual-review');
    assert.equal(result.selectedCandidate, null);
    assert.equal(result.manualReviewRequired, true);
    assert.equal(result.retainedCandidates[0], complete);
    assert.equal(result.retainedCandidates[1], confident);
    assert.equal(result.synthesizedCandidate, null);
    assert.equal(result.fieldMergeAllowed, false);
    assert.equal(result.semanticGuessingAllowed, false);
});

test('raw semantic appearance never breaks a deterministic tie', () => {
    const first = candidate('engine-a', { rawText: 'looks perfect' });
    const second = candidate('engine-b', { rawText: 'malformed-looking but irrelevant' });
    const result = Policy.selectProductionCandidate([first, second], {
        promotions: [promotion('engine-a'), promotion('engine-b')]
    });
    assert.equal(result.decision, 'manual-review');
    assert.equal(result.selectedCandidate, null);
    assert.equal(result.retainedCandidates.length, 2);
});

test('promotion is pinned to exact engine version', () => {
    const input = candidate('engine-a', { engineVersion: '2.0.0' });
    const result = Policy.selectProductionCandidate([input], {
        promotions: [promotion('engine-a', '1.0.0')]
    });
    assert.ok(result.evaluations[0].reasons.includes('engine-not-production-promoted'));
    assert.equal(result.selectedCandidate, null);
});
