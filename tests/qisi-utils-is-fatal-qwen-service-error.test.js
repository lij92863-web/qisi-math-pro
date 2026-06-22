const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { isFatalQwenServiceError } = require('../qisi-utils.js');

describe('isFatalQwenServiceError', () => {
    it('normal input: detects qwen vision error', () => {
        const result = isFatalQwenServiceError({ message: 'qwen 视觉识别接口不可用' });
        assert.equal(result, true);
    });

    it('empty input: returns false', () => {
        const result = isFatalQwenServiceError('');
        assert.equal(result, false);
    });

    it('null input: returns false', () => {
        const result = isFatalQwenServiceError(null);
        assert.equal(result, false);
    });

    it('undefined input: returns false', () => {
        const result = isFatalQwenServiceError(undefined);
        assert.equal(result, false);
    });

    it('dashscope auth error: returns true', () => {
        const result = isFatalQwenServiceError({ message: 'dashscope 鉴权失败' });
        assert.equal(result, true);
    });

    it('balance error: returns true', () => {
        const result = isFatalQwenServiceError({ message: '余额不足' });
        assert.equal(result, true);
    });

    it('quota error: returns true', () => {
        const result = isFatalQwenServiceError({ message: 'quota exceeded' });
        assert.equal(result, true);
    });

    it('rate limit error: returns true', () => {
        const result = isFatalQwenServiceError({ message: 'HTTP 429 Too Many Requests' });
        assert.equal(result, true);
    });

    it('unauthorized error: returns true', () => {
        const result = isFatalQwenServiceError({ message: 'unauthorized access' });
        assert.equal(result, true);
    });

    it('non-fatal error: returns false', () => {
        const result = isFatalQwenServiceError({ message: 'network timeout' });
        assert.equal(result, false);
    });

    it('case insensitive: detects uppercase', () => {
        const result = isFatalQwenServiceError({ message: 'QUOTA exceeded' });
        assert.equal(result, true);
    });

    it('boundary: string error instead of object', () => {
        const result = isFatalQwenServiceError('余额不足');
        assert.equal(result, true);
    });

    it('representative real case: actual error object', () => {
        const error = new Error('api key 无效，请检查配置');
        const result = isFatalQwenServiceError(error);
        assert.equal(result, true);
    });

    it('no mutation: does not modify input', () => {
        const input = { message: 'test error' };
        const original = { ...input };
        isFatalQwenServiceError(input);
        assert.deepEqual(input, original);
    });

    it('output shape consistency: always returns boolean', () => {
        const inputs = [{ message: 'test' }, '', null, undefined, 'error', { message: 'quota' }];
        for (const input of inputs) {
            const result = isFatalQwenServiceError(input);
            assert.equal(typeof result, 'boolean', `Failed for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles non-standard gracefully', () => {
        const result = isFatalQwenServiceError(12345);
        assert.equal(typeof result, 'boolean');
    });
});
