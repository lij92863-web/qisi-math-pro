'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = address && typeof address === 'object'
                ? address.port
                : 0;
            probe.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(
                `local server exited before startup (${child.exitCode})`
            );
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // The readiness loop is bounded and intentionally quiet.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

function stopProcess(child) {
    if (!child || child.exitCode !== null || child.killed) {
        return Promise.resolve();
    }
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

const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);

test('H3 browser completes the structured editor workflow without source writes', {
    timeout: 120_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const output = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => output.push(chunk.toString()));
    server.stderr.on('data', chunk => output.push(chunk.toString()));

    let browser;
    let context;
    const externalRequests = [];
    const requestedPaths = new Set();
    const badResponses = [];
    const pageErrors = [];
    const consoleErrors = [];

    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({
            headless: true
        });
        context = await browser.newContext({
            viewport: {
                width: 1600,
                height: 1000
            }
        });
        await context.route('**/*', route => {
            const requestUrl = new URL(route.request().url());
            if (
                ['http:', 'https:'].includes(requestUrl.protocol)
                && requestUrl.origin !== origin
            ) {
                externalRequests.push(requestUrl.href);
                return route.abort('blockedbyclient');
            }
            if (requestUrl.origin === origin) {
                requestedPaths.add(requestUrl.pathname);
            }
            return route.continue();
        });

        const page = await context.newPage();
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') {
                consoleErrors.push(message.text());
            }
        });
        page.on('response', response => {
            if (
                response.url().startsWith(origin)
                && response.status() >= 400
            ) {
                badResponses.push(
                    `${response.status()} ${new URL(response.url()).pathname}`
                );
            }
        });

        await page.goto(`${origin}/handout.html`, {
            waitUntil: 'domcontentloaded'
        });
        await page.locator('.welcome-card').waitFor({
            state: 'visible',
            timeout: 15_000
        });
        assert.equal(
            await page.evaluate(() => window.__TEX_HANDOUT_READY__),
            true
        );
        assert.equal(await page.locator('.fatal-panel').count(), 0);

        await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            await database.questions.put({
                id: 'formal-h3-question',
                createdAt: '2026-07-27T07:00:00.000Z',
                updatedAt: '2026-07-27T08:00:00.000Z',
                grade: '高二',
                type: '单选题',
                diff: '中等',
                systemKnowledge: '函数',
                stem: 'FORMAL_STEM $x^2=4$',
                options: ['1', '2', '3', '4'],
                answer: 'SECRET_BROWSER_ANSWER',
                analysis: 'SECRET_BROWSER_ANALYSIS',
                solution: 'SECRET_BROWSER_SOLUTION',
                teacherNote: 'SECRET_BROWSER_NOTE',
                images: []
            });
        });

        await page.getByTestId('new-handout').click();
        await page.getByTestId('handout-title').fill(
            'H3 browser acceptance'
        );
        await page.getByTestId('save-now').click();

        for (const testId of [
            'add-heading',
            'add-body',
            'add-callout',
            'add-page-break'
        ]) {
            await page.getByTestId(testId).click();
        }
        assert.equal(await page.locator('.editor-block').count(), 4);

        await page.getByTestId('undo').click();
        assert.equal(await page.locator('.editor-block').count(), 3);
        await page.getByTestId('redo').click();
        assert.equal(await page.locator('.editor-block').count(), 4);

        const firstBlockId = await page.locator('.editor-block')
            .first()
            .getAttribute('data-block-id');
        const firstBlock = page.locator(
            `.editor-block[data-block-id="${firstBlockId}"]`
        );
        await firstBlock.locator('button[title="复制"]').click();
        assert.equal(await page.locator('.editor-block').count(), 5);
        await page.locator(
            '.editor-block.selected button[title="删除"]'
        ).click();
        await page.getByTestId('confirm-danger').click();
        assert.equal(await page.locator('.editor-block').count(), 4);
        await page.getByTestId('undo').click();
        assert.equal(await page.locator('.editor-block').count(), 5);
        await page.getByTestId('undo').click();
        assert.equal(await page.locator('.editor-block').count(), 4);

        await page.locator(
            '.library-panel input[type="file"]'
        ).setInputFiles({
            name: 'h3-pixel.png',
            mimeType: 'image/png',
            buffer: tinyPng
        });
        await page.locator('.editor-block.block-image').waitFor({
            state: 'visible'
        });
        assert.equal(await page.locator('.editor-block').count(), 5);
        assert.equal(
            await page.locator('.editor-block.block-image img').count(),
            1
        );

        await page.getByTestId('open-global-settings').click();
        assert.equal(
            await page.getByText('页面、页眉与页脚', {
                exact: true
            }).isVisible(),
            true
        );
        const globalTabs = page.locator(
            '.inspector-panel .inspector-tabs'
        );
        for (const label of ['页眉', '页脚', '信息', '页面']) {
            const button = globalTabs.getByRole('button', {
                name: label,
                exact: true
            });
            await button.click();
            assert.equal(
                await button.evaluate(element =>
                    element.classList.contains('active')
                ),
                true
            );
        }

        await page.getByTestId('open-question-library').click();
        await page.locator(
            '[data-question-id="formal-h3-question"]'
        ).waitFor({
            state: 'visible'
        });
        await page.locator(
            '[data-question-id="formal-h3-question"]'
        ).click();
        await page.locator('.editor-block.block-question').waitFor({
            state: 'visible'
        });
        assert.equal(await page.locator('.editor-block').count(), 6);

        for (const tabId of [
            'content',
            'options',
            'images',
            'answers',
            'labels',
            'display',
            'source'
        ]) {
            await page.getByTestId(`tab-${tabId}`).click();
            assert.equal(
                await page.getByTestId(`tab-${tabId}`)
                    .evaluate(element => element.classList.contains('active')),
                true,
                `${tabId} inspector tab`
            );
        }

        await page.getByTestId('tab-content').click();
        await page.locator('.inspector-form textarea').fill(
            'LOCAL_STEM $x=2$'
        );
        assert.match(
            await page.locator(
                '.editor-block.block-question .question-stem'
            ).innerText(),
            /LOCAL_STEM/
        );

        await page.getByTestId('tab-options').click();
        await page.locator('.inspector-form select').selectOption(
            'two-columns'
        );
        assert.equal(
            await page.locator(
                '.editor-block.block-question .option-preview'
            ).evaluate(element =>
                element.style.getPropertyValue('--option-columns')
            ),
            '2'
        );

        await page.getByTestId('tab-source').click();
        await page.getByTestId('check-source-update').click();
        assert.match(
            await page.locator('.source-result').innerText(),
            /源题没有变化/
        );

        const sourceAfterEdits = await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            return database.questions.get('formal-h3-question');
        });
        assert.equal(sourceAfterEdits.stem, 'FORMAL_STEM $x^2=4$');
        assert.equal(sourceAfterEdits.answer, 'SECRET_BROWSER_ANSWER');

        await page.getByTestId('student-preview').click();
        await page.getByTestId('toggle-preview').click();
        await page.getByTestId('html-preview').waitFor({
            state: 'visible'
        });
        const studentHtml = await page.getByTestId('html-preview')
            .evaluate(element => element.innerHTML);
        for (const secret of [
            'SECRET_BROWSER_ANSWER',
            'SECRET_BROWSER_ANALYSIS',
            'SECRET_BROWSER_SOLUTION',
            'SECRET_BROWSER_NOTE'
        ]) {
            assert.equal(studentHtml.includes(secret), false, secret);
        }
        assert.match(studentHtml, /LOCAL_STEM/);

        await page.getByTestId('teacher-preview').click();
        const teacherHtml = await page.getByTestId('html-preview')
            .evaluate(element => element.innerHTML);
        assert.match(teacherHtml, /SECRET_BROWSER_ANSWER/);
        assert.match(teacherHtml, /SECRET_BROWSER_ANALYSIS/);
        assert.match(teacherHtml, /SECRET_BROWSER_SOLUTION/);

        await page.getByTestId('toggle-preview').click();
        await page.getByTestId('save-now').click();
        const countBeforeReload = await page.locator('.editor-block').count();
        await page.reload({
            waitUntil: 'domcontentloaded'
        });
        await page.getByTestId('handout-title').waitFor({
            state: 'visible',
            timeout: 15_000
        });
        assert.equal(
            await page.getByTestId('handout-title').inputValue(),
            'H3 browser acceptance'
        );
        assert.equal(
            await page.locator('.editor-block').count(),
            countBeforeReload
        );

        await page.getByTestId('show-revisions').click();
        await page.waitForFunction(
            () => document.querySelectorAll('.revision-row').length > 0
        );
        const revisionRows = page.locator('.revision-row');
        assert.ok(await revisionRows.count() >= 1);
        await revisionRows.first()
            .getByRole('button', {
                name: '恢复',
                exact: true
            })
            .click();
        await page.locator('.modal-backdrop').waitFor({
            state: 'hidden'
        });
        const restoredBlockCount = await page.locator(
            '.editor-block'
        ).count();
        assert.ok(restoredBlockCount >= 1);

        await page.getByTestId('duplicate-handout').click();
        await page.waitForFunction(
            () => document.querySelectorAll('.handout-list-item').length === 2
        );
        assert.equal(
            await page.locator('.handout-list-item').count(),
            2
        );
        assert.equal(
            await page.locator('.editor-block').count(),
            restoredBlockCount
        );
        await page.getByTestId('delete-handout').click();
        await page.getByTestId('confirm-danger').click();
        await page.waitForFunction(
            () => document.querySelectorAll('.handout-list-item').length === 1
        );
        assert.equal(
            await page.locator('.handout-list-item').count(),
            1
        );
        assert.equal(
            await page.getByTestId('handout-title').inputValue(),
            'H3 browser acceptance'
        );

        assert.deepEqual(pageErrors, []);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(badResponses, []);
        assert.deepEqual(externalRequests, []);
        assert.equal(
            [...requestedPaths].some(pathname =>
                /typst|mitex|pdf\.worker|handout-typst/i.test(pathname)
            ),
            false
        );
        for (const requiredPath of [
            '/handout.html',
            '/handout.css',
            '/qisi-handout-app.js',
            '/qisi-handout-editor-state.js',
            '/qisi-handout-preview.js'
        ]) {
            assert.equal(requestedPaths.has(requiredPath), true, requiredPath);
        }
    } catch (error) {
        error.message += `\nLocal server output:\n${output.join('')}`;
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});
