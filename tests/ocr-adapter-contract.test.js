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
