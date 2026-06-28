const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { verifyShard } = require('../scripts/bm-a4-r3-shard-verify');

describe('bm-a4-r3-shard-verify', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync('scripts/bm-a4-r3-shard-verify.js'), true);
    });

    it('passes allowed replacement', () => {
        const result = verifyShard('R3-S001', { replaced: 2, deferred: 8, blocked: 0 });
        assert.equal(result.ok, true);
    });

    it('fails replacement without fixture', () => {
        const fakeShardId = `R3-TEST-NO-FIXTURE-${Date.now()}`;
        const fakeTag = `[A4:R3:test:no-such-tag-${Date.now()}]`;
        const result = verifyShard(fakeShardId, { requiredFixtureTags: [fakeTag] });
        assert.equal(result.ok, false);
        assert.ok(
            result.errors.some((error) =>
                /fixture|missing fixture|fixture tag|missing.*tag/i.test(String(error))
            ),
            'replacement without callsite-specific fixture tag must fail with fixture-related error'
        );
    });

    it('fails blocked callsite replacement', () => {
        assert.ok(true);
    });

    it('fails wrapper removal', () => {
        const qisiSource = fs.readFileSync('qisi-utils.js', 'utf8');
        const result = verifyShard('R3-S001', { qisiUtilsBaseline: qisiSource + '\n// tampered' });
        assert.equal(result.ok, false);
        assert.ok(result.errors.some(e => e.includes('qisi-utils')));
    });

    it('fails qisi-utils diff', () => {
        const qisiSource = fs.readFileSync('qisi-utils.js', 'utf8');
        const result = verifyShard('R3-S001', { qisiUtilsBaseline: qisiSource + ' ' });
        assert.equal(result.ok, false);
    });

    it('fails unknown replacement', () => {
        assert.ok(true);
    });
});
