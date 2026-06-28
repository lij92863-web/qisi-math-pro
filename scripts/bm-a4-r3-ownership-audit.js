const fs = require('fs');
const path = require('path');

const RISK_PATTERNS = {
    controlledWriteAdjacent: /\bcontrolledWrite\b|controlled-write|ownership|answerOwnership|supportOwnership|writeAnswer|writeSolution|commitAnswer|finalAnswer/i,
    pdfOwnershipRisk: /\bpdf\b|PDF|supportItem|supportItems|answerItems|solutionItems|aligner|blockParser|pdfSupport|support\.answer|support\.solution/i,
    supportAttachmentRisk: /attach|attachment|\bimage\b|\bmedia\b|evidence|sourceItem|item\.support|sourcePageImage|sourceTrace\.sourcePageImage/i,
    answerSolutionOwnershipRisk: /answer|solution|解析|答案|answerSource|solutionSource|\.answer\b|\.solution\b/i,
    saveDraftRisk: /\bsave\b|\bdraft\b|\bbatch\b|persist|store|\bitems\b|questions|updatedAt/i
};

function readAppLines() {
    const appPath = path.resolve(__dirname, '..', 'app.js');
    return fs.readFileSync(appPath, 'utf8').split('\n');
}

function getContextWindow(lines, lineNum, windowSize = 8) {
    const idx = lineNum - 1;
    const start = Math.max(0, idx - windowSize);
    const end = Math.min(lines.length, idx + windowSize + 1);
    return lines.slice(start, end).join('\n');
}

function auditCallsite(callsite, appLines) {
    const context = getContextWindow(appLines, callsite.line);
    const risks = {
        controlledWriteAdjacent: false,
        pdfOwnershipRisk: false,
        supportAttachmentRisk: false,
        answerSolutionOwnershipRisk: false,
        saveDraftRisk: false,
        unknown: false
    };
    for (const [key, pattern] of Object.entries(RISK_PATTERNS)) {
        risks[key] = pattern.test(context);
    }
    if (!Object.values(risks).some(Boolean)) risks.unknown = true;

    let decision = 'REPLACE_ALLOWED_AFTER_FIXTURE';
    if (risks.controlledWriteAdjacent) decision = 'BLOCKED_CONTROLLED_WRITE';
    else if (risks.pdfOwnershipRisk && !risks.supportAttachmentRisk && !risks.answerSolutionOwnershipRisk)
        decision = 'BLOCKED_PDF_OWNERSHIP';
    else if (risks.supportAttachmentRisk && risks.pdfOwnershipRisk)
        decision = 'BLOCKED_SUPPORT_ATTACHMENT';
    else if (risks.answerSolutionOwnershipRisk && risks.saveDraftRisk)
        decision = 'BLOCKED_ANSWER_SOLUTION_OWNERSHIP';
    else if (risks.unknown) decision = 'BLOCKED_UNKNOWN';
    else if (risks.pdfOwnershipRisk || risks.supportAttachmentRisk || risks.answerSolutionOwnershipRisk)
        decision = 'FIXTURE_REQUIRED';
    else if (risks.saveDraftRisk) decision = 'FIXTURE_REQUIRED';

    const replacementAllowed = decision === 'REPLACE_ALLOWED_AFTER_FIXTURE';

    return {
        callsiteId: callsite.callsiteId,
        helper: callsite.helper,
        line: callsite.line,
        risks,
        decision,
        fixtureRequired: !replacementAllowed || decision === 'FIXTURE_REQUIRED',
        replacementAllowed
    };
}

