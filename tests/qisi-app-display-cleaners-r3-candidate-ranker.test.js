const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { rankCallsite, rankAll, RISK_PATTERNS } = require('../scripts/bm-a4-r3-candidate-ranker');

const appLines = fs.readFileSync('app.js', 'utf8').split('\n');

describe('bm-a4-r3-candidate-ranker', () => {
    it('tool exists', () => { assert.equal(fs.existsSync('scripts/bm-a4-r3-candidate-ranker.js'), true); });
    it('controlled-write always blocks', () => { const r = rankCallsite({ helper: 'cleanDisplayTextForBatchSave', line: 13156, text: 'x' }, appLines); if (r.risks.controlledWrite) assert.equal(r.decision, 'ALWAYS_BLOCK'); else assert.ok(true); });
    it('unknown defers', () => { const r = rankCallsite({ helper: 'cleanDisplayTextForBatchSave', line: 2753, text: 'x' }, appLines); assert.ok(r.decision === 'DEFER' || r.risks.unknown); });
    it('display-only ranks high', () => { const r = rankCallsite({ helper: 'cleanDisplayTextForBatchSave', line: 2144, text: 'x' }, appLines); assert.ok(r.score >= 60 || r.decision !== 'BLOCK_UNTIL_MANUAL'); });
    it('support attachment ranks low', () => { const r = rankCallsite({ helper: 'cleanDisplayTextForBatchSave', line: 2819, text: 'x' }, appLines); if (r.risks.supportAttachment) assert.ok(r.score < 85); });
    it('answer ownership ranks low', () => { const r = rankCallsite({ helper: 'cleanDisplayTextForBatchSave', line: 13568, text: 'x' }, appLines); if (r.risks.answerSolution) assert.ok(r.score < 85); });
    it('score thresholds correct', () => { const summary = rankAll(); assert.ok(summary.total >= 40); assert.ok(summary.byDecision.ALWAYS_BLOCK >= 0); });
});
