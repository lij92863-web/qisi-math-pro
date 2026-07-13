const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { expandPageRange } = require('../qisi-utils.js');

describe('expandPageRange', () => {
    it('normal input: comma-separated pages and ranges', () => {
        const result = expandPageRange('1,3-5,7', 10);
        assert.deepEqual(result, [1, 3, 4, 5, 7]);
    });

    it('empty input: returns all pages 1..maxPage', () => {
        const result = expandPageRange('', 5);
        assert.deepEqual(result, [1, 2, 3, 4, 5]);
    });

    it('null input: returns all pages', () => {
        const result = expandPageRange(null, 3);
        assert.deepEqual(result, [1, 2, 3]);
    });

    it('undefined input: returns all pages', () => {
        const result = expandPageRange(undefined, 3);
        assert.deepEqual(result, [1, 2, 3]);
    });

    it('single page: returns single element', () => {
        const result = expandPageRange('3', 10);
        assert.deepEqual(result, [3]);
    });

    it('boundary: pages beyond maxPage are filtered out', () => {
        const result = expandPageRange('8-12', 10);
        assert.deepEqual(result, [8, 9, 10]);
    });

    it('boundary: zero and negative page numbers silently dropped', () => {
        const result = expandPageRange('0,1,2,-3', 5);
        assert.deepEqual(result, [1, 2]);
    });

    it('representative project case: typical PDF page range', () => {
        const result = expandPageRange('1-3', 6);
        assert.deepEqual(result, [1, 2, 3]);
    });

    it('no mutation: returns new array', () => {
        const input = '1-3';
        const result = expandPageRange(input, 5);
        assert.deepEqual(result, [1, 2, 3]);
        assert.equal(input, '1-3');
    });

    it('output shape consistency: always returns sorted array', () => {
        const result = expandPageRange('5,1,3', 10);
        assert.deepEqual(result, [1, 3, 5]);
    });

    it('malformed input: non-numeric parts dropped', () => {
        const result = expandPageRange('1,abc,3', 5);
        assert.deepEqual(result, [1, 3]);
    });

    it('browser source owners call expandPageRange outside app.js', () => {
        const fs = require('node:fs');
        const path = require('node:path');

        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const renderer = fs.readFileSync(
            path.join(__dirname, '..', 'qisi-browser-pdf-renderer.js'),
            'utf8'
        );

        assert.doesNotMatch(app, /expandPageRange\s*\(/);
        assert.match(renderer, /root\.Qisi\.Utils\.expandPageRange\s*\(/);
    });

    it('app.js: no naked expandPageRange calls', () => {
        const fs = require('node:fs');
        const path = require('node:path');

        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

        const nakedCalls = app
            .split(/\r?\n/)
            .filter(line => line.includes('expandPageRange('))
            .filter(line => !line.includes('window.Qisi.Utils.expandPageRange('));

        assert.deepEqual(nakedCalls, []);
    });
});
