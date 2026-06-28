const fs = require('fs');
const { rankAll } = require('./bm-a4-r3-candidate-ranker');
const { buildAll } = require('./bm-a4-r3-proof-builder');
const { traceAll } = require('./bm-a4-r3-ownership-trace');
const { mapAll } = require('./bm-a4-r3-field-mutation-map');

const SAFE_TRACE = new Set([
    'DISPLAY_ONLY_PROVABLE',
    'WARNING_ONLY_PROVABLE',
    'LOCAL_CLEANUP_PROVABLE'
]);

const SAFE_MUTATION = new Set([
    'SAFE_LOCAL_DISPLAY_MUTATION',
    'SAFE_WARNING_MUTATION',
    'SAFE_OPTIONS_CLEANUP'
]);

function decisionFromUnsafeTrace(traceDecision) {
    if (traceDecision === 'CONTROLLED_WRITE_ADJACENT_TRUE') return 'FREEZE_CONTROLLED_WRITE';
    if (traceDecision === 'OWNERSHIP_RISK_TRUE') return 'FREEZE_PDF_OWNERSHIP';
    if (traceDecision === 'SUPPORT_ATTACHMENT_RISK_TRUE') return 'FREEZE_SUPPORT_ATTACHMENT';
    if (traceDecision === 'ANSWER_SOLUTION_RISK_TRUE') return 'FREEZE_ANSWER_SOLUTION_OWNERSHIP';
    if (traceDecision === 'TRACE_INSUFFICIENT') return 'FREEZE_INSUFFICIENT_PROOF';
    return '';
}

function decisionFromUnsafeMutation(mutationDecision) {
    if (mutationDecision === 'UNSAFE_CONTROLLED_WRITE_MUTATION') return 'FREEZE_CONTROLLED_WRITE';
    if (mutationDecision === 'UNSAFE_OWNERSHIP_MUTATION') return 'FREEZE_PDF_OWNERSHIP';
    if (mutationDecision === 'UNSAFE_SUPPORT_MUTATION') return 'FREEZE_SUPPORT_ATTACHMENT';
    if (mutationDecision === 'UNSAFE_ANSWER_SOLUTION_MUTATION') return 'FREEZE_ANSWER_SOLUTION_OWNERSHIP';
    if (mutationDecision === 'MUTATION_UNKNOWN') return 'FREEZE_INSUFFICIENT_PROOF';
    return '';
}

function finalAllowedDecision(traceDecision, mutationDecision, rankDecision) {
    if (traceDecision === 'WARNING_ONLY_PROVABLE' && mutationDecision === 'SAFE_WARNING_MUTATION') {
        return rankDecision === 'BLOCK_UNTIL_MANUAL' ? 'REPLACE_ALLOWED_STRONG_PROOF' : 'REPLACE_ALLOWED_WARNING_ONLY';
    }
    if (traceDecision === 'LOCAL_CLEANUP_PROVABLE') return 'REPLACE_ALLOWED_LOCAL_CLEANUP';
    if (traceDecision === 'DISPLAY_ONLY_PROVABLE' && mutationDecision === 'SAFE_OPTIONS_CLEANUP') return 'REPLACE_ALLOWED_DISPLAY_ONLY';
    if (traceDecision === 'DISPLAY_ONLY_PROVABLE') return 'REPLACE_ALLOWED_DISPLAY_ONLY';
    return 'REPLACE_ALLOWED_STRONG_PROOF';
}

function decideResidual(input) {
    const rankDecision = input.rankDecision || 'DEFER';
    const traceDecision = input.traceDecision || 'TRACE_INSUFFICIENT';
    const mutationDecision = input.mutationDecision || 'MUTATION_UNKNOWN';
    const fixturePlan = input.fixturePlan || 'none';
    const legacyReplacementAllowed = Boolean(input.legacyReplacementAllowed);
    const rankBlocked = rankDecision === 'BLOCK_UNTIL_MANUAL';

    const unsafeTrace = decisionFromUnsafeTrace(traceDecision);
    if (unsafeTrace) return { residualDecision: unsafeTrace, replacementAllowed: false, reason: `trace:${traceDecision}` };

    const unsafeMutation = decisionFromUnsafeMutation(mutationDecision);
    if (unsafeMutation) return { residualDecision: unsafeMutation, replacementAllowed: false, reason: `mutation:${mutationDecision}` };

    if (!SAFE_TRACE.has(traceDecision) || !SAFE_MUTATION.has(mutationDecision)) {
        return { residualDecision: 'FREEZE_INSUFFICIENT_PROOF', replacementAllowed: false, reason: 'missing safe trace or mutation proof' };
    }
    if (rankBlocked && traceDecision !== 'WARNING_ONLY_PROVABLE') {
        return { residualDecision: 'FREEZE_INSUFFICIENT_PROOF', replacementAllowed: false, reason: 'blocked rank without false-positive warning proof' };
    }
    if (!legacyReplacementAllowed || fixturePlan === 'none') {
        return { residualDecision: 'FREEZE_INSUFFICIENT_PROOF', replacementAllowed: false, reason: 'fixture plan missing' };
    }

    return {
        residualDecision: finalAllowedDecision(traceDecision, mutationDecision, rankDecision),
        replacementAllowed: true,
        reason: 'strong proof gates passed'
    };
}

