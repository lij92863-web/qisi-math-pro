const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const net = require('node:net');
const { once } = require('node:events');
const { postDashScope, closeDashScopeConnections } = require('../qisi-local-https-transport');
const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures/https-transport', name));
const cert = fixture('server-cert.pem'), key = fixture('server-key.pem');
// The validated upstream URL is never dispatched: the injected request below only uses loopback.
const upstream = `https://${['dashscope', 'aliyuncs', 'com'].join('.')}/compatible-mode/v1/chat/completions`;
const input = body => ({ url: upstream, headers: { 'Content-Type': 'text/plain' }, body });

async function localServer(t, handler) {
    closeDashScopeConnections();
    const sockets = new Set(), requests = [], clientSockets = new Set();
    let connections = 0, requestCalls = 0;
    const server = https.createServer({ key, cert }, (req, res) => {
        requests.push(req);
        let body = '';
        req.setEncoding('utf8'); req.on('data', chunk => { body += chunk; });
        req.on('end', () => handler ? handler(req, res, body, requests.length) : res.end(body));
    });
    server.on('connection', socket => { connections++; sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(async () => {
        closeDashScopeConnections(); sockets.forEach(socket => socket.destroy());
        await new Promise(resolve => server.close(resolve));
    });
    const request = (_url, options, callback) => {
        requestCalls++;
        const req = https.request(new URL(`https://127.0.0.1:${server.address().port}/synthetic`),
            { ...options, ca: cert, servername: 'localhost' }, callback);
        req.on('socket', socket => clientSockets.add(socket));
        return req;
    };
    return { server, request, requests, clientSockets, get connections() { return connections; },
        get requestCalls() { return requestCalls; } };
}

test('44 sequential synthetic POSTs use one verified TLS connection with no listener accumulation', { timeout: 15000 }, async t => {
    const h = await localServer(t);
    let counts;
    for (let i = 0; i < 44; i++) {
        const result = await postDashScope(input(`synthetic-${i}`), { request: h.request });
        assert.equal(result.buffer.toString(), `synthetic-${i}`);
        assert.equal(result.transportDiagnostic.tlsAuthorized, true);
        assert.equal(result.transportDiagnostic.reusedSocket, i > 0);
        assert.equal(result.transportDiagnostic.responseComplete, true);
        const socket = [...h.clientSockets][0];
        const observed = ['lookup', 'connect', 'secureConnect'].map(event => socket.listenerCount(event));
        if (!counts) counts = observed;
        else assert.deepEqual(observed, counts);
    }
    assert.equal(h.connections, 1); assert.equal(h.requests.length, 44); assert.equal(h.requestCalls, 44);
});

test('server Connection: close creates a new connection for the next call without retrying either call', { timeout: 10000 }, async t => {
    const h = await localServer(t, (_req, res, body) => { res.setHeader('Connection', 'close'); res.end(body); });
    for (let i = 0; i < 2; i++) {
        const result = await postDashScope(input('synthetic'), { request: h.request });
        assert.equal(result.transportDiagnostic.reusedSocket, false);
    }
    assert.equal(h.connections, 2); assert.equal(h.requestCalls, 2);
});

test('a reset on a reused socket fails exactly that POST and never replays it', { timeout: 10000 }, async t => {
    const h = await localServer(t, (req, res, body, ordinal) => {
        if (ordinal === 2) req.socket.destroy(); else res.end(body);
    });
    await postDashScope(input('first'), { request: h.request });
    await assert.rejects(postDashScope(input('second'), { request: h.request }), error => {
        assert.equal(error.code, 'ECONNRESET');
        assert.equal(error.transportDiagnostic.reusedSocket, true);
        assert.equal(error.definitelyNotSubmitted, undefined);
        return true;
    });
    assert.equal(h.requestCalls, 2); assert.equal(h.requests.length, 2);
});

test('a truncated HTTPS response is not success and is never retried', { timeout: 10000 }, async t => {
    const h = await localServer(t, (_req, res) => {
        res.writeHead(200, { 'Content-Length': '100' }); res.write('partial');
        setImmediate(() => res.destroy());
    });
    await assert.rejects(postDashScope(input('synthetic'), { request: h.request }), error => {
        assert.equal(error.code, 'ECONNRESET');
        assert.equal(error.transportDiagnostic.responseStarted, true);
        assert.equal(error.transportDiagnostic.responseComplete, false);
        return true;
    });
    assert.equal(h.requestCalls, 1);
});

test('four active requests are bounded; queued cancellation cannot send a fifth POST or cancel its peers', { timeout: 10000 }, async t => {
    const responses = []; let allActive;
    const ready = new Promise(resolve => { allActive = resolve; });
    const h = await localServer(t, (_req, res, body) => {
        responses.push({ res, body }); if (responses.length === 4) allActive();
    });
    const active = Array.from({ length: 4 }, (_, i) => postDashScope(input(`active-${i}`), { request: h.request }));
    await ready;
    const controller = new AbortController();
    const queued = postDashScope({ ...input('queued'), signal: controller.signal }, { request: h.request });
    controller.abort(); await assert.rejects(queued, { name: 'AbortError' });
    responses.forEach(({ res, body }) => res.end(body));
    const results = await Promise.all(active);
    assert.equal(results.length, 4); assert.equal(h.requests.length, 4); assert.equal(h.connections, 4);
});

test('cancelling an active connection preserves another active request', { timeout: 10000 }, async t => {
    const responses = []; let bothActive;
    const ready = new Promise(resolve => { bothActive = resolve; });
    const h = await localServer(t, (_req, res, body) => { responses.push({ res, body }); if (responses.length === 2) bothActive(); });
    const controller = new AbortController();
    const cancelled = postDashScope({ ...input('cancel'), signal: controller.signal }, { request: h.request });
    const peer = postDashScope(input('peer'), { request: h.request });
    await ready; controller.abort();
    await assert.rejects(cancelled, error => {
        assert.equal(error.name, 'AbortError'); assert.equal(error.transportDiagnostic.outcome, 'cancelled'); return true;
    });
    responses.find(r => r.body === 'peer').res.end('peer');
    assert.equal((await peer).buffer.toString(), 'peer'); assert.equal(h.requestCalls, 2);
});

test('untrusted TLS certificate fails before HTTP and cannot disable production verification', { timeout: 10000 }, async t => {
    const h = await localServer(t);
    await assert.rejects(postDashScope(input('synthetic'), { request: (_url, options, callback) => {
        assert.equal(options.rejectUnauthorized, true);
        return https.request(new URL(`https://127.0.0.1:${h.server.address().port}/synthetic`),
            { ...options, ca: [], servername: 'localhost' }, callback);
    } }), error => {
        assert.match(error.code, /SELF_SIGNED|VERIFY/);
        assert.equal(error.transportDiagnostic.tlsAuthorized, null);
        assert.equal(error.definitelyNotSubmitted, undefined);
        return true;
    });
    assert.equal(h.requests.length, 0);
});

test('TCP reset before TLS is distinguishable and has no automatic retry', { timeout: 10000 }, async t => {
    let calls = 0;
    const server = net.createServer(socket => socket.destroy());
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    await assert.rejects(postDashScope(input('synthetic'), { request: (_url, options, callback) => {
        calls++;
        return https.request(new URL(`https://127.0.0.1:${server.address().port}/synthetic`), options, callback);
    } }), error => {
        assert.equal(error.code, 'ECONNRESET');
        assert.equal(error.transportDiagnostic.tlsAuthorized, null);
        assert.equal(error.transportDiagnostic.responseStarted, false);
        return true;
    });
    assert.equal(calls, 1);
});
