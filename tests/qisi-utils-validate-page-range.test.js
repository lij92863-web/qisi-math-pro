const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { validatePageRange } = require('../qisi-utils.js');

describe('validatePageRange', () => {
    it('normal input: accepts comma-separated pages and ranges', () => {
        assert.equal(validatePageRange('1,3,5-8'), true);
    });

    it('empty input: returns true', () => {
        assert.equal(validatePageRange(''), true);
    });

    it('null input: returns true', () => {
        assert.equal(validatePageRange(null), true);
    });

    it('undefined input: returns true', () => {
        assert.equal(validatePageRange(undefined), true);
    });

    it('whitespace and punctuation: rejects spaces and Chinese separators', () => {
        assert.equal(validatePageRange('1, 2'), false);
        assert.equal(validatePageRange('1，2'), false);
        assert.equal(validatePageRange('1；2'), false);
        assert.equal(validatePageRange('1、2'), false);
    });

    it('malformed input: rejects bad range syntax', () => {
        assert.equal(validatePageRange('1--3'), false);
        assert.equal(validatePageRange('abc'), false);
        assert.equal(validatePageRange('1,'), false);
    });

    it('representative project case: accepts PDF page range hint', () => {
        assert.equal(validatePageRange('1-5,8,10-12'), true);
    });

    it('boundary case: rejects zero and descending ranges', () => {
        assert.equal(validatePageRange('0'), false);
        assert.equal(validatePageRange('0-2'), false);
        assert.equal(validatePageRange('5-3'), false);
    });

    it('single page boundary: accepts positive page numbers', () => {
        assert.equal(validatePageRange('1'), true);
        assert.equal(validatePageRange('999'), true);
    });

    it('no mutation: string input remains unchanged', () => {
        const input = '1-3,5';
        const before = input.slice();
        validatePageRange(input);
        assert.equal(input, before);
    });

    it('output shape consistency: always returns boolean', () => {
        const inputs = ['1', '', null, undefined, '1-2', '2-1', '1，2'];
        for (const input of inputs) {
            assert.equal(typeof validatePageRange(input), 'boolean');
        }
    });

    it('app.js explicitly calls Qisi Utils helper', () => {
        const rootDir = path.join(__dirname, '..');
        const app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
        assert.match(app, /window\.Qisi\.Utils\.validatePageRange\(file\.pageRange\)/);
        assert.doesNotMatch(app, /const\s+validatePageRange\s*=/);
    });
});

