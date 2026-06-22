const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { finalChoiceAnswerText } = require('../qisi-utils.js');

describe('finalChoiceAnswerText', () => {
    it('normal input: extracts choice answer', () => {
        const result = finalChoiceAnswerText('ABD');
        assert.equal(result, 'ABD');
    });

    it('empty input: returns empty string', () => {
        const result = finalChoiceAnswerText('');
        assert.equal(result, '');
    });

    it('null input: returns empty string', () => {
        const result = finalChoiceAnswerText(null);
        assert.equal(result, '');
    });

    it('undefined input: returns empty string', () => {
        const result = finalChoiceAnswerText(undefined);
        assert.equal(result, '');
    });

    it('full-width letters: converts to half-width', () => {
        const result = finalChoiceAnswerText('ＡＢＣ');
        assert.equal(result, 'ABC');
    });

    it('with punctuation: extracts answer', () => {
        const result = finalChoiceAnswerText('答案：ABD');
        assert.equal(result, 'ABD');
    });

    it('Chinese prefix: 答案', () => {
        const result = finalChoiceAnswerText('答案是BC');
        assert.equal(result, 'BC');
    });

    it('Chinese prefix: 故选', () => {
        const result = finalChoiceAnswerText('故选A');
        assert.equal(result, 'A');
    });

    it('tail match: answer at end', () => {
        const result = finalChoiceAnswerText('根据计算 ABD');
        assert.equal(result, 'ABD');
    });

    it('boundary: single answer', () => {
        const result = finalChoiceAnswerText('A');
        assert.equal(result, 'A');
    });

    it('boundary: four answers', () => {
        const result = finalChoiceAnswerText('ABCD');
        assert.equal(result, 'ABCD');
    });

    it('representative real case: exam answer', () => {
        const result = finalChoiceAnswerText('由题意可知，正确答案为ABD');
        assert.ok(['ABD', 'A', 'B', 'D'].includes(result));
    });

    it('no mutation: does not modify input', () => {
        const input = 'ABD';
        const original = input;
        finalChoiceAnswerText(input);
        assert.equal(input, original);
    });

    it('output shape consistency: always returns string', () => {
        const inputs = ['ABD', '', null, undefined, 'no answer', 'A'];
        for (const input of inputs) {
            const result = finalChoiceAnswerText(input);
            assert.equal(typeof result, 'string', `Failed for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles non-string gracefully', () => {
        const result = finalChoiceAnswerText(12345);
        assert.equal(typeof result, 'string');
    });

    it('whitespace-only input: returns empty string', () => {
        const result = finalChoiceAnswerText('   \n\n   ');
        assert.equal(result, '');
    });

    it('invalid answer: returns empty string', () => {
        const result = finalChoiceAnswerText('EFG');
        assert.equal(result, '');
    });
});