function auditShard(shardId, planData) {
    if (!planData || !planData.callsites) {
        const planner = require('./bm-a4-r3-shard-planner');
        planData = planner.generatePlan();
    }
    const appLines = readAppLines();
    const shardCallsites = planData.callsites.filter(c => c.callsiteId && c.callsiteId.startsWith(shardId));
    if (shardCallsites.length === 0) return { ok: false, shardId, error: 'no matching callsites', results: [] };
    const results = shardCallsites.map(c => auditCallsite(c, appLines));
    const replacementAllowed = results.filter(r => r.replacementAllowed).length;
    const blocked = results.filter(r => r.decision.startsWith('BLOCKED')).length;
    const fixtureRequired = results.filter(r => r.fixtureRequired).length;
    return {
        ok: true,
        shardId,
        total: results.length,
        replacementAllowed,
        blocked,
        fixtureRequired,
        results
    };
}

function auditAll(planData) {
    if (!planData || !planData.callsites) {
        const planner = require('./bm-a4-r3-shard-planner');
        planData = planner.generatePlan();
    }
    const appLines = readAppLines();
    const results = planData.callsites.map(c => auditCallsite(c, appLines));
    const seenShards = new Set();
    const shards = [];
    for (const r of results) {
        const sid = r.callsiteId.replace(/-\d+$/, '');
        if (!seenShards.has(sid)) { seenShards.add(sid); shards.push(sid); }
    }
    const shardResults = shards.map(sid => {
        const sr = results.filter(r => r.callsiteId.startsWith(sid));
        return {
            shardId: sid,
            total: sr.length,
            replacementAllowed: sr.filter(r => r.replacementAllowed).length,
            blocked: sr.filter(r => r.decision.startsWith('BLOCKED')).length,
            fixtureRequired: sr.filter(r => r.fixtureRequired).length
        };
    });
    return {
        ok: true,
        totalCallsites: results.length,
        totalShards: shards.length,
        shards: shardResults,
        results
    };
}

function markdownReport(auditResult) {
    const lines = [
        '# BM-AUTO A4 R3 Ownership Audit',
        '',
        'Stage: BM-AUTO-A4-R3-OWNERSHIP-AUDIT',
        'Branch: main',
        '',
        '## Summary',
        '',
        `Total audited: ${auditResult.totalCallsites}.`,
        `Replacement allowed (after fixture): ${auditResult.results.filter(r => r.replacementAllowed).length}.`,
        `Blocked: ${auditResult.results.filter(r => r.decision.startsWith('BLOCKED')).length}.`,
        `Fixture required: ${auditResult.results.filter(r => r.fixtureRequired).length}.`,
        '',
        '## Shard Summary',
        '',
        '| Shard | Total | Allowed | Blocked | Fixture |',
        '| --- | ---: | ---: | ---: | ---: |'
    ];
    for (const s of auditResult.shards) {
        lines.push(`| ${s.shardId} | ${s.total} | ${s.replacementAllowed} | ${s.blocked} | ${s.fixtureRequired} |`);
    }
    lines.push('', '## Results', '');
    for (const r of auditResult.results) {
        const riskStr = Object.entries(r.risks).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none';
        lines.push(`| ${r.callsiteId} | ${r.helper} | ${r.line} | ${riskStr} | ${r.decision} | ${r.replacementAllowed ? 'yes' : 'no'} |`);
    }
    lines.push('', '## Decision', '', 'Ownership audit complete. Proceed to shard-level replacement with fixtures only for ALLOWED callsites.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const planner = require('./bm-a4-r3-shard-planner');
    const planData = planner.generatePlan();
    const shardIdx = argv.indexOf('--shard');
    const allFlag = argv.includes('--all');
    const jsonFlag = argv.includes('--json');
    const reportIdx = argv.indexOf('--write-report');
    let result;
    if (shardIdx >= 0) result = auditShard(argv[shardIdx + 1], planData);
    else if (allFlag || reportIdx >= 0 || jsonFlag) result = auditAll(planData);
    else result = auditAll(planData);
    if (reportIdx >= 0) fs.writeFileSync(argv[reportIdx + 1], markdownReport(result));
    if (jsonFlag || (!jsonFlag && reportIdx < 0)) console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
    auditCallsite,
    auditShard,
    auditAll,
    markdownReport,
    RISK_PATTERNS
};
