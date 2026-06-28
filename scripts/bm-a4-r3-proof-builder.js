const fs = require('fs');
const path = require('path');
const { rankAll } = require('./bm-a4-r3-candidate-ranker');

function readAppLines() {
    return fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8').split('\n');
}

function getParentFunction(lines, lineNum) {
    for (let i = lineNum - 1; i >= 0; i--) {
        const m = lines[i].match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|[^=]))/);
        if (m) return m[1] || m[2] || 'unknown';
    }
    return 'global';
}

function getSurroundingBlock(lines, lineNum, radius) {
    const idx = lineNum - 1;
    return lines.slice(Math.max(0, idx - radius), Math.min(lines.length, idx + radius + 1)).join('\n');
}

function buildProof(callsite, appLines) {
    const lineNum = callsite.line;
    const contextLine = (appLines[lineNum - 1] || '').trim();
    const block = getSurroundingBlock(appLines, lineNum, 6);
    const parentFn = getParentFunction(appLines, lineNum);
    const classification = callsite.decision || 'unknown';

    const dataFieldsRead = [];
    const dataFieldsWritten = [];
    let mutatedObject = '';
    const possibleOwnershipFields = [];
    const supportFields = [];
    const answerFields = [];
    const solutionFields = [];
    const mediaFields = [];
    const warningFields = [];
    const saveDraftFields = [];
    const pdfFields = [];

    if (/stem/i.test(block)) { dataFieldsRead.push('stem'); if (/\.stem\s*=/.test(contextLine)) { mutatedObject = 'draft'; possibleOwnershipFields.push('stem'); dataFieldsWritten.push('stem'); } }
    if (/options/i.test(block)) { dataFieldsRead.push('options'); if (/\.options\s*=/.test(contextLine)) { dataFieldsWritten.push('options'); mutatedObject = mutatedObject || 'draft'; } }
    if (/answer/i.test(block)) { answerFields.push('answer'); if (/\.answer\s*=/.test(contextLine)) dataFieldsWritten.push('answer'); }
    if (/solution/i.test(block)) { solutionFields.push('solution'); if (/\.solution\s*=/.test(contextLine)) dataFieldsWritten.push('solution'); }
    if (/image|media|picture|图形/.test(block)) mediaFields.push('media');
    if (/warning/i.test(block)) warningFields.push('warning');
    if (/save|batch|draft/i.test(block)) saveDraftFields.push('saveDraft');
    if (/pdf|PDF/i.test(block)) pdfFields.push('pdf');

    let proofDecision;
    const risks = callsite.risks || {};
    if (risks.controlledWrite) proofDecision = 'BLOCK_CONTROLLED_WRITE';
    else if (risks.pdfOwnership && dataFieldsWritten.length > 0) proofDecision = 'BLOCK_PDF_OWNERSHIP';
    else if (risks.supportAttachment && dataFieldsWritten.length > 0) proofDecision = 'BLOCK_SUPPORT_ATTACHMENT';
    else if (risks.answerSolution && (answerFields.length > 0 || solutionFields.length > 0)) proofDecision = 'BLOCK_ANSWER_SOLUTION_OWNERSHIP';
    else if (risks.unknown && callsite.score < 50) proofDecision = 'BLOCK_UNKNOWN_CONTEXT';
    else if (callsite.helper === 'addWarningOnce' && dataFieldsWritten.length === 0) proofDecision = 'PROVE_WITH_SYNTHETIC_FIXTURE';
    else if (callsite.score >= 70) proofDecision = 'PROVE_WITH_CONTEXT_FIXTURE';
    else proofDecision = 'DEFER_COMPLEX_MUTATION';

    const replacementAllowed = proofDecision === 'PROVE_WITH_SYNTHETIC_FIXTURE' || proofDecision === 'PROVE_WITH_CONTEXT_FIXTURE';
    const fixturePlan = replacementAllowed ? `[A4:R3:AUTO:${callsite.callsiteId}:${callsite.helper}]` : 'none';

    return {
        callsiteId: callsite.callsiteId, helper: callsite.helper, line: lineNum, lineText: contextLine,
        parentFunction: parentFn, surroundingBlock: block.substring(0, 500),
        classification: classification, rankScore: callsite.score, rankDecision: callsite.decision,
        dataFieldsRead, dataFieldsWritten, mutatedObject, possibleOwnershipFields,
        supportFields, answerFields, solutionFields, mediaFields, warningFields, saveDraftFields, pdfFields,
        proofDecision, fixturePlan, replacementAllowed,
        reason: proofDecision === 'PROVE_WITH_SYNTHETIC_FIXTURE' ? 'simple warning-only; synthetic fixture' :
                proofDecision === 'PROVE_WITH_CONTEXT_FIXTURE' ? 'display cleanup; context fixture proves no ownership change' :
                proofDecision.startsWith('BLOCK') ? `blocked: ${proofDecision}` : `deferred: ${proofDecision}`
    };
}

function buildAll() {
    const summary = rankAll();
    const appLines = readAppLines();
    const proofs = summary.ranked.map(c => buildProof(c, appLines));
    const allowed = proofs.filter(p => p.replacementAllowed).length;
    return { ok: true, total: proofs.length, replacementAllowed: allowed, blocked: proofs.filter(p => p.proofDecision.startsWith('BLOCK')).length, deferred: proofs.filter(p => !p.replacementAllowed && !p.proofDecision.startsWith('BLOCK')).length, proofs };
}

function markdownReport(result) {
    const lines = ['# BM-AUTO A4 R3 Proof Inventory', '', 'Stage: BM-AUTO-A4-R3-PROOF-INVENTORY', 'Branch: main', '',
        '## Summary', '', `Total: ${result.total}. Replacement allowed: ${result.replacementAllowed}. Blocked: ${result.blocked}. Deferred: ${result.deferred}.`, '',
        '## Replacement-Allowed (top 20)', '',
        '| ID | Helper | Line | Score | Proof |', '| --- | --- | ---: | ---: | --- |'];
    for (const p of result.proofs.filter(p => p.replacementAllowed).slice(0, 20)) lines.push(`| ${p.callsiteId} | ${p.helper} | ${p.line} | ${p.rankScore} | ${p.proofDecision} |`);
    lines.push('', '## Blocked', '',
        '| ID | Helper | Line | Score | Reason |', '| --- | --- | ---: | ---: | --- |');
    for (const p of result.proofs.filter(p => p.proofDecision.startsWith('BLOCK')).slice(0, 20)) lines.push(`| ${p.callsiteId} | ${p.helper} | ${p.line} | ${p.rankScore} | ${p.reason} |`);
    lines.push('', '## Decision', '', `Proof inventory complete. ${result.replacementAllowed} callsites ready for fixture generation.`, '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const result = buildAll();
    const ri = argv.indexOf('--write-report');
    if (ri >= 0) fs.writeFileSync(argv[ri + 1], markdownReport(result));
    if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else if (ri < 0) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();
module.exports = { buildProof, buildAll, markdownReport };
