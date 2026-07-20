const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TEXT = {
    entry: '\u65b0\u9898\u76ee\u5f55\u5165',
    entryHeading: '\u9898\u76ee\u5f55\u5165\u5f15\u64ce',
    batch: '\u6279\u91cf\u5f55\u9898',
    createTask: '\u521b\u5efa\u4efb\u52a1',
    createBatchHeading: '\u521b\u5efa\u6279\u91cf\u5f55\u9898\u4efb\u52a1',
    backToList: '\u8fd4\u56de\u5217\u8868',
    recentTasks: '\u6700\u8fd1\u8bc6\u522b\u4efb\u52a1',
    library: '\u9898\u5e93\u4e0e\u68c0\u7d22',
    knowledgeFilter: '\u77e5\u8bc6\u70b9\u7b5b\u9009',
    systemKnowledge: '\u7cfb\u7edf\u77e5\u8bc6\u70b9',
    personalKnowledge: '\u4e2a\u4eba\u77e5\u8bc6\u70b9',
    externalLibrary: '\u5916\u90e8\u9898\u5e93',
    exam: '\u667a\u80fd\u7ec4\u5377\u53f0',
    examHeading: '\u5feb\u901f\u7ec4\u5377',
    personal: '\u4e2a\u4eba\u7ba1\u7406',
    personalHeading: '\u4e2a\u4eba\u77e5\u8bc6\u70b9\u7ba1\u7406',
    template: '\u6781\u5ba2\u6392\u7248\u914d\u7f6e',
    templateHeading: '\u6a21\u677f\u9884\u8bbe\u5e93'
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

async function waitForServer(origin, processState) {
    const deadline = Date.now() + 20_000;
    let lastError = null;

    while (Date.now() < deadline) {
        if (processState.exitCode !== null) {
            throw new Error('local server exited before startup (' + processState.exitCode + ')');
        }

        try {
            const response = await fetch(origin + '/api/health', {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
            lastError = new Error('health endpoint returned ' + response.status);
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('local server did not become ready: ' + (lastError?.message || 'timeout'));
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

function isForbiddenAiOrOcrRequest(url) {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname === '/api/ai'
        || pathname.startsWith('/api/ai/')
        || pathname === '/api/ocr'
        || pathname.startsWith('/api/ocr/');
}

test('top-level application views remain navigable in an isolated browser context', {
    timeout: 90_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;
    let context;
    const forbiddenRequests = [];
    const pageErrors = [];
    const consoleErrors = [];

    try {
        await waitForServer(origin, server);

        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            viewport: { width: 1440, height: 900 }
        });

        await context.route('**/*', route => {
            const requestUrl = route.request().url();
            if (isForbiddenAiOrOcrRequest(requestUrl)) {
                forbiddenRequests.push(requestUrl);
                return route.abort('blockedbyclient');
            }
            return route.continue();
        });

        const page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        const views = [
            { button: TEXT.entry, root: '.entry-layout', heading: TEXT.entryHeading },
            { button: TEXT.batch, root: '.batch-import-page', heading: TEXT.batch },
            { button: TEXT.library, root: '.library-layout', heading: TEXT.knowledgeFilter },
            { button: TEXT.exam, root: '.exam-builder', heading: TEXT.examHeading },
            { button: TEXT.personal, root: '.personal-layout', heading: TEXT.personalHeading },
            { button: TEXT.template, root: '.template-layout', heading: TEXT.templateHeading }
        ];

        for (const view of views) {
            const navButton = navigation.getByRole('button', {
                name: view.button,
                exact: true
            });
            await navButton.click();
            await page.locator(view.root).waitFor({ state: 'visible' });
            await page.locator(view.root).getByText(view.heading, { exact: true }).first()
                .waitFor({ state: 'visible' });
            assert.match(await navButton.getAttribute('class'), /(?:^|\s)active(?:\s|$)/,
                view.button + ' should be the active navigation item');
        }

        await navigation.getByRole('button', { name: TEXT.batch, exact: true }).click();
        await page.locator('.batch-import-page')
            .getByRole('button', { name: TEXT.createTask, exact: true }).click();
        await page.getByText(TEXT.createBatchHeading, { exact: true }).waitFor({ state: 'visible' });
        await page.locator('.batch-import-page')
            .getByRole('button', { name: TEXT.backToList, exact: true }).click();
        await page.getByText(TEXT.recentTasks, { exact: true }).waitFor({ state: 'visible' });

        await navigation.getByRole('button', { name: TEXT.library, exact: true }).click();
        for (const mode of [TEXT.personalKnowledge, TEXT.externalLibrary, TEXT.systemKnowledge]) {
            const modeButton = page.locator('.library-filter-sidebar')
                .getByRole('button', { name: mode, exact: true });
            await modeButton.click();
            assert.match(await modeButton.getAttribute('class') || '', /(?:^|\s)active(?:\s|$)/,
                mode + ' filter should become active');
        }

        await page.waitForTimeout(100);
        assert.deepEqual(forbiddenRequests, [], 'navigation must not attempt AI/OCR requests');
        assert.deepEqual(pageErrors, [], 'navigation must not raise page errors');
        assert.deepEqual(consoleErrors, [], 'navigation must not log error-level console messages');
    } catch (error) {
        error.message += '\nlocal server output:\n' + serverOutput.join('');
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});
