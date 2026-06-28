const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { auditDocs, auditSource, countSections, discoverDocs, isCurrentCampaignDoc, markdownReport } = require('../scripts/bm-a4-doc-audit');

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

    it('escaped newline string fails', () => {
        // Simulate a doc compressed into one long line using literal \n as separator
        const BS = String.fromCharCode(92);
        const NL = BS + 'n';
        const compressed = ['# Test Doc', 'Stage: TEST', 'Branch: main', '## Summary', 'Content.', '## Tests', 'OK.', '## Safety', 'OK.', '## Decision', 'OK.'].join(NL) + NL + Array.from({length: 10}, (_, i) => 'Line ' + i).join(NL);
        const errors = auditSource('BM_AUTO_test.md', compressed);
        assert.ok(errors.length > 0, 'compressed doc with escaped newlines must fail');
    });

    it('medium campaign summary has enough physical lines', () => {
        const fs = require('node:fs');
        const source = fs.readFileSync('docs/refactor/BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md', 'utf8');
        const lines = source.split(/\r?\n/);
        assert.ok(lines.length >= 20, `medium summary has ${lines.length} physical lines`);
    });

    it('medium remaining register has enough physical lines', () => {
        const fs = require('node:fs');
        const source = fs.readFileSync('docs/refactor/BM_AUTO_A4_R3_MEDIUM_REMAINING_REGISTER.md', 'utf8');
        const lines = source.split(/\r?\n/);
        assert.ok(lines.length >= 20, `medium register has ${lines.length} physical lines`);
    });

    it('medium wrapper gate has enough physical lines', () => {
        const fs = require('node:fs');
        const source = fs.readFileSync('docs/refactor/BM_AUTO_A4_R3_MEDIUM_WRAPPER_REMOVAL_GATE.md', 'utf8');
        const lines = source.split(/\r?\n/);
        assert.ok(lines.length >= 20, `medium gate has ${lines.length} physical lines`);
    });

    it('classifies current residual campaign docs', () => {
        assert.equal(isCurrentCampaignDoc('BM_AUTO_A4_R3_RESIDUAL_PROOF.md'), true);
        assert.equal(isCurrentCampaignDoc('BM_AUTO_OLD_PLAN.md'), false);
    });

    it('write-report includes file and reason', () => {
        const result = auditDocs('docs/refactor');
        const report = markdownReport(result);
        assert.ok(report.includes('BM_AUTO'));
        assert.ok(report.includes('Errors'));
    });
});
