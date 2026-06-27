const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { HELPERS, mapCallsites } = require('../scripts/bm-a4-callsite-map');

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
