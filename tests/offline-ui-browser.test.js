'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const VENDOR_ROOT = path.join(ROOT, 'vendor');
const MAIN_HTML = path.join(ROOT, 'main.html');
const TEXT = Object.freeze({
    entry: '\u65b0\u9898\u76ee\u5f55\u5165',
    batch: '\u6279\u91cf\u5f55\u9898',
    library: '\u9898\u5e93\u4e0e\u68c0\u7d22',
    exam: '\u667a\u80fd\u7ec4\u5377\u53f0',
    personal: '\u4e2a\u4eba\u7ba1\u7406',
    template: '\u6781\u5ba2\u6392\u7248\u914d\u7f6e'
});

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

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
    let lastError = null;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`local server exited before startup (${child.exitCode})`);
        }
        try {
            const response = await fetch(origin + '/api/health', {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
            lastError = new Error(`health endpoint returned ${response.status}`);
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`local server did not become ready: ${lastError?.message || 'timeout'}`);
}

function stopProcess(child) {
    if (!child || child.exitCode !== null || child.killed) return Promise.resolve();
    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
        }, 3_000);
        timeout.unref();
        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
        child.kill();
    });
}

function isAiOrOcrPath(url) {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname === '/api/ai'
        || pathname.startsWith('/api/ai/')
        || pathname === '/api/ocr'
        || pathname.startsWith('/api/ocr/');
}

