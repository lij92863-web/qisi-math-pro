const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { extractRelevanceTokens } = require('../qisi-utils.js');

describe('extractRelevanceTokens', () => {
    it('normal input: extracts LaTeX commands', () => {
        const result = extractRelevanceTokens('\\frac{1}{2} + \\sqrt{3} = x');
        assert.ok(result.includes('\\frac'));
        assert.ok(result.includes('\\sqrt'));
        assert.ok(result.includes('x'));
    });

    it('empty input: returns empty array', () => {
        const result = extractRelevanceTokens('');
        assert.deepEqual(result, []);
    });

    it('null input: returns empty array', () => {
        const result = extractRelevanceTokens(null);
        assert.deepEqual(result, []);
    });

    it('undefined input: returns empty array', () => {
        const result = extractRelevanceTokens(undefined);
        assert.deepEqual(result, []);
    });

    it('no tokens: returns empty array', () => {
        const result = extractRelevanceTokens('的');
        assert.deepEqual(result, []);
    });

    it('Chinese phrases: extracts 2-6 char phrases', () => {
        const result = extractRelevanceTokens('已知三角形ABC中，求正弦定理');
        assert.ok(result.some(t => t.includes('三角')));
    });

    it('single letters: extracts x, y, z, n, m etc.', () => {
        const result = extractRelevanceTokens('设x等于y加z');
        assert.ok(result.includes('x'));
        assert.ok(result.includes('y'));
        assert.ok(result.includes('z'));
    });

    it('capital letter sequences: extracts identifiers', () => {
        const result = extractRelevanceTokens('在ABC中，AB等于AC');
        assert.ok(result.includes('AB'));
        assert.ok(result.includes('AC'));
    });

    it('stop words: filters common words', () => {
        const result = extractRelevanceTokens('已知求下列正确');
        assert.ok(!result.includes('已知'));
        assert.ok(!result.includes('求'));
        assert.ok(!result.includes('下列'));
        assert.ok(!result.includes('正确'));
    });

    it('generic math tokens: filters common symbols', () => {
        const result = extractRelevanceTokens('\\sin \\cos \\tan');
        assert.ok(!result.includes('\\sin'));
        assert.ok(!result.includes('\\cos'));
        assert.ok(!result.includes('\\tan'));
    });

    it('boundary: single variable letter', () => {
        const result = extractRelevanceTokens('x');
        assert.ok(result.includes('x'));
    });

    it('representative real case: exam question', () => {
        const result = extractRelevanceTokens('在\\triangle ABC中，\\angle BAC = 60°，求BC的长度');
        assert.ok(Array.isArray(result));
        assert.ok(result.length > 0);
    });

    it('no mutation: does not modify input', () => {
        const input = '\\triangle ABC';
        const original = input;
        extractRelevanceTokens(input);
        assert.equal(input, original);
    });

    it('output shape consistency: always returns array', () => {
        const inputs = ['\\frac', '', null, undefined, 'no math', 'x'];
        for (const input of inputs) {
            const result = extractRelevanceTokens(input);
            assert.ok(Array.isArray(result), `Failed for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles non-string gracefully', () => {
        const result = extractRelevanceTokens(12345);
        assert.ok(Array.isArray(result));
    });

    it('whitespace-only input: returns empty array', () => {
        const result = extractRelevanceTokens('   \n\n   ');
        assert.deepEqual(result, []);
    });

    it('deduplication: returns unique tokens', () => {
        const result = extractRelevanceTokens('\\vec{a} + \\vec{a}');
        const vecCount = result.filter(t => t === '\\vec').length;
        assert.equal(vecCount, 1);
    });
});
