const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { mapCallsite, mapAll } = require('../scripts/bm-a4-r3-field-mutation-map');
// C2-12 retired the final app-owned display-cleaner wrapper callsites.
const EXPECTED_REMAINING_CALLSITES = 0;

function mapSnippet(source, line, helper = 'cleanDisplayTextForBatchSave') {
    return mapCallsite({ callsiteId: 'R3-TEST', helper, line, text: '' }, source.split(/\r?\n/));
}

describe('bm-a4-r3-field-mutation-map', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-field-mutation-map.js'), true);
    });

    it('safe display mutation', () => {
        const result = mapSnippet('function f() {\n  q.stem = cleanDisplayTextForBatchSave(text);\n}', 2);
        assert.equal(result.mutationDecision, 'SAFE_LOCAL_DISPLAY_MUTATION');
    });

    it('safe warning mutation', () => {
        const result = mapSnippet('function f() {\n  addWarningOnce(q, warning);\n}', 2, 'addWarningOnce');
        assert.equal(result.mutationDecision, 'SAFE_WARNING_MUTATION');
    });

    it('safe options cleanup', () => {
        const result = mapSnippet('function f() {\n  q.options = cleanDisplayOptionsForBatchSave(options);\n}', 2, 'cleanDisplayOptionsForBatchSave');
        assert.equal(result.mutationDecision, 'SAFE_OPTIONS_CLEANUP');
    });

    it('unsafe support mutation', () => {
        const result = mapSnippet('function f() {\n  draft.support = support;\n  cleanDisplayTextForBatchSave(text);\n}', 3);
        assert.equal(result.mutationDecision, 'UNSAFE_SUPPORT_MUTATION');
    });

    it('unsafe answer mutation', () => {
        const result = mapSnippet('function f() {\n  draft.answer = answer;\n  cleanDisplayTextForBatchSave(answer);\n}', 3);
        assert.equal(result.mutationDecision, 'UNSAFE_ANSWER_SOLUTION_MUTATION');
    });

    it('unsafe solution mutation', () => {
        const result = mapSnippet('function f() {\n  draft.solution = solution;\n  cleanDisplayTextForBatchSave(solution);\n}', 3);
        assert.equal(result.mutationDecision, 'UNSAFE_ANSWER_SOLUTION_MUTATION');
    });

    it('unsafe controlled-write mutation', () => {
        const result = mapSnippet('function f() {\n  controlledWriteApply();\n  cleanDisplayTextForBatchSave(text);\n}', 3);
        assert.equal(result.mutationDecision, 'UNSAFE_CONTROLLED_WRITE_MUTATION');
    });

    it('unknown mutation', () => {
        const result = mapSnippet('function f() {\n  const preview = cleanDisplayTextForBatchSave(text);\n}', 2);
        assert.equal(result.mutationDecision, 'MUTATION_UNKNOWN');
    });

    it('outputs all remaining callsites', () => {
        const result = mapAll();
        assert.equal(result.ok, true);
        assert.equal(result.totalCallsites, EXPECTED_REMAINING_CALLSITES);
        assert.equal(result.results.length, EXPECTED_REMAINING_CALLSITES);
    });
});
