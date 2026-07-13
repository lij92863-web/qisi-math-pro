const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    createLocalOcrService,
    createUnavailableEngine
} = require('../local-ocr/server.js');

const root = path.resolve(__dirname, '..');
const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-local-ocr-test-'));
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const mockEngine = (recognize = async () => ({ rawText: 'recognized' })) => ({
    getMetadata: () => ({ name: 'mock-local', version: '1.0.0', model: 'none' }),
    healthCheck: async () => ({ ok: true }),
    recognize
});

const start = async options => {
    const service = createLocalOcrService({ port: 0, ...options });
    const address = await service.start();
    return {
        service,
        endpoint: `http://127.0.0.1:${address.port}`
    };
};

const post = (endpoint, body = pngBytes, headers = {}) => fetch(
    `${endpoint}/v1/recognize`,
    {
        method: 'POST',
        headers: {
            'content-type': 'image/png',
            'x-qisi-request-id': `request-${Date.now()}-${Math.random()}`,
            ...headers
        },
        body
    }
);

test('service refuses non-loopback binding', () => {
    assert.throws(
        () => createLocalOcrService({ host: '0.0.0.0' }),
        /loopback/
    );
});

test('health exposes service and engine metadata without source content', async t => {
    const logs = [];
    const { service, endpoint } = await start({
        engine: mockEngine(),
        logger: event => logs.push(event),
        tempRoot: tempRoot()
    });
    t.after(() => service.stop());
    const response = await fetch(`${endpoint}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, 'qisi-local-ocr');
    assert.deepEqual(body.engine, {
        name: 'mock-local', version: '1.0.0', model: 'none', available: true
    });
    assert.equal(JSON.stringify(logs).includes('recognized'), false);
});

test('recognition accepts bytes only and rejects MIME, size, and path-shaped JSON before engine', async t => {
    let calls = 0;
    const { service, endpoint } = await start({
        engine: mockEngine(async () => { calls += 1; return { rawText: 'ok' }; }),
        maxBytes: 8,
        tempRoot: tempRoot()
    });
    t.after(() => service.stop());

    assert.equal((await post(endpoint, 'x', { 'content-type': 'text/html' })).status, 415);
    assert.equal((await post(endpoint, '123456789')).status, 413);
    assert.equal((await post(
        endpoint,
        JSON.stringify({ path: 'C:/private/source.png' }),
        { 'content-type': 'application/json' }
    )).status, 415);
    assert.equal(calls, 0);
});

test('recognition returns candidate-shaped metadata and removes managed temp files', async t => {
    const directory = tempRoot();
    let observedPath = '';
    const { service, endpoint } = await start({
        tempRoot: directory,
        engine: mockEngine(async input => {
            observedPath = input.tempFilePath;
            assert.equal(Buffer.isBuffer(input.buffer), true);
            assert.equal(input.mimeType, 'image/png');
            assert.equal(fs.existsSync(input.tempFilePath), true);
            return {
                rawText: 'PRIVATE_RECOGNIZED_TEXT',
                blocks: [], formulas: [], images: [], warnings: [], confidence: 0.8
            };
        })
    });
    t.after(() => service.stop());
    const response = await post(endpoint);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.engine, 'mock-local');
    assert.equal(body.engineVersion, '1.0.0');
    assert.equal(body.rawText, 'PRIVATE_RECOGNIZED_TEXT');
    assert.match(body.rawEvidenceRef, /^local-ocr:\/\//);
    assert.equal(fs.existsSync(observedPath), false);
    assert.deepEqual(fs.readdirSync(directory), []);
});

test('concurrency overflow is explicit and does not enter the engine', async t => {
    let release;
    let calls = 0;
    const firstDone = new Promise(resolve => { release = resolve; });
    const { service, endpoint } = await start({
        concurrencyLimit: 1,
        tempRoot: tempRoot(),
        engine: mockEngine(async () => {
            calls += 1;
            await firstDone;
            return { rawText: '' };
        })
    });
    t.after(() => service.stop());
    const first = post(endpoint, pngBytes, { 'x-qisi-request-id': 'concurrent-1' });
    while (calls === 0) await new Promise(resolve => setImmediate(resolve));
    const second = await post(endpoint, pngBytes, { 'x-qisi-request-id': 'concurrent-2' });
    assert.equal(second.status, 429);
    assert.equal((await second.json()).code, 'concurrency-limit');
    assert.equal(calls, 1);
    release();
    assert.equal((await first).status, 200);
});

test('timeout is explicit, aborts the engine signal, and cleans temp files', async t => {
    const directory = tempRoot();
    let aborted = false;
    const { service, endpoint } = await start({
        timeoutMs: 20,
        tempRoot: directory,
        engine: mockEngine(input => new Promise(resolve => {
            input.signal.addEventListener('abort', () => {
                aborted = true;
                resolve({ rawText: '' });
            }, { once: true });
        }))
    });
    t.after(() => service.stop());
    const response = await post(endpoint, pngBytes);
    const body = await response.json();
    assert.equal(response.status, 504);
    assert.equal(body.code, 'ocr-timeout');
    assert.equal(aborted, true);
    assert.deepEqual(fs.readdirSync(directory), []);
});

test('default unavailable engine fails closed and logs no raw request content', async t => {
    const logs = [];
    const { service, endpoint } = await start({
        engine: createUnavailableEngine(),
        logger: event => logs.push(event),
        tempRoot: tempRoot()
    });
    t.after(() => service.stop());
    const health = await (await fetch(`${endpoint}/health`)).json();
    assert.equal(health.ok, false);
    assert.equal(health.engine.available, false);
    const response = await post(endpoint, Buffer.concat([
        pngBytes,
        Buffer.from('PRIVATE_REQUEST_CONTENT')
    ]));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'ocr-engine-unavailable');
    assert.equal(JSON.stringify(logs).includes('PRIVATE_REQUEST_CONTENT'), false);
});

test('Windows lifecycle scripts exist and model/runtime directories are ignored', () => {
    for (const file of [
        'install.ps1', 'start.ps1', 'stop.ps1', 'health-check.ps1',
        'diagnostics.ps1', 'uninstall.ps1'
    ]) {
        assert.equal(fs.existsSync(path.join(root, 'local-ocr', file)), true, file);
    }
    const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    assert.match(ignore, /^local-ocr\/models\/$/m);
    assert.match(ignore, /^local-ocr\/runtime\/$/m);
    assert.match(ignore, /^local-ocr\/tmp\/$/m);
    const install = fs.readFileSync(path.join(root, 'local-ocr', 'install.ps1'), 'utf8');
    const startScript = fs.readFileSync(path.join(root, 'local-ocr', 'start.ps1'), 'utf8');
    const uninstall = fs.readFileSync(path.join(root, 'local-ocr', 'uninstall.ps1'), 'utf8');
    assert.doesNotMatch(install, /Invoke-WebRequest|curl|pip\s+install|modelscope|huggingface/i);
    assert.match(startScript, /Start-Process[\s\S]+-WindowStyle Hidden/);
    assert.match(uninstall, /StartsWith/);
    assert.match(uninstall, /RemoveModels/);
});
