const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { cleanFormulaOcrText } = require('../qisi-utils.js');

describe('cleanFormulaOcrText', () => {
    it('normal input: wraps LaTeX in dollar signs', () => {
        const result = cleanFormulaOcrText('\\frac{1}{2}');
        assert.equal(result, '$\\frac{1}{2}$');
    });

    it('empty input: returns empty string', () => {
        const result = cleanFormulaOcrText('');
        assert.equal(result, '');
    });

    it('null input: returns empty string', () => {
        const result = cleanFormulaOcrText(null);
        assert.equal(result, '');
    });

    it('undefined input: returns empty string', () => {
        const result = cleanFormulaOcrText(undefined);
        assert.equal(result, '');
    });

    it('code fence: strips markdown code fence', () => {
        const result = cleanFormulaOcrText('```latex\n\\frac{1}{2}\n```');
        assert.equal(result, '$\\frac{1}{2}$');
    });

    it('double dollar: strips $$ delimiters', () => {
        const result = cleanFormulaOcrText('$$\\frac{1}{2}$$');
        assert.equal(result, '$\\frac{1}{2}$');
    });

    it('single dollar: strips $ delimiters', () => {
        const result = cleanFormulaOcrText('$\\frac{1}{2}$');
        assert.equal(result, '$\\frac{1}{2}$');
    });

    it('no LaTeX: returns empty string', () => {
        const result = cleanFormulaOcrText('hello world');
        assert.equal(result, '');
    });

    it('boundary: simple expression', () => {
        const result = cleanFormulaOcrText('x^2');
        assert.equal(result, '$x^2$');
    });

    it('representative real case: OCR output', () => {
        const result = cleanFormulaOcrText('\\sqrt{a^2 + b^2}');
        assert.equal(result, '$\\sqrt{a^2 + b^2}$');
    });

    it('no mutation: does not modify input', () => {
        const input = '\\frac{1}{2}';
        const original = input;
        cleanFormulaOcrText(input);
        assert.equal(input, original);
    });

    it('output shape consistency: always returns string', () => {
        const inputs = ['\\frac', '', null, undefined, 'no latex', 'x^2'];
        for (const input of inputs) {
            const result = cleanFormulaOcrText(input);
            assert.equal(typeof result, 'string', `Failed for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles non-string gracefully', () => {
        const result = cleanFormulaOcrText(12345);
        assert.equal(typeof result, 'string');
    });

    it('whitespace-only input: returns empty string', () => {
        const result = cleanFormulaOcrText('   \n\n   ');
        assert.equal(result, '');
    });

    it('complex LaTeX: handles nested braces', () => {
        const result = cleanFormulaOcrText('\\frac{\\sqrt{x}}{y}');
        assert.equal(result, '$\\frac{\\sqrt{x}}{y}$');
    });
});
