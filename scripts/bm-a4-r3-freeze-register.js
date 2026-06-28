const fs = require('fs');
const { buildResidualProofs } = require('./bm-a4-r3-residual-proof');

function reasonFromDecision(decision) {
    if (decision === 'FREEZE_CONTROLLED_WRITE') return 'CONTROLLED_WRITE_ADJACENT';
    if (decision === 'FREEZE_PDF_OWNERSHIP') return 'PDF_OWNERSHIP';
    if (decision === 'FREEZE_SUPPORT_ATTACHMENT') return 'SUPPORT_ATTACHMENT';
    if (decision === 'FREEZE_ANSWER_SOLUTION_OWNERSHIP') return 'ANSWER_SOLUTION_OWNERSHIP';
    if (decision === 'FREEZE_UNKNOWN') return 'UNKNOWN';
    return 'INSUFFICIENT_PROOF';
}

function futureEvidenceFor(reason) {
    if (reason === 'CONTROLLED_WRITE_ADJACENT') return 'Independent controlled-write fixture proving no answer/solution ownership change and no truth-gate bypass.';
    if (reason === 'PDF_OWNERSHIP') return 'PDF ownership trace proving the callsite cannot affect parser, aligner, support item ownership, or controlled-write inputs.';
    if (reason === 'SUPPORT_ATTACHMENT') return 'Support attachment fixture proving no support, image, sourceTrace, or media ownership mutation.';
    if (reason === 'ANSWER_SOLUTION_OWNERSHIP') return 'Answer/solution fixture proving no answer, solution, baseline, or draft ownership mutation.';
    if (reason === 'UNKNOWN') return 'Narrow AST proof that identifies the parent function, exact read fields, exact written fields, and fixture coverage.';
    return 'Two independent strong-proof signals plus fixture coverage for the exact callsite.';
}

function freezeItem(proof) {
    const freezeReason = reasonFromDecision(proof.residualDecision);
    return {
        callsiteId: proof.callsiteId,
        helper: proof.helper,
        line: proof.line,
        parentFunction: proof.parentFunction || 'see ownership trace',
        freezeReason,
        evidence: [
            `rank=${proof.rankDecision}`,
            `trace=${proof.traceDecision}`,
            `mutation=${proof.mutationDecision}`,
            `residual=${proof.residualDecision}`,
            `reason=${proof.reason}`
        ],
        requiredFutureEvidence: futureEvidenceFor(freezeReason),
        wrapperRequired: true,
        replacementAllowed: false
    };
}

function assertValidFrozenItem(item) {
    const required = ['callsiteId', 'helper', 'line', 'parentFunction', 'freezeReason', 'evidence', 'requiredFutureEvidence', 'wrapperRequired', 'replacementAllowed'];
    for (const key of required) {
        if (item[key] === undefined || item[key] === '') {
            throw new Error(`Frozen item ${item.callsiteId || '(unknown)'} lacks ${key}`);
        }
    }
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
        throw new Error(`Frozen item ${item.callsiteId} lacks evidence`);
    }
    if (item.replacementAllowed !== false) {
        throw new Error(`Frozen item ${item.callsiteId} must not allow replacement`);
    }
}

function buildFreezeRegister() {
    const residual = buildResidualProofs();
    const frozen = residual.results.filter((proof) => !proof.replacementAllowed).map(freezeItem);
    for (const item of frozen) assertValidFrozenItem(item);
    return {
        ok: true,
        totalResidual: residual.totalCallsites,
        frozenCount: frozen.length,
        replaceAllowedCount: residual.replaceAllowed,
        byReason: frozen.reduce((acc, item) => {
            acc[item.freezeReason] = (acc[item.freezeReason] || 0) + 1;
            return acc;
        }, {}),
        frozen
    };
}

function markdownReport(register) {
    const lines = [
        '# BM-AUTO A4 R3 Freeze Register',
        '',
        'Stage: BM-AUTO-A4-R3-FREEZE-REGISTER',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Total residual callsites: ${register.totalResidual}.`,
        `Frozen callsites: ${register.frozenCount}.`,
        `Replace allowed callsites: ${register.replaceAllowedCount}.`,
        '',
        '## Reasons',
        '',
        '| Reason | Count |',
        '| --- | ---: |'
    ];
    for (const [reason, count] of Object.entries(register.byReason).sort()) {
        lines.push(`| ${reason} | ${count} |`);
    }
    lines.push('', '## Frozen Items', '', '| ID | Helper | Line | Reason | Wrapper Required | Required Future Evidence |', '| --- | --- | ---: | --- | --- | --- |');
    for (const item of register.frozen) {
        lines.push(`| ${item.callsiteId} | ${item.helper} | ${item.line} | ${item.freezeReason} | ${item.wrapperRequired ? 'yes' : 'no'} | ${item.requiredFutureEvidence} |`);
    }
    lines.push('', '## Decision', '', 'Frozen residual callsites must keep the four display-cleaner wrappers. Replacement is not allowed until the required future evidence exists.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const reportIndex = argv.indexOf('--write-report');
    const register = buildFreezeRegister();
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(register));
    if (reportIndex < 0 || argv.includes('--json')) console.log(JSON.stringify(register, null, 2));
}

if (require.main === module) main();

module.exports = {
    reasonFromDecision,
    futureEvidenceFor,
    freezeItem,
    assertValidFrozenItem,
    buildFreezeRegister,
    markdownReport
};
