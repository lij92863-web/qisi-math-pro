const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ENTRY_BUTTON = '\u65b0\u9898\u76ee\u5f55\u5165';
const VIEW_ROOTS = {
    entry: '.entry-layout',
    batchImport: '.batch-import-page',
    library: '.library-layout',
    exam: '.exam-builder',
    personal: '.personal-layout',
    template: '.template-layout'
};

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
        if (child.exitCode !== null) throw new Error('local server exited before startup');
        try {
            const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1_000) });
            if (response.ok) return;
        } catch {
            // retry until the deadline
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

function visibleViews(page) {
    return page.evaluate(roots => Object.entries(roots)
        .filter(([, selector]) => {
            const node = document.querySelector(selector);
            return Boolean(node) && node.offsetParent !== null;
        })
        .map(([name]) => name), VIEW_ROOTS);
}

test('the remembered view never overwrites a navigation the teacher already clicked', {
    timeout: 60_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});

    let browser;
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        // Make the first awaited startup step slow. This is the same situation as a slow
        // database load, and it is what let the startup restore reach past a user click.
        await page.addInitScript(() => {
            try {
                Object.defineProperty(navigator.storage, 'persist', {
                    configurable: true,
                    value: () => new Promise(resolve => setTimeout(resolve, 1500))
                });
            } catch {
                // A browser without a patchable storage manager keeps the fast path.
            }
        });

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });
        await page.evaluate(() => window.localStorage.setItem('qisi_last_view', 'library'));

        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.getByRole('button', { name: ENTRY_BUTTON, exact: true }).click();
        await page.waitForTimeout(2_600);
        assert.deepEqual(
            await visibleViews(page),
            ['entry'],
            'a startup restore must not take away the view the teacher just opened'
        );

        await page.evaluate(() => window.localStorage.setItem('qisi_last_view', 'library'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await page.waitForTimeout(2_600);
        assert.deepEqual(
            await visibleViews(page),
            ['library'],
            'the remembered view must still be restored when nothing was clicked'
        );

        assert.deepEqual(pageErrors, []);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});
