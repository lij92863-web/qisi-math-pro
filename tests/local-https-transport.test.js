const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { postDashScope } = require('../qisi-local-https-transport');
const input = () => ({ url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    headers: { Authorization: 'Bearer test-only' }, body: '{"model":"mock"}' });
function mock({ status = 200, chunks = ['{"ok":true}'], error = null, wait = false } = {}) {
    const calls = [];
    const request = (url, options, callback) => {
        const req = new EventEmitter();
        req.destroy = reason => { req.destroyed = true; queueMicrotask(() => req.emit('error', reason)); };
        req.end = body => {
            calls.push({ url, options, body, req });
            if (wait) return;
            queueMicrotask(() => {
                if (error) { req.emit('error', error); return; }
                const response = new EventEmitter(); response.statusCode = status;
                response.headers = { 'content-type': 'application/json' };
                response.destroy = reason => response.emit('error', reason);
                callback(response);
                chunks.forEach(chunk => response.emit('data', Buffer.from(chunk)));
                response.emit('end');
            });
        };
        return req;
    };
    return { request, calls };
}
test('one verified HTTPS POST preserves upstream status and exact payload', async () => {
    const ports = mock({ status: 429 });
    const result = await postDashScope(input(), ports);
    assert.equal(ports.calls.length, 1);
    assert.equal(ports.calls[0].options.rejectUnauthorized, true);
    assert.equal(ports.calls[0].options.agent, false);
    assert.equal(ports.calls[0].body, input().body);
    assert.equal(result.status, 429); assert.equal(result.ok, false);
    assert.equal(result.buffer.toString(), '{"ok":true}');
});
test('unapproved hosts, redirects and endpoint variants are rejected before request', async () => {
    for (const url of ['http://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        'https://example.com/compatible-mode/v1/chat/completions',
        'https://dashscope.aliyuncs.com/private', 'https://dashscope.aliyuncs.com:8443/compatible-mode/v1/chat/completions']) {
        await assert.rejects(postDashScope({ ...input(), url }, { request: () => assert.fail('must reject') }));
    }
    const redirect = mock({ status: 302 });
    assert.equal((await postDashScope(input(), redirect)).status, 302);
    assert.equal(redirect.calls.length, 1);
});
test('response overflow and socket errors reject without any second request', async () => {
    const large = mock({ chunks: ['1234', '5678'] });
    await assert.rejects(postDashScope({ ...input(), maxResponseBytes: 5 }, large), { code: 'UPSTREAM_RESPONSE_TOO_LARGE' });
    assert.equal(large.calls.length, 1);
    const broken = mock({ error: Object.assign(Error('reset'), { code: 'ECONNRESET' }) });
    await assert.rejects(postDashScope(input(), broken), { code: 'ECONNRESET' });
    assert.equal(broken.calls.length, 1);
});
test('pre-abort makes no request and active cancellation destroys exactly one transport', async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(postDashScope({ ...input(), signal: controller.signal }, {
        request: () => assert.fail('pre-aborted') }), { name: 'AbortError' });
    const active = new AbortController(), ports = mock({ wait: true });
    const promise = postDashScope({ ...input(), signal: active.signal }, ports);
    active.abort(); await assert.rejects(promise, { name: 'AbortError' });
    assert.equal(ports.calls.length, 1); assert.equal(ports.calls[0].req.destroyed, true);
});
