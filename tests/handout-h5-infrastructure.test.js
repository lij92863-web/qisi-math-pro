'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const compilerClientModule =
    require('../qisi-handout-compiler-client.js');
const pdfSessionModule =
    require('../qisi-handout-pdf-session.js');

const ROOT = path.resolve(__dirname, '..');
const LINE_MAP = Object.freeze([{
    path: '/main.typ',
    blockId: 'block-1',
    formulaId: null,
    startLine: 1,
    endLine: 10
}, {
    path: '/main.typ',
    blockId: 'block-1',
    formulaId: 'block-1:stem:1',
    startLine: 4,
    endLine: 6
}]);

class FakeWorker {
    constructor(behavior = () => {}) {
        this.behavior = behavior;
        this.listeners = new Map();
        this.messages = [];
        this.terminated = false;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    postMessage(message, transfers = []) {
        this.messages.push({ message, transfers });
        this.behavior(this, message);
    }

    emit(type, value) {
        for (const listener of this.listeners.get(type) || []) {
            listener(type === 'message'
                ? { data: value }
                : value);
        }
    }

    terminate() {
        this.terminated = true;
    }
}

const makePdfBytes = () => {
    const bytes = new Uint8Array(256);
    bytes.set(new TextEncoder().encode('%PDF-1.7'));
    return bytes.buffer;
};

const makeGenerated = overrides => ({
    edition: 'student',
    source: '#set page(paper: "a4")\nHello',
    lineMap: LINE_MAP,
    assetRequests: [],
    diagnostics: [],
    readyForCompile: true,
    ...overrides
});

test('H5 compiler client creates its Worker lazily and transfers one result', async () => {
    const workers = [];
    const progress = [];
    const client = compilerClientModule.createCompilerClient({
        timeoutMs: 5_000,
        onProgress: message => progress.push(message.phase),
        workerFactory() {
            const worker = new FakeWorker((target, message) => {
                queueMicrotask(() => {
                    target.emit('message', {
                        type: 'progress',
                        requestId: message.requestId,
                        phase: 'compile'
                    });
                    target.emit('message', {
                        type: 'compiled',
                        requestId: message.requestId,
                        pdfBytes: makePdfBytes(),
                        diagnostics: [],
                        metrics: {
                            runtimeVersion: 'test'
                        }
                    });
                });
            });
            workers.push(worker);
            return worker;
        }
    });

    assert.equal(workers.length, 0);
    assert.equal(client.hasWorker(), false);
    const response = await client.compile({
        source: 'hello',
        lineMap: LINE_MAP,
        assets: []
    });

    assert.equal(workers.length, 1);
    assert.equal(client.hasWorker(), true);
    assert.equal(workers[0].messages.length, 1);
    assert.match(
        workers[0].messages[0].message.requestId,
        /^h5-/
    );
    assert.deepEqual(progress, ['compile']);
    assert.equal(
        new Uint8Array(response.pdfBytes).byteLength,
        256
    );
    client.dispose();
    assert.equal(workers[0].terminated, true);
});

test('H5 cancellation terminates the active Worker and permits a clean retry', async () => {
    const workers = [];
    let respond = false;
    const client = compilerClientModule.createCompilerClient({
        timeoutMs: 5_000,
        workerFactory() {
            const worker = new FakeWorker((target, message) => {
                if (!respond) return;
                queueMicrotask(() => target.emit('message', {
                    type: 'compiled',
                    requestId: message.requestId,
                    pdfBytes: makePdfBytes(),
                    diagnostics: [],
                    metrics: {}
                }));
            });
            workers.push(worker);
            return worker;
        }
    });

    const cancelled = client.compile({
        source: 'first',
        lineMap: LINE_MAP
    });
    assert.equal(client.cancel(), true);
    await assert.rejects(cancelled, error =>
        error.name === 'AbortError'
        && error.code === 'HANDOUT_COMPILE_CANCELLED'
    );
    assert.equal(workers[0].terminated, true);

    respond = true;
    const retried = await client.compile({
        source: 'second',
        lineMap: LINE_MAP
    });
    assert.equal(workers.length, 2);
    assert.equal(new Uint8Array(retried.pdfBytes).byteLength, 256);
    client.dispose();
});

test('H5 runtime contract bounds source, assets, paths and versions', async () => {
    const contract = await import(pathToFileURL(
        path.join(
            ROOT,
            'workers',
            'qisi-handout-compiler-contract.mjs'
        )
    ));
    const request = contract.validateCompileRequest({
        type: contract.WORKER_MESSAGE.compile,
        requestId: 'h5-contract-1',
        source: 'hello',
        lineMap: LINE_MAP,
        assets: [{
            path: '/assets/figure.png',
            mimeType: 'image/png',
            bytes: new Uint8Array([1, 2, 3]).buffer
        }]
    });

    assert.equal(request.assets[0].path, '/assets/figure.png');
    assert.match(contract.CACHE_NAME, /^tex-handout-compiler-/);
    assert.match(contract.RUNTIME_VERSION, /typst-0\.7\.0/);
    assert.throws(() => contract.validateCompileRequest({
        type: contract.WORKER_MESSAGE.compile,
        requestId: 'h5-contract-2',
        source: 'hello',
        lineMap: LINE_MAP,
        assets: [{
            path: '/assets/../secret.png',
            bytes: new Uint8Array([1]).buffer
        }]
    }), /invalid handout asset path/);
    assert.throws(() => contract.validateCompileRequest({
        type: contract.WORKER_MESSAGE.compile,
        requestId: 'h5-contract-3',
        source: '',
        lineMap: LINE_MAP
    }), /must not be empty/);
});

test('H5 diagnostics prefer formula context over its enclosing block', async () => {
    const diagnostics = await import(pathToFileURL(
        path.join(
            ROOT,
            'workers',
            'qisi-handout-compiler-diagnostics.mjs'
        )
    ));
    const [item] = diagnostics.normalizeCompilerDiagnostics([{
        path: '/main.typ',
        range: '5:1-5:8',
        severity: 'error',
        message: 'unknown variable'
    }], LINE_MAP);

    assert.equal(item.blockId, 'block-1');
    assert.equal(item.formulaId, 'block-1:stem:1');
    assert.match(item.display, /Formula block-1:stem:1/);
});

test('H5 PDF session reuses one Blob for preview and download until explicit close', async () => {
    const revoked = [];
    const urls = [];
    let compileCalls = 0;
    let disposed = false;
    const compilerClient = {
        async compile() {
            compileCalls += 1;
            return {
                requestId: 'h5-session-1',
                pdfBytes: makePdfBytes(),
                diagnostics: [],
                metrics: {
                    runtimeVersion: 'test',
                    pdfBytes: 256
                }
            };
        },
        cancel: () => false,
        dispose() {
            disposed = true;
        }
    };
    const lifecycle = new EventTarget();
    const session = pdfSessionModule.createPdfSession({
        compilerClient,
        lifecycleTarget: lifecycle,
        documentObject: null,
        urlApi: {
            createObjectURL() {
                const value = `blob:test-${urls.length + 1}`;
                urls.push(value);
                return value;
            },
            revokeObjectURL(value) {
                revoked.push(value);
            }
        },
        blobConstructor: Blob
    });

    await session.compileGenerated(makeGenerated());
    const download = session.getDownloadDescriptor('student');
    assert.equal(compileCalls, 1);
    assert.equal(download.href, session.getPreviewUrl());
    assert.equal(download.href, urls[0]);
    assert.equal(download.filename, 'student.pdf');
    assert.equal(session.copyPdfBytes().byteLength, 256);
    assert.equal(session.hasArtifact(), true);

    session.closePreview();
    assert.equal(session.hasArtifact(), false);
    assert.deepEqual(revoked, [urls[0]]);
    session.dispose();
    assert.equal(disposed, true);
});

test('H5 missing assets and external SVG references block compile before Worker use', async () => {
    let compileCalls = 0;
    const compilerClient = {
        async compile() {
            compileCalls += 1;
            throw new Error('must not be called');
        },
        cancel: () => false,
        dispose() {}
    };
    const session = pdfSessionModule.createPdfSession({
        compilerClient,
        lifecycleTarget: null,
        documentObject: null,
        urlApi: {
            createObjectURL: () => 'blob:unused',
            revokeObjectURL() {}
        },
        blobConstructor: Blob
    });
    const missing = makeGenerated({
        assetRequests: [{
            assetId: 'figure',
            path: '/assets/001-figure.png',
            blockId: 'block-1'
        }]
    });
    await assert.rejects(
        session.compileGenerated(missing, []),
        error => error.code === 'HANDOUT_ASSET_MISSING'
    );
    assert.equal(compileCalls, 0);

    const records = [{
        id: 'figure',
        handoutId: 'handout',
        mimeType: 'image/svg+xml',
        blob: new Blob([
            '<svg><image href="https://example.com/a.png"/></svg>'
        ], {
            type: 'image/svg+xml'
        })
    }];
    const paths = pdfSessionModule.createAssetPathById(
        records,
        'handout'
    );
    const unsafe = makeGenerated({
        assetRequests: [{
            assetId: 'figure',
            path: paths.figure,
            blockId: 'block-1'
        }]
    });
    await assert.rejects(
        session.compileGenerated(unsafe, records),
        error => error.code === 'HANDOUT_SVG_EXTERNAL_REFERENCE'
    );
    assert.equal(compileCalls, 0);
    session.dispose();
});
