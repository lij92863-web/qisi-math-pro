const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { auditDocs, auditSource, countSections, discoverDocs, isCurrentCampaignDoc, jsonSummary, markdownReport } = require('../scripts/bm-a4-doc-audit');

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

function activeDoc(extra = '') {
    return completeDoc(extra);
}

function historicalDoc(extra = '') {
    return [
        '# Historical Doc',
        'Stage: HISTORICAL',
        '',
        '## Historical note',
        'This is a historical record.',
        '',
        '## Historical status',
        'Historical status: recorded.',
        '',
        '## Decision',
        'Decision: historical record kept.',
        extra
    ].join('\n');
}

function archivedDoc(extra = '') {
    return [
        '# Archived Doc',
        'Archived-Doc-Audit-Status: archived',
        'Archive-Reason: historical auxiliary record',
        'Historical-Status: archived and not active',
        '',
        '## Historical note',
        'This file is retained as archive evidence.',
        '',
        '## Decision',
        'Decision: archived.',
        extra
    ].join('\n');
}

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
        const errors = auditSource('BM_AUTO_A4_R3_RESIDUAL_TEST.md', doc);
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
        assert.ok(report.includes('Reasons'));
    });

    it('active doc missing Decision fails', () => {
        const errors = auditSource('BM_AUTO_A4_R3_RESIDUAL_TEST.md', activeDoc().replace('## Decision', '## Outcome').replace('Decision: accepted.', 'Accepted.'));
        assert.ok(errors.some(e => e.includes('missing Decision')));
    });

    it('active doc with TODO fails', () => {
        const errors = auditSource('BM_AUTO_A4_R3_RESIDUAL_TEST.md', activeDoc('TODO: finish'));
        assert.ok(errors.some(e => e.includes('TODO')));
    });

    it('active doc with pending fails', () => {
        const errors = auditSource('BM_AUTO_A4_R3_RESIDUAL_TEST.md', activeDoc('End commit: pending'));
        assert.ok(errors.some(e => e.includes('pending')));
    });

    it('active doc with literal newline fails', () => {
        const BS = String.fromCharCode(92);
        const compressed = activeDoc().split('\n').join(BS + 'n');
        const errors = auditSource('BM_AUTO_A4_R3_RESIDUAL_TEST.md', compressed);
        assert.ok(errors.some(e => e.includes('escaped')));
    });

    it('active doc with too few lines fails', () => {
        const errors = auditSource('BM_AUTO_A4_R3_RESIDUAL_TEST.md', '# Active\nStage: X\nDecision: no');
        assert.ok(errors.some(e => e.includes('physical lines')));
    });

    it('historical doc with TODO fails', () => {
        const errors = auditSource('BM_AUTO_OLD_TEST.md', historicalDoc('TODO: old'));
        assert.ok(errors.some(e => e.includes('TODO')));
    });

    it('historical doc with pending fails', () => {
        const errors = auditSource('BM_AUTO_OLD_TEST.md', historicalDoc('Status: pending'));
        assert.ok(errors.some(e => e.includes('pending')));
    });

    it('historical doc with literal newline fails', () => {
        const BS = String.fromCharCode(92);
        const errors = auditSource('BM_AUTO_OLD_TEST.md', historicalDoc().split('\n').join(BS + 'n'));
        assert.ok(errors.some(e => e.includes('escaped')));
    });

    it('historical doc with one-line compression fails', () => {
        const errors = auditSource('BM_AUTO_OLD_TEST.md', 'Stage: HIST Historical status: recorded Decision: kept');
        assert.ok(errors.some(e => e.includes('physical lines')));
    });

    it('historical doc with historical status passes', () => {
        const errors = auditSource('BM_AUTO_OLD_TEST.md', historicalDoc());
        assert.deepEqual(errors, []);
    });

    it('archived doc without marker fails', () => {
        const errors = auditSource('BM_AUTO_ARCHIVE_TEST.md', archivedDoc().replace('Archived-Doc-Audit-Status: archived', 'Archived-Doc-Audit-Status:'));
        assert.ok(errors.some(e => e.includes('archive status')));
    });

    it('archived doc with marker passes', () => {
        const errors = auditSource('BM_AUTO_ARCHIVE_TEST.md', archivedDoc());
        assert.deepEqual(errors, []);
    });

    it('archived doc with TODO still fails', () => {
        const errors = auditSource('BM_AUTO_ARCHIVE_TEST.md', archivedDoc('TODO: old'));
        assert.ok(errors.some(e => e.includes('TODO')));
    });

    it('archived doc with literal newline still fails', () => {
        const BS = String.fromCharCode(92);
        const errors = auditSource('BM_AUTO_ARCHIVE_TEST.md', archivedDoc().split('\n').join(BS + 'n'));
        assert.ok(errors.some(e => e.includes('escaped')));
    });

    it('json output includes total failures', () => {
        const result = auditDocs('docs/refactor');
        assert.equal(typeof result.failures, 'number');
    });

    it('write-report is multi-line markdown', () => {
        const report = markdownReport(auditDocs('docs/refactor'));
        const lines = report.split(/\r?\n/);
        const headings = report.match(/^#{1,6}\s+/gm) || [];
        assert.ok(lines.length >= 30);
        assert.ok(headings.length >= 5);
        assert.ok(report.includes('Stage:'));
        assert.ok(report.includes('Branch:'));
        assert.ok(report.includes('## Summary'));
        assert.ok(report.includes('## Failure Table'));
        assert.ok(report.includes('## Validation'));
        assert.ok(report.includes('## Safety'));
        assert.ok(report.includes('## Decision'));
    });

    it('write-report includes all failing files', () => {
        const result = auditDocs('docs/refactor');
        const report = markdownReport(result);
        for (const doc of result.docs.filter((item) => !item.ok)) {
            assert.ok(report.includes(doc.name), `report missing ${doc.name}`);
        }
    });

    it('write-report contains no literal newline marker', () => {
        const report = markdownReport(auditDocs('docs/refactor'));
        assert.equal(report.includes('\\n'), false);
    });

    it('write-report includes failure reasons', () => {
        const report = markdownReport(auditDocs('docs/refactor'));
        assert.ok(report.includes('Reasons'));
    });

    it('write-report includes recommended action', () => {
        const report = markdownReport(auditDocs('docs/refactor'));
        assert.ok(report.includes('Recommended Action'));
    });

    it('json summary includes totalFailures and failures array', () => {
        const summary = jsonSummary(auditDocs('docs/refactor'));
        assert.equal(typeof summary.totalFailures, 'number');
        assert.equal(Array.isArray(summary.failures), true);
    });

    it('ordinary audit still exits non-zero when failures exist', () => {
        const result = spawnSync(process.execPath, ['scripts/bm-a4-doc-audit.js', '--dir', 'docs/refactor'], {
            encoding: 'utf8'
        });
        assert.notEqual(result.status, 0);
    });

    it('ordinary audit exits zero when no failures exist', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-doc-audit-'));
        fs.writeFileSync(path.join(tmp, 'BM_AUTO_GOOD.md'), historicalDoc());
        const result = spawnSync(process.execPath, ['scripts/bm-a4-doc-audit.js', '--dir', tmp], {
            encoding: 'utf8'
        });
        assert.equal(result.status, 0, result.stderr || result.stdout);
    });
});
