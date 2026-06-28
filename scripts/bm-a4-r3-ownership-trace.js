const fs = require('fs');
const path = require('path');
const { rankAll } = require('./bm-a4-r3-candidate-ranker');

const FIELD_PATTERNS = {
    ownershipFieldsNearby: /\bownership\b|answerOwnership|solutionOwnership|supportOwnership|baselineCandidate|controlledWriteAccepted/i,
    supportFieldsNearby: /\bsupport\b|supportItems|supportItem|sourceTrace|sourcePageImage|evidence|attach/i,
    answerFieldsNearby: /\banswer\b|answerItems|answerSource|\.answer\b|答案/i,
    solutionFieldsNearby: /\bsolution\b|solutionItems|solutionSource|\.solution\b|解析|详解/i
};

const READ_FIELD_PATTERN = /\b(?:draft|q|item|patch|next|d)\.(stem|options|answer|solution|warnings|support|supportItems|answerItems|solutionItems|images|media|source|sourceTrace)\b/g;
const MUTATED_FIELD_PATTERN = /\b(?:draft|q|item|patch|next|d)\.(stem|options|answer|solution|warnings|support|supportItems|answerItems|solutionItems|images|media|source|sourceTrace)\s*=|\b(?:draft|q|item|patch|next|d)\.warnings\.push\s*\(/g;

function readAppLines(appPath = path.resolve(__dirname, '..', 'app.js')) {
    return fs.readFileSync(appPath, 'utf8').split(/\r?\n/);
}

function getContextWindow(lines, lineNum, radius = 12) {
    const index = lineNum - 1;
    const start = Math.max(0, index - radius);
    const end = Math.min(lines.length, index + radius + 1);
    return {
        startLine: start + 1,
        endLine: end,
        text: lines.slice(start, end).join('\n')
    };
}

function findParentFunction(lines, lineNum) {
    for (let index = lineNum - 1; index >= 0; index -= 1) {
        const line = lines[index];
        const named = line.match(/\b(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/);
        if (named) return named[1];
        const assigned = line.match(/\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z0-9_$]+\s*=>)/);
        if (assigned) return assigned[1];
        const method = line.match(/^\s*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/);
        if (method) return method[1];
    }
    return '(global)';
}

function uniqueMatches(pattern, text) {
    const matches = [];
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let match;
    while ((match = re.exec(text)) !== null) {
        matches.push(match[1] || match[0]);
    }
    return [...new Set(matches)];
}

function fieldsForPattern(pattern, context) {
    return pattern.test(context) ? uniqueMatches(READ_FIELD_PATTERN, context) : [];
}

