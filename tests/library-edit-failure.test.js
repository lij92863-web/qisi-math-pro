'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

const NAV_LIBRARY = '\u9898\u5e93\u4e0e\u68c0\u7d22';
const SEARCH_PLACEHOLDER = '\u641c\u7d22\u9898\u5e72\u3001\u7b54\u6848\u3001\u89e3\u6790';
const EDIT_CARD = '\u7f16\u8f91';
const CONFIRM_UPDATE = '\u786e\u8ba4\u66f4\u65b0';
const SOURCE_PLACEHOLDER = '\u5728\u6b64\u4fee\u6539 LaTeX \u6e90\u7801...';
const ORIGINAL_MARKER = '\u5931\u8d25\u6ce8\u5165\u539f\u9898';
const EDITED_MARKER = '\u5931\u8d25\u6ce8\u5165\u4fee\u6539';

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            probe.close(error => error ? reject(error) : resolve(port));
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
        } catch (_) {
            // bounded readiness loop
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

// A failed write must never look like a successful edit: the page would then disagree with the
// database and the change would silently disappear on reload.
test('a failed library edit is reported and the page returns to the stored value', {
    timeout: 120_000
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
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        const page = await context.newPage();
        const dialogs = [];
        page.on('dialog', dialog => {
            dialogs.push(dialog.message());
            dialog.dismiss().catch(() => {});
        });

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        await page.evaluate(async marker => {
            const database = window.Qisi.Database.getDatabase();
            await Promise.all(database.tables.map(table => table.clear()));
            const now = Date.now();
            await database.questions.put({
                id: 'edit-failure-question',
                createdAt: now,
                updatedAt: now,
                grade: '\u9ad8\u4e8c',
                type: '\u5355\u9009\u9898',
                diff: '\u4e2d\u7b49',
                systemKnowledge: '\u96c6\u5408',
                knowledge: '\u96c6\u5408',
                stem: `${marker} $x=1$`,
                options: ['1', '2', '3', '4'],
                answer: 'A',
                solution: '\u539f\u89e3\u6790',
                images: []
            });
        }, ORIGINAL_MARKER);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });

        await navigation.getByRole('button', { name: NAV_LIBRARY, exact: true }).click();
        const libraryRoot = page.locator('.library-layout');
        await libraryRoot.waitFor({ state: 'visible' });
        await libraryRoot.getByPlaceholder(SEARCH_PLACEHOLDER, { exact: true }).fill(ORIGINAL_MARKER);
        // The database was cleared, so this is the only card. A text filter would stop matching as
        // soon as the stem moves into the edit textarea.
        const card = libraryRoot.locator('.question-card').first();
        await card.waitFor({ state: 'visible', timeout: 20_000 });
        assert.match(await card.innerText(), new RegExp(ORIGINAL_MARKER));

        const injected = await page.evaluate(() => {
            const database = window.Qisi.Database.getDatabase();
            const original = database.questions.put.bind(database.questions);
            window.__qisiOriginalPut = original;
            let injectedOnce = false;
            database.questions.put = async (...args) => {
                if (!injectedOnce) {
                    injectedOnce = true;
                    throw new Error('injected write failure');
                }
                return original(...args);
            };
            return true;
        });
        assert.equal(injected, true, 'fault injection must be installed');

        await card.getByRole('button', { name: EDIT_CARD, exact: true }).click();
        const editor = card.getByPlaceholder(SOURCE_PLACEHOLDER, { exact: true });
        await editor.waitFor({ state: 'visible' });
        await editor.fill(`${EDITED_MARKER} $x=2$`);
        await card.getByRole('button', { name: CONFIRM_UPDATE, exact: true }).click();

        // The failure must be reported to the teacher.
        const deadline = Date.now() + 10_000;
        while (!dialogs.length && Date.now() < deadline) {
            await page.waitForTimeout(200);
        }
        assert.ok(
            dialogs.some(message => /修改未保存/.test(message)),
            `the failed edit must be reported, saw: ${JSON.stringify(dialogs)}`
        );

        await page.waitForTimeout(500);
        const stored = await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            const row = await database.questions.get('edit-failure-question');
            return String(row?.stem || '');
        });
        assert.match(stored, new RegExp(ORIGINAL_MARKER), 'the database must still hold the original stem');

        const cardText = await card.innerText();
        assert.match(
            cardText,
            new RegExp(ORIGINAL_MARKER),
            'the card must return to the stored value instead of showing an edit that was never saved'
        );
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});
