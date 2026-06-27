const fs = require('fs');

const HELPERS = [
    'cleanDisplayTextForBatchSave',
    'cleanDisplayOptionsForBatchSave',
    'addWarningOnce',
    'cleanDisplayFieldsOnly'
];

function classifyContext(text) {
    const lower = text.toLowerCase();
    const markers = [];
    if (/pdf|support|parser|aligner/.test(lower)) markers.push('PDF_PATH');
    if (/submit|save|batchsave|confirmbatchsubmit|finalplaceholder/.test(lower)) markers.push('BATCH_SAVE_PATH');
    if (/draft|activeDraft|updateDraft|saveActiveDraft/i.test(text)) markers.push('DRAFT_WRITE_PATH');
    if (/option|repair|sanitize|extract/.test(lower)) markers.push('OPTION_REPAIR_PATH');
    if (/validat|problem|missing|issue/.test(lower)) markers.push('FINAL_VALIDATION_PATH');
    if (/visual|image|crop|figure/.test(lower)) markers.push('VISUAL_REPAIR_PATH');
    if (/warning|warnings|addWarningOnce/.test(text)) markers.push('WARNING_MUTATION_PATH');
    if (/display|preview|summary|count|text/.test(lower)) markers.push('DISPLAY_ONLY_PATH');
    if (/docx|importer|mammoth/.test(lower)) markers.push('DOCX_PATH');
    if (markers.length === 0) markers.push('UNKNOWN_PATH');
    return [...new Set(markers)];
}

function isDefinition(line, helper) {
    return new RegExp(`\\bconst\\s+${helper}\\s*=`).test(line) ||
        new RegExp(`\\bfunction\\s+${helper}\\s*\\(`).test(line);
}

function mapCallsites(appPath = 'app.js') {
    const source = fs.readFileSync(appPath, 'utf8');
    const lines = source.split(/\r?\n/);
    const callsites = [];

    lines.forEach((line, index) => {
        for (const helper of HELPERS) {
            if (!line.includes(helper)) continue;
            if (isDefinition(line, helper)) continue;
            if (!new RegExp(`(?:^|[^A-Za-z0-9_$\\.])${helper}\\s*\\(`).test(line) &&
                !line.includes(`window.Qisi.Utils.${helper}`)) {
                continue;
            }
            const start = Math.max(0, index - 5);
            const end = Math.min(lines.length, index + 6);
            const context = lines.slice(start, end).join('\n');
            const classification = classifyContext(context);
            callsites.push({
                helper,
                line: index + 1,
                lineText: line.trim(),
                contextBefore: lines.slice(start, index).map((x) => x.trim()),
                contextAfter: lines.slice(index + 1, end).map((x) => x.trim()),
                classification,
                riskMarkers: classification.filter((x) => x !== 'DISPLAY_ONLY_PATH')
            });
        }
    });

    const byHelper = {};
    const byClassification = {};
    for (const helper of HELPERS) byHelper[helper] = 0;
    for (const site of callsites) {
        byHelper[site.helper] += 1;
        for (const c of site.classification) byClassification[c] = (byClassification[c] || 0) + 1;
    }

    return {
        ok: callsites.length > 0,
        total: callsites.length,
        byHelper,
        byClassification,
        unknown: callsites.filter((site) => site.classification.includes('UNKNOWN_PATH')),
        highRisk: callsites.filter((site) =>
            site.classification.some((c) => ['PDF_PATH', 'BATCH_SAVE_PATH', 'DRAFT_WRITE_PATH'].includes(c))
        ),
        callsites
    };
}

function markdownReport(result) {
    const lines = [
        '# BM-AUTO Chain A A4 Callsite Map',
        '',
        'Stage: BM-AUTO-CHAIN-A-A4-CALLSITE-MAP',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Total callsites: ${result.total}.`,
        `Unknown callsites: ${result.unknown.length}.`,
        `High-risk callsites: ${result.highRisk.length}.`,
        '',
        '## Callsites By Helper',
        '',
        '| Helper | Count |',
        '| --- | ---: |'
    ];
    for (const [helper, count] of Object.entries(result.byHelper)) lines.push(`| ${helper} | ${count} |`);
    lines.push('', '## Callsites By Classification', '', '| Classification | Count |', '| --- | ---: |');
    for (const [classification, count] of Object.entries(result.byClassification)) {
        lines.push(`| ${classification} | ${count} |`);
    }
    lines.push('', '## Replacement Batch Proposal', '', '- R1: DISPLAY_ONLY_PATH callsites without PDF, draft write, batch save, mutation, or unknown markers.');
    lines.push('- R2: OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH after fixture coverage.');
    lines.push('- R3: BATCH_SAVE_PATH, DRAFT_WRITE_PATH, PDF_PATH only when explicitly fixture-covered.');
    lines.push('', '## Callsites', '', '| Line | Helper | Classification | Text |', '| ---: | --- | --- | --- |');
    for (const site of result.callsites) {
        lines.push(`| ${site.line} | ${site.helper} | ${site.classification.join(', ')} | ${site.lineText.replace(/\|/g, '\\|')} |`);
    }
    lines.push('', '## Decision', '', 'Callsite map generated: yes.', '');
    return `${lines.join('\n')}\n`;
}

function main(argv = process.argv.slice(2)) {
    const result = mapCallsites('app.js');
    const json = argv.includes('--json');
    const reportIndex = argv.indexOf('--write-report');
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result));
    if (json || reportIndex < 0) console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
    HELPERS,
    classifyContext,
    mapCallsites,
    markdownReport
};
