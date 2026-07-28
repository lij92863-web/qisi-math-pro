'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const pdfjsLib = require('../vendor/pdfjs-dist/3.11.174/pdf.min.js');

const ROOT = path.resolve(__dirname, '..');
const PROTOTYPE_ROOT = path.join(ROOT, 'prototypes', 'handout-typst');
const MANIFEST_PATH = path.join(PROTOTYPE_ROOT, 'dependency-manifest.json');
const PROTOTYPE_URL = '/prototypes/handout-typst/index.html';

pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    ROOT,
    'vendor',
    'pdfjs-dist',
    '3.11.174',
    'pdf.worker.min.js'
);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const sha256File = file => sha256(fs.readFileSync(file));

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`local server exited before startup (${child.exitCode})`);
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // A bounded readiness loop is intentionally quiet.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

function stopProcess(child) {
    if (!child || child.exitCode !== null || child.killed) return Promise.resolve();
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
        }, 3_000);
        timer.unref();
        child.once('exit', () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill();
    });
}

async function readDownload(download) {
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function extractPdfText(pdfBytes) {
    const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(pdfBytes),
        disableWorker: true,
        isEvalSupported: false
    });
    const document = await loadingTask.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        pages.push(textContent.items.map(item => item.str).join(' '));
    }
    await document.destroy();
    return { numPages: pages.length, text: pages.join('\n') };
}

test('H1 dependency manifest pins every local runtime asset and license', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.stage, 'H1');
    assert.equal(manifest.policy.networkAtRuntime, false);
    assert.equal(manifest.policy.workerOnlyCompilation, true);
    assert.equal(manifest.policy.productionMainPageLoadsAssets, false);
    assert.equal(new Set(manifest.packages.map(item => `${item.name}@${item.version}`)).size, 5);

    for (const asset of manifest.runtimeAssets) {
        const absolute = path.resolve(ROOT, asset.path);
        assert.ok(absolute.startsWith(ROOT + path.sep), `${asset.path} stays inside the repository`);
        assert.equal(fs.existsSync(absolute), true, `${asset.path} exists`);
        assert.equal(fs.statSync(absolute).size, asset.bytes, `${asset.path} byte size`);
        assert.equal(sha256File(absolute), asset.sha256, `${asset.path} digest`);
    }

    for (const license of manifest.licenseFiles) {
        const absolute = path.resolve(ROOT, license);
        assert.equal(fs.existsSync(absolute), true, `${license} exists`);
        assert.ok(fs.statSync(absolute).size > 1_000, `${license} is non-empty`);
    }
});

test('H1 document builder is structured, deterministic, and maps every proof formula', async () => {
    const moduleUrl = pathToFileURL(path.join(PROTOTYPE_ROOT, 'proof-document.mjs')).href;
    const { buildProofDocument } = await import(moduleUrl);
    const valid = buildProofDocument();
    const repeated = buildProofDocument();
    const invalid = buildProofDocument({ invalidFormula: true });

    assert.equal(valid.source, repeated.source);
    assert.ok(valid.source.includes('#import "/mitex/lib.typ": mi, mitex'));
    assert.ok(valid.source.includes('\\begin{cases}'));
    assert.ok(valid.source.includes('\\begin{pmatrix}'));
    assert.ok(valid.source.includes('/assets/coordinate-system.svg'));
    assert.ok(valid.source.includes('#pagebreak()'));
    assert.ok(valid.lineMap.some(item => item.formulaId === 'formula-piecewise'));
    assert.ok(valid.lineMap.some(item => item.formulaId === 'formula-matrix'));
    assert.ok(invalid.lineMap.some(item => item.formulaId === 'formula-bad'));
    assert.notEqual(valid.source, invalid.source);
    assert.equal(valid.expected.minimumPages, 2);
});

test('H1 worker contract rejects malformed requests and diagnostics retain block/formula identity', async () => {
    const contractUrl = pathToFileURL(path.join(PROTOTYPE_ROOT, 'runtime-contract.mjs')).href;
    const diagnosticsUrl = pathToFileURL(path.join(PROTOTYPE_ROOT, 'diagnostics.mjs')).href;
    const { validateCompileRequest, WORKER_MESSAGE } = await import(contractUrl);
    const { normalizeCompilerDiagnostics } = await import(diagnosticsUrl);

    const lineMap = [{
        path: '/main.typ',
        blockId: 'piecewise',
        formulaId: 'formula-bad',
        startLine: 20,
        endLine: 28
    }];
    const request = validateCompileRequest({
        type: WORKER_MESSAGE.compile,
        requestId: 'h1-contract',
        source: '#(formula-bad-symbol)',
        lineMap
    });
    assert.equal(request.requestId, 'h1-contract');
    assert.throws(() => validateCompileRequest({
        type: WORKER_MESSAGE.compile,
        requestId: '../escape',
        source: 'x',
        lineMap
    }), /request id/i);
    assert.throws(() => validateCompileRequest({
        type: WORKER_MESSAGE.compile,
        requestId: 'h1-empty',
        source: '',
        lineMap
    }), /must not be empty/i);

    const [diagnostic] = normalizeCompilerDiagnostics([{
        path: '/main.typ',
        severity: 'error',
        range: '26:3-26:21',
        message: 'unknown variable'
    }], lineMap);
    assert.equal(diagnostic.blockId, 'piecewise');
    assert.equal(diagnostic.formulaId, 'formula-bad');
    assert.match(diagnostic.display, /formula-bad/);
    assert.match(diagnostic.display, /piecewise/);
});

