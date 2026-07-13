const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
    freezeItem,
    assertValidFrozenItem,
    buildFreezeRegister
} = require('../scripts/bm-a4-r3-freeze-register');
const EXPECTED_REMAINING_CALLSITES = 27;

const unsafeProof = {
    callsiteId: 'R3-TEST',
    helper: 'cleanDisplayTextForBatchSave',
    line: 123,
    rankDecision: 'BLOCK_UNTIL_MANUAL',
    traceDecision: 'ANSWER_SOLUTION_RISK_TRUE',
    mutationDecision: 'UNSAFE_ANSWER_SOLUTION_MUTATION',
    residualDecision: 'FREEZE_ANSWER_SOLUTION_OWNERSHIP',
    replacementAllowed: false,
    reason: 'trace:ANSWER_SOLUTION_RISK_TRUE'
};

describe('bm-a4-r3-freeze-register', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-freeze-register.js'), true);
    });

    it('freezes unsafe callsite', () => {
        const item = freezeItem(unsafeProof);
        assert.equal(item.replacementAllowed, false);
        assert.equal(item.freezeReason, 'ANSWER_SOLUTION_OWNERSHIP');
    });

    it('does not freeze replace-allowed callsite', () => {
        const register = buildFreezeRegister();
        assert.equal(register.frozen.some((item) => item.replacementAllowed), false);
    });

    it('includes reason', () => {
        assert.equal(freezeItem(unsafeProof).freezeReason, 'ANSWER_SOLUTION_OWNERSHIP');
    });

    it('includes evidence', () => {
        assert.ok(freezeItem(unsafeProof).evidence.length > 0);
    });

    it('includes wrapperRequired', () => {
        assert.equal(freezeItem(unsafeProof).wrapperRequired, true);
    });

    it('fails if frozen item lacks reason', () => {
        const item = freezeItem(unsafeProof);
        item.freezeReason = '';
        assert.throws(() => assertValidFrozenItem(item), /lacks freezeReason/);
    });

    it('outputs all frozen residual callsites', () => {
        const register = buildFreezeRegister();
        assert.equal(register.ok, true);
        assert.equal(register.totalResidual, EXPECTED_REMAINING_CALLSITES);
        assert.equal(register.frozenCount, EXPECTED_REMAINING_CALLSITES);
    });
});
