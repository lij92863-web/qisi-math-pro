const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('ownership hardening is held without a real Holdout failing case', () => {
    const decision = read('docs/ocr/OCR_OWNERSHIP_SAFE_PARTIAL_DECISION_R1.md');
    assert.match(decision, /NO_HIGH_RISK_CHANGE_WITHOUT_HOLDOUT_FAILURE/);
    assert.match(decision, /eligible private documents[^\n]*0/i);
    assert.match(decision, /real Holdout failing cases[^\n]*0/i);
    assert.match(decision, /high-risk owner changes[^\n]*none/i);
    assert.match(decision, /production-promoted[^\n]*no/i);
});

test('decision preserves every deterministic ownership input and safe outcome', () => {
    const decision = read('docs/ocr/OCR_OWNERSHIP_SAFE_PARTIAL_DECISION_R1.md');
    for (const evidence of [
        'expectedQuestionNumbers', 'sourceOrder', 'answer sequence',
        'solution sequence', 'continuity', 'duplicate', 'rewind',
        'pairing consistency'
    ]) {
        assert.match(decision, new RegExp(evidence, 'i'), evidence);
    }
    assert.match(decision, /full[^\n]*prefix[^\n]*fail-closed/i);
    for (const forbidden of [
        'gap 后继续', '回跳后继续', 'answer-only', 'semantic overlap',
        'formula token'
    ]) {
        assert.match(decision, new RegExp(forbidden, 'i'), forbidden);
    }
});

test('new OCR structure owner remains outside controlled-write and formal admission', () => {
    const source = read('qisi-ocr-structure-extractor.js');
    assert.match(source, /eligibleForControlledWrite:\s*false/);
    assert.match(source, /eligibleForFormalAdmission:\s*false/);
    assert.match(source, /ownershipStatus:\s*'unvalidated'/);
    assert.doesNotMatch(source, /eligibleForControlledWrite:\s*true/);
    assert.doesNotMatch(source, /saveQuestion|confirmDraftToQuestion|db\.questions/);
});
