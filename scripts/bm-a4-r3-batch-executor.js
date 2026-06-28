const fs = require('fs');
const path = require('path');
const { rankAll } = require('./bm-a4-r3-candidate-ranker');
const { buildProof } = require('./bm-a4-r3-proof-builder');

function readAppLines() { return fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8').split('\n'); }

function replaceCallsiteInApp(line, helper, appSource) {
    const lines = appSource.split('\n');
    const idx = line - 1;
    const oldLine = lines[idx];
    const nakedCall = new RegExp(`\\b${helper}\\s*\\(`);
    if (!nakedCall.test(oldLine)) return { replaced: false, reason: 'no naked call found', source: appSource };
    const newLine = oldLine.replace(new RegExp(`(?<!window\\.Qisi\\.Utils\\.)\\b${helper}\\s*\\(`), `window.Qisi.Utils.${helper}(`);
    if (newLine === oldLine) return { replaced: false, reason: 'no change after replace', source: appSource };
    lines[idx] = newLine;
    return { replaced: true, oldLine, newLine, source: lines.join('\n') };
}

function executeBatch(batchSize, writeFixtures, applyReplacements, mediumMode) {
    const summary = rankAll();
    const appLines = readAppLines();
    const appSource = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8');
    let candidates;
    if (mediumMode) {
        const medium = summary.ranked.filter(r => r.decision === 'PROOF_REQUIRED');
        const proofs = medium.map(c => buildProof(c, appLines));
        candidates = proofs.filter(p => p.proofDecision === 'PROVE_WITH_CONTEXT_FIXTURE' && p.replacementAllowed).slice(0, Math.min(batchSize, 1)).map(p => summary.ranked.find(r => r.line === p.line)).filter(Boolean);
    } else {
        candidates = summary.ranked.filter(r => r.decision === 'AUTO_FIXTURE_CANDIDATE').slice(0, batchSize);
    }
    const proofs = candidates.map(c => buildProof(c, appLines));
    const allowed = proofs.filter(p => p.replacementAllowed);
    const replacements = [];
    let newSource = appSource;

    if (applyReplacements) {
        for (const p of allowed) {
            const r = replaceCallsiteInApp(p.line, p.helper, newSource);
            if (r.replaced) {
                replacements.push({ callsiteId: p.callsiteId, helper: p.helper, line: p.line, oldLine: r.oldLine.trim(), newLine: r.newLine.trim() });
                newSource = r.source;
            }
        }
    }

    // Apply replacement to app.js
    if (applyReplacements && replacements.length > 0) {
        fs.writeFileSync(path.resolve(__dirname, '..', 'app.js'), newSource);
    }

    // Write fixtures if requested
    let fixtureInfo = { generated: 0, tags: [] };
    if (writeFixtures && allowed.length > 0) {
        const fixtureGenerator = require('./bm-a4-r3-fixture-generator');
        fixtureInfo = fixtureGenerator.generateFixturesForAllowed(allowed, appLines, true);
    }

    return {
        ok: true,
        batchSize,
        candidatesAudited: candidates.length,
        proofAllowed: allowed.length,
        replacementsApplied: replacements.length,
        fixturesGenerated: fixtureInfo.generated,
        replacements,
        deferred: proofs.filter(p => !p.replacementAllowed).length,
        blocked: proofs.filter(p => p.proofDecision.startsWith('BLOCK')).length
    };
}

function markdownReport(result, batchId) {
    const lines = ['# BM-AUTO A4 R3 Batch Report', '', `Stage: BM-AUTO-A4-R3-BATCH-${batchId}`, 'Branch: main', `Batch ID: ${batchId}`, '',
        '## Summary', '', `Candidates audited: ${result.candidatesAudited}.`, `Proof allowed: ${result.proofAllowed}.`,
        `Replacements applied: ${result.replacementsApplied}.`, `Fixtures generated: ${result.fixturesGenerated}.`,
        `Deferred: ${result.deferred}. Blocked: ${result.blocked}.`, ''];
    if (result.replacements.length > 0) {
        lines.push('## Replacements', '', '| ID | Helper | Line | Old | New |', '| --- | --- | ---: | --- | --- |');
        for (const r of result.replacements) lines.push(`| ${r.callsiteId} | ${r.helper} | ${r.line} | ${r.oldLine} | ${r.newLine} |`);
    }
    lines.push('', '## Decision', '', result.replacementsApplied > 0 ? `Replaced ${result.replacementsApplied} callsites.` : 'No replacements in this batch.', '');
    return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
    const bsIdx = argv.indexOf('--batch-size');
    const batchSize = bsIdx >= 0 ? parseInt(argv[bsIdx + 1]) || 3 : 3;
    const writeFixtures = argv.includes('--write-fixtures');
    const applyReplacements = argv.includes('--apply-replacements');
    const mediumMode = argv.includes('--medium');
    const batchId = mediumMode ? `MED-${Date.now().toString(36)}` : `AUTO-${Date.now().toString(36)}`;
    const result = executeBatch(batchSize, writeFixtures, applyReplacements, mediumMode);
    const ri = argv.indexOf('--write-report');
    if (ri >= 0) fs.writeFileSync(argv[ri + 1], markdownReport(result, batchId));
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();
module.exports = { executeBatch, replaceCallsiteInApp, markdownReport };