test('production browser dependencies are complete, pinned, and locally addressed', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(VENDOR_ROOT, 'manifest.json'), 'utf8'));
    const html = fs.readFileSync(MAIN_HTML, 'utf8');
    const printTemplate = fs.readFileSync(path.join(ROOT, 'qisi-a4-exam-template.js'), 'utf8');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const requiredPackages = new Set([
        'tailwindcss',
        'katex',
        'vue',
        'vue-virtual-scroller',
        'dexie',
        'jszip',
        'pdfjs-dist',
        'lucide'
    ]);

    assert.equal(manifest.schemaVersion, 1);
    for (const asset of manifest.assets) {
        const absolute = path.resolve(VENDOR_ROOT, asset.path);
        assert.ok(absolute.startsWith(VENDOR_ROOT + path.sep), `${asset.path} stays under vendor/`);
        assert.equal(fs.existsSync(absolute), true, `${asset.path} must be checked in`);
        assert.equal(sha256(absolute), asset.sha256, `${asset.path} must match its pinned digest`);
        assert.ok(asset.path.includes('/' + asset.version + '/'), `${asset.path} must pin its version`);
        requiredPackages.delete(asset.package);
    }
    assert.deepEqual([...requiredPackages], [], 'every required browser package has a pinned asset');

    assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']https?:\/\//i);
    assert.doesNotMatch(printTemplate, /katexCssHref\s*=\s*["']https?:\/\//i);
    assert.doesNotMatch(appSource, /unpkg\.com\/pdfjs-dist/i);
    assert.equal(
        (appSource.match(/\.\/vendor\/pdfjs-dist\/3\.11\.174\/pdf\.worker\.min\.js/g) || []).length,
        3,
        'every PDF parsing path must select the checked-in worker'
    );
    assert.match(appSource, /\.\/vendor\/katex\/0\.16\.8\/katex\.min\.css/);

    const vendorReferences = [...html.matchAll(/(?:src|href)\s*=\s*["']\.\/vendor\/([^"']+)/gi)]
        .map(match => match[1].split(/[?#]/, 1)[0]);
    assert.ok(vendorReferences.length >= 11, 'main.html must load the complete local browser stack');
    for (const reference of vendorReferences) {
        assert.equal(fs.existsSync(path.join(VENDOR_ROOT, reference)), true, reference);
    }

    const katexCss = path.join(VENDOR_ROOT, 'katex', '0.16.8', 'katex.min.css');
    const css = fs.readFileSync(katexCss, 'utf8');
    const fontReferences = [...css.matchAll(/url\(([^)]+)\)/g)]
        .map(match => match[1].replace(/["']/g, ''));
    assert.ok(fontReferences.length > 0, 'KaTeX CSS must retain its font declarations');
    for (const reference of fontReferences) {
        assert.equal(fs.existsSync(path.resolve(path.dirname(katexCss), reference)), true, reference);
    }
});

test('primary UI boots and renders locally while every external HTTP request is denied', {
    timeout: 90_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
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
    const externalRequests = [];
    const aiOrOcrRequests = [];
    const badResponses = [];
    const pageErrors = [];
    const consoleErrors = [];
    const sameOriginAssets = [];

    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await context.route('**/*', route => {
            const requestUrl = route.request().url();
            const url = new URL(requestUrl);
            if (isAiOrOcrPath(requestUrl)) {
                aiOrOcrRequests.push(requestUrl);
                return route.abort('blockedbyclient');
            }
            if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== origin) {
                externalRequests.push(requestUrl);
                return route.abort('blockedbyclient');
            }
            if (url.origin === origin) sameOriginAssets.push(url.pathname);
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

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        const dependencyProbe = await page.evaluate(async () => {
            const mathHost = document.createElement('div');
            document.body.appendChild(mathHost);
            window.katex.render(String.raw`\frac{\sqrt{x}}{2}`, mathHost, { throwOnError: true });

            const utilityProbe = document.createElement('div');
            utilityProbe.className = 'hidden bg-red-500';
            document.body.appendChild(utilityProbe);
            const deadline = Date.now() + 5_000;
            while (getComputedStyle(utilityProbe).display !== 'none' && Date.now() < deadline) {
                await new Promise(resolve => setTimeout(resolve, 25));
            }
            await document.fonts.ready;

            const virtualScroller = window.VueVirtualScroller || window['vue-virtual-scroller'];
            return {
                vueVersion: window.Vue?.version,
                katexVersion: window.katex?.version,
                katexRendered: Boolean(mathHost.querySelector('.katex')),
                autoRender: typeof window.renderMathInElement,
                tailwindHidden: getComputedStyle(utilityProbe).display,
                virtualScroller: Boolean(virtualScroller?.RecycleScroller),
                dexieVersion: String(window.Dexie?.semVer || window.Dexie?.version || ''),
                jszipVersion: window.JSZip?.version,
                pdfjsVersion: window.pdfjsLib?.version,
                lucide: typeof window.lucide?.createIcons
            };
        });

        assert.deepEqual(dependencyProbe, {
            vueVersion: '3.5.40',
            katexVersion: '0.16.8',
            katexRendered: true,
            autoRender: 'function',
            tailwindHidden: 'none',
            virtualScroller: true,
            dexieVersion: '3.2.4',
            jszipVersion: '3.10.1',
            pdfjsVersion: '3.11.174',
            lucide: 'function'
        });

        const views = [
            { button: TEXT.entry, root: '.entry-layout' },
            { button: TEXT.batch, root: '.batch-import-page' },
            { button: TEXT.library, root: '.library-layout' },
            { button: TEXT.exam, root: '.exam-builder' },
            { button: TEXT.personal, root: '.personal-layout' },
            { button: TEXT.template, root: '.template-layout' }
        ];
        for (const view of views) {
            await navigation.getByRole('button', { name: view.button, exact: true }).click();
            await page.locator(view.root).waitFor({ state: 'visible' });
        }

        await page.waitForTimeout(250);
        assert.ok(sameOriginAssets.some(item => item.endsWith('/vendor/katex/0.16.8/katex.min.js')));
        assert.ok(sameOriginAssets.some(item => /\/vendor\/katex\/0\.16\.8\/fonts\/.*\.woff2$/.test(item)));
        assert.deepEqual(externalRequests, [], 'offline boot must not attempt an external HTTP request');
        assert.deepEqual(aiOrOcrRequests, [], 'offline navigation must not attempt AI/OCR');
        assert.deepEqual(badResponses, [], 'every local production asset must resolve');
        assert.deepEqual(pageErrors, [], 'offline navigation must not raise page errors');
        assert.deepEqual(consoleErrors, [], 'offline navigation must not log error-level messages');
    } catch (error) {
        error.message += '\nlocal server output:\n' + serverOutput.join('');
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});