test('H1 browser compiles locally in a Worker, exports the preview bytes, and fails closed', {
    timeout: 180_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;
    let context;
    const requestedPaths = new Set();
    const externalRequests = [];
    const badResponses = [];
    const pageErrors = [];
    const consoleErrors = [];

    try {
        await waitForServer(origin, server);

        for (const pathname of [
            '/vendor/typst/0.7.0/typst_ts_web_compiler_bg.wasm',
            '/vendor/mitex/0.2.7/mitex.wasm'
        ]) {
            const response = await fetch(origin + pathname);
            assert.equal(response.ok, true, pathname);
            assert.match(response.headers.get('content-type') || '', /application\/wasm/i);
        }

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ acceptDownloads: true });
        await context.route('**/*', route => {
            const requestUrl = new URL(route.request().url());
            if (
                (requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:')
                && requestUrl.origin !== origin
            ) {
                externalRequests.push(requestUrl.href);
                return route.abort('blockedbyclient');
            }
            if (requestUrl.origin === origin) requestedPaths.add(requestUrl.pathname);
            return route.continue();
        });

        const page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        page.on('response', response => {
            if (response.url().startsWith(origin) && response.status() >= 400) {
                badResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
            }
        });

        await page.goto(origin + PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-role="state"][data-state="ready"]').waitFor({
            state: 'visible',
            timeout: 120_000
        });

        const previewState = await page.evaluate(() => ({
            hasPdf: window.__TEX_H1_PROOF__.hasPdf(),
            pdfByteLength: window.__TEX_H1_PROOF__.pdfByteLength(),
            iframeSource: document.querySelector('[data-role="preview"]').getAttribute('src'),
            downloadDisabled: document.querySelector('[data-action="download"]').disabled,
            bytes: Array.from(window.__TEX_H1_PROOF__.copyPdfBytes())
        }));
        const pdfBytes = Buffer.from(previewState.bytes);
        assert.equal(previewState.hasPdf, true);
        assert.equal(previewState.pdfByteLength, pdfBytes.length);
        assert.match(previewState.iframeSource, /^blob:/);
        assert.equal(previewState.downloadDisabled, false);
        assert.equal(pdfBytes.subarray(0, 5).toString('ascii'), '%PDF-');

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.locator('[data-action="download"]').click()
        ]);
        const downloadedBytes = await readDownload(download);
        assert.equal(sha256(downloadedBytes), sha256(pdfBytes));
        if (process.env.QISI_H1_WRITE_EVIDENCE === '1') {
            const evidenceDirectory = path.join(ROOT, 'tmp', 'pdfs');
            fs.mkdirSync(evidenceDirectory, { recursive: true });
            fs.writeFileSync(path.join(evidenceDirectory, 'h1-proof.pdf'), downloadedBytes);
        }

        const pdfEvidence = await extractPdfText(pdfBytes);
        const compactPdfText = pdfEvidence.text.replace(/[\u0000-\u0020]+/g, '');
        assert.ok(pdfEvidence.numPages >= 2, `expected 2+ pages, got ${pdfEvidence.numPages}`);
        for (const token of [
            'TEX题库讲义排版验证',
            '浏览器 Typst',
            '中文与行内公式',
            '第二页与长文档',
            '本地 SVG 坐标示意图'
        ]) {
            const compactToken = token.replace(/\s+/g, '');
            assert.ok(compactPdfText.includes(compactToken), `PDF text contains ${token}`);
        }
        assert.match(compactPdfText, /第1页/);
        assert.match(compactPdfText, /第2页/);

        await page.locator('[data-action="compile-invalid"]').click();
        await page.locator('[data-role="state"][data-state="failed"]').waitFor({
            state: 'visible',
            timeout: 30_000
        });
        const failedState = await page.evaluate(() => ({
            hasPdf: window.__TEX_H1_PROOF__.hasPdf(),
            iframeSource: document.querySelector('[data-role="preview"]').getAttribute('src'),
            downloadDisabled: document.querySelector('[data-action="download"]').disabled,
            diagnostic: document.querySelector('[data-role="diagnostics"]').textContent
        }));
        assert.equal(failedState.hasPdf, false);
        assert.equal(failedState.iframeSource, null);
        assert.equal(failedState.downloadDisabled, true);
        assert.match(failedState.diagnostic, /formula-bad/);
        assert.match(failedState.diagnostic, /piecewise/);

        assert.ok(requestedPaths.has('/vendor/typst/0.7.0/typst-all-in-one-lite.mjs'));
        assert.ok(requestedPaths.has('/vendor/typst/0.7.0/typst_ts_web_compiler_bg.wasm'));
        assert.ok(requestedPaths.has('/vendor/mitex/0.2.7/mitex.wasm'));
        assert.ok(requestedPaths.has(
            '/vendor/typst/fonts/noto-serif-cjk-sc-2.003/NotoSerifCJKsc-Regular.otf'
        ));

        const mainPageH1Requests = [];
        const mainPage = await context.newPage();
        mainPage.on('request', request => {
            const pathname = new URL(request.url()).pathname;
            if (
                pathname.startsWith('/vendor/typst/')
                || pathname.startsWith('/vendor/mitex/')
                || pathname.startsWith('/prototypes/handout-typst/')
            ) {
                mainPageH1Requests.push(pathname);
            }
        });
        await mainPage.goto(`${origin}/main.html`, { waitUntil: 'domcontentloaded' });
        await mainPage.locator('aside.sidebar nav').waitFor({
            state: 'visible',
            timeout: 30_000
        });
        assert.deepEqual(mainPageH1Requests, []);

        assert.deepEqual(externalRequests, []);
        assert.deepEqual(badResponses, []);
        assert.deepEqual(pageErrors, []);
        assert.deepEqual(consoleErrors, []);
    } catch (error) {
        error.message += `\nlocal server output:\n${serverOutput.join('')}`;
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});
