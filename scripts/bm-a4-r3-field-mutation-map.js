const fs = require('fs');
const path = require('path');
const { rankAll } = require('./bm-a4-r3-candidate-ranker');
const { getContextWindow } = require('./bm-a4-r3-ownership-trace');

const FIELD_TYPES = [
    'stem',
    'options',
    'answer',
    'solution',
    'analysis',
    'warnings',
    'support',
    'supportItems',
    'answerItems',
    'solutionItems',
    'images',
    'media',
    'source',
    'ownership',
    'draft',
    'save',
    'pdf',
    'controlledWrite'
];

const FIELD_PATTERNS = {
    stem: /\bstem\b|\.stem\b/g,
    options: /\boptions\b|\.options\b/g,
    answer: /\banswer\b|\.answer\b|答案/g,
    solution: /\bsolution\b|\.solution\b|解析|详解/g,
    analysis: /\banalysis\b|explanation/g,
    warnings: /\bwarning\b|\bwarnings\b|addWarningOnce/g,
    support: /\bsupport\b|supportItem\b/g,
    supportItems: /\bsupportItems\b/g,
    answerItems: /\banswerItems\b/g,
    solutionItems: /\bsolutionItems\b/g,
    images: /\bimage\b|\bimages\b|sourcePageImage/g,
    media: /\bmedia\b/g,
    source: /\bsource\b|sourceTrace/g,
    ownership: /\bownership\b|baselineCandidate|controlledWriteAccepted/g,
    draft: /\bdraft\b/g,
    save: /\bsave\b|persist|store|submit/g,
    pdf: /\bpdf\b|PDF|renderPdf/g,
    controlledWrite: /\bcontrolledWrite\b|controlled-write|writeAnswer|writeSolution/g
};

