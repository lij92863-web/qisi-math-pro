const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { HELPERS, mapCallsites } = require('../scripts/bm-a4-callsite-map');
const { generatePlan, planShards, classifyRisk, computeInitialDecision } = require('../scripts/bm-a4-r3-shard-planner');

describe('bm-a4-callsite-map', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-callsite-map.js'), true);
    });

    it('finds four helper names', () => {
        assert.deepEqual(HELPERS, [
            'cleanDisplayTextForBatchSave',
            'cleanDisplayOptionsForBatchSave',
            'addWarningOnce',
            'cleanDisplayFieldsOnly'
        ]);
    });

    it('total callsite count > 0', () => {
        const result = mapCallsites('app.js');
        assert.ok(result.total > 0);
    });

    it('classification exists for each callsite', () => {
        const result = mapCallsites('app.js');
        assert.ok(result.callsites.every((site) => Array.isArray(site.classification) && site.classification.length > 0));
    });

    it('unknown classification is explicit', () => {
        const result = mapCallsites('app.js');
        assert.ok(result.callsites.every((site) => !site.classification.includes('UNKNOWN') && site.classification.every((x) => x.endsWith('_PATH'))));
    });

    it('does not modify app.js', () => {
        const before = fs.readFileSync('app.js', 'utf8');
        mapCallsites('app.js');
        const after = fs.readFileSync('app.js', 'utf8');
        assert.equal(after, before);
    });

    it('does not require app.js execution', () => {
        const before = Object.keys(require.cache);
        mapCallsites('app.js');
        const after = Object.keys(require.cache);
        assert.deepEqual(after, before);
    });
});

describe('bm-a4-r3-shard-planner', () => {
    it('planner exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-shard-planner.js'), true);
    });

    it('planner outputs shards', () => {
        const plan = generatePlan();
        assert.ok(plan.totalShards > 0);
        assert.ok(Array.isArray(plan.shards));
    });

    it('each shard has max 10 callsites', () => {
        const plan = generatePlan();
        for (const shard of plan.shards) {
            assert.ok(shard.count <= 10, `${shard.shardId} has ${shard.count} callsites`);
        }
    });

    it('each callsite has id/helper/line/classification', () => {
        const plan = generatePlan();
        for (const site of plan.callsites) {
            assert.ok(site.callsiteId, 'missing callsiteId');
            assert.ok(site.helper, 'missing helper');
            assert.ok(typeof site.line === 'number', 'missing line');
            assert.ok(Array.isArray(site.riskMarkers), 'missing riskMarkers');
        }
    });

    it('wrappers excluded', () => {
        const plan = generatePlan();
        for (const site of plan.callsites) {
            assert.ok(site.line !== 1925, `wrapper line 1925 found`);
            assert.ok(site.line !== 1928, `wrapper line 1928 found`);
            assert.ok(site.line !== 1931, `wrapper line 1931 found`);
            assert.ok(site.line !== 1934, `wrapper line 1934 found`);
        }
    });

    it('blocked callsites not marked POSSIBLE_FIXTURE_CANDIDATE', () => {
        const plan = generatePlan();
        for (const site of plan.callsites) {
            if (site.initialDecision.startsWith('BLOCKED')) {
                assert.ok(site.initialDecision !== 'POSSIBLE_FIXTURE_CANDIDATE');
            }
        }
    });

    it('controlled-write context yields BLOCKED_CONTROLLED_WRITE', () => {
        const decision = computeInitialDecision(['CONTROLLED_WRITE_ADJACENT', 'SAVE_DRAFT_RISK']);
        assert.equal(decision, 'BLOCKED_CONTROLLED_WRITE');
    });
});
