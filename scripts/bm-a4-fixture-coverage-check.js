const fs = require('fs');

const REQUIRED_TAGS = [
    '[A4:text:empty]',
    '[A4:text:null]',
    '[A4:text:undefined]',
    '[A4:text:plain]',
    '[A4:text:bad-placeholder]',
    '[A4:text:legal-image-token]',
    '[A4:text:legal-formula-token]',
    '[A4:text:includegraphics]',
    '[A4:text:literal-pollution]',
    '[A4:text:mixed-spacing]',
    '[A4:text:idempotent]',
    '[A4:options:non-array]',
    '[A4:options:empty-array]',
    '[A4:options:short-array]',
    '[A4:options:extra-options]',
    '[A4:options:plain]',
    '[A4:options:bad-placeholder]',
    '[A4:options:legal-image-token]',
    '[A4:options:legal-formula-token]',
    '[A4:options:mixed-token-text]',
    '[A4:options:mutation]',
    '[A4:options:malformed-entry]',
    '[A4:warning:null-question]',
    '[A4:warning:empty-message]',
    '[A4:warning:create-array]',
    '[A4:warning:dedupe]',
    '[A4:warning:second-warning]',
    '[A4:warning:preserve-existing]',
    '[A4:warning:non-array]',
    '[A4:warning:mutation]',
    '[A4:warning:return-value]',
    '[A4:warning:preserve-fields]',
    '[A4:fields:null]',
    '[A4:fields:undefined]',
    '[A4:fields:return-reference]',
    '[A4:fields:stem]',
    '[A4:fields:options]',
    '[A4:fields:answer]',
    '[A4:fields:solution]',
    '[A4:fields:legal-token]',
    '[A4:fields:bad-placeholder]',
    '[A4:fields:preserve-extra]',
    '[A4:fields:mutation]',
    '[A4:fields:no-attachment-inference]',
    '[A4:fields:malformed-options]',
    '[A4:integration:docx-normal]',
    '[A4:integration:docx-image-option]',
    '[A4:integration:missing-options]',
    '[A4:integration:pdf-draft]',
    '[A4:integration:no-runner]',
    '[A4:integration:no-ai-ocr]'
];

function checkFixtureCoverage(filePath = 'tests/qisi-app-display-cleaners-fixtures.test.js') {
    const errors = [];
    if (!fs.existsSync(filePath)) {
        return { ok: false, filePath, totalRequired: REQUIRED_TAGS.length, present: [], missing: REQUIRED_TAGS, errors: ['fixture file missing'] };
    }
    const source = fs.readFileSync(filePath, 'utf8');
    const present = REQUIRED_TAGS.filter((tag) => source.includes(tag));
    const missing = REQUIRED_TAGS.filter((tag) => !source.includes(tag));
    if (/\b(?:it|test|describe)\.skip\s*\(/.test(source)) errors.push('skip marker found');
    if (/\b(?:it|test|describe)\.only\s*\(/.test(source)) errors.push('only marker found');
    if (/\btodo\b|TODO-only/i.test(source)) errors.push('todo marker found');
    return {
        ok: missing.length === 0 && errors.length === 0,
        filePath,
        totalRequired: REQUIRED_TAGS.length,
        present,
        missing,
        errors
    };
}

function markdownReport(result) {
    return [
        '# BM-AUTO Chain A A4 Fixture Coverage',
        '',
        'Stage: BM-AUTO-CHAIN-A-A4-FIXTURE-COVERAGE',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Coverage passed: ${result.ok ? 'yes' : 'no'}.`,
        `Required tags: ${result.totalRequired}.`,
        `Present tags: ${result.present.length}.`,
        `Missing tags: ${result.missing.length}.`,
        '',
        '## Missing Tags',
        '',
        ...(result.missing.length ? result.missing.map((tag) => `- ${tag}`) : ['- none']),
        '',
        '## Errors',
        '',
        ...(result.errors.length ? result.errors.map((error) => `- ${error}`) : ['- none']),
        '',
        '## Decision',
        '',
        `Fixture coverage accepted: ${result.ok ? 'yes' : 'no'}.`,
        ''
    ].join('\n');
}

function main(argv = process.argv.slice(2)) {
    const result = checkFixtureCoverage();
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    if (json || reportIndex < 0) console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
    REQUIRED_TAGS,
    checkFixtureCoverage,
    markdownReport
};