function buildResidualProofs() {
    const ranked = rankAll().ranked;
    const legacyProofs = buildAll().proofs;
    const traces = traceAll().results;
    const mutations = mapAll().results;
    const byId = (items) => new Map(items.map((item) => [item.callsiteId, item]));
    const legacyById = byId(legacyProofs);
    const traceById = byId(traces);
    const mutationById = byId(mutations);

    const results = ranked.sort((a, b) => a.line - b.line).map((rank) => {
        const legacy = legacyById.get(rank.callsiteId) || {};
        const trace = traceById.get(rank.callsiteId) || {};
        const mutation = mutationById.get(rank.callsiteId) || {};
        const decision = decideResidual({
            rankDecision: rank.decision,
            traceDecision: trace.traceDecision,
            mutationDecision: mutation.mutationDecision,
            fixturePlan: legacy.fixturePlan,
            legacyReplacementAllowed: legacy.replacementAllowed
        });
        return {
            callsiteId: rank.callsiteId,
            helper: rank.helper,
            line: rank.line,
            rankDecision: rank.decision,
            rankScore: rank.score,
            legacyProofDecision: legacy.proofDecision || 'none',
            traceDecision: trace.traceDecision || 'TRACE_INSUFFICIENT',
            mutationDecision: mutation.mutationDecision || 'MUTATION_UNKNOWN',
            fixturePlan: legacy.fixturePlan || 'none',
            residualDecision: decision.residualDecision,
            replacementAllowed: decision.replacementAllowed,
            reason: decision.reason
        };
    });

    return {
        ok: true,
        totalCallsites: results.length,
        replaceAllowed: results.filter((item) => item.replacementAllowed).length,
        frozen: results.filter((item) => !item.replacementAllowed).length,
        byDecision: results.reduce((acc, result) => {
            acc[result.residualDecision] = (acc[result.residualDecision] || 0) + 1;
            return acc;
        }, {}),
        results
    };
}

function markdownReport(summary) {
    const lines = [
        '# BM-AUTO A4 R3 Residual Proof',
        '',
        'Stage: BM-AUTO-A4-R3-RESIDUAL-PROOF',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Total residual callsites: ${summary.totalCallsites}.`,
        `Replace allowed: ${summary.replaceAllowed}.`,
        `Frozen: ${summary.frozen}.`,
        '',
        '## Decisions',
        '',
        '| Decision | Count |',
        '| --- | ---: |'
    ];
    for (const [decision, count] of Object.entries(summary.byDecision).sort()) {
        lines.push(`| ${decision} | ${count} |`);
    }
    lines.push('', '## Results', '', '| ID | Helper | Line | Rank | Trace | Mutation | Residual | Reason |', '| --- | --- | ---: | --- | --- | --- | --- | --- |');
    for (const result of summary.results) {
        lines.push(`| ${result.callsiteId} | ${result.helper} | ${result.line} | ${result.rankDecision} | ${result.traceDecision} | ${result.mutationDecision} | ${result.residualDecision} | ${result.reason} |`);
    }
    lines.push('', '## Decision', '', summary.replaceAllowed > 0 ? 'Some residual callsites may be replaced only with the listed strong proof and fixture evidence.' : 'No residual replacement is allowed by the current strong-proof gates. Freeze remaining callsites and keep wrappers.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const callsiteIndex = argv.indexOf('--callsite');
    const reportIndex = argv.indexOf('--write-report');
    let result;
    if (callsiteIndex >= 0) {
        const summary = buildResidualProofs();
        result = summary.results.find((item) => item.callsiteId === argv[callsiteIndex + 1]);
        if (!result) {
            console.error(`Unknown callsite: ${argv[callsiteIndex + 1]}`);
            process.exitCode = 1;
            return;
        }
    } else {
        result = buildResidualProofs();
    }
    if (reportIndex >= 0) fs.writeFileSync(argv[reportIndex + 1], markdownReport(result.results ? result : { totalCallsites: 1, replaceAllowed: result.replacementAllowed ? 1 : 0, frozen: result.replacementAllowed ? 0 : 1, byDecision: { [result.residualDecision]: 1 }, results: [result] }));
    if (reportIndex < 0 || argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
    SAFE_TRACE,
    SAFE_MUTATION,
    decideResidual,
    buildResidualProofs,
    markdownReport
};
