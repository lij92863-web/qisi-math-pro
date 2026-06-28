const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { auditSource, countSections, discoverDocs } = require('../scripts/bm-a4-doc-audit');

function completeDoc(extra = '') {
    return [
        '# A4 Test Doc',
        'Stage: TEST',
        'Branch: main',
        'Commit: abc123',
        '',
        '## Summary',
        'Summary of the test document.',
        '',
        '## Details',
        'Detailed information.',
        '',
        '## Tests',
        'Tests: passed.',
        '',
        '## Safety',
        'Safety: no forbidden files touched.',
        '',
        '## Validation',
        'Validation: all checks pass.',
        '',
        '## Decision',
        'Decision: accepted.',
        '',
        ...Array.from({ length: 8 }, (_, i) => `Line ${i}`),
        extra
    ].join('\n');
}

function oneLineDoc() { return '# A4 Test Doc - Stage: TEST'; }

function twoLineDoc() { return '# A4 Test Doc\nStage: TEST Branch: main'; }

describe('bm-a4-doc-audit', () => {
    it('one-line doc fails', () => {
        const errors = auditSource('BM_AUTO_test.md', oneLineDoc());
        assert.ok(errors.length > 0);
    });

    it('two-line compressed document fails', () => {
        const errors = auditSource('BM_AUTO_test.md', twoLineDoc());
        assert.ok(errors.length > 0);
    });

    it('proper multi-section document passes', () => {
        const errors = auditSource('BM_AUTO_test.md', completeDoc());
        assert.deepEqual(errors, []);
    });

    it('document with Stage/Decision but no line breaks fails', () => {
        const doc = `Stage: TEST\nBranch: main\nCommit: abc\n## Decision\nAccepted.\n## Safety\nOK\n## Tests\nOK\n` +
            Array.from({ length: 2 }, () => 'x').join('\n');
        const errors = auditSource('BM_AUTO_test.md', doc);
        assert.ok(errors.some(e => e.includes('lines')));
    });

    it('historical docs can be audited without changing business code', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const docs = discoverDocs('docs/refactor');
        assert.ok(docs.length > 0);
        assert.ok(docs.every(d => d.endsWith('.md')));
    });

    it('pending field fails when not allowed', () => {
        const errors = auditSource('BM_AUTO_test.md', completeDoc('End commit: pending'));
        assert.ok(errors.some(e => e.includes('pending')));
    });

    it('complete doc with enough sections passes', () => {
        const doc = completeDoc();
        const sections = countSections(doc);
        assert.ok(sections >= 5, `expected >= 5 sections, got ${sections}`);
    });

    it('long line document fails', () => {
        const base = completeDoc();
        const long = base + '\n' + 'x'.repeat(1300);
        const errors = auditSource('BM_AUTO_test.md', long);
        assert.ok(errors.some(e => e.includes('lines exceed')));
    });
});
