const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { auditCallsite, auditShard, auditAll, RISK_PATTERNS } = require('../scripts/bm-a4-r3-ownership-audit');

const appLines = fs.readFileSync('app.js', 'utf8').split('\n');
const candidateNormalizerLines = fs.readFileSync(
    'qisi-candidate-normalizer.js',
    'utf8'
).split('\n');
// Wave 16 retired fourteen unreachable OCR/Vision producer callsites.
const EXPECTED_REMAINING_CALLSITES = 12;

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

    it('controlled-write context stays blocked after its dead app callsite is retired', () => {
        assert.doesNotMatch(
            appLines.join('\n'),
            /const patchedAnswer = cleanDisplayTextForBatchSave/
        );
        const fixtureLines = [
            'controlledWrite();',
            'const value = cleanDisplayTextForBatchSave(patch.answer);'
        ];
        const result = auditCallsite({
            callsiteId: 'R3-TEST-01',
            helper: 'cleanDisplayTextForBatchSave',
            line: 2
        }, fixtureLines);
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

    it('removed PDF support projection cannot return as an app callsite', () => {
        const app = appLines.join('\n');
        const owner = fs.readFileSync(
            'qisi-pdf-candidate-projection.js',
            'utf8'
        );
        assert.doesNotMatch(app, /pdfSupportFusedWarnings/);
        assert.doesNotMatch(app, /pdfSupportFieldWarningsByQuestion/);
        assert.match(app, /PdfCandidateProjection\s*\.projectPdfCandidates\s*\(/);
        assert.match(owner, /function\s+projectPdfCandidate\s*\(/);
    });

    it('answer/solution ownership context blocked', () => {
        assert.doesNotMatch(
            appLines.join('\n'),
            /const oldAnswer = cleanDisplayTextForBatchSave\(draft\.answer\)/
        );
        const result = auditCallsite({
            callsiteId: 'R3-TEST-04',
            helper: 'cleanDisplayTextForBatchSave',
            line: 2
        }, [
            'const draft = currentDraft;',
            'const oldAnswer = cleanDisplayTextForBatchSave(draft.answer);'
        ]);
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

    it('module-style support repair callsites remain audited at their production owner', () => {
        const repairSite = makeCallsite(
            'R3-TEST-07',
            'repairChoiceOptions',
            'window.Qisi.SupportRepair.repairChoiceOptions(rawStem, rawOptions'
        );
        const repairResult = auditCallsite(repairSite, appLines);
        assert.equal(repairResult.replacementAllowed, false);

        const jsonRepairLine = candidateNormalizerLines.findIndex(line =>
            line.includes('helpers.tryRepairedCandidate({')
        ) + 1;
        assert.ok(jsonRepairLine > 0, 'candidate normalizer repair delegation');
        const jsonRepairResult = auditCallsite({
            callsiteId: 'R3-TEST-08',
            helper: 'tryRepairedCandidate',
            line: jsonRepairLine
        }, candidateNormalizerLines);
        assert.equal(jsonRepairResult.replacementAllowed, false);
        assert.match(
            fs.readFileSync('app.js', 'utf8'),
            /Qisi\.CandidateNormalizer\.normalizeCandidates/
        );
    });

    it('auditAll returns results for all callsites', () => {
        const result = auditAll();
        assert.equal(result.ok, true);
        assert.equal(result.totalCallsites, EXPECTED_REMAINING_CALLSITES);
        assert.equal(result.results.length, EXPECTED_REMAINING_CALLSITES);
    });
});
