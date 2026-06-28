const fs = require('fs');
const path = require('path');

const DOC_DIR = 'docs/refactor';
const MAX_LINE_LENGTH = 1200;
const WARN_LINE_LENGTH = 500;
const MIN_SECTIONS = 5;
const MIN_LINES = 20;

const ACTIVE_CAMPAIGN_PATTERNS = [
    /^BM_AUTO_A4_R3_RESIDUAL.*\.md$/i,
    /^BM_AUTO_A4_R3_.*MEDIUM.*\.md$/i,
    /^BM_AUTO_A4_R3_FORCE.*\.md$/i,
    /^BM_AUTO_A4_R3_COMMITTED.*\.md$/i,
    /^BM_AUTO_A4_R3_DOC_AUDIT.*\.md$/i,
    /^BM_AUTO_DOC_AUDIT.*\.md$/i
];

function discoverDocs(dir) {
    const result = [];
    if (!fs.existsSync(dir)) return result;
    for (const entry of fs.readdirSync(dir)) {
        if (entry.startsWith('BM_AUTO') && entry.endsWith('.md')) {
            result.push(entry);
        }
    }
    return result;
}

function countSections(source) {
    const headings = (source.match(/^#{1,4}\s+/gm) || []).length;
    const tableRows = (source.match(/^\|.+\|/gm) || []).length;
    const decisionBlocks = (source.match(/^Decision/i) || []).length;
    return headings + Math.floor(tableRows / 3) + decisionBlocks;
}

function isCurrentCampaignDoc(name) {
    return ACTIVE_CAMPAIGN_PATTERNS.some((pattern) => pattern.test(name));
}

function analyzeSource(name, source) {
    const lines = source.split(/\r?\n/);
    const escapedNlLineCount = lines.filter(l => (l.match(/(?<!\\)\\n/g) || []).length > 0).length;
    const headingCount = (source.match(/^#{1,4}\s+/gm) || []).length;
    const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const currentCampaignDoc = isCurrentCampaignDoc(name);
    const hasArchiveIntent = /Archived-Doc-Audit-Status:|Archive-Reason:|Historical-Status:/i.test(source);
    const archivedDoc = !currentCampaignDoc && hasArchiveIntent;
    return {
        lineCount: lines.length,
        headingCount,
        sectionCount: countSections(source),
        maxLineLength,
        avgLineLength: lines.length > 0 ? Math.round(lines.reduce((sum, l) => sum + l.length, 0) / lines.length) : 0,
        hasLiteralNewline: escapedNlLineCount > 0,
        literalNewlineLineCount: escapedNlLineCount,
        hasTodo: /TODO/i.test(source),
        hasPending: /pending/i.test(source),
        missingStage: !/Stage:/i.test(source),
        missingBranchOrCommit: !/(Branch:|commit)/i.test(source),
        missingValidationOrTests: !/(?:Tests|Validation)/i.test(source),
        missingSafety: !/Safety/i.test(source),
        missingDecision: !/Decision/i.test(source),
        missingHistoricalNote: !/(Stage:|Historical note|Historical-Status:)/i.test(source),
        missingHistoricalStatus: !/(Decision|Historical status|Historical-Status:)/i.test(source),
        missingArchiveStatus: !/Archived-Doc-Audit-Status:\s*archived/i.test(source),
        missingArchiveReason: !/Archive-Reason:\s*\S/i.test(source),
        missingArchiveHistoricalStatus: !/Historical-Status:\s*\S/i.test(source),
        intentionallyBriefIndex: /Intentionally-Brief-Index:\s*yes/i.test(source),
        currentCampaignDoc,
        historicalDoc: !currentCampaignDoc && !archivedDoc,
        archivedDoc,
        policyClass: currentCampaignDoc ? 'active' : archivedDoc ? 'archived' : 'historical'
    };
}

function auditSource(name, source) {
    const errors = [];
    const analysis = analyzeSource(name, source);
    const lines = source.split(/\r?\n/);
    const physicalLineCount = analysis.lineCount;
    const isToolingOrMap = /TOOLING_PLAN|CALLSITE_MAP|RISK_MATRIX|FIXTURE_COVERAGE/i.test(name);

    if (analysis.hasLiteralNewline) errors.push(`${analysis.literalNewlineLineCount} lines use escaped \\n as line separator`);
    if (analysis.maxLineLength > MAX_LINE_LENGTH) errors.push(`${lines.filter(l => l.length > MAX_LINE_LENGTH).length} lines exceed ${MAX_LINE_LENGTH} chars`);
    if (analysis.avgLineLength > WARN_LINE_LENGTH) errors.push(`average line length ${analysis.avgLineLength} exceeds ${WARN_LINE_LENGTH}`);
    if (analysis.hasPending) errors.push('pending marker found');
    if (analysis.hasTodo) errors.push('TODO marker found');

    if (analysis.policyClass === 'historical') {
        if (physicalLineCount < 10 && !analysis.intentionallyBriefIndex) errors.push(`less than 10 physical lines (${physicalLineCount})`);
        if (analysis.missingHistoricalNote) errors.push('missing Stage or Historical note');
        if (analysis.missingHistoricalStatus) errors.push('missing Decision or Historical status');
        return errors;
    }

    if (analysis.policyClass === 'archived') {
        if (physicalLineCount < 10) errors.push(`less than 10 physical lines (${physicalLineCount})`);
        if (analysis.missingArchiveStatus) errors.push('missing archive status marker');
        if (analysis.missingArchiveReason) errors.push('missing Archive-Reason');
        if (analysis.missingArchiveHistoricalStatus) errors.push('missing Historical-Status');
        return errors;
    }

    // Physical line count (raw, not rendered)
    if (physicalLineCount < MIN_LINES) errors.push(`less than ${MIN_LINES} physical lines (${physicalLineCount})`);

    // Heading count
    const headings = analysis.headingCount;
    if (headings < 4) errors.push(`less than 4 markdown headings (${headings})`);

    // Section count
    const sections = countSections(source);
    if (sections < MIN_SECTIONS) errors.push(`less than ${MIN_SECTIONS} sections/tables (${sections})`);

    // Required fields
    if (!/Stage:/i.test(source)) errors.push('missing Stage');
    if (!/(Branch:|commit)/i.test(source)) errors.push('missing Branch or commit');
    if (!/Decision/i.test(source)) errors.push('missing Decision');

    // Safety / Tests
    if (!/Safety/i.test(source) && !isToolingOrMap) errors.push('missing Safety');
    if (!/(?:Tests|Validation)/i.test(source) && !isToolingOrMap) errors.push('missing Tests or Validation');

    return errors;
}

function auditDocs(dir = DOC_DIR) {
    const names = discoverDocs(dir);
    const docs = [];
    for (const name of names) {
        const filePath = path.join(dir, name);
        if (!fs.existsSync(filePath)) continue;
        const source = fs.readFileSync(filePath, 'utf8');
        const errors = auditSource(name, source);
        const analysis = analyzeSource(name, source);
        docs.push({ name, filePath, ok: errors.length === 0, errors, ...analysis, recommendedAction: recommendedAction(errors, analysis) });
    }
    return {
        ok: docs.every((doc) => doc.ok),
        docs,
        checked: docs.length,
        failures: docs.filter((doc) => !doc.ok).length
    };
}

function recommendedAction(errors, analysis) {
    if (errors.length === 0) return 'none';
    if (analysis.hasLiteralNewline || analysis.maxLineLength > MAX_LINE_LENGTH || analysis.lineCount < 10) {
        return 'archive-normalize';
    }
    if (analysis.hasTodo || analysis.hasPending) return 'fix';
    if (analysis.historicalDoc) return 'policy-exempt-with-marker';
    if (analysis.archivedDoc) return 'fix';
    return 'investigate';
}

function markdownReport(result) {
    const lines = [
        '# BM-AUTO A4 Doc Audit',
        '',
        'Stage: BM-AUTO-A4-DOC-AUDIT',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Docs checked: ${result.checked}.`,
        `Total failures: ${result.failures}.`,
        `Doc audit passed: ${result.ok ? 'yes' : 'no'}.`,
        `Rules: >= ${MIN_LINES} lines, >= ${MIN_SECTIONS} sections, < ${MAX_LINE_LENGTH} max line.`,
        '',
        '## Failure Inventory',
        '',
        '| File | Lines | Headings | Max Line | Literal \\n | TODO | Pending | Missing Stage | Missing Branch/Commit | Missing Validation/Tests | Missing Safety | Missing Decision | Current Campaign | Historical | Recommended Action | Errors |',
        '| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
    ];
    for (const doc of result.docs.filter((item) => !item.ok)) {
        lines.push(`| ${doc.name} | ${doc.lineCount} | ${doc.headingCount} | ${doc.maxLineLength} | ${doc.hasLiteralNewline ? 'yes' : 'no'} | ${doc.hasTodo ? 'yes' : 'no'} | ${doc.hasPending ? 'yes' : 'no'} | ${doc.missingStage ? 'yes' : 'no'} | ${doc.missingBranchOrCommit ? 'yes' : 'no'} | ${doc.missingValidationOrTests ? 'yes' : 'no'} | ${doc.missingSafety ? 'yes' : 'no'} | ${doc.missingDecision ? 'yes' : 'no'} | ${doc.currentCampaignDoc ? 'yes' : 'no'} | ${doc.historicalDoc ? 'yes' : 'no'} | ${doc.recommendedAction} | ${doc.errors.join('; ')} |`);
    }
    lines.push('', '## Decision', '', `A4 docs accepted: ${result.ok ? 'yes' : 'no'}.`, '');
    return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
    const result = auditDocs();
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    if (json || reportIndex < 0) console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
    discoverDocs,
    analyzeSource,
    auditSource,
    auditDocs,
    markdownReport,
    countSections,
    isCurrentCampaignDoc,
    recommendedAction
};
