const fs = require('fs');
const path = require('path');

const DOC_DIR = 'docs/refactor';
const MAX_LINE_LENGTH = 1200;
const WARN_LINE_LENGTH = 500;
const MIN_SECTIONS = 5;
const MIN_LINES = 20;

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

function auditSource(name, source) {
    const errors = [];
    const lines = source.split(/\r?\n/);

    // Line count
    if (lines.length < MIN_LINES) errors.push(`less than ${MIN_LINES} lines (${lines.length})`);

    // Max line length
    const longLines = lines.filter(l => l.length > MAX_LINE_LENGTH);
    if (longLines.length > 0) errors.push(`${longLines.length} lines exceed ${MAX_LINE_LENGTH} chars`);

    // Section count
    const sections = countSections(source);
    if (sections < MIN_SECTIONS) errors.push(`less than ${MIN_SECTIONS} sections/tables (${sections})`);

    // Required fields
    if (!/Stage:/i.test(source)) errors.push('missing Stage');
    if (!/(Branch:|commit)/i.test(source)) errors.push('missing Branch or commit');
    if (!/Decision/i.test(source)) errors.push('missing Decision');

    // Safety / Tests
    const isToolingOrMap = /TOOLING_PLAN|CALLSITE_MAP|RISK_MATRIX|FIXTURE_COVERAGE/i.test(name);
    if (!/Safety/i.test(source) && !isToolingOrMap) errors.push('missing Safety');
    if (!/(?:Tests|Validation)/i.test(source) && !isToolingOrMap) errors.push('missing Tests or Validation');

    // Forbidden markers
    const isLongRun = /LONG_RUN_SUMMARY/i.test(name);
    if (/pending/i.test(source) && !isLongRun) errors.push('pending marker found');
    if (/TODO/i.test(source) && !/future-work|rejected future-work/i.test(source)) errors.push('TODO marker found');

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
        docs.push({ name, filePath, ok: errors.length === 0, errors });
    }
    return {
        ok: docs.every((doc) => doc.ok),
        docs,
        checked: docs.length
    };
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
        `Doc audit passed: ${result.ok ? 'yes' : 'no'}.`,
        `Rules: >= ${MIN_LINES} lines, >= ${MIN_SECTIONS} sections, < ${MAX_LINE_LENGTH} max line.`,
        '',
        '## Results',
        '',
        '| Document | OK | Errors |',
        '| --- | --- | --- |'
    ];
    for (const doc of result.docs) {
        lines.push(`| ${doc.name} | ${doc.ok ? 'yes' : 'no'} | ${doc.errors.join('; ')} |`);
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
    auditSource,
    auditDocs,
    markdownReport,
    countSections
};
