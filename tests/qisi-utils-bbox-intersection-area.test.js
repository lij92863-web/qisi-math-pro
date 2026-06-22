const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { bboxIntersectionArea } = require('../qisi-utils.js');

describe('bboxIntersectionArea', () => {
    it('normal input: overlapping rectangles', () => {
        const result = bboxIntersectionArea([0, 0, 100, 100], [50, 50, 150, 150]);
        assert.equal(result, 2500);
    });

    it('no overlap: returns 0', () => {
        const result = bboxIntersectionArea([0, 0, 10, 10], [20, 20, 30, 30]);
        assert.equal(result, 0);
    });

    it('empty array: returns 0', () => {
        const result = bboxIntersectionArea([], [0, 0, 100, 100]);
        assert.equal(result, 0);
    });

    it('null input: returns 0', () => {
        const result = bboxIntersectionArea(null, [0, 0, 100, 100]);
        assert.equal(result, 0);
    });

    it('undefined input: returns 0', () => {
        const result = bboxIntersectionArea(undefined, [0, 0, 100, 100]);
        assert.equal(result, 0);
    });

    it('boundary: zero-area intersection returns 0', () => {
        const result = bboxIntersectionArea([0, 0, 10, 10], [10, 0, 20, 10]);
        assert.equal(result, 0);
    });

    it('no mutation: does not modify inputs', () => {
        const left = [0, 0, 100, 100];
        const right = [50, 50, 150, 150];
        bboxIntersectionArea(left, right);
        assert.deepEqual(left, [0, 0, 100, 100]);
        assert.deepEqual(right, [50, 50, 150, 150]);
    });

    it('output shape: always returns number', () => {
        assert.equal(typeof bboxIntersectionArea([0, 0, 10, 10], [5, 5, 15, 15]), 'number');
    });

    it('app.js explicit call: uses window.Qisi.Utils.bboxIntersectionArea', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        assert.match(app, /window\.Qisi\.Utils\.bboxIntersectionArea\s*\(/);
    });

    it('app.js: no naked bboxIntersectionArea calls', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const nakedCalls = app
            .split(/\r?\n/)
            .filter(line => line.includes('bboxIntersectionArea('))
            .filter(line => !line.includes('window.Qisi.Utils.bboxIntersectionArea('));
        assert.deepEqual(nakedCalls, []);
    });
});
