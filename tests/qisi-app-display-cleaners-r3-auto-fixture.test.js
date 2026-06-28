const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { generateFixtureCode } = require('../scripts/bm-a4-r3-fixture-generator');

const sampleProof = { callsiteId: 'R3-TEST-001', helper: 'addWarningOnce', line: 9999, lineText: 'addWarningOnce(q, msg)', proofDecision: 'PROVE_WITH_SYNTHETIC_FIXTURE' };
const blockedProof = { callsiteId: 'R3-TEST-BLK', helper: 'cleanDisplayTextForBatchSave', line: 9998, lineText: 'x', proofDecision: 'BLOCK_CONTROLLED_WRITE' };
const appLines = [''];

describe('bm-a4-r3-auto-fixture', () => {
    it('tool exists', () => { assert.equal(fs.existsSync('scripts/bm-a4-r3-fixture-generator.js'), true); });
    it('generator creates unique tags', () => { const f1 = generateFixtureCode(sampleProof, appLines); const f2 = generateFixtureCode({ ...sampleProof, callsiteId: 'R3-TEST-002' }, appLines); assert.notEqual(f1.tag, f2.tag); });
    it('generator emits real assertions', () => { const f = generateFixtureCode(sampleProof, appLines); assert.ok(f.code.includes('assert.')); });
    it('generator does not use skip/only/todo', () => { const f = generateFixtureCode(sampleProof, appLines); assert.ok(!f.code.includes('.skip')); assert.ok(!f.code.includes('.only')); assert.ok(!f.code.toLowerCase().includes('todo')); });
});
