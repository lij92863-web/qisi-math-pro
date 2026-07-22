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
    templateHeading: '\u6a21\u677f\u9884\u8bbe\u5e93',
    systemPicker: '\u9009\u62e9\u7cfb\u7edf\u8282\u70b9',
    personalPicker: '\u9009\u62e9\u4e2a\u4eba\u8282\u70b9',
    stemTab: '\u9898\u5e72',
    answerTab: '\u7b54\u6848',
    solutionTab: '\u89e3\u6790',
    librarySearch: '\u641c\u7d22\u9898\u5e72\u3001\u7b54\u6848\u3001\u89e3\u6790',
    resetFilters: '\u91cd\u7f6e\u7b5b\u9009',
    onlyQuestions: '\u53ea\u6253\u5370\u9898\u76ee',
    withAnswers: '\u4e00\u4efd PDF\uff1a\u9898\u76ee\u540e\u53e6\u8d77\u65b0\u9875\u5370\u7b54\u6848',
    splitPdf: '\u4e24\u4efd PDF\uff1a\u9898\u76ee\u548c\u7b54\u6848\u5206\u5f00'
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

        await navigation.getByRole('button', { name: TEXT.entry, exact: true }).click();
        const entryRoot = page.locator('.entry-layout');
        const systemPicker = entryRoot.getByRole('button', { name: TEXT.systemPicker, exact: true });
        const personalPicker = entryRoot.getByRole('button', { name: TEXT.personalPicker, exact: true });
        await systemPicker.click();
        assert.equal(await entryRoot.locator('.knowledge-cascader:visible').count(), 1);
        await personalPicker.click();
        assert.equal(
            await entryRoot.locator('.knowledge-cascader:visible').count(),
            1,
            'one click must switch directly from the system picker to the personal picker'
        );
        await personalPicker.click();
        assert.equal(await entryRoot.locator('.knowledge-cascader:visible').count(), 0);

        for (const [tabName, fieldName] of [
            [TEXT.answerTab, 'answer'],
            [TEXT.solutionTab, 'solution'],
            [TEXT.stemTab, 'stem']
        ]) {
            await entryRoot.getByRole('button', { name: tabName, exact: true }).click();
            assert.match(
                await entryRoot.locator('textarea.textarea-code').getAttribute('placeholder') || '',
                new RegExp(`\uff1a${fieldName}`)
            );
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

        const libraryRoot = page.locator('.library-layout');
        const librarySearch = libraryRoot.getByPlaceholder(TEXT.librarySearch, { exact: true });
        const librarySelects = libraryRoot.locator('select');
        assert.equal(await librarySelects.count(), 5);
        await librarySearch.fill('R9E-filter-probe');
        await librarySelects.nth(0).selectOption({ label: '\u5355\u9009\u9898' });
        await librarySelects.nth(1).selectOption({ label: '\u8f83\u96be' });
        await librarySelects.nth(2).selectOption({ label: '\u9ad8\u4e8c' });
        await librarySelects.nth(3).selectOption({ label: '\u6709\u89e3\u6790' });
        await librarySelects.nth(4).selectOption({ label: '\u6709\u56fe\u7247' });
        await libraryRoot.getByRole('button', { name: TEXT.resetFilters, exact: true }).click();
        assert.equal(await librarySearch.inputValue(), '');
        assert.deepEqual(
            await librarySelects.evaluateAll(nodes => nodes.map(node => node.value)),
            ['', '', '', '', '']
        );

        await navigation.getByRole('button', { name: TEXT.exam, exact: true }).click();
        const examRoot = page.locator('.exam-builder');
        for (const mode of [TEXT.withAnswers, TEXT.splitPdf, TEXT.onlyQuestions]) {
            const modeButton = examRoot.getByRole('button', { name: mode, exact: true });
            await modeButton.click();
            assert.match(await modeButton.getAttribute('class') || '', /border-\[#22a039\]/);
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