const MUTATION_PATTERNS = [
    { field: 'stem', pattern: /\b(?:draft|q|next|item|d)\.stem\s*=/g },
    { field: 'options', pattern: /\b(?:draft|q|next|item|d)\.options\s*=|\boptions\[[^\]]+\]\s*=/g },
    { field: 'answer', pattern: /\b(?:draft|q|next|item|d)\.answer\s*=/g },
    { field: 'solution', pattern: /\b(?:draft|q|next|item|d)\.solution\s*=/g },
    { field: 'analysis', pattern: /\b(?:draft|q|next|item|d)\.analysis\s*=/g },
    { field: 'warnings', pattern: /\b(?:draft|q|next|item|d)\.warnings\s*=|\b(?:draft|q|next|item|d)\.warnings\.push\s*\(|addWarningOnce\s*\(/g },
    { field: 'support', pattern: /\b(?:draft|q|next|item|d)\.support\s*=/g },
    { field: 'supportItems', pattern: /\bsupportItems\s*=|\b(?:draft|q|next|item|d)\.supportItems\s*=/g },
    { field: 'answerItems', pattern: /\banswerItems\s*=|\b(?:draft|q|next|item|d)\.answerItems\s*=/g },
    { field: 'solutionItems', pattern: /\bsolutionItems\s*=|\b(?:draft|q|next|item|d)\.solutionItems\s*=/g },
    { field: 'images', pattern: /\b(?:draft|q|next|item|d)\.images\s*=|sourcePageImage\s*=/g },
    { field: 'media', pattern: /\b(?:draft|q|next|item|d)\.media\s*=/g },
    { field: 'source', pattern: /\b(?:draft|q|next|item|d)\.source(?:Trace)?\s*=/g },
    { field: 'ownership', pattern: /\bownership\s*=|baselineCandidate\s*=|controlledWriteAccepted\s*=/g },
    { field: 'draft', pattern: /\bdraft\s*=/g },
    { field: 'save', pattern: /\bsave[A-Za-z0-9_$]*\s*\(|submit[A-Za-z0-9_$]*\s*\(/g },
    { field: 'pdf', pattern: /\bpdf[A-Za-z0-9_$]*\s*=/g },
    { field: 'controlledWrite', pattern: /\bcontrolledWrite[A-Za-z0-9_$]*\s*\(|writeAnswer\s*\(|writeSolution\s*\(/g }
];

function readAppLines(appPath = path.resolve(__dirname, '..', 'app.js')) {
    return fs.readFileSync(appPath, 'utf8').split(/\r?\n/);
}

function hasPattern(pattern, text) {
    return new RegExp(pattern.source, pattern.flags.replace('g', '')).test(text);
}

function detectNearbyFieldTypes(contextText) {
    return FIELD_TYPES.filter((field) => hasPattern(FIELD_PATTERNS[field], contextText));
}

function detectMutatedFields(contextText) {
    const fields = [];
    for (const { field, pattern } of MUTATION_PATTERNS) {
        if (hasPattern(pattern, contextText)) fields.push(field);
    }
    return [...new Set(fields)];
}

function mapCallsite(callsite, appLines = readAppLines()) {
    const context = getContextWindow(appLines, callsite.line, 12);
    const nearbyFieldTypes = detectNearbyFieldTypes(context.text);
    const mutatedFields = detectMutatedFields(context.text);
    const mutatesOnlyTargetDisplayField = mutatedFields.length > 0 && mutatedFields.every((field) => ['stem', 'options'].includes(field));
    const mutatesWarningsOnly = mutatedFields.length > 0 && mutatedFields.every((field) => field === 'warnings');
    const mutatesOwnershipField = mutatedFields.includes('ownership');
    const mutatesSupportField = mutatedFields.some((field) => ['support', 'supportItems', 'source', 'images', 'media', 'pdf'].includes(field));
    const mutatesAnswerSolutionField = mutatedFields.some((field) => ['answer', 'solution', 'analysis', 'answerItems', 'solutionItems'].includes(field));
    const mutatesControlledWrite = mutatedFields.includes('controlledWrite') || nearbyFieldTypes.includes('controlledWrite');
    const hasAnswerSolutionContext = nearbyFieldTypes.some((field) => ['answer', 'solution', 'analysis', 'answerItems', 'solutionItems'].includes(field));
    const hasSupportContext = nearbyFieldTypes.some((field) => ['support', 'supportItems', 'source', 'images', 'media', 'pdf'].includes(field));

    let mutationDecision = 'MUTATION_UNKNOWN';
    if (mutatesControlledWrite) mutationDecision = 'UNSAFE_CONTROLLED_WRITE_MUTATION';
    else if (mutatesOwnershipField) mutationDecision = 'UNSAFE_OWNERSHIP_MUTATION';
    else if (mutatesSupportField) mutationDecision = 'UNSAFE_SUPPORT_MUTATION';
    else if (mutatesAnswerSolutionField) mutationDecision = 'UNSAFE_ANSWER_SOLUTION_MUTATION';
    else if (mutatesWarningsOnly && !hasAnswerSolutionContext && !hasSupportContext) mutationDecision = 'SAFE_WARNING_MUTATION';
    else if (mutatedFields.length > 0 && mutatedFields.every((field) => field === 'options') && !hasAnswerSolutionContext && !hasSupportContext) mutationDecision = 'SAFE_OPTIONS_CLEANUP';
    else if (mutatesOnlyTargetDisplayField && !hasAnswerSolutionContext && !hasSupportContext) mutationDecision = 'SAFE_LOCAL_DISPLAY_MUTATION';

    return {
        callsiteId: callsite.callsiteId,
        helper: callsite.helper,
        line: callsite.line,
        nearbyFieldTypes,
        mutatedFields,
        mutatesOnlyTargetDisplayField,
        mutatesWarningsOnly,
        mutatesOwnershipField,
        mutatesSupportField,
        mutatesAnswerSolutionField,
        mutatesControlledWrite,
        mutationDecision
    };
}

function mapAll() {
    const appLines = readAppLines();
    const ranked = rankAll().ranked.sort((a, b) => a.line - b.line);
    const results = ranked.map((callsite) => mapCallsite(callsite, appLines));
    return {
        ok: true,
        totalCallsites: results.length,
        byDecision: results.reduce((acc, result) => {
            acc[result.mutationDecision] = (acc[result.mutationDecision] || 0) + 1;
            return acc;
        }, {}),
        results
    };
}

function markdownReport(summary) {
    const lines = [
        '# BM-AUTO A4 R3 Field Mutation Map',
        '',
        'Stage: BM-AUTO-A4-R3-FIELD-MUTATION-MAP',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Total mapped: ${summary.totalCallsites}.`,
        '',
        '## Decisions',
        '',
        '| Decision | Count |',
        '| --- | ---: |'
    ];
    for (const [decision, count] of Object.entries(summary.byDecision).sort()) {
        lines.push(`| ${decision} | ${count} |`);
    }
    lines.push('', '## Results', '', '| ID | Helper | Line | Decision | Mutated | Nearby |', '| --- | --- | ---: | --- | --- | --- |');
    for (const result of summary.results) {
        lines.push(`| ${result.callsiteId} | ${result.helper} | ${result.line} | ${result.mutationDecision} | ${result.mutatedFields.join(', ') || 'none'} | ${result.nearbyFieldTypes.join(', ') || 'none'} |`);
    }
    lines.push('', '## Decision', '', 'Field mutation map generated. Unsafe and unknown entries must remain frozen unless later proof supplies narrower evidence.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const callsiteIndex = argv.indexOf('--callsite');
    const reportIndex = argv.indexOf('--write-report');
    let result;
    if (callsiteIndex >= 0) {
        const summary = mapAll();
        result = summary.results.find((item) => item.callsiteId === argv[callsiteIndex + 1]);
        if (!result) {
            console.error(`Unknown callsite: ${argv[callsiteIndex + 1]}`);
            process.exitCode = 1;
            return;
        }
    } else {
        result = mapAll();
    }
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result.results ? result : { totalCallsites: 1, byDecision: { [result.mutationDecision]: 1 }, results: [result] }));
    if (reportIndex < 0 || argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
    FIELD_TYPES,
    detectNearbyFieldTypes,
    detectMutatedFields,
    mapCallsite,
    mapAll,
    markdownReport
};
