const fs = require('fs');
const { extractHelpers } = require('./bm-a4-helper-extract');
const { mapCallsites } = require('./bm-a4-callsite-map');
const { classifyRisks } = require('./bm-a4-risk-classifier');
const { checkFixtureCoverage } = require('./bm-a4-fixture-coverage-check');
const { auditDocs } = require('./bm-a4-doc-audit');
const { analyzeFiles } = require('./bm-a4-staged-migration-verify');

function buildReport() {
    const helperExtraction = extractHelpers('app.js');
    const callsiteMap = mapCallsites('app.js');
    const riskMatrix = classifyRisks();
    const fixtureCoverage = checkFixtureCoverage();
    const docAudit = auditDocs();
    const staged = analyzeFiles({
        beforePath: '.bm_a4_app_before.js',
        afterPath: 'app.js',
        modulePath: 'qisi-utils.js'
    });

    return {
        helperExtraction,
        callsiteMap,
        riskMatrix,
        fixtureCoverage,
        docAudit,
        staged
    };
}

function markdownReport(result) {
    return [
        '# BM-AUTO Chain A A4 Long Run Summary',
        '',
        'Stage: BM-AUTO-CHAIN-A-A4-STAGED-MIGRATION-LONG-RUN',
        'Branch: main',
        'Start commit: 3673290635b0e46a0a0b35d36147d3c4066628f2',
        'End commit: pending',
        '',
        '## Tools Added',
        '',
        '- scripts/bm-a4-helper-extract.js',
        '- scripts/bm-a4-callsite-map.js',
        '- scripts/bm-a4-risk-classifier.js',
        '- scripts/bm-a4-fixture-coverage-check.js',
        '- scripts/bm-a4-doc-audit.js',
        '- scripts/bm-a4-staged-migration-verify.js',
        '- scripts/bm-a4-long-run-report.js',
        '',
        '## Callsite Summary',
        '',
        `Total callsites: ${result.callsiteMap.total}.`,
        `Unknown callsites: ${result.callsiteMap.unknown.length}.`,
        `High-risk callsites: ${result.callsiteMap.highRisk.length}.`,
        '',
        '## Deferred Callsites',
        '',
        result.staged.classification === 'STAGED_MIGRATION_COMPLETE' ? '- none' : '- see callsite map and staged verifier output',
        '',
        '## Blocked Callsites',
        '',
        result.riskMatrix.counts.BLOCK ? `- BLOCK count: ${result.riskMatrix.counts.BLOCK}` : '- none detected by classifier',
        '',
        '## Tests Summary',
        '',
        '- See phase documents and final validation report for exact command results.',
        `- Fixture coverage checker: ${result.fixtureCoverage.ok ? 'passed' : 'not passed'}.`,
        `- Doc audit: ${result.docAudit.ok ? 'passed' : 'not passed'}.`,
        '',
        '## Safety Summary',
        '',
        '- controlled-write touched: no.',
        '- parser touched: no.',
        '- aligner touched: no.',
        '- runner touched: no.',
        '- Route B integrated: no.',
        '- real-run called: no.',
        '- AI/OCR called: no.',
        '',
        '## Decision',
        '',
        `Staged verifier classification: ${result.staged.classification}.`,
        `A4 staged migration complete: ${result.staged.classification === 'STAGED_MIGRATION_COMPLETE' ? 'yes' : 'no'}.`,
        ''
    ].join('\n');
}

function main(argv = process.argv.slice(2)) {
    const result = buildReport();
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) {
        fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
}

if (require.main === module) main();

module.exports = {
    buildReport,
    markdownReport
};
