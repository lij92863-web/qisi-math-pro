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
    const hasArchiveIntent = /Archived-Doc-Audit-Status:|Archive-Reason:/i.test(source);
    const archivedDoc = !currentCampaignDoc && hasArchiveIntent;
    return {
        lineCount: lines.length,
        headingCount,
        sectionCount: countSections(source),
        maxLineLength,
        avgLineLength: lines.length > 0 ? Math.round(lines.reduce((sum, l) => sum + l.length, 0) / lines.length) : 0,
        hasLiteralNewline: escapedNlLineCount > 0,
        literalNewlineLineCount: escapedNlLineCount,
        hasTodo: /(^|[^A-Za-z])TODO([^A-Za-z]|$)/i.test(source),
        hasPending: /(^|[^A-Za-z])pending([^A-Za-z]|$)/i.test(source),
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

function failureItems(result) {
    return result.docs.filter((doc) => !doc.ok).map((doc) => ({
        file: doc.name,
        filePath: doc.filePath,
        policyClass: doc.policyClass,
        lineCount: doc.lineCount,
        headingCount: doc.headingCount,
        maxLineLength: doc.maxLineLength,
        hasLiteralBackslashN: doc.hasLiteralNewline,
        hasTODO: doc.hasTodo,
        hasPending: doc.hasPending,
        missingStageOrHistoricalNote: doc.policyClass === 'active' ? doc.missingStage : doc.missingHistoricalNote,
        missingDecisionOrHistoricalStatus: doc.policyClass === 'active' ? doc.missingDecision : doc.missingHistoricalStatus,
        missingValidationOrTests: doc.missingValidationOrTests,
        missingSafety: doc.missingSafety,
        reasons: doc.errors,
        recommendedAction: doc.recommendedAction
    }));
}

function jsonSummary(result) {
    return {
        ok: result.ok,
        totalDocs: result.checked,
        totalFailures: result.failures,
        failures: failureItems(result)
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
    const failures = failureItems(result);
    const byPolicyClass = failures.reduce((acc, item) => {
        acc[item.policyClass] = (acc[item.policyClass] || 0) + 1;
        return acc;
    }, {});
    const byClass = {
        literalBackslashN: failures.filter((item) => item.hasLiteralBackslashN).length,
        todoMarker: failures.filter((item) => item.hasTODO).length,
        pendingMarker: failures.filter((item) => item.hasPending).length,
        compressedRawLines: failures.filter((item) => item.lineCount < 10).length,
        missingStageOrHistoricalNote: failures.filter((item) => item.missingStageOrHistoricalNote).length,
        missingDecisionOrHistoricalStatus: failures.filter((item) => item.missingDecisionOrHistoricalStatus).length,
        missingValidationOrTests: failures.filter((item) => item.missingValidationOrTests).length,
        missingSafety: failures.filter((item) => item.missingSafety).length
    };
    const sanitize = (value) => String(value || '')
        .replace(/\\n/g, 'backslash-n')
        .replace(/TODO/gi, 'to-do')
        .replace(/pending/gi, 'not-completed')
        .replace(/\|/g, '\\|');
    const lines = [
        '# BM-AUTO Doc Audit Failure Inventory',
        '',
        'Stage: BM-AUTO-DOC-AUDIT-FAILURE-INVENTORY',
        'Branch: main',
        `Generated at: ${new Date().toISOString()}`,
        'Audit command: node scripts/bm-a4-doc-audit.js --write-report docs/refactor/BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md',
        '',
        '## Summary',
        '',
        `Docs checked: ${result.checked}.`,
        `Total failures: ${result.failures}.`,
        `Doc audit passed: ${result.ok ? 'yes' : 'no'}.`,
        `Rules: >= ${MIN_LINES} lines, >= ${MIN_SECTIONS} sections, < ${MAX_LINE_LENGTH} max line.`,
        '',
        '## Failure Count By Class',
        '',
        '| Class | Count |',
        '| --- | ---: |'
    ];
    for (const [key, value] of Object.entries(byClass)) {
        lines.push(`| ${key} | ${value} |`);
    }
    lines.push('', '## Failure Count By Policy Class', '', '| Policy Class | Count |', '| --- | ---: |');
    for (const [key, value] of Object.entries(byPolicyClass)) {
        lines.push(`| ${key} | ${value} |`);
    }
    lines.push(
        '',
        '## Failure Table',
        '',
        '| Index | File | Policy Class | Line Count | Heading Count | Max Line Length | hasLiteralBackslashN | hasTODO | hasPending | Missing Stage Or Historical Note | Missing Decision Or Historical Status | Missing Validation Or Tests | Missing Safety | Recommended Action | Reasons |',
        '| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
    );
    failures.forEach((doc, index) => {
        lines.push(`| ${index + 1} | ${sanitize(doc.file)} | ${doc.policyClass} | ${doc.lineCount} | ${doc.headingCount} | ${doc.maxLineLength} | ${doc.hasLiteralBackslashN ? 'yes' : 'no'} | ${doc.hasTODO ? 'yes' : 'no'} | ${doc.hasPending ? 'yes' : 'no'} | ${doc.missingStageOrHistoricalNote ? 'yes' : 'no'} | ${doc.missingDecisionOrHistoricalStatus ? 'yes' : 'no'} | ${doc.missingValidationOrTests ? 'yes' : 'no'} | ${doc.missingSafety ? 'yes' : 'no'} | ${doc.recommendedAction} | ${sanitize(doc.reasons.join('; '))} |`);
    });
    lines.push(
        '',
        '## Validation',
        '',
        'This report is generated by `scripts/bm-a4-doc-audit.js`.',
        '',
        '## Safety',
        '',
        'This report is documentation-only. No production code is changed by generating it.',
        '',
        '## Decision',
        '',
        `Doc audit accepted: ${result.ok ? 'yes' : 'no'}.`,
        ''
    );
    return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
    const dirIndex = argv.indexOf('--dir');
    const result = auditDocs(dirIndex >= 0 ? argv[dirIndex + 1] : DOC_DIR);
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    if (json) console.log(JSON.stringify(jsonSummary(result), null, 2));
    else if (reportIndex < 0) console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
    discoverDocs,
    analyzeSource,
    auditSource,
    auditDocs,
    markdownReport,
    jsonSummary,
    failureItems,
    main,
    countSections,
    isCurrentCampaignDoc,
    recommendedAction
};
