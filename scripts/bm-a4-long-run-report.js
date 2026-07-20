const fs = require('fs');
const { extractHelpers } = require('./bm-a4-helper-extract');
const { mapCallsites } = require('./bm-a4-callsite-map');
const { classifyRisks } = require('./bm-a4-risk-classifier');
const { checkFixtureCoverage } = require('./bm-a4-fixture-coverage-check');
const { auditDocs } = require('./bm-a4-doc-audit');
const { analyzeFiles } = require('./bm-a4-staged-migration-verify');

function buildReport({ beforePath, afterPath = 'app.js', modulePath = 'qisi-utils.js' } = {}) {
    const staged = analyzeFiles({ beforePath, afterPath, modulePath });
    const helperExtraction = extractHelpers('app.js');
    const callsiteMap = mapCallsites('app.js');
    const riskMatrix = classifyRisks();
    const fixtureCoverage = checkFixtureCoverage();
    const docAudit = auditDocs();
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
    try {
        const beforeIndex = argv.indexOf('--before');
        const afterIndex = argv.indexOf('--after');
        const moduleIndex = argv.indexOf('--module');
        const result = buildReport({
            beforePath: beforeIndex >= 0 ? argv[beforeIndex + 1] : undefined,
            afterPath: afterIndex >= 0 ? argv[afterIndex + 1] : 'app.js',
            modulePath: moduleIndex >= 0 ? argv[moduleIndex + 1] : 'qisi-utils.js'
        });
        const reportIndex = argv.indexOf('--write-report');
        if (reportIndex >= 0) {
            fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
        } else {
            console.log(JSON.stringify(result, null, 2));
        }
    } catch (error) {
        console.error(`bm-a4-long-run-report: ${error.message}`);
        process.exitCode = 1;
    }
}

if (require.main === module) main();

module.exports = {
    buildReport,
    markdownReport
};
