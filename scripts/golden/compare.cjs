#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function compare(before, after) {
    if (before.schema !== 'qisi.golden-report.v1' || after.schema !== before.schema ||
        !before.suiteSha256 || before.suiteSha256 !== after.suiteSha256) throw new Error('GOLDEN_COMPARISON_INPUT_CHANGED');
    const oldCases = new Map(before.cases.map(item => [item.id, item]));
    if (oldCases.size !== before.cases.length || after.cases.length !== oldCases.size ||
        new Set(after.cases.map(item => item.id)).size !== oldCases.size ||
        after.cases.some(item => !oldCases.has(item.id))) throw new Error('GOLDEN_COMPARISON_CASES_CHANGED');
    const regressions = [], deltas = [];
    for (const item of after.cases) {
        const old = oldCases.get(item.id);
        if (!item.ok) regressions.push({ id: item.id, code: 'current-case-failed' });
        if (!old.counts || !item.counts) {
            deltas.push({ id: item.id, previousMeasured: Boolean(old.counts), currentMeasured: Boolean(item.counts) });
            continue;
        }
        const change = {};
        for (const key of ['identityMatched', 'correctCandidateAnswers', 'correctAutomaticAnswers',
            'matchedSolutionAnchors', 'wrongAutomaticAnswers', 'ungradedAutomaticAnswers']) {
            if (![old.counts[key], item.counts[key]].every(value => Number.isSafeInteger(value) && value >= 0)) {
                throw new Error('GOLDEN_COMPARISON_COUNTS_INVALID');
            }
            change[key] = item.counts[key] - old.counts[key];
        }
        for (const key of ['identityMatched', 'correctCandidateAnswers', 'correctAutomaticAnswers', 'matchedSolutionAnchors']) {
            if (change[key] < 0) regressions.push({ id: item.id, code: 'coverage-regression', metric: key, delta: change[key] });
        }
        if (item.counts.wrongAutomaticAnswers || item.counts.ungradedAutomaticAnswers) regressions.push({ id: item.id, code: 'unsafe-automatic-answer' });
        deltas.push({ id: item.id, change });
    }
    return { schema: 'qisi.golden-comparison.v1', ok: after.ok === true && regressions.length === 0,
        suiteSha256: after.suiteSha256, regressions, deltas,
        limit: 'Identical declared input/label suite only. This is not a claim of accuracy on unseen real papers.' };
}
if (require.main === module) {
    try {
        const args = process.argv.slice(2), options = {};
        for (let i = 0; i < args.length; i += 2) {
            if (!['--before', '--after', '--out'].includes(args[i]) || !args[i + 1]) throw new Error('Required: --before REPORT --after REPORT --out NEW_FILE');
            options[args[i]] = path.resolve(args[i + 1]);
        }
        if (!options['--before'] || !options['--after'] || !options['--out']) throw new Error('GOLDEN_COMPARISON_INPUT_REQUIRED');
        const result = compare(JSON.parse(fs.readFileSync(options['--before'])), JSON.parse(fs.readFileSync(options['--after'])));
        if (fs.existsSync(options['--out'])) throw new Error('GOLDEN_COMPARISON_ALREADY_EXISTS');
        fs.mkdirSync(path.dirname(options['--out']), { recursive: true });
        fs.writeFileSync(options['--out'], JSON.stringify(result, null, 2) + '\n');
        console.log(JSON.stringify(result));
        process.exitCode = result.ok ? 0 : 1;
    } catch (error) { console.error(String(error.message || error)); process.exitCode = 1; }
}
module.exports = { compare };
