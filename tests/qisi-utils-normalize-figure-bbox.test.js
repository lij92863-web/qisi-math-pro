const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizeFigureBbox } = require('../qisi-utils.js');

describe('normalizeFigureBbox', () => {
    it('normal input: normalizes unordered corners', () => {
        const result = normalizeFigureBbox([10, 50, 30, 20]);
        assert.deepEqual(result, [10, 20, 30, 50]);
    });

    it('already normalized: returns same values', () => {
        const result = normalizeFigureBbox([0, 0, 100, 200]);
        assert.deepEqual(result, [0, 0, 100, 200]);
    });

    it('empty array: returns empty', () => {
        const result = normalizeFigureBbox([]);
        assert.deepEqual(result, []);
    });

    it('null input: returns empty', () => {
        const result = normalizeFigureBbox(null);
        assert.deepEqual(result, []);
    });

    it('undefined input: returns empty', () => {
        const result = normalizeFigureBbox(undefined);
        assert.deepEqual(result, []);
    });

    it('wrong length: returns empty', () => {
        const result = normalizeFigureBbox([1, 2, 3]);
        assert.deepEqual(result, []);
    });

    it('non-numeric values: returns empty', () => {
        const result = normalizeFigureBbox(['a', 'b', 'c', 'd']);
        assert.deepEqual(result, []);
    });

    it('zero-area: x2 <= x1 returns empty', () => {
        const result = normalizeFigureBbox([5, 0, 5, 10]);
        assert.deepEqual(result, []);
    });

    it('zero-area: y2 <= y1 returns empty', () => {
        const result = normalizeFigureBbox([0, 3, 10, 3]);
        assert.deepEqual(result, []);
    });

    it('no mutation: does not modify input', () => {
        const input = [10, 50, 30, 20];
        const original = [...input];
        normalizeFigureBbox(input);
        assert.deepEqual(input, original);
    });

    it('output shape consistency: returns array', () => {
        const result = normalizeFigureBbox([100, 200, 300, 400]);
        assert.ok(Array.isArray(result));
    });

    it('strict question policy owns normalizeFigureBbox callsites', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const owner = fs.readFileSync(
            path.join(__dirname, '..', 'qisi-strict-question-policy.js'),
            'utf8'
        );
        assert.doesNotMatch(app, /normalizeFigureBbox\s*\(/);
        assert.match(owner, /root\.Qisi\.Utils\.normalizeFigureBbox\s*\(/);
    });

    it('app.js: no naked normalizeFigureBbox calls', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const nakedCalls = app
            .split(/\r?\n/)
            .filter(line => line.includes('normalizeFigureBbox('))
            .filter(line => !line.includes('window.Qisi.Utils.normalizeFigureBbox('));
        assert.deepEqual(nakedCalls, []);
    });
});
