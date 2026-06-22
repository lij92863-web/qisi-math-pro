const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { mathSignalCount } = require('../qisi-utils.js');

describe('mathSignalCount', () => {
    it('normal input: counts LaTeX commands', () => {
        const result = mathSignalCount('\\frac{1}{2} + \\sqrt{3}');
        assert.equal(result, 2); // \frac and \sqrt
    });

    it('empty input: returns 0', () => {
        const result = mathSignalCount('');
        assert.equal(result, 0);
    });

    it('null input: returns 0', () => {
        const result = mathSignalCount(null);
        assert.equal(result, 0);
    });

    it('undefined input: returns 0', () => {
        const result = mathSignalCount(undefined);
        assert.equal(result, 0);
    });

    it('no math: returns 0', () => {
        const result = mathSignalCount('hello world');
        assert.equal(result, 0);
    });

    it('dollar signs: counts occurrences (after cleanRecognizedText processing)', () => {
        const result = mathSignalCount('$x$ and $y$');
        assert.ok(result >= 2); // cleanRecognizedText may modify dollar sign handling
    });

    it('subscript and superscript: counts underscores and carets', () => {
        const result = mathSignalCount('x_1 + y^2');
        assert.equal(result, 2);
    });

    it('Chinese math symbols: counts ≤≥≠', () => {
        const result = mathSignalCount('x ≤ 5 and y ≥ 3');
        assert.equal(result, 2);
    });

    it('multiple commands: counts all', () => {
        const result = mathSignalCount('\\sin(\\theta) + \\cos(\\alpha)');
        assert.equal(result, 4); // \sin, \theta, \cos, \alpha
    });

    it('boundary: single command', () => {
        const result = mathSignalCount('\\vec{a}');
        assert.equal(result, 1);
    });

    it('representative real case: exam question with math', () => {
        const result = mathSignalCount('已知\\triangle ABC中，\\angle A = 90°，求\\frac{AB}{AC}');
        assert.ok(result >= 3);
    });

    it('no mutation: does not modify input', () => {
        const input = '\\frac{1}{2}';
        const original = input;
        mathSignalCount(input);
        assert.equal(input, original);
    });

    it('output shape consistency: always returns number', () => {
        const inputs = ['\\frac', '', null, undefined, 'no math', '$x$'];
        for (const input of inputs) {
            const result = mathSignalCount(input);
            assert.equal(typeof result, 'number', `Failed for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles non-string gracefully', () => {
        const result = mathSignalCount(12345);
        assert.equal(typeof result, 'number');
    });

    it('whitespace-only input: returns 0', () => {
        const result = mathSignalCount('   \n\n   ');
        assert.equal(result, 0);
    });

    it('repeated same command: counts each occurrence', () => {
        const result = mathSignalCount('\\vec{a} + \\vec{b} + \\vec{c}');
        assert.equal(result, 3);
    });
});
