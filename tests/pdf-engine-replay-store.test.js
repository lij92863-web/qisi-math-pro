const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildReplayMetadata,
    rebuildReplayCacheKey,
    redactRequestBody,
    sha256
} = require('../scripts/pdf-engine-replay-store.js');

test('PDF engine replay key contains file, page, DPI, model, prompt and schema evidence', () => {
    const body = {
        model: 'qwen3-vl-plus',
        messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
            { type: 'text', text: 'prompt-r1' }
        ] }]
    };
    const metadata = buildReplayMetadata({
        requestBody: body,
        sourceFileSha256: 'file-hash',
        page: 2,
        renderDpi: 144,
        endpoint: '/api/replay/chat'
    });
    assert.equal(metadata.sourceFileSha256, 'file-hash');
    assert.equal(metadata.page, 2);
    assert.equal(metadata.model, 'qwen3-vl-plus');
    assert.equal(metadata.promptSha256, sha256('prompt-r1'));
    assert.equal(metadata.requestSchemaVersion, 'qisi-ai-proxy-r1');
    assert.match(metadata.request.messages[0].content[0].image_url.url, /^\[redacted-image sha256=/);
});

test('PDF engine replay redaction never stores auth or raw image data', () => {
    const body = {
        model: 'qwen-vl-ocr-latest',
        input: { messages: [{ content: [{ image: 'data:image/jpeg;base64,SECRET' }] }] }
    };
    const redacted = JSON.stringify(redactRequestBody(body));
    assert.doesNotMatch(redacted, /base64,SECRET/);
    assert.doesNotMatch(redacted, /authorization|api[-_ ]?key/i);
});

test('PDF engine replay key can be rebuilt after verified page metadata correction', () => {
    const metadata = buildReplayMetadata({
        requestBody: {
            model: 'qwen-vl-plus',
            messages: [{ role: 'user', content: [{ type: 'text', text: 'page prompt' }] }]
        },
        sourceFileSha256: 'question-file',
        page: 1,
        endpoint: '/api/replay/chat'
    });
    const corrected = { ...metadata, page: 2 };

    assert.notEqual(rebuildReplayCacheKey(corrected), metadata.cacheKey);
    assert.equal(
        rebuildReplayCacheKey({ ...corrected, cacheKey: 'ignored-stale-key' }),
        rebuildReplayCacheKey(corrected)
    );
});
