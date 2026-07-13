const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Qwen = require('../qisi-ocr-qwen-adapter.js');

const ROOT = path.resolve(__dirname, '..');
const CHAT_URL = ['', 'api', 'ai', 'chat'].join('/');
const OCR_URL = ['', 'api', 'ai', 'ocr'].join('/');
const HEALTH_URL = ['', 'api', 'ai', 'health'].join('/');

test('Qwen proxy transport owns same-origin routing, accounting, and health', async () => {
    const calls = [];
    const costs = [];
    const transport = Qwen.createQwenProxyTransport({
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            return url === HEALTH_URL
                ? {
                    ok: true,
                    status: 200,
                    json: async () => ({ ok: true, configured: true })
                }
                : { ok: true, status: 200 };
        },
        onAiRequest: label => costs.push(label)
    });

    const response = await transport.request(
        'chat', { method: 'POST' }, 100, 'fixture-chat'
    );
    const health = await transport.checkHealth();

    assert.equal(response.ok, true);
    assert.deepEqual(costs, ['fixture-chat']);
    assert.equal(calls[0].url, CHAT_URL);
    assert.equal(calls[1].url, HEALTH_URL);
    assert.deepEqual(health, {
        ok: true,
        status: 200,
        configured: true,
        chatUrl: CHAT_URL,
        ocrUrl: OCR_URL
    });
    assert.equal(transport.getEndpoint('ocr'), OCR_URL);
});

test('Qwen proxy transport rejects non-proxy endpoints and unknown route kinds', async () => {
    assert.throws(
        () => Qwen.createQwenProxyTransport({
            fetchImpl: async () => ({ ok: true }),
            chatUrl: [
                'https://dashscope', 'aliyuncs', 'com/api/v1'
            ].join('.')
        }),
        /same-origin AI proxy/i
    );
    const transport = Qwen.createQwenProxyTransport({
        fetchImpl: async () => ({ ok: true })
    });
    await assert.rejects(
        transport.request('other', {}, 100, 'invalid'),
        error => error?.code === 'QWEN_PROXY_KIND_INVALID'
    );
});

test('Qwen proxy transport aborts timed-out work with the legacy safe message', async () => {
    const transport = Qwen.createQwenProxyTransport({
        fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            });
        })
    });

    await assert.rejects(
        transport.request('ocr', {}, 1, 'fixture-timeout'),
        /fixture-timeout 超时/
    );
});

test('app shell assembles owners but contains zero AI proxy requests', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const adapter = fs.readFileSync(
        path.join(ROOT, 'qisi-ocr-qwen-adapter.js'),
        'utf8'
    );
    const visualSupport = fs.readFileSync(
        path.join(ROOT, 'qisi-visual-support-source.js'),
        'utf8'
    );

    assert.doesNotMatch(app, /const fetchWithTimeout\s*=/);
    assert.doesNotMatch(app, /DASHSCOPE_(?:CHAT|OCR)_URL/);
    assert.doesNotMatch(app, /fetch\(\s*['"]\/api\/ai\//);
    assert.equal(
        (app.match(/qwenProxyTransport\.request\(/g) || []).length,
        0
    );
    assert.doesNotMatch(app, /qwenProxyTransport\.getEndpoint\(/);
    assert.match(app, /createQwenTaskClient\s*\(/);
    assert.match(
        app,
        /createVisualSupportSource\s*\(\{[\s\S]*?qwenTaskClient[\s\S]*?\}\)/
    );
    assert.match(visualSupport, /qwenTaskClient\.chatJson\s*\(/);
    assert.match(adapter, /checkHealth:\s*\(\)\s*=>\s*transport\.checkHealth\(\)/);
});
