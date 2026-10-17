const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const acorn = require('acorn');
const { createAiRequestLimiter, networkFailureCode } = require('../qisi-local-ai-request-policy');
const { createSecureLogger } = require('../qisi-secure-logger');
const { createPdfWindowRecognizer } = require('../qisi-qwen-vision-source-port');

// Execute the actual proxy functions, without loading server startup, dotenv or production data.
const source = fs.readFileSync(path.join(__dirname, '..', 'qisi-local-server.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });
const names = new Set(['safeAiModelName', 'validateAiRequestBody', 'forwardDashScopeRequest']);
const functions = ast.body.filter(n => n.type === 'FunctionDeclaration' && names.has(n.id.name))
    .map(n => source.slice(n.start, n.end)).join('\n');
assert.equal(functions.includes('forwardDashScopeRequest'), true);

function harness(post) {
    const logs = [], timers = new Map(); let releases = 0, calls = 0, lease;
    const logger = { log: (...args) => logs.push(args), error: (...args) => logs.push(args) };
    createSecureLogger(logger).install();
    const limiter = createAiRequestLimiter({ maxConcurrent: 1 });
    const credentialName = ['DASHSCOPE', 'API', 'KEY'].join('_');
    const context = { [credentialName]: 'synthetic-test-value', AI_REQUEST_TIMEOUT_MS: 600000,
        AbortController, Date, console: logger, networkFailureCode,
        setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; },
        clearTimeout(id) { timers.delete(id); },
        aiRequestLimiter: { acquire() {
            lease = limiter.acquire();
            return lease.ok ? { ...lease, release() { releases++; lease.release(); } } : lease;
        } },
        postDashScope(options) { calls++; return post(options); }
    };
    const forward = vm.runInNewContext(functions + '\nforwardDashScopeRequest;', context);
    const req = { body: { model: 'qwen-test' }, get: () => 'synthetic-request-1' };
    const res = Object.assign(new EventEmitter(), {
        destroyed: false, writableEnded: false, writes: [],
        status(code) { this.statusCode = code; return this; },
        set(name, value) { this.headers = { ...this.headers, [name]: value }; return this; },
        json(body) { this.writes.push(body); this.writableEnded = true; return this; },
        send(body) { this.writes.push(body); this.writableEnded = true; return this; }
    });
    return { req, res, logs, timers, limiter, run: () => forward(req, res, 'chat', 'https://example.invalid/synthetic'),
        get calls() { return calls; }, get releases() { return releases; } };
}

const diagnostic = { version: 1, phase: 'tcp_connected', outcome: 'failed', elapsedMs: 50,
    reusedSocket: false, tlsAuthorized: null, requestFinished: false, responseStarted: false,
    responseComplete: false, events: [{ stage: 'tcp_connected', elapsedMs: 3 }, { stage: 'failed', elapsedMs: 50 }] };
const pendingUntilAbort = options => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(Error('synthetic abort'),
        { name: 'AbortError', transportDiagnostic: { ...diagnostic, outcome: 'cancelled' } })), { once: true });
});

test('proxy persists stage diagnostics in PDF raw error evidence without relaxing unknown semantics', async () => {
    const h = harness(async options => {
        options.onPhase({ stage: 'tcp_connected', elapsedMs: 3, reusedSocket: false });
        throw Object.assign(Error('PRIVATE_SERVER_ERROR'), { code: 'ECONNRESET', transportDiagnostic: diagnostic });
    });
    await h.run();
    assert.equal(h.res.statusCode, 502); assert.equal(h.calls, 1); assert.equal(h.releases, 1);
    const body = h.res.writes[0];
    assert.equal(body.code, 'AI_PROXY_FETCH_FAILED'); assert.equal(body.causeCode, 'ECONNRESET');
    assert.deepEqual(body.transportDiagnostic, diagnostic);
    const recognize = createPdfWindowRecognizer({ transport: {
        request: async () => ({ ok: false, status: 502, json: async () => body })
    } });
    await assert.rejects(recognize({ model: 'qwen-test', prompt: 'synthetic' }), error => {
        assert.deepEqual(error.rawResponse.transportDiagnostic, diagnostic);
        assert.equal(error.definitelyNotSubmitted, undefined);
        assert.equal(error.submissionAccepted, undefined);
        assert.equal(error.externalResponseReceived, undefined);
        return true;
    });
    assert.ok(h.logs.some(([, row]) => row.stage === 'chat.transport.tcp_connected' && row.duration === 3));
    assert.doesNotMatch(JSON.stringify(h.logs), /PRIVATE_SERVER_ERROR|synthetic-test-value/);
    assert.equal(h.timers.size, 0); assert.equal(h.res.listenerCount('close'), 0);
});

test('deadline has timeout identity, preserves diagnostics and releases exactly one lease', async () => {
    const h = harness(pendingUntilAbort), running = h.run();
    [...h.timers.values()][0](); await running;
    assert.equal(h.res.statusCode, 504);
    assert.equal(h.res.writes[0].code, 'AI_PROXY_TIMEOUT');
    assert.equal(h.res.writes[0].abortReason, 'deadline');
    assert.equal(h.calls, 1); assert.equal(h.releases, 1); assert.equal(h.timers.size, 0);
    assert.equal(h.res.listenerCount('close'), 0);
});

test('client disconnect cancels work without pretending to time out or writing to a closed response', async () => {
    const h = harness(pendingUntilAbort), running = h.run();
    h.res.destroyed = true; h.res.emit('close'); await running;
    assert.equal(h.res.writes.length, 0); assert.equal(h.calls, 1); assert.equal(h.releases, 1);
    assert.ok(h.logs.some(([, row]) => row.code === 'AI_PROXY_CANCELLED'));
    assert.ok(!h.logs.some(([, row]) => row.code === 'AI_PROXY_TIMEOUT'));
    assert.equal(h.timers.size, 0); assert.equal(h.res.listenerCount('close'), 0);
});

test('an already disconnected response is not written even when upstream completion wins the race', async () => {
    let complete;
    const h = harness(() => new Promise(resolve => { complete = resolve; }));
    const running = h.run(); h.res.destroyed = true; h.res.emit('close');
    complete({ status: 200, ok: true, contentType: 'application/json', buffer: Buffer.from('{}') });
    await running;
    assert.equal(h.res.writes.length, 0); assert.equal(h.releases, 1);
});

test('complete upstream HTTP errors preserve exact response bytes and status without being wrapped as network failures', async () => {
    const buffer = Buffer.from('{"error":"synthetic-provider-response"}');
    const h = harness(async () => ({ status: 429, ok: false, contentType: 'application/json', buffer }));
    await h.run();
    assert.equal(h.res.statusCode, 429); assert.equal(h.res.writes[0], buffer);
    assert.equal(h.calls, 1); assert.equal(h.releases, 1);
});
