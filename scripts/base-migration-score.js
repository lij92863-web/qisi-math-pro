const fs = require('fs');
const path = require('path');
const { inventoryAppJs } = require('./base-migration-inventory');

const rootDir = path.resolve(__dirname, '..');

const EXISTING_MODULES = new Set(
    fs.readdirSync(rootDir).filter(f => /^qisi-.*\.js$/.test(f))
);

/**
 * Score a candidate function group by how impactful its migration would be.
 *
 * Hard gates (all must pass for eligible=true):
 *  1. No DOM access
 *  2. No DB access
 *  3. No AI/OCR access
 *  4. No controlled-write access
 *  5. No async
 *  6. estimatedRemovedAppLines >= 10
 *  7. Target existing module exists
 */
function scoreCandidate(func) {
    // Individual function gates
    const passesGates =
        !func.hasDomAccess &&
        !func.hasDbAccess &&
        !func.hasAiOrOcrAccess &&
        !func.hasControlledWriteAccess &&
        !func.hasAsync;

    const moduleExists = EXISTING_MODULES.has(func.suggestedModule);

    // Base score from line count (max 50 points)
    const lineScore = Math.min(50, Math.floor(func.lineCount * 1.2));

    // Risk bonus: low risk gets full points
    const riskScore = func.risk === 'low' ? 30 : func.risk === 'medium' ? 15 : 0;

    // Module match bonus
    const moduleScore = moduleExists ? 10 : 0;

    // Call graph impact: estimate based on whether it's likely reused
    // Functions with generic utility names get higher impact scores
    const utilityNamePattern = /^(get|set|build|make|create|format|normalize|validate|parse|check|compute|find|sort|filter|map|reduce|has|is|can|should|will)/;
    const callGraphImpact = utilityNamePattern.test(func.name) ? 4 : 2;

    const score = lineScore + riskScore + moduleScore + callGraphImpact * 2;

    const eligible = passesGates && func.lineCount >= 10 && moduleExists;

    return {
        name: func.name,
        module: func.suggestedModule,
        estimatedRemovedAppLines: func.lineCount,
        callGraphImpact,
        risk: func.risk,
        score,
        eligible,
        reason: buildReason(func, eligible, passesGates, moduleExists)
    };
}

function buildReason(func, eligible, passesGates, moduleExists) {
    if (eligible) return 'pure helper, no DOM/db/AI, reusable';

    const reasons = [];
    if (!passesGates) {
        const blocks = [];
        if (func.hasDomAccess) blocks.push('DOM');
        if (func.hasDbAccess) blocks.push('DB');
        if (func.hasAiOrOcrAccess) blocks.push('AI/OCR');
        if (func.hasControlledWriteAccess) blocks.push('controlled-write');
        if (func.hasAsync) blocks.push('async');
        reasons.push(`risk markers: ${blocks.join(', ')}`);
    }
    if (func.lineCount < 10) reasons.push(`too small (${func.lineCount} lines < 10)`);
    if (!moduleExists) reasons.push(`target module ${func.suggestedModule} missing`);

    return reasons.join('; ') || 'unknown';
}

/**
 * Group eligible candidates by target module to form migration batches.
 */
function groupCandidates(scored) {
    const groups = new Map();

    for (const item of scored) {
        if (!item.eligible) continue;
        const mod = item.module;
        if (!groups.has(mod)) {
            groups.set(mod, []);
        }
        groups.get(mod).push(item);
    }

    const result = [];
    for (const [module, items] of groups) {
        const totalLines = items.reduce((sum, it) => sum + it.estimatedRemovedAppLines, 0);
        const avgScore = Math.round(items.reduce((sum, it) => sum + it.score, 0) / items.length);

        result.push({
            name: items.map(it => it.name).join(', '),
            module,
            estimatedRemovedAppLines: totalLines,
            callGraphImpact: items.reduce((sum, it) => sum + it.callGraphImpact, 0),
            risk: items.every(it => it.risk === 'low') ? 'low' : 'medium',
            score: avgScore,
            eligible: true,
            reason: `${items.length} pure helper(s), total ${totalLines} lines, target ${module}`,
            functions: items.map(it => it.name)
        });
    }

    result.sort((a, b) => b.score - a.score);
    return result;
}

function run() {
    const inventory = inventoryAppJs();
    const scored = inventory.functions.map(scoreCandidate);
    const groups = groupCandidates(scored);

    const output = {
        appJsLines: inventory.appJsLines,
        totalFunctions: inventory.functions.length,
        eligibleFunctions: scored.filter(s => s.eligible).length,
        eligibleGroups: groups.length,
        ineligibleFunctions: scored.filter(s => !s.eligible).length,
        scored,
        groups
    };

    if (require.main === module) {
        console.log(JSON.stringify(output, null, 2));
    }

    return output;
}

const result = run();

module.exports = { scoreCandidate, groupCandidates, run };
