const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../qisi-utils.js');

const withoutCode = message => Object.assign(new Error(message), {});

test('a fetch-level failure is reported as the local hop, not as a recognition failure', () => {
    const failure = utils.classifyVisualServiceFailure(
        Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' })
    );

    assert.equal(failure.code, 'LOCAL_SERVER_UNREACHABLE');
    assert.match(failure.message, /本机识别服务/);
    assert.doesNotMatch(failure.message, /^识别失败$/);
});

test('the local server structured codes are mapped to their own hop', () => {
    const cases = [
        [{ message: 'blocked', code: 'ORIGIN_NOT_ALLOWED', status: 403 }, 'ORIGIN_NOT_ALLOWED'],
        [{ message: 'DashScope API Key is not configured', code: 'DASHSCOPE_NOT_CONFIGURED', status: 503 }, 'API_AUTH_ERROR'],
        [{ message: 'unauthorized', status: 401 }, 'API_AUTH_ERROR'],
        [{ message: 'DashScope upstream request failed.', code: 'AI_PROXY_FETCH_FAILED', status: 502 }, 'UPSTREAM_UNREACHABLE'],
        [{ message: 'timed out', code: 'AI_PROXY_TIMEOUT', status: 504 }, 'UPSTREAM_UNREACHABLE'],
        [{ message: 'model invalid', code: 'INVALID_AI_MODEL', status: 400 }, 'API_RESPONSE_ERROR'],
        [{ message: 'upstream said no', status: 429 }, 'API_RESPONSE_ERROR']
    ];

    for (const [error, expected] of cases) {
        const failure = utils.classifyVisualServiceFailure(error);
        assert.equal(failure.code, expected, `${JSON.stringify(error)} -> ${failure.code}`);
    }
});

test('the teacher-facing wording keeps the hop visible', () => {
    const described = utils.describeVisualServiceFailure(
        withoutCode('Failed to fetch'),
        'PDF 视觉识别'
    );

    assert.match(described, /PDF 视觉识别失败/);
    assert.match(described, /LOCAL_SERVER_UNREACHABLE/);
    assert.match(described, /本机识别服务/);

    const upstream = utils.describeVisualServiceFailure(
        { message: 'DashScope upstream request failed.', code: 'AI_PROXY_FETCH_FAILED', status: 502 },
        '页面视觉识别'
    );
    assert.match(upstream, /UPSTREAM_UNREACHABLE/);
    assert.match(upstream, /上游视觉服务/);

    assert.equal(
        utils.describeVisualServiceFailure(null, '视觉识别'),
        '视觉识别失败（LOCAL_SERVER_UNREACHABLE）'
    );
});

test('an upstream authentication failure is not described as an unreachable server', () => {
    const failure = utils.classifyVisualServiceFailure({
        message: 'DashScope API Key is not configured on the local server.',
        code: 'DASHSCOPE_NOT_CONFIGURED',
        status: 503
    });

    assert.equal(failure.code, 'API_AUTH_ERROR');
    assert.match(failure.message, /API Key/);
});
