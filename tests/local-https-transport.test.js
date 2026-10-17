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
    assert.equal(ports.calls[0].options.agent.options.keepAlive, true);
    assert.equal(ports.calls[0].options.agent.maxSockets, 4);
    assert.equal(ports.calls[0].options.agent.maxFreeSockets, 2);
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

function phasedRequest({ failAt, reused = false, observer } = {}) {
    const calls = [], socket = new EventEmitter();
    socket.authorized = reused;
    const request = (_url, options, callback) => {
        const req = new EventEmitter(); req.reusedSocket = reused;
        req.destroy = error => queueMicrotask(() => req.emit('error', error));
        req.end = () => {
            calls.push(options);
            queueMicrotask(() => {
                req.emit('socket', socket);
                const fail = phase => {
                    if (phase !== failAt) return false;
                    req.emit('error', Object.assign(Error('private-body-and-credential'), { code: 'ECONNRESET' }));
                    return true;
                };
                if (fail('socket_assigned')) return;
                if (!reused) {
                    socket.emit('lookup', null, '127.0.0.1', 4, 'private-host');
                    if (fail('dns_lookup')) return;
                    socket.emit('connect');
                    if (fail('tcp_connected')) return;
                    socket.authorized = true; socket.emit('secureConnect');
                    if (fail('tls_connected')) return;
                }
                req.emit('finish');
                if (fail('request_finished')) return;
                const response = new EventEmitter();
                response.statusCode = 200; response.headers = {};
                callback(response); observer?.(req, response, socket);
                if (failAt === 'response_started') { response.emit('aborted'); return; }
                if (failAt === 'response_close') { response.emit('close'); return; }
                response.emit('data', Buffer.from('synthetic'));
                response.complete = failAt !== 'incomplete_end';
                response.emit('end');
            });
        };
        return req;
    };
    return { request, calls, socket };
}

test('failure diagnostics distinguish connection stages without declaring non-submission or retrying', async () => {
    for (const phase of ['socket_assigned', 'dns_lookup', 'tcp_connected', 'tls_connected', 'request_finished', 'response_started']) {
        const ports = phasedRequest({ failAt: phase });
        await assert.rejects(postDashScope(input(), ports), error => {
            assert.equal(error.code, 'ECONNRESET');
            assert.equal(error.transportDiagnostic.phase, phase);
            assert.equal(error.definitelyNotSubmitted, undefined);
            assert.equal(error.transportDiagnostic.outcome, 'failed');
            assert.doesNotMatch(JSON.stringify(error.transportDiagnostic), /private|Bearer|127\.0\.0\.1/);
            return true;
        });
        assert.equal(ports.calls.length, 1);
        for (const event of ['lookup', 'connect', 'secureConnect']) assert.equal(ports.socket.listenerCount(event), 0);
    }
});

test('reuse records existing TLS state and a bounded snapshot even without new handshake events', async () => {
    const ports = phasedRequest({ reused: true }), phases = [];
    const result = await postDashScope({ ...input(), onPhase: event => phases.push(event) }, ports);
    assert.equal(result.transportDiagnostic.reusedSocket, true);
    assert.equal(result.transportDiagnostic.tlsAuthorized, true);
    assert.equal(result.transportDiagnostic.responseComplete, true);
    assert.equal(result.transportDiagnostic.outcome, 'complete');
    assert.ok(phases.some(e => e.stage === 'socket_reused'));
    assert.ok(!phases.some(e => e.stage === 'tls_connected'));
    assert.ok(result.transportDiagnostic.events.length <= 12);
    assert.ok(result.transportDiagnostic.elapsedMs >= 0);
});

test('observer failures never change request outcome; terminal events settle only once', async () => {
    const ports = phasedRequest();
    const result = await postDashScope({ ...input(), onPhase() { throw Error('observer'); } }, ports);
    assert.equal(result.status, 200);
    assert.equal(ports.calls.length, 1);
});

test('premature response close or incomplete end cannot be accepted as success', { timeout: 2000 }, async () => {
    for (const failAt of ['response_close', 'incomplete_end']) {
        const ports = phasedRequest({ failAt });
        await assert.rejects(postDashScope(input(), ports), { code: 'ECONNRESET' });
        assert.equal(ports.calls.length, 1);
    }
});

test('separate requests use the same bounded production agent', async () => {
    const first = mock(), second = mock();
    await postDashScope(input(), first); await postDashScope(input(), second);
    assert.equal(first.calls[0].options.agent, second.calls[0].options.agent);
    assert.equal(first.calls[0].options.agent.maxTotalSockets, 4);
    assert.equal(first.calls[0].options.agent.scheduling, 'lifo');
});
