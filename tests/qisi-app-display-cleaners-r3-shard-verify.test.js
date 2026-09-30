const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

const { verifyShard } = require('../scripts/bm-a4-r3-shard-verify');

describe('bm-a4-r3-shard-verify', () => {
    it('tool exists', () => {
        assert.equal(fs.existsSync(path.join(ROOT, 'scripts/bm-a4-r3-shard-verify.js')), true);
    });

    it('historical shard cannot run after C2-12 wrapper retirement', () => {
        const result = verifyShard('R3-S001', { replaced: 2, deferred: 8, blocked: 0 });
        assert.equal(result.ok, false);
        assert.ok(result.errors.some(error => /wrapper/i.test(error)));
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
        const result = verifyShard('fixture', { replacements: [{ helper: 'cleanDisplayTextForBatchSave', blocked: true }] });
        assert.equal(result.ok, false);
        assert.ok(result.errors.includes('blocked callsite replacement'));
    });

    it('fails wrapper removal', () => {
        const qisiSource = fs.readFileSync(path.join(ROOT, 'qisi-utils.js'), 'utf8');
        const result = verifyShard('R3-S001', { qisiUtilsBaseline: qisiSource + '\n// tampered' });
        assert.equal(result.ok, false);
        assert.ok(result.errors.some(e => e.includes('qisi-utils')));
    });

    it('fails qisi-utils diff', () => {
        const qisiSource = fs.readFileSync(path.join(ROOT, 'qisi-utils.js'), 'utf8');
        const result = verifyShard('R3-S001', { qisiUtilsBaseline: qisiSource + ' ' });
        assert.equal(result.ok, false);
    });

    it('fails unknown replacement', () => {
        const result = verifyShard('fixture', { replacements: [{ helper: 'unknownHelper' }] });
        assert.equal(result.ok, false);
        assert.ok(result.errors.includes('unknown replacement helper'));
    });
});
