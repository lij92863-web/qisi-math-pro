const test = require('node:test');
const assert = require('node:assert/strict');

const Qwen = require('../qisi-ocr-qwen-adapter.js');

const response = content => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
});

test('task client owns model identity, payload assembly, and response parsing', async () => {
    const calls = [];
    const client = Qwen.createQwenTaskClient({
        transport: {
            request: async (kind, options, timeoutMs, label) => {
                calls.push({ kind, body: JSON.parse(options.body), timeoutMs, label });
                return response('{"questions":[{"questionNumber":"1"}]}');
            },
            checkHealth: async () => ({ ok: true })
        },
        getMode: () => 'standard'
    });

    const result = await client.chatJson({
        task: 'strict-vision', prompt: 'fixture prompt',
        imageUrl: 'data:image/png;base64,fixture'
    });
    assert.equal(result.value.questions[0].questionNumber, '1');
    assert.match(result.model, /vl/i);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].kind, 'chat');
    assert.equal(calls[0].body.model, result.model);
    assert.equal(calls[0].body.messages[0].content[0].type, 'image_url');
});

test('task client OCR route and health use the production proxy owner', async () => {
    const calls = [];
    const client = Qwen.createQwenTaskClient({
        transport: {
            request: async (kind, options) => {
                calls.push({ kind, body: JSON.parse(options.body) });
                return response('recognized text');
            },
            checkHealth: async () => ({ ok: true, configured: true })
        }
    });
    assert.equal((await client.ocrText({ imageUrl: 'data:image/png;base64,x' })).text,
        'recognized text');
    assert.equal(calls[0].kind, 'ocr');
    assert.equal(calls[0].body.parameters.ocr_options.task, 'document_parsing');
    assert.deepEqual(await client.checkHealth(), { ok: true, configured: true });
});

test('missing transport, malformed JSON, HTTP failure, and cancellation fail closed', async () => {
    assert.throws(() => Qwen.createQwenTaskClient(), /transport is required/i);

    const malformed = Qwen.createQwenTaskClient({
        transport: {
            request: async () => response('private malformed response'),
            checkHealth: async () => ({ ok: true })
        }
    });
    await assert.rejects(
        malformed.chatJson({ task: 'text-structure', prompt: 'private prompt' }),
        error => error.code === 'QWEN_TASK_JSON_INVALID' &&
            !error.message.includes('private')
    );

    const failed = Qwen.createQwenTaskClient({
        transport: {
            request: async () => ({ ok: false, status: 503 }),
            checkHealth: async () => ({ ok: false })
        }
    });
    await assert.rejects(
        failed.chatText({ task: 'text-structure', prompt: 'private prompt' }),
        error => error.code === 'QWEN_PROXY_HTTP_FAILED' &&
            !error.message.includes('private')
    );

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        malformed.chatText({
            task: 'text-structure', prompt: 'fixture', signal: controller.signal
        }),
        error => error.name === 'AbortError' &&
            error.code === 'OCR_REQUEST_CANCELLED'
    );
});
