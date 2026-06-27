const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { auditSource } = require('../scripts/bm-a4-doc-audit');

function completeDoc(extra = '') {
    return [
        '# A4 Test Doc',
        'Stage: TEST',
        'Branch: main',
        'Commit: abc123',
        '## Tests',
        'Tests: passed.',
        '## Safety',
        'Safety: no forbidden files touched.',
        '## Decision',
        'Decision: accepted.',
        ...Array.from({ length: 15 }, (_, index) => `Line ${index}`),
        extra
    ].join('\n');
}

describe('bm-a4-doc-audit', () => {
    it('one-line doc fails', () => {
        const errors = auditSource('BM_AUTO_CHAIN_A_A4_QISI_UTILS_IMPL.md', 'Stage: TEST');
        assert.ok(errors.length > 0);
    });

    it('pending field fails when not allowed', () => {
        const errors = auditSource('BM_AUTO_CHAIN_A_A4_QISI_UTILS_IMPL.md', completeDoc('End commit: pending'));
        assert.ok(errors.some((error) => error.includes('pending')));
    });

    it('complete doc passes', () => {
        const errors = auditSource('BM_AUTO_CHAIN_A_A4_QISI_UTILS_IMPL.md', completeDoc());
        assert.deepEqual(errors, []);
    });

    it('unrelated docs ignored by caller contract', () => {
        const errors = auditSource('BM_AUTO_CHAIN_A_A4_LONG_RUN_SUMMARY.md', completeDoc('End commit: pending'));
        assert.deepEqual(errors, []);
    });
});
