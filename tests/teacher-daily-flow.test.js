'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

const NAV_ENTRY = '\u65b0\u9898\u76ee\u5f55\u5165';
const NAV_LIBRARY = '\u9898\u5e93\u4e0e\u68c0\u7d22';
const NAV_EXAM = '\u667a\u80fd\u7ec4\u5377\u53f0';
const TAB_STEM = '\u9898\u5e72';
const TAB_ANSWER = '\u7b54\u6848';
const TAB_SOLUTION = '\u89e3\u6790';
const SAVE_TO_BANK = '\u786e\u8ba4\u65e0\u8bef\uff0c\u4fdd\u5b58\u5165\u5e93';
const EDIT_CARD = '\u7f16\u8f91';
const CONFIRM_UPDATE = '\u786e\u8ba4\u66f4\u65b0';
const REVEAL_ANSWER = '\u89e3\u6790';
const PICK_QUESTION = '\u9009\u9898';
const PRINT_BUTTON = '\u6253\u5370 PDF';
const SEARCH_PLACEHOLDER = '\u641c\u7d22\u9898\u5e72\u3001\u7b54\u6848\u3001\u89e3\u6790';
const SOURCE_PLACEHOLDER = '\u5728\u6b64\u4fee\u6539 LaTeX \u6e90\u7801...';

const MARKER = '\u8001\u5e08\u65e5\u5e38\u6d41\u7a0b\u9a8c\u6536';
const EDIT_MARKER = '\u7f16\u8f91\u540e\u7684\u9898\u5e72';

const STEM_SOURCE = [
    `${MARKER}：已知集合 $A=\\{x\\mid x^2-3x+2\\le 0\\}$，则下列结论正确的是（    ）`,
    'A. $x\\in(0,+\\infty)$',
    'B. $\\frac{1}{2}$',
    'C. $\\sqrt{3}$',
    'D. $x\\in[1,2]$'
].join('\n');

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

async function readVisibleSurface(page, selector) {
    return page.evaluate(rootSelector => {
        const root = document.querySelector(rootSelector);
        if (!root) return { missingRoot: true };
        const suspect = /\\(?:frac|dfrac|sqrt|left|right|begin\{|\$)/u;
        const leaks = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const parent = node.parentElement;
            if (parent && !parent.closest('.katex-mathml, annotation, script, style, textarea, input')) {
                const value = String(node.nodeValue || '').trim();
                if (value && suspect.test(value)) leaks.push(value.slice(0, 80));
            }
            node = walker.nextNode();
        }
        return {
            katex: root.querySelectorAll('.katex').length,
            options: root.querySelectorAll('.gaokao-option').length,
            leaks
        };
    }, selector);
}

