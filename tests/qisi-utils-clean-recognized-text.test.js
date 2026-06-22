const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Load qisi-utils.js to get cleanRecognizedText
const { cleanRecognizedText } = require('../qisi-utils.js');

describe('cleanRecognizedText', () => {
    it('normal input: returns cleaned text unchanged', () => {
        const result = cleanRecognizedText('hello world');
        assert.equal(result, 'hello world');
    });

    it('empty input: returns empty string for empty string', () => {
        const result = cleanRecognizedText('');
        assert.equal(result, '');
    });

    it('null input: returns empty string', () => {
        const result = cleanRecognizedText(null);
        assert.equal(result, '');
    });

    it('undefined input: returns empty string', () => {
        const result = cleanRecognizedText(undefined);
        assert.equal(result, '');
    });

    it('boolean true: returns empty string', () => {
        const result = cleanRecognizedText(true);
        assert.equal(result, '');
    });

    it('boolean false: returns empty string', () => {
        const result = cleanRecognizedText(false);
        assert.equal(result, '');
    });

    it('array input: joins non-empty items with newline', () => {
        const result = cleanRecognizedText(['hello', 'world', '']);
        assert.equal(result, 'hello\nworld');
    });

    it('object input: returns empty string', () => {
        const result = cleanRecognizedText({ key: 'value' });
        assert.equal(result, '');
    });

    it('HTML tags: strips tags from text', () => {
        const result = cleanRecognizedText('<p>hello</p><br>world');
        assert.equal(result, 'helloworld');
    });

    it('w:br tags: converts to newline', () => {
        const result = cleanRecognizedText('hello<w:br/>world');
        assert.equal(result, 'hello\nworld');
    });

    it('HTML entities: decodes lt, gt, amp, quot, apos', () => {
        const result = cleanRecognizedText('&lt;div&gt; &amp; &quot;test&quot; &apos;ok&apos;');
        assert.equal(result, '<div> & "test" \'ok\'');
    });

    it('non-breaking space: converts to regular space', () => {
        const result = cleanRecognizedText('hello world');
        assert.equal(result, 'hello world');
    });

    it('multiple spaces: collapses to single space', () => {
        const result = cleanRecognizedText('hello   world');
        assert.equal(result, 'hello world');
    });

    it('multiple newlines: collapses to double newline', () => {
        const result = cleanRecognizedText('hello\n\n\n\nworld');
        assert.equal(result, 'hello\n\nworld');
    });

    it('trailing spaces before newline: removed', () => {
        const result = cleanRecognizedText('hello   \nworld');
        assert.equal(result, 'hello\nworld');
    });

    it('boundary: number input converts to string', () => {
        const result = cleanRecognizedText(12345);
        assert.equal(result, '12345');
    });

    it('representative real case: DOCX XML fragments', () => {
        const result = cleanRecognizedText('<w:p>测试<w:br/>题目</w:p>');
        assert.equal(result, '测试\n题目');
    });

    it('no mutation: does not modify array input', () => {
        const input = ['hello', 'world'];
        const original = [...input];
        cleanRecognizedText(input);
        assert.deepEqual(input, original);
    });

    it('output shape consistency: always returns string', () => {
        const inputs = ['text', '', null, undefined, true, false, 123, ['a'], {}];
        for (const input of inputs) {
            const result = cleanRecognizedText(input);
            assert.equal(typeof result, 'string', `Failed for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles nested arrays', () => {
        const result = cleanRecognizedText([['a', 'b'], 'c']);
        assert.equal(typeof result, 'string');
    });

    it('whitespace-only input: returns empty string', () => {
        const result = cleanRecognizedText('   \n\n   ');
        assert.equal(result, '');
    });
});
