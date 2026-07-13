const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { decideResidual, buildResidualProofs } = require('../scripts/bm-a4-r3-residual-proof');
// Wave 16 retired fourteen unreachable OCR/Vision producer callsites.
const EXPECTED_REMAINING_CALLSITES = 12;

function decide(overrides) {
    return decideResidual({
        rankDecision: 'PROOF_REQUIRED',
        traceDecision: 'DISPLAY_ONLY_PROVABLE',
        mutationDecision: 'SAFE_LOCAL_DISPLAY_MUTATION',
        fixturePlan: '[fixture]',
        legacyReplacementAllowed: true,
        ...overrides
    });
}

describe('bm-a4-r3-residual-proof', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-residual-proof.js'), true);
    });

    it('allows display-only strong proof', () => {
        assert.equal(decide().residualDecision, 'REPLACE_ALLOWED_DISPLAY_ONLY');
    });

    it('allows warning-only strong proof', () => {
        const result = decide({
            traceDecision: 'WARNING_ONLY_PROVABLE',
            mutationDecision: 'SAFE_WARNING_MUTATION'
        });
        assert.equal(result.residualDecision, 'REPLACE_ALLOWED_WARNING_ONLY');
    });

    it('allows local cleanup proof', () => {
        const result = decide({
            traceDecision: 'LOCAL_CLEANUP_PROVABLE',
            mutationDecision: 'SAFE_LOCAL_DISPLAY_MUTATION'
        });
        assert.equal(result.residualDecision, 'REPLACE_ALLOWED_LOCAL_CLEANUP');
    });

    it('freezes controlled-write', () => {
        assert.equal(decide({ traceDecision: 'CONTROLLED_WRITE_ADJACENT_TRUE' }).residualDecision, 'FREEZE_CONTROLLED_WRITE');
    });

    it('freezes support attachment', () => {
        assert.equal(decide({ traceDecision: 'SUPPORT_ATTACHMENT_RISK_TRUE' }).residualDecision, 'FREEZE_SUPPORT_ATTACHMENT');
    });

    it('freezes answer/solution ownership', () => {
        assert.equal(decide({ traceDecision: 'ANSWER_SOLUTION_RISK_TRUE' }).residualDecision, 'FREEZE_ANSWER_SOLUTION_OWNERSHIP');
    });

    it('freezes unknown', () => {
        assert.equal(decide({ mutationDecision: 'MUTATION_UNKNOWN' }).residualDecision, 'FREEZE_INSUFFICIENT_PROOF');
    });

    it('does not allow blocked without false-positive proof', () => {
        const result = decide({
            rankDecision: 'BLOCK_UNTIL_MANUAL',
            traceDecision: 'DISPLAY_ONLY_PROVABLE'
        });
        assert.equal(result.replacementAllowed, false);
    });

    it('outputs all remaining callsites', () => {
        const result = buildResidualProofs();
        assert.equal(result.ok, true);
        assert.equal(result.totalCallsites, EXPECTED_REMAINING_CALLSITES);
        assert.equal(result.results.length, EXPECTED_REMAINING_CALLSITES);
    });
});
