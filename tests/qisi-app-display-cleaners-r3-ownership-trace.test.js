const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { traceCallsite, traceAll } = require('../scripts/bm-a4-r3-ownership-trace');
// Wave 16 retired fourteen unreachable OCR/Vision producer callsites.
const EXPECTED_REMAINING_CALLSITES = 12;

function traceSnippet(source, line, helper = 'cleanDisplayTextForBatchSave') {
    return traceCallsite({ callsiteId: 'R3-TEST', helper, line, text: '' }, source.split(/\r?\n/));
}

describe('bm-a4-r3-ownership-trace', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-ownership-trace.js'), true);
    });

    it('detects controlled-write adjacency', () => {
        const result = traceSnippet('function f() {\n  const baselineCandidate = controlledWrite.accepted;\n  cleanDisplayTextForBatchSave(draft.answer);\n}', 3);
        assert.equal(result.callsControlledWrite, true);
        assert.equal(result.traceDecision, 'CONTROLLED_WRITE_ADJACENT_TRUE');
    });

    it('detects support attachment fields', () => {
        const result = traceSnippet('function f() {\n  const sourcePageImage = draft.sourceTrace.sourcePageImage;\n  cleanDisplayTextForBatchSave(draft.stem);\n}', 3);
        assert.equal(result.supportFieldsNearby.includes('sourceTrace'), true);
        assert.equal(result.traceDecision, 'SUPPORT_ATTACHMENT_RISK_TRUE');
    });

    it('detects answer/solution fields', () => {
        const result = traceSnippet('function f() {\n  const solution = draft.solution;\n  cleanDisplayTextForBatchSave(solution);\n}', 3);
        assert.equal(result.solutionFieldsNearby.includes('solution'), true);
        assert.equal(result.traceDecision, 'ANSWER_SOLUTION_RISK_TRUE');
    });

    it('detects display-only cleanup', () => {
        const result = traceSnippet('function f() {\n  const preview = cleanDisplayTextForBatchSave(text);\n  return preview;\n}', 2);
        assert.equal(result.onlyCleansDisplayText, true);
        assert.equal(result.traceDecision, 'DISPLAY_ONLY_PROVABLE');
    });

    it('detects warning-only mutation', () => {
        const result = traceSnippet('function f() {\n  addWarningOnce(draft, warning);\n}', 2, 'addWarningOnce');
        assert.equal(result.traceDecision, 'WARNING_ONLY_PROVABLE');
    });

    it('detects local cleanup', () => {
        const result = traceSnippet('function f() {\n  q.stem = cleanDisplayTextForBatchSave(q.stem);\n}', 2);
        assert.equal(result.mutatedFields.includes('stem'), true);
        assert.equal(result.traceDecision, 'LOCAL_CLEANUP_PROVABLE');
    });

    it('does not mark risky context safe', () => {
        const result = traceSnippet('function f() {\n  draft.answer = patch.answer;\n  cleanDisplayTextForBatchSave(draft.answer);\n}', 3);
        assert.equal(result.traceDecision, 'ANSWER_SOLUTION_RISK_TRUE');
    });

    it('outputs all remaining callsites', () => {
        const result = traceAll();
        assert.equal(result.ok, true);
        assert.equal(result.totalCallsites, EXPECTED_REMAINING_CALLSITES);
        assert.equal(result.results.length, EXPECTED_REMAINING_CALLSITES);
    });
});
