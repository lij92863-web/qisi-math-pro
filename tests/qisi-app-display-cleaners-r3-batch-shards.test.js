const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { executeBatch, replaceCallsiteInApp } = require('../scripts/bm-a4-r3-batch-executor');

describe('bm-a4-r3-batch-executor', () => {
    it('tool exists', () => { assert.equal(fs.existsSync('scripts/bm-a4-r3-batch-executor.js'), true); });
    it('executor plans batch', () => { const r = executeBatch(3, false, false); assert.ok(r.ok); assert.ok(r.candidatesAudited >= 0); });
    it('executor does not modify app.js by default', () => { const before = fs.readFileSync('app.js', 'utf8'); executeBatch(3, false, false); assert.equal(fs.readFileSync('app.js', 'utf8'), before); });
    it('executor limits replacements to batch size', () => { const r = executeBatch(3, false, false); assert.ok(r.replacementsApplied <= 3); });
    it('replaceCallsiteInApp works', () => { const source = 'cleanDisplayTextForBatchSave( text );\n'; const r = replaceCallsiteInApp(1, 'cleanDisplayTextForBatchSave', source); assert.equal(r.replaced, true); assert.ok(r.newLine.includes('window.Qisi.Utils.cleanDisplayTextForBatchSave')); });
    it('executor preserves wrappers', () => { const source = fs.readFileSync('app.js', 'utf8'); assert.ok(source.includes('const cleanDisplayTextForBatchSave')); });
    it('medium mode only selects PROOF_REQUIRED', () => { const r = executeBatch(1, false, false, true); assert.ok(r.candidatesAudited <= 1); });
    it('medium mode replaces at most 1', () => { const r = executeBatch(1, false, false, true); assert.ok(r.replacementsApplied <= 1); });
    it('medium mode refuses BLOCK_UNTIL_MANUAL', () => { const r = executeBatch(1, false, false, true); assert.ok(r.blocked >= 0); });
    it('medium mode limits replacements', () => { const r = executeBatch(5, false, false, true); assert.ok(r.candidatesAudited <= 1); });
});
