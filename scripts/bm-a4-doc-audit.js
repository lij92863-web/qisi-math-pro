const fs = require('fs');
const path = require('path');

const DOCS = [
    'BM_AUTO_CHAIN_A_A4_TOOLING_PLAN.md',
    'BM_AUTO_CHAIN_A_A4_HELPER_EXTRACTION_REPORT.md',
    'BM_AUTO_CHAIN_A_A4_CALLSITE_MAP.md',
    'BM_AUTO_CHAIN_A_A4_RISK_MATRIX.md',
    'BM_AUTO_CHAIN_A_A4_FIXTURE_TESTS.md',
    'BM_AUTO_CHAIN_A_A4_FIXTURE_COVERAGE.md',
    'BM_AUTO_CHAIN_A_A4_QISI_UTILS_IMPL.md',
    'BM_AUTO_CHAIN_A_A4_WRAPPER_ADAPTER.md',
    'BM_AUTO_CHAIN_A_A4_CALLSITE_REPLACE_R1.md',
    'BM_AUTO_CHAIN_A_A4_CALLSITE_REPLACE_R2.md',
    'BM_AUTO_CHAIN_A_A4_CALLSITE_REPLACE_R3.md',
    'BM_AUTO_CHAIN_A_A4_FINAL_WRAPPER_REMOVAL.md',
    'BM_AUTO_CHAIN_A_A4_STAGED_VERIFICATION.md',
    'BM_AUTO_CHAIN_A_A4_LONG_RUN_SUMMARY.md'
];

function auditSource(name, source) {
    const errors = [];
    const lines = source.split(/\r?\n/);
    if (lines.length < 20) errors.push('less than 20 lines');
    if (!/Stage:/i.test(source)) errors.push('missing Stage');
    if (!/(Branch:|commit)/i.test(source)) errors.push('missing Branch or commit');
    if (!/Decision/i.test(source)) errors.push('missing Decision');
    if (/SAFETY|Safety/.test(source) === false && !/TOOLING_PLAN|CALLSITE_MAP|RISK_MATRIX/.test(name)) {
        errors.push('missing Safety');
    }
    if (/TESTS|Tests/.test(source) === false && !/CALLSITE_MAP|RISK_MATRIX/.test(name)) {
        errors.push('missing Tests');
    }
    if (/pending/i.test(source) && !/LONG_RUN_SUMMARY/.test(name)) errors.push('pending marker found');
    if (/TODO/i.test(source) && !/future-work|rejected future-work/i.test(source)) errors.push('TODO marker found');
    return errors;
}

function auditDocs(dir = 'docs/refactor') {
    const docs = [];
    for (const name of DOCS) {
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
        '# BM-AUTO Chain A A4 Doc Audit',
        '',
        'Stage: BM-AUTO-CHAIN-A-A4-DOC-AUDIT',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Docs checked: ${result.checked}.`,
        `Doc audit passed: ${result.ok ? 'yes' : 'no'}.`,
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
    DOCS,
    auditSource,
    auditDocs,
    markdownReport
};
