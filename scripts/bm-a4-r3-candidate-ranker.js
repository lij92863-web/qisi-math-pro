const fs = require('fs');
const path = require('path');
const { analyzeSources } = require('./bm-a4-staged-migration-verify');

function readAnalysisSources({ afterSource, moduleSource, afterPath = 'app.js', modulePath = 'qisi-utils.js' } = {}) {
    const rootPath = path.resolve(__dirname, '..');
    return {
        after: typeof afterSource === 'string'
            ? afterSource
            : fs.readFileSync(path.resolve(rootPath, afterPath), 'utf8'),
        moduleSource: typeof moduleSource === 'string'
            ? moduleSource
            : fs.readFileSync(path.resolve(rootPath, modulePath), 'utf8')
    };
}

function getNakedCallsites(input = {}) {
    const sources = readAnalysisSources(input);
    const data = analyzeSources({ after: sources.after, moduleSource: sources.moduleSource });
    if (!data.ok || !data.naked) return [];
    const sites = [];
    for (const [helper, calls] of Object.entries(data.naked)) {
        for (const call of calls) {
            sites.push({ helper, line: call.line, text: call.text });
        }
    }
    return sites;
}

function getContext(lines, lineNum, radius) {
    const idx = lineNum - 1;
    return lines.slice(Math.max(0, idx - radius), Math.min(lines.length, idx + radius + 1)).join('\n');
}

const RISK_PATTERNS = {
    controlledWrite: /\bcontrolledWrite\b|controlled-write|ownership|writeAnswer|writeSolution|commitAnswer|finalAnswer/i,
    pdfOwnership: /\bpdf\b|PDF|supportItem|answerItems|solutionItems|aligner|blockParser|pdfSupport/i,
    supportAttachment: /attach|attachment|evidence|sourceItem|item\.support|sourcePageImage/i,
    answerSolution: /\.answer\b|\.solution\b|answerSource|solutionSource/i,
    draftWrite: /\bdraft\b|\.stem\s*=|\.options\s*=|\.answer\s*=|\.solution\s*=/i,
    batchSave: /\bsave\b|\bbatch\b|persist|store|updatedAt/i,
    pdfPath: /\bpdf\b|PDF|renderPdf|pdfFile/i,
    warningMutation: /addWarningOnce|warning/i,
    objectMutation: /q\.stem\s*=|q\.options\s*=|q\.answer\s*=|q\.solution\s*=|draft\.stem|draft\.options/i
};

function rankCallsite(site, appLines) {
    const context = getContext(appLines, site.line, 5);
    let score = 100;
    const reasons = [];
    const risks = {};

    if (RISK_PATTERNS.controlledWrite.test(context)) { score -= 40; risks.controlledWrite = true; reasons.push('controlled-write adjacent'); }
    else risks.controlledWrite = false;

    if (RISK_PATTERNS.pdfOwnership.test(context)) { score -= 35; risks.pdfOwnership = true; reasons.push('PDF ownership risk'); }
    else risks.pdfOwnership = false;

    if (RISK_PATTERNS.supportAttachment.test(context)) { score -= 30; risks.supportAttachment = true; reasons.push('support attachment risk'); }
    else risks.supportAttachment = false;

    if (RISK_PATTERNS.answerSolution.test(context)) { score -= 30; risks.answerSolution = true; reasons.push('answer/solution ownership'); }
    else risks.answerSolution = false;

    if (RISK_PATTERNS.draftWrite.test(context)) { score -= 20; risks.draftWrite = true; }
    else risks.draftWrite = false;

    if (RISK_PATTERNS.batchSave.test(context)) { score -= 20; risks.batchSave = true; }
    else risks.batchSave = false;

    if (RISK_PATTERNS.pdfPath.test(context)) { score -= 15; risks.pdfPath = true; }
    else risks.pdfPath = false;

    if (RISK_PATTERNS.warningMutation.test(context)) { score -= 10; risks.warningMutation = true; }
    else risks.warningMutation = false;

    if (!Object.values(risks).some(Boolean)) { score -= 10; risks.unknown = true; reasons.push('unknown context'); }
    else risks.unknown = false;

    if (RISK_PATTERNS.objectMutation.test(context)) { score -= 5; risks.objectMutation = true; }

    if (site.helper === 'addWarningOnce') { score += 10; reasons.push('warning-only helper'); }
    if (site.helper === 'cleanDisplayFieldsOnly') { score += 10; reasons.push('field-level display only'); }
    if (!RISK_PATTERNS.answerSolution.test(context) && !RISK_PATTERNS.pdfOwnership.test(context)) { score += 10; reasons.push('no answer/solution/PDF in context'); }
    if (!RISK_PATTERNS.objectMutation.test(context) && site.helper === 'addWarningOnce') { score += 5; reasons.push('no mutation except warnings'); }

    let decision;
    if (risks.controlledWrite) decision = 'ALWAYS_BLOCK';
    else if (risks.unknown && score < 50) decision = 'DEFER';
    else if (score >= 85) decision = 'AUTO_FIXTURE_CANDIDATE';
    else if (score >= 70) decision = 'PROOF_REQUIRED';
    else if (score >= 50) decision = 'DEFER_UNLESS_STRONG_FIXTURE';
    else decision = 'BLOCK_UNTIL_MANUAL';

    return { callsiteId: `R3-${String(site.line).padStart(5, '0')}`, helper: site.helper, line: site.line, text: site.text, score, decision, reasons, risks, replacementAllowed: decision === 'AUTO_FIXTURE_CANDIDATE' };
}

