const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildProof, buildAll } = require('../scripts/bm-a4-r3-proof-builder');
const appLines = fs.readFileSync('app.js', 'utf8').split('\n');
// Wave 16 retired fourteen unreachable OCR/Vision producer callsites.
const EXPECTED_REMAINING_CALLSITES = 12;

const sampleSafe = { callsiteId: 'R3-TEST', helper: 'addWarningOnce', line: 3739, text: 'x', score: 90, decision: 'AUTO_FIXTURE_CANDIDATE', risks: { controlledWrite: false, pdfOwnership: false, supportAttachment: false, answerSolution: false, unknown: false } };
const sampleBlocked = { callsiteId: 'R3-TEST-B', helper: 'cleanDisplayTextForBatchSave', line: 2127, text: 'x', score: 40, decision: 'ALWAYS_BLOCK', risks: { controlledWrite: true, pdfOwnership: false, supportAttachment: false, answerSolution: false, unknown: false } };

describe('bm-a4-r3-proof-builder', () => {
    it('tool exists', () => { assert.equal(fs.existsSync('scripts/bm-a4-r3-proof-builder.js'), true); });
    it('builds proof packet', () => { const p = buildProof(sampleSafe, appLines); assert.ok(p.callsiteId); assert.ok(p.proofDecision); });
    it('blocks controlled-write', () => { const p = buildProof(sampleBlocked, appLines); assert.equal(p.replacementAllowed, false); });
    it('allows simple display cleanup proof', () => { const p = buildProof(sampleSafe, appLines); assert.equal(p.replacementAllowed, true); });
    it('detects parent function', () => { const p = buildProof(sampleSafe, appLines); assert.ok(p.parentFunction && p.parentFunction.length > 0); });
    it('does not modify app.js', () => { const before = fs.readFileSync('app.js', 'utf8'); buildAll(); assert.equal(fs.readFileSync('app.js', 'utf8'), before); });
    it('buildAll returns results', () => { const r = buildAll(); assert.equal(r.total, EXPECTED_REMAINING_CALLSITES); assert.ok(r.replacementAllowed >= 0); });
});
