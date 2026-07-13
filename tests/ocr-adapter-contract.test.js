const test = require('node:test');
const assert = require('node:assert/strict');
const Contracts = require('../qisi-recognition-contracts.js');
const { createQwenAdapter } = require('../qisi-ocr-qwen-adapter.js');
const { createLocalAdapter } = require('../qisi-ocr-local-adapter.js');

test('Qwen mock transport returns RecognitionCandidate only', async () => {
    const adapter = createQwenAdapter({
        request: async () => ({ rawText: 'text', blocks: [], confidence: 0.9 }),
        engineVersion: 'mock'
    });
    const result = await adapter.recognizePage(
        { sourceId: 's1', page: 1 },
        { requestId: 'r1', sourceId: 's1', page: 1 }
    );
    assert.equal(Contracts.validateRecognitionCandidate(result).valid, true);
    assert.equal(result.engine, 'qwen-vl-plus');
    assert.equal(result.answer, undefined);
});

test('local adapter enforces loopback, MIME, size, and no paths', async () => {
    assert.throws(() => createLocalAdapter({ transport: async () => ({}), endpoint: 'https://example.com' }), /loopback/);
    const adapter = createLocalAdapter({
        transport: async (_url, input, options) => options.healthCheck
            ? { ok: true }
            : { rawText: 'local', engineVersion: 'mock' },
        maxBytes: 10
    });
    await assert.rejects(adapter.recognizePage({ path: 'C:/secret', mimeType: 'image/png', bytes: 1 }), error => error.code === 'local-path-forbidden');
    await assert.rejects(adapter.recognizePage({ mimeType: 'text/html', bytes: 1 }), error => error.code === 'mime-rejected');
    await assert.rejects(adapter.recognizePage({ mimeType: 'image/png', bytes: 11 }), error => error.code === 'size-rejected');
    const result = await adapter.recognizePage({ sourceId: 's1', mimeType: 'image/png', bytes: 2 });
    assert.equal(Contracts.validateRecognitionCandidate(result).valid, true);
    assert.equal((await adapter.healthCheck()).ok, true);
});

test('RecognitionCandidate includes a stable rawEvidenceRef without adding domain fields', async () => {
    const adapter = createQwenAdapter({
        request: async () => ({ rawText: 'text' }),
        engineVersion: 'mock-1'
    });
    const result = await adapter.recognizePage(
        { sourceId: 'source-1', page: 1 },
        { requestId: 'evidence-1' }
    );
    assert.equal(result.rawEvidenceRef, 'qwen-vl-plus://evidence-1');
    assert.equal(result.answer, undefined);
    assert.equal(result.solution, undefined);
    assert.equal(Contracts.validateRecognitionCandidate(result).valid, true);
});

test('Qwen adapter rejects malformed response and logs metadata without private content', async () => {
    const events = [];
    const adapter = createQwenAdapter({
        request: async () => ({ rawText: 'PRIVATE_RAW_TEXT', blocks: 'not-an-array' }),
        engineVersion: 'mock-1',
        logger: event => events.push(event)
    });
    await assert.rejects(
        adapter.recognizePage(
            { sourceId: 'source-1', page: 1 },
            { requestId: 'malformed-1' }
        ),
        error => error.code === 'ocr-malformed-response' &&
            error.requestId === 'malformed-1' &&
            !error.message.includes('PRIVATE_RAW_TEXT')
    );
    assert.equal(events.some(event => event.event === 'ocr-adapter-failure'), true);
    assert.equal(JSON.stringify(events).includes('PRIVATE_RAW_TEXT'), false);
});

test('adapter maps unavailable transport to a stable error without leaking cause text', async () => {
    const unavailable = Object.assign(new Error('PRIVATE_ENDPOINT_AND_SOURCE'), {
        code: 'ECONNREFUSED'
    });
    const qwen = createQwenAdapter({
        request: async () => { throw unavailable; },
        engineVersion: 'mock-1'
    });
    const local = createLocalAdapter({
        transport: async () => { throw unavailable; }
    });
    for (const [adapter, input, requestId] of [
        [qwen, { sourceId: 's1' }, 'unavailable-qwen'],
        [local, { sourceId: 's1', mimeType: 'image/png', bytes: 1 }, 'unavailable-local']
    ]) {
        await assert.rejects(
            adapter.recognizePage(input, { requestId }),
            error => error.code === 'ocr-engine-unavailable' &&
                error.requestId === requestId &&
                !error.message.includes('PRIVATE_ENDPOINT_AND_SOURCE')
        );
    }
});

test('Qwen adapter enforces MIME and size when byte metadata is present', async () => {
    let calls = 0;
    const adapter = createQwenAdapter({
        request: async () => { calls += 1; return {}; },
        engineVersion: 'mock-1',
        maxBytes: 10
    });
    await assert.rejects(
        adapter.recognizePage({ mimeType: 'text/html', bytes: 1 }),
        error => error.code === 'mime-rejected'
    );
    await assert.rejects(
        adapter.recognizePage({ mimeType: 'image/png', bytes: 11 }),
        error => error.code === 'size-rejected'
    );
    assert.equal(calls, 0);
});

test('duplicate active requestId fails closed and cancellation is stable', async () => {
    let transportCalls = 0;
    const adapter = createQwenAdapter({
        engineVersion: 'mock-1',
        request: (_input, options) => new Promise((resolve, reject) => {
            transportCalls += 1;
            options.signal.addEventListener('abort', () => {
                reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            }, { once: true });
        })
    });
    const active = adapter.recognizePage({ sourceId: 's1' }, { requestId: 'duplicate-1' });
    await Promise.resolve();
    await assert.rejects(
        adapter.recognizePage({ sourceId: 's2' }, { requestId: 'duplicate-1' }),
        error => error.code === 'duplicate-request-id'
    );
    assert.equal(transportCalls, 1);
    assert.equal(adapter.cancel('duplicate-1'), true);
    await assert.rejects(active, error => error.code === 'ocr-cancelled');
    assert.equal(adapter.cancel('duplicate-1'), false);
});

test('local adapter rejects malformed response instead of returning an invalid candidate', async () => {
    const adapter = createLocalAdapter({
        transport: async () => ({ rawText: 42, blocks: {} })
    });
    await assert.rejects(
        adapter.recognizePage(
            { sourceId: 's1', mimeType: 'image/png', bytes: 1 },
            { requestId: 'local-malformed-1' }
        ),
        error => error.code === 'ocr-malformed-response'
    );
});