function rankAll(input = {}) {
    const sources = readAnalysisSources(input);
    const sourceInput = { afterSource: sources.after, moduleSource: sources.moduleSource };
    const sites = getNakedCallsites(sourceInput);
    const appLines = sources.after.split('\n');
    const ranked = sites.map(s => rankCallsite(s, appLines)).sort((a, b) => b.score - a.score);
    const summary = {
        ok: true, total: ranked.length,
        byDecision: {
            AUTO_FIXTURE_CANDIDATE: ranked.filter(r => r.decision === 'AUTO_FIXTURE_CANDIDATE').length,
            PROOF_REQUIRED: ranked.filter(r => r.decision === 'PROOF_REQUIRED').length,
            DEFER_UNLESS_STRONG_FIXTURE: ranked.filter(r => r.decision === 'DEFER_UNLESS_STRONG_FIXTURE').length,
            BLOCK_UNTIL_MANUAL: ranked.filter(r => r.decision === 'BLOCK_UNTIL_MANUAL').length,
            ALWAYS_BLOCK: ranked.filter(r => r.decision === 'ALWAYS_BLOCK').length,
            DEFER: ranked.filter(r => r.decision === 'DEFER').length
        },
        ranked
    };
    return summary;
}

function markdownReport(summary) {
    const lines = ['# BM-AUTO A4 R3 Candidate Ranking', '', 'Stage: BM-AUTO-A4-R3-CANDIDATE-RANKING', 'Branch: main', '', '## Summary', '', `Total callsites: ${summary.total}.`, ''];
    for (const [k, v] of Object.entries(summary.byDecision)) lines.push(`- ${k}: ${v}`);
    lines.push('', '## Top 20 Safest', '', '| ID | Helper | Line | Score | Decision |', '| --- | --- | ---: | ---: | --- |');
    for (const r of summary.ranked.slice(0, 20)) lines.push(`| ${r.callsiteId} | ${r.helper} | ${r.line} | ${r.score} | ${r.decision} |`);
    lines.push('', '## Top 20 Most Dangerous', '', '| ID | Helper | Line | Score | Decision | Risks |', '| --- | --- | ---: | ---: | --- | --- |');
    for (const r of summary.ranked.slice(-20).reverse()) lines.push(`| ${r.callsiteId} | ${r.helper} | ${r.line} | ${r.score} | ${r.decision} | ${r.reasons.join('; ') || 'none'} |`);
    lines.push('', '## Decision', '', `Safe auto-fixture candidates: ${summary.byDecision.AUTO_FIXTURE_CANDIDATE}.`, '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const summary = rankAll();
    const ri = argv.indexOf('--write-report');
    if (ri >= 0) fs.writeFileSync(argv[ri + 1], markdownReport(summary));
    if (argv.includes('--json')) console.log(JSON.stringify(summary, null, 2));
    else if (ri < 0) console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) main();

module.exports = { rankCallsite, rankAll, markdownReport, RISK_PATTERNS, getNakedCallsites };
