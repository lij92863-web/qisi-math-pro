const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { auditCallsite, auditShard, auditAll, RISK_PATTERNS } = require('../scripts/bm-a4-r3-ownership-audit');

const appLines = fs.readFileSync('app.js', 'utf8').split('\n');

function makeCallsite(id, line, helper) {
    return { callsiteId: id, helper, line };
}

describe('bm-a4-r3-ownership-audit', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-ownership-audit.js'), true);
    });

    it('controlled-write context blocked', () => {
        const site = makeCallsite('R3-TEST-01', 13559, 'cleanDisplayTextForBatchSave');
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('PDF support context blocked', () => {
        const site = makeCallsite('R3-TEST-02', 5275, 'cleanDisplayTextForBatchSave');
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('support attachment context blocked', () => {
        const site = makeCallsite('R3-TEST-03', 18952, 'addWarningOnce');
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('answer/solution ownership context blocked', () => {
        const site = makeCallsite('R3-TEST-04', 13568, 'cleanDisplayTextForBatchSave');
        const result = auditCallsite(site, appLines);
        assert.equal(result.decision.startsWith('BLOCKED'), true);
    });

    it('plain save display cleanup requires fixture', () => {
        const site = makeCallsite('R3-TEST-05', 2144, 'cleanDisplayTextForBatchSave');
        const result = auditCallsite(site, appLines);
        assert.equal(result.fixtureRequired, true);
        assert.equal(result.decision.startsWith('BLOCKED'), false);
        assert.equal(result.replacementAllowed, false);
    });

    it('unknown context deferred', () => {
        const site = makeCallsite('R3-TEST-06', 17426, 'addWarningOnce');
        const result = auditCallsite(site, appLines);
        assert.ok(result.decision.startsWith('BLOCKED') || result.fixtureRequired);
    });

    it('auditAll returns results for all callsites', () => {
        const result = auditAll();
        assert.equal(result.ok, true);
        assert.ok(result.totalCallsites >= 80);
        assert.ok(result.results.length >= 90);
    });
});
