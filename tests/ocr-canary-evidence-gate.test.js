const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('production canary remains disabled without Holdout promotion', () => {
    const decision = read('docs/ocr/OCR_CANARY_DECISION_R1.md');
    assert.match(decision, /CANARY_DISABLED_PROMOTION_GATE_NOT_MET/);
    assert.match(decision, /eligible private documents[^\n]*0/i);
    assert.match(decision, /production-promoted engines[^\n]*0/i);
    assert.match(decision, /Holdout promotion decisions[^\n]*0/i);
    assert.match(decision, /canary enabled[^\n]*no/i);
    assert.equal(fs.existsSync(path.join(root, 'qisi-ocr-canary.js')), false);
    assert.doesNotMatch(read('main.html'), /qisi-ocr-canary\.js/);
});

test('future canary gate preserves rollback and every downstream validator', () => {
    const decision = read('docs/ocr/OCR_CANARY_DECISION_R1.md');
    for (const requirement of [
        'small private subset', 'explicit engine flag', 'current engine fallback',
        'validator', 'controlled-write', 'FormalAdmission', 'no automatic overwrite',
        'manual correction time', 'one-click disable'
    ]) {
        assert.match(decision, new RegExp(requirement, 'i'), requirement);
    }
    assert.match(decision, /production wiring[^\n]*none/i);
    assert.match(decision, /real canary runs[^\n]*0/i);
});

test('selection and shadow owners cannot independently grant formal-write authority', () => {
    const selection = read('qisi-ocr-candidate-selection-policy.js');
    const shadow = read('qisi-ocr-shadow-mode.js');
    for (const source of [selection, shadow]) {
        assert.doesNotMatch(source, /eligibleForControlledWrite:\s*true/);
        assert.doesNotMatch(source, /eligibleForFormalAdmission:\s*true/);
        assert.doesNotMatch(source, /saveQuestion|confirmDraftToQuestion|db\.questions/);
    }
});
