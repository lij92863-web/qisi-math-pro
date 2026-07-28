'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const startupGuard = require('../qisi-startup-guard.js');

const ROOT = path.resolve(__dirname, '..');
const MAIN_HTML = path.join(ROOT, 'main.html');
const GUARD_PATH = path.join(ROOT, 'qisi-startup-guard.js');

const reserveLoopbackPort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(error => {
            if (error) reject(error);
            else resolve(address.port);
        });
    });
});

const waitForServer = async (origin, child) => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(`local server exited before startup (${child.exitCode})`);
        }
        try {
            const response = await fetch(`${origin}/api/health`);
            if (response.ok) return;
        } catch (_) {
            // The bounded readiness loop is intentionally quiet.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
};

test('startup guard classifies resource, script, rejection, and timeout failures without leaking full URLs', () => {
    assert.equal(
        startupGuard.assetNameFromUrl('http://127.0.0.1:3000/vendor/vue.js?v=1'),
        'vue.js'
    );
    assert.deepEqual(
        startupGuard.describeWindowError({
            target: {
                tagName: 'SCRIPT',
                src: 'http://127.0.0.1:3000/vendor/vue.js?v=1'
            }
        }),
        {
            code: 'RESOURCE_LOAD_FAILED',
            title: 'TEX题库启动资源加载失败',
            message: '关键文件“vue.js”未能加载。',
            detail: '请确认本地服务已完全启动，然后重新加载页面。'
        }
    );
    assert.equal(
        startupGuard.describeWindowError({ message: 'boot exploded' }).code,
        'STARTUP_SCRIPT_ERROR'
    );
    assert.equal(
        startupGuard.describeUnhandledRejection({ reason: new Error('async exploded') }).code,
        'STARTUP_PROMISE_REJECTION'
    );
    assert.equal(startupGuard.normalizeFailure('x'.repeat(800)).message.length, 500);
});

test('main page always has a visible startup shell and installs the guard before every dependency', () => {
    const html = fs.readFileSync(MAIN_HTML, 'utf8');
    const guardIndex = html.indexOf('qisi-startup-guard.js');
    const firstVendorIndex = html.indexOf('vendor/katex');
    const shellIndex = html.indexOf('id="tex-startup-shell"');

    assert.ok(guardIndex >= 0);
    assert.ok(firstVendorIndex > guardIndex);
    assert.ok(shellIndex > guardIndex);
    assert.match(html, /data-startup-state="loading"/);
    assert.match(html, /正在启动 TEX题库/);
    assert.match(html, /id="tex-startup-retry"[^>]*hidden/);
});

test('watchdog replaces a stalled empty startup with a readable recovery screen', {
    timeout: 30_000
}, async () => {
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage();
        await page.setContent(`
            <div id="app">
                <section id="tex-startup-shell" data-startup-state="loading">
                    <strong id="tex-startup-title">loading</strong>
                    <p id="tex-startup-message"></p>
                    <p id="tex-startup-detail"></p>
                    <button id="tex-startup-retry" hidden>reload</button>
                </section>
            </div>
            <script>window.__TEX_STARTUP_TIMEOUT_MS__ = 30;</script>
        `);
        await page.addScriptTag({ path: GUARD_PATH });
        await page.waitForSelector('[data-startup-state="failed"]');

        const state = await page.evaluate(() => ({
            title: document.getElementById('tex-startup-title').textContent,
            message: document.getElementById('tex-startup-message').textContent,
            retryHidden: document.getElementById('tex-startup-retry').hidden
        }));

        assert.equal(state.title, 'TEX题库启动超时');
        assert.match(state.message, /没有在规定时间内完成启动/);
        assert.equal(state.retryHidden, false);
    } finally {
        await browser.close();
    }
});

test('a missing critical browser dependency produces a readable diagnostic instead of a white page', {
    timeout: 45_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: 'ignore',
        windowsHide: true
    });
    let browser;

    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.route('**/vendor/vue/3.5.40/vue.global.prod.js', route =>
            route.abort('blockedbyclient')
        );
        await page.goto(`${origin}/main.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-startup-state="failed"]');

        const failure = await page.evaluate(() => ({
            state: document.getElementById('tex-startup-shell')?.dataset.startupState,
            title: document.getElementById('tex-startup-title')?.textContent,
            message: document.getElementById('tex-startup-message')?.textContent,
            retryVisible: !document.getElementById('tex-startup-retry')?.hidden,
            bodyTextLength: document.body.innerText.trim().length
        }));

        assert.equal(failure.state, 'failed');
        assert.equal(failure.title, 'TEX题库启动资源加载失败');
        assert.match(failure.message, /vue\.global\.prod\.js/);
        assert.equal(failure.retryVisible, true);
        assert.ok(failure.bodyTextLength > 30);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});