test('a teacher can enter, find, edit, reload and print a question in one session', {
    timeout: 120_000
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
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
                return route.abort('blockedbyclient');
            }
            if (url.pathname.startsWith('/api/ai/') || url.pathname.startsWith('/api/ocr')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ choices: [{ message: { content: '{"questions":[]}' } }] })
                });
            }
            return route.continue();
        });
        const page = await context.newPage();
        const pageErrors = [];
        const consoleErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        // 1. Enter a question by hand, exactly as a teacher would.
        await navigation.getByRole('button', { name: NAV_ENTRY, exact: true }).click();
        const entryRoot = page.locator('.entry-layout');
        await entryRoot.waitFor({ state: 'visible' });
        // The entry grid order is 年级 / 题型 / 难度, so the question type is the second select.
        await entryRoot.locator('select').nth(1).selectOption({ label: '\u5355\u9009\u9898' });
        await entryRoot.getByRole('button', { name: TAB_STEM, exact: true }).click();
        await entryRoot.locator('textarea.textarea-code').fill(STEM_SOURCE);
        await entryRoot.getByRole('button', { name: TAB_ANSWER, exact: true }).click();
        await entryRoot.locator('textarea.textarea-code').fill('B');
        await entryRoot.getByRole('button', { name: TAB_SOLUTION, exact: true }).click();
        await entryRoot.locator('textarea.textarea-code').fill(
            '\u7531 $x^2-3x+2\\le 0$ \u5f97 $A=[1,2]$\uff0c\u6545\u9009 B\u3002'
        );
        await page.getByRole('button', { name: SAVE_TO_BANK, exact: true }).click();

        // 2. Find it in the library, with its options rendered.
        await navigation.getByRole('button', { name: NAV_LIBRARY, exact: true }).click();
        const libraryRoot = page.locator('.library-layout');
        await libraryRoot.waitFor({ state: 'visible' });
        await libraryRoot.getByPlaceholder(SEARCH_PLACEHOLDER, { exact: true }).fill(MARKER);
        const card = libraryRoot.locator('.question-card').filter({ hasText: MARKER }).first();
        await card.waitFor({ state: 'visible', timeout: 20_000 });
        await card.locator('.katex').first().waitFor({ state: 'attached', timeout: 20_000 });

        const entered = await readVisibleSurface(page, '.library-layout');
        assert.deepEqual(entered.leaks, [], 'the entered question must not show raw LaTeX');
        assert.equal(entered.options, 4, 'the four options must survive entry and storage');
        assert.ok(entered.katex >= 4, `expected the stem and options to render, saw ${entered.katex}`);

        // 3. Edit it through the card editor.
        await card.getByRole('button', { name: EDIT_CARD, exact: true }).click();
        const editor = card.getByPlaceholder(SOURCE_PLACEHOLDER, { exact: true });
        await editor.waitFor({ state: 'visible' });
        await editor.fill(`${EDIT_MARKER}：${STEM_SOURCE}`);
        await card.getByRole('button', { name: CONFIRM_UPDATE, exact: true }).click();
        await card.getByText(EDIT_MARKER, { exact: false }).first().waitFor({ state: 'visible', timeout: 20_000 });

        // The card renders the edit before the asynchronous write commits, so wait for the stored
        // value rather than racing the next navigation against it.
        const readStoredEdit = () => page.evaluate(async marker => {
            const database = window.Qisi.Database.getDatabase();
            const rows = await database.questions.toArray();
            const row = rows.find(item => String(item.stem || '').includes(marker.slice(0, 4)));
            return {
                count: rows.length,
                hasEdit: Boolean(row) && String(row.stem || '').includes(marker),
                stemHead: String(row?.stem || '').slice(0, 60)
            };
        }, EDIT_MARKER);

        let storedAfterEdit = await readStoredEdit();
        const storedDeadline = Date.now() + 15_000;
        while (!storedAfterEdit.hasEdit && Date.now() < storedDeadline) {
            await page.waitForTimeout(200);
            storedAfterEdit = await readStoredEdit();
        }

        // 4. Reload and confirm the edit survived, which is what "state after re-entering" means.
        assert.equal(
            storedAfterEdit.hasEdit,
            true,
            `the card edit never reached the database: ${JSON.stringify(storedAfterEdit)}`
            + ` | pageErrors: ${JSON.stringify(pageErrors)}`
            + ` | consoleErrors: ${JSON.stringify(consoleErrors.slice(0, 3))}`
        );
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await navigation.getByRole('button', { name: NAV_LIBRARY, exact: true }).click();
        const reloadedRoot = page.locator('.library-layout');
        await reloadedRoot.waitFor({ state: 'visible' });
        await reloadedRoot.getByPlaceholder(SEARCH_PLACEHOLDER, { exact: true }).fill(MARKER);
        const reloadedCard = reloadedRoot.locator('.question-card').filter({ hasText: MARKER }).first();
        await reloadedCard.waitFor({ state: 'visible', timeout: 20_000 });
        assert.match(
            await reloadedCard.innerText(),
            new RegExp(EDIT_MARKER),
            'the edited stem must still be there after a reload'
        );
        await reloadedCard.getByRole('button', { name: REVEAL_ANSWER, exact: true }).click();
        const reloaded = await readVisibleSurface(page, '.library-layout');
        assert.deepEqual(reloaded.leaks, [], 'the reloaded question must not show raw LaTeX');

        // 5. Use it in an exam and print it.
        await reloadedCard.getByRole('button', { name: PICK_QUESTION, exact: true }).click();
        await navigation.getByRole('button', { name: NAV_EXAM, exact: true }).click();
        const examRoot = page.locator('.exam-builder');
        await examRoot.waitFor({ state: 'visible' });
        await examRoot.locator('.katex').first().waitFor({ state: 'attached', timeout: 20_000 });
        assert.match(await examRoot.innerText(), new RegExp(EDIT_MARKER), 'the exam must contain the question');

        await page.evaluate(() => {
            window.__qisiPrintHtml = [];
            const original = URL.createObjectURL.bind(URL);
            URL.createObjectURL = blob => {
                try {
                    if (String(blob?.type || '').includes('html')) {
                        blob.text().then(text => window.__qisiPrintHtml.push(text));
                    }
                } catch (_) {
                    // capture is best effort
                }
                return original(blob);
            };
        });
        await examRoot.getByRole('button', { name: PRINT_BUTTON, exact: true }).click();
        await page.waitForFunction(
            () => (window.__qisiPrintHtml || []).some(text => /<html|<!DOCTYPE/i.test(text)),
            null,
            { timeout: 30_000 }
        );
        const printHtml = await page.evaluate(() => (window.__qisiPrintHtml || [])
            .find(text => /<html|<!DOCTYPE/i.test(text)) || '');
        assert.match(printHtml, new RegExp(MARKER), 'the printed paper must contain the question');
        assert.match(printHtml, /katex/, 'the printed paper must contain rendered formulas');

        assert.deepEqual(pageErrors, [], `page errors: ${serverOutput.join('').slice(-300)}`);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});
