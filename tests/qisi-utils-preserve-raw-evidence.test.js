const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { preserveRawEvidence } = require('../qisi-utils.js');

describe('preserveRawEvidence', () => {
    it('normal input: preserves raw fields', () => {
        const q = { rawText: 'hello', rawBlock: 'block' };
        const result = preserveRawEvidence(q);
        assert.equal(result.rawTextOriginal, 'hello');
        assert.equal(result.rawBlockOriginal, 'block');
    });
    it('empty object: sets empty original fields', () => {
        const q = {};
        const result = preserveRawEvidence(q);
        assert.equal(result.rawTextOriginal, '');
        assert.equal(result.rawBlockOriginal, '');
    });
    it('null input: returns null', () => {
        assert.equal(preserveRawEvidence(null), null);
    });
    it('undefined input: returns undefined', () => {
        assert.equal(preserveRawEvidence(undefined), undefined);
    });
    it('already has originals: keeps existing values', () => {
        const q = { rawText: 'new', rawTextOriginal: 'old' };
        const result = preserveRawEvidence(q);
        assert.equal(result.rawTextOriginal, 'old');
    });
    it('sourceTrace: preserves source trace fields', () => {
        const q = { rawText: 't', sourceTrace: { rawBlock: 'b' } };
        const result = preserveRawEvidence(q);
        assert.equal(result.sourceTrace.rawBlockOriginal, 'b');
    });
    it('no sourceTrace: does not add sourceTrace', () => {
        const q = { rawText: 't' };
        const result = preserveRawEvidence(q);
        assert.equal(result.sourceTrace, undefined);
    });
    it('returns same object reference', () => {
        const q = { rawText: 'x' };
        const result = preserveRawEvidence(q);
        assert.strictEqual(result, q);
    });
    it('app.js explicit call', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        assert.match(app, /window\.Qisi\.Utils\.preserveRawEvidence\s*\(/);
    });
    it('app.js no naked calls', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const naked = app.split(/\r?\n/).filter(l => l.includes('preserveRawEvidence(') && !l.includes('window.Qisi.Utils.preserveRawEvidence('));
        assert.deepEqual(naked, []);
    });
});