function traceCallsite(callsite, appLines = readAppLines()) {
    const context = getContextWindow(appLines, callsite.line, 12);
    const contextText = context.text;
    const mutatedFields = uniqueMatches(MUTATED_FIELD_PATTERN, contextText);
    const readFields = uniqueMatches(READ_FIELD_PATTERN, contextText);
    const parentFunction = findParentFunction(appLines, callsite.line);

    const ownershipFieldsNearby = fieldsForPattern(FIELD_PATTERNS.ownershipFieldsNearby, contextText);
    const supportFieldsNearby = fieldsForPattern(FIELD_PATTERNS.supportFieldsNearby, contextText);
    const answerFieldsNearby = fieldsForPattern(FIELD_PATTERNS.answerFieldsNearby, contextText);
    const solutionFieldsNearby = fieldsForPattern(FIELD_PATTERNS.solutionFieldsNearby, contextText);

    const callsControlledWrite = /\bcontrolledWrite\b|controlled-write|writeAnswer|writeSolution|baselineCandidate/i.test(contextText);
    const callsPdfSupport = /\bpdf\b|PDF|pdfSupport|aligner|blockParser|renderPdf/i.test(contextText);
    const onlyMutatesWarningArray = callsite.helper === 'addWarningOnce' &&
        mutatedFields.every((field) => field === 'warnings') &&
        !callsControlledWrite;
    const onlyCleansDisplayText = /^cleanDisplay(?:Text|Options|Fields)ForBatchSave$/.test(callsite.helper) &&
        !callsControlledWrite &&
        supportFieldsNearby.length === 0 &&
        answerFieldsNearby.length === 0 &&
        solutionFieldsNearby.length === 0 &&
        ownershipFieldsNearby.length === 0;
    const localCleanupOnly = /^cleanDisplay(?:Text|Options|Fields)ForBatchSave$/.test(callsite.helper) &&
        !callsControlledWrite &&
        mutatedFields.length > 0 &&
        mutatedFields.every((field) => ['stem', 'options'].includes(field));

    let traceDecision = 'TRACE_INSUFFICIENT';
    if (callsControlledWrite) traceDecision = 'CONTROLLED_WRITE_ADJACENT_TRUE';
    else if (callsPdfSupport && (ownershipFieldsNearby.length > 0 || /ownership/i.test(contextText))) traceDecision = 'OWNERSHIP_RISK_TRUE';
    else if (callsPdfSupport) traceDecision = 'SUPPORT_ATTACHMENT_RISK_TRUE';
    else if (supportFieldsNearby.length > 0) traceDecision = 'SUPPORT_ATTACHMENT_RISK_TRUE';
    else if (answerFieldsNearby.length > 0 || solutionFieldsNearby.length > 0) traceDecision = 'ANSWER_SOLUTION_RISK_TRUE';
    else if (onlyMutatesWarningArray || (callsite.helper === 'addWarningOnce' && /warning|warnings/i.test(contextText))) traceDecision = 'WARNING_ONLY_PROVABLE';
    else if (localCleanupOnly) traceDecision = 'LOCAL_CLEANUP_PROVABLE';
    else if (onlyCleansDisplayText) traceDecision = 'DISPLAY_ONLY_PROVABLE';

    return {
        callsiteId: callsite.callsiteId,
        helper: callsite.helper,
        line: callsite.line,
        parentFunction,
        contextStartLine: context.startLine,
        contextEndLine: context.endLine,
        ownershipFieldsNearby,
        supportFieldsNearby,
        answerFieldsNearby,
        solutionFieldsNearby,
        mutatedFields,
        readFields,
        onlyCleansDisplayText,
        onlyMutatesWarningArray,
        callsControlledWrite,
        callsPdfSupport,
        traceDecision
    };
}

function traceAll() {
    const appLines = readAppLines();
    const ranked = rankAll().ranked.sort((a, b) => a.line - b.line);
    const results = ranked.map((callsite) => traceCallsite(callsite, appLines));
    return {
        ok: true,
        totalCallsites: results.length,
        byDecision: results.reduce((acc, result) => {
            acc[result.traceDecision] = (acc[result.traceDecision] || 0) + 1;
            return acc;
        }, {}),
        results
    };
}

function markdownReport(summary) {
    const lines = [
        '# BM-AUTO A4 R3 Ownership Trace',
        '',
        'Stage: BM-AUTO-A4-R3-OWNERSHIP-TRACE',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Total traced: ${summary.totalCallsites}.`,
        '',
        '## Decisions',
        '',
        '| Decision | Count |',
        '| --- | ---: |'
    ];
    for (const [decision, count] of Object.entries(summary.byDecision).sort()) {
        lines.push(`| ${decision} | ${count} |`);
    }
    lines.push('', '## Results', '', '| ID | Helper | Line | Parent | Decision | Mutated | Read |', '| --- | --- | ---: | --- | --- | --- | --- |');
    for (const result of summary.results) {
        lines.push(`| ${result.callsiteId} | ${result.helper} | ${result.line} | ${result.parentFunction} | ${result.traceDecision} | ${result.mutatedFields.join(', ') || 'none'} | ${result.readFields.join(', ') || 'none'} |`);
    }
    lines.push('', '## Decision', '', 'Ownership trace generated. Use with field mutation map and residual proof before replacing any residual callsite.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const callsiteIndex = argv.indexOf('--callsite');
    const reportIndex = argv.indexOf('--write-report');
    let result;
    if (callsiteIndex >= 0) {
        const summary = traceAll();
        result = summary.results.find((item) => item.callsiteId === argv[callsiteIndex + 1]);
        if (!result) {
            console.error(`Unknown callsite: ${argv[callsiteIndex + 1]}`);
            process.exitCode = 1;
            return;
        }
    } else {
        result = traceAll();
    }
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result.results ? result : { totalCallsites: 1, byDecision: { [result.traceDecision]: 1 }, results: [result] }));
    if (reportIndex < 0 || argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
    FIELD_PATTERNS,
    findParentFunction,
    getContextWindow,
    traceCallsite,
    traceAll,
    markdownReport
};
