const fs = require('fs');
const { mapCallsites } = require('./bm-a4-callsite-map');

function riskFor(site) {
    const classes = site.classification || [];
    if (classes.some((c) => ['PDF_OWNERSHIP_WRITE', 'CONTROLLED_WRITE', 'RUNNER', 'AI_OCR'].includes(c))) return 'BLOCK';
    if (classes.some((c) => ['PDF_PATH', 'BATCH_SAVE_PATH', 'DRAFT_WRITE_PATH'].includes(c))) return 'HIGH';
    if (classes.some((c) => ['OPTION_REPAIR_PATH', 'FINAL_VALIDATION_PATH', 'WARNING_MUTATION_PATH', 'VISUAL_REPAIR_PATH', 'DOCX_PATH'].includes(c))) return 'MEDIUM';
    if (classes.includes('UNKNOWN_PATH')) return 'MEDIUM';
    return 'LOW';
}

function classifyRisks() {
    const map = mapCallsites('app.js');
    const callsites = map.callsites.map((site) => ({
        ...site,
        risk: riskFor(site)
    }));
    const counts = {};
    for (const site of callsites) counts[site.risk] = (counts[site.risk] || 0) + 1;
    return {
        ok: true,
        counts,
        directMigrationAllowed: false,
        wrapperFirstAllowed: !counts.BLOCK,
        fixtureFirstRequired: true,
        callsites
    };
}

function markdownReport(result) {
    const lines = [
        '# BM-AUTO Chain A A4 Risk Matrix',
        '',
        'Stage: BM-AUTO-CHAIN-A-A4-RISK-MATRIX',
        'Branch: main',
        '',
        '## Summary',
        '',
        `A4 direct migration allowed: ${result.directMigrationAllowed ? 'yes' : 'no'}.`,
        `A4 wrapper-first allowed: ${result.wrapperFirstAllowed ? 'yes' : 'no'}.`,
        `A4 fixture-first required: ${result.fixtureFirstRequired ? 'yes' : 'no'}.`,
        '',
        '## Counts',
        '',
        '| Risk | Count |',
        '| --- | ---: |'
    ];
    for (const risk of ['LOW', 'MEDIUM', 'HIGH', 'BLOCK']) lines.push(`| ${risk} | ${result.counts[risk] || 0} |`);
    lines.push('', '## Callsites', '', '| Line | Helper | Risk | Classification | Text |', '| ---: | --- | --- | --- | --- |');
    for (const site of result.callsites) {
        lines.push(`| ${site.line} | ${site.helper} | ${site.risk} | ${site.classification.join(', ')} | ${site.lineText.replace(/\|/g, '\\|')} |`);
    }
    lines.push('', '## Decision', '', `Wrapper-first gate may proceed: ${result.wrapperFirstAllowed ? 'yes' : 'no'}.`, '');
    return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
    const result = classifyRisks();
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    if (json || reportIndex < 0) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
    classifyRisks,
    riskFor,
    markdownReport
};
