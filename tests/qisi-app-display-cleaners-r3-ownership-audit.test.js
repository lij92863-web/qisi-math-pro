const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { auditCallsite, auditShard, auditAll, RISK_PATTERNS } = require('../scripts/bm-a4-r3-ownership-audit');

const appLines = fs.readFileSync('app.js', 'utf8').split('\n');

function findLineContaining(fragment, startLine = 1) {
    const index = appLines.findIndex((line, idx) =>
        idx + 1 >= startLine &&
        line.includes(fragment)
    );

    assert.notEqual(
        index,
        -1,
        `missing app.js callsite anchor: ${fragment}`
    );

    return index + 1;
}

function findLineAfter(anchor, fragment) {
    const anchorLine = findLineContaining(anchor);

    return findLineContaining(fragment, anchorLine);
}

function makeCallsite(id, helper, fragment, startLine = 1) {
    return {
        callsiteId: id,
        helper,
        line: findLineContaining(fragment, startLine)
    };
}

function makeCallsiteAfter(id, helper, anchor, fragment) {
    return {
        callsiteId: id,
        helper,
        line: findLineAfter(anchor, fragment)
    };
}

describe('bm-a4-r3-ownership-audit', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-ownership-audit.js'), true);
    });

    it('controlled-write context blocked', () => {
        const site = makeCallsite(
            'R3-TEST-01',
            'cleanDisplayTextForBatchSave',
            'const patchedAnswer = cleanDisplayTextForBatchSave(patch.answer || patch.答案 || \'\');'
        );
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('PDF support context blocked', () => {
        const site = makeCallsite(
            'R3-TEST-02',
            'cleanDisplayTextForBatchSave',
            'solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)),'
        );
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('support attachment context blocked', () => {
        const site = makeCallsiteAfter(
            'R3-TEST-03',
            'addWarningOnce',
            'pdfSupportFusedWarnings',
            'addWarningOnce(draft, warning);'
        );
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('answer/solution ownership context blocked', () => {
        const site = makeCallsite(
            'R3-TEST-04',
            'cleanDisplayTextForBatchSave',
            'const oldAnswer = cleanDisplayTextForBatchSave(draft.answer);'
        );
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('plain save display cleanup requires fixture', () => {
        const site = makeCallsite(
            'R3-TEST-05',
            'cleanDisplayTextForBatchSave',
            'const next = window.Qisi.Utils.cleanDisplayTextForBatchSave(candidate);'
        );
        const result = auditCallsite(site, appLines);
        assert.equal(result.fixtureRequired, true);
        assert.equal(result.decision.startsWith('BLOCKED'), false);
        assert.equal(result.replacementAllowed, false);
    });

    it('unknown context deferred', () => {
        const site = makeCallsite(
            'R3-TEST-06',
            'addWarningOnce',
            'window.Qisi.Utils.addWarningOnce('
        );
        const result = auditCallsite(site, appLines);
        assert.ok(result.decision.startsWith('BLOCKED') || result.fixtureRequired);
    });

    it('module-style support repair callsites are still audited by app.js context', () => {
        const repairSite = makeCallsite(
            'R3-TEST-07',
            'repairChoiceOptions',
            'window.Qisi.SupportRepair.repairChoiceOptions(rawStem, rawOptions'
        );
        const repairResult = auditCallsite(repairSite, appLines);
        assert.equal(repairResult.replacementAllowed, false);

        const jsonRepairSite = makeCallsite(
            'R3-TEST-08',
            'tryRepairedCandidate',
            'window.Qisi.SupportRepair.tryRepairedCandidate({'
        );
        const jsonRepairResult = auditCallsite(jsonRepairSite, appLines);
        assert.equal(jsonRepairResult.replacementAllowed, false);
    });

    it('auditAll returns results for all callsites', () => {
        const result = auditAll();
        assert.equal(result.ok, true);
        assert.ok(result.totalCallsites >= 40);
        assert.ok(result.results.length >= 40);
    });
});
