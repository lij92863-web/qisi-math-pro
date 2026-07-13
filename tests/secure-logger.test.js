const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createSecureLogger, sanitizeLogArgs } = require('../qisi-secure-logger.js');

const PRIVATE_MARKERS = [
    'PRIVATE_OCR_TEXT',
    'sk-private-key',
    'data:image/png;base64,PRIVATE_BASE64',
    'PRIVATE_QUESTION_CONTENT',
    'PRIVATE_FULL_MODEL_RESPONSE'
];

test('sanitizer drops OCR text, keys, base64, private content, and model responses', () => {
    const result = sanitizeLogArgs([
        '[AI_PROXY][response]',
        {
            requestId: 'req-123',
            stage: 'ocr.response',
            durationMs: 42,
            model: 'qwen-vl',
            errorCode: 'UPSTREAM_FAILED',
            rawText: PRIVATE_MARKERS[0],
            apiKey: PRIVATE_MARKERS[1],
            image: PRIVATE_MARKERS[2],
            question: PRIVATE_MARKERS[3],
            response: { content: PRIVATE_MARKERS[4] }
        }
    ]);

    assert.deepEqual(result, ['[QISI_LOG]', {
        requestId: 'req-123',
        stage: 'ocr.response',
        duration: 42,
        engine: 'qwen-vl',
        code: 'UPSTREAM_FAILED'
    }]);
    const serialized = JSON.stringify(result);
    PRIVATE_MARKERS.forEach(marker => assert.equal(serialized.includes(marker), false));
});

test('arbitrary strings and Error messages cannot cross the log boundary', () => {
    const result = sanitizeLogArgs([
        PRIVATE_MARKERS.join(' '),
        new Error(PRIVATE_MARKERS.join(' '))
    ]);
    assert.deepEqual(result, ['[QISI_LOG]', { stage: 'application' }]);
});

test('installed console methods emit only sanitized arguments', () => {
    const emitted = [];
    const target = {};
    for (const method of ['log', 'warn', 'error', 'info', 'debug', 'table', 'group', 'groupCollapsed']) {
        target[method] = (...args) => emitted.push({ method, args });
    }
    target.groupEnd = () => {};

    createSecureLogger(target).install();
    target.error('[OCR][failed]', {
        requestId: 'req-safe',
        code: 'OCR_FAILED',
        rawText: PRIVATE_MARKERS[0],
        response: PRIVATE_MARKERS[4]
    });

    assert.deepEqual(emitted[0].args, ['[QISI_LOG]', {
        requestId: 'req-safe',
        stage: 'OCR.failed',
        code: 'OCR_FAILED'
    }]);
    assert.equal(PRIVATE_MARKERS.some(marker => JSON.stringify(emitted).includes(marker)), false);
});

test('production installs the secure logger before application logging', () => {
    const root = path.resolve(__dirname, '..');
    const main = fs.readFileSync(path.join(root, 'main.html'), 'utf8');
    assert.ok(
        main.indexOf('qisi-secure-logger.js') < main.indexOf('qisi-config.js'),
        'browser logger must load before Qisi application scripts'
    );
    const server = fs.readFileSync(path.join(root, 'qisi-local-server.js'), 'utf8');
    assert.match(server, /createSecureLogger\(console\)\.install\(\)/);
    assert.ok(
        server.indexOf('createSecureLogger(console).install()') < server.indexOf("const app = express()"),
        'server logger must install before routes and startup logs'
    );
});
