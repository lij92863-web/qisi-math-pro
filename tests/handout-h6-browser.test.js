'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);

const reserveLoopbackPort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = address && typeof address === 'object'
            ? address.port
            : 0;
        server.close(error =>
            error ? reject(error) : resolve(port)
        );
    });
});

const waitForServer = async (origin, child) => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(
                `local server exited before H6 acceptance (${child.exitCode})`
            );
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // A bounded readiness poll isolates expected startup races.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not start for H6 acceptance');
};

const stopProcess = child => {
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
};

const sha256 = bytes => crypto
    .createHash('sha256')
    .update(bytes)
    .digest('hex');

const extractActivePdf = page => page.evaluate(async () => {
    const app = globalThis.__TEX_HANDOUT_APP__;
    const bytes = app.formalSession.copyPdfBytes();
    const loading = globalThis.pdfjsLib.getDocument({
        data: bytes.slice()
    });
    const pdf = await loading.promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const pdfPage = await pdf.getPage(pageNumber);
        const content = await pdfPage.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
    }
    await pdf.destroy();
    return {
        bytes: [...bytes],
        pageCount: pages.length,
        text: pages.join('\n')
    };
});

test('H6 completes main-to-handout student and teacher PDF workflow', {
    timeout: 180_000
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
    const requestedPaths = [];
    const pageErrors = [];
    const consoleErrors = [];
    const badResponses = [];

    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
            acceptDownloads: true,
            viewport: {
                width: 1680,
                height: 1050
            }
        });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (
                ['http:', 'https:'].includes(url.protocol)
                && url.origin !== origin
            ) {
                externalRequests.push(url.href);
                return route.abort('blockedbyclient');
            }
            if (url.origin === origin) {
                requestedPaths.push(url.pathname);
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

        await page.goto(`${origin}/main.html`, {
            waitUntil: 'domcontentloaded'
        });
        await page.getByTestId('open-handout').waitFor({
            state: 'visible',
            timeout: 15_000
        });
        assert.equal(
            requestedPaths.some(value =>
                /\/vendor\/(?:typst|mitex)|\/workers\/qisi-handout-typst-worker/.test(value)
            ),
            false,
            'main page must not initialize the formal compiler'
        );
        await Promise.all([
            page.waitForURL(`${origin}/handout.html`),
            page.getByTestId('open-handout').click()
        ]);
        await page.locator('.welcome-card').waitFor({
            state: 'visible',
            timeout: 15_000
        });
        assert.equal(
            await page.evaluate(() => globalThis.__TEX_HANDOUT_READY__),
            true
        );

        await page.evaluate(async imageBytes => {
            const database = globalThis.Qisi.Database.getDatabase();
            const blob = new Blob([
                new Uint8Array(imageBytes)
            ], {
                type: 'image/png'
            });
            await database.images.put({
                id: 'formal-h6-image',
                blob,
                createdAt: '2026-07-29T03:00:00.000Z'
            });
            await database.questions.put({
                id: 'formal-h6-question',
                questionNumber: '1',
                createdAt: '2026-07-29T03:00:00.000Z',
                updatedAt: '2026-07-29T03:10:00.000Z',
                grade: '高二',
                type: '单选题',
                diff: '中等',
                systemKnowledge: '函数',
                stem: 'H6_SOURCE_STEM $x^2+1=5$',
                options: ['$1$', '$2$', '$3$', '$4$'],
                answer: 'H6_SOURCE_ANSWER',
                analysis: 'H6_SOURCE_ANALYSIS',
                solution: 'H6_SOURCE_SOLUTION',
                teacherNote: 'H6_SOURCE_NOTE',
                images: [{
                    id: 'formal-h6-image',
                    placement: 'below-stem',
                    width: {
                        value: 28,
                        unit: 'mm'
                    },
                    alignment: 'center',
                    caption: 'H6 source image'
                }]
            });
        }, [...tinyPng]);

        await page.getByTestId('new-handout').click();
        await page.getByTestId('handout-title').fill(
            'H6 产品闭环验收'
        );
        for (const testId of [
            'add-heading',
            'add-body',
            'add-callout',
            'add-page-break'
        ]) {
            await page.getByTestId(testId).click();
        }
        await page.locator(
            '.library-panel input[type="file"]'
        ).setInputFiles({
            name: 'h6-standalone.png',
            mimeType: 'image/png',
            buffer: tinyPng
        });
        await page.locator('.editor-block.block-image').waitFor({
            state: 'visible'
        });

        await page.getByTestId('open-question-library').click();
        await page.locator(
            '[data-question-id="formal-h6-question"]'
        ).waitFor({
            state: 'visible'
        });
        await page.locator(
            '[data-question-id="formal-h6-question"]'
        ).click();
        await page.locator('.editor-block.block-question').waitFor({
            state: 'visible'
        });
        assert.equal(await page.locator('.editor-block').count(), 6);

        await page.getByTestId('tab-content').click();
        await page.locator(
            '.inspector-form textarea'
        ).fill('H6_LOCAL_STEM $x^2+1=5$');
        await page.getByTestId('tab-options').click();
        await page.getByTestId('question-option-layout')
            .selectOption('two-columns');
        await page.getByTestId('tab-images').click();
        await page.getByTestId('question-image-placement-0')
            .selectOption('right-of-stem');
        await page.getByTestId('tab-answers').click();
        await page.getByTestId('question-answer')
            .fill('H6_TEACHER_ANSWER');
        await page.getByTestId('question-analysis')
            .fill('H6_TEACHER_ANALYSIS');
        await page.getByTestId('question-solution')
            .fill('H6_TEACHER_SOLUTION $x=2$');
        await page.getByTestId('question-answer-placement')
            .selectOption('after-question');
        await page.getByTestId('question-analysis-placement')
            .selectOption('end');
        await page.getByTestId('question-solution-placement')
            .selectOption('after-question');

        await page.getByTestId('open-global-settings').click();
        await page.getByTestId('global-header').click();
        await page.getByTestId('header-enabled').setChecked(true);
        await page.getByTestId('header-left').fill('H6_HEADER {title}');
        await page.getByTestId('global-footer').click();
        await page.getByTestId('footer-enabled').setChecked(true);
        await page.getByTestId('footer-center').fill('H6_FOOTER {page}/{pages}');

        await page.getByTestId('save-now').click();
        await page.waitForFunction(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return (
                app
                && !app.saving
                && !app.editor?.dirty
                && app.saveStatus === 'saved'
            );
        });
        const beforeReload = await page.evaluate(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return {
                handoutId: app.editor.handout.id,
                blockCount: app.editor.handout.blocks.length,
                assetCount: app.assetRecords.length
            };
        });
        assert.ok(beforeReload.assetCount >= 2);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('handout-title').waitFor({
            state: 'visible',
            timeout: 15_000
        });
        assert.equal(
            await page.getByTestId('handout-title').inputValue(),
            'H6 产品闭环验收'
        );
        assert.equal(
            await page.locator('.editor-block').count(),
            beforeReload.blockCount
        );

        await page.getByTestId('student-preview').click();
        await page.getByTestId('toggle-preview').click();
        await page.getByTestId('html-preview').waitFor({
            state: 'visible'
        });
        assert.equal(
            (await page.getByTestId('html-preview').innerText())
                .includes('H6_TEACHER_ANSWER'),
            false
        );
        await page.getByTestId('formal-preview').click();
        await page.getByTestId('download-formal-pdf').waitFor({
            state: 'visible',
            timeout: 90_000
        });
        await page.waitForFunction(() => {
            const canvas = document.querySelector(
                '[data-testid="formal-pdf-canvas"]'
            );
            return (
                canvas
                && canvas.width > 500
                && canvas.height > 700
                && !globalThis.__TEX_HANDOUT_APP__.formalRendering
            );
        });
        const canvasSize = await page.getByTestId('formal-pdf-canvas')
            .evaluate(canvas => ({
                width: canvas.width,
                height: canvas.height
            }));
        assert.ok(canvasSize.width > 500);
        assert.ok(canvasSize.height > 700);
        assert.ok(
            await page.evaluate(() =>
                globalThis.__TEX_HANDOUT_APP__.formalPageCount >= 2
            )
        );
        await page.getByTestId('formal-page-next').click();
        await page.waitForFunction(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return app.formalPageNumber === 2 && !app.formalRendering;
        });
        await page.getByTestId('formal-page-previous').click();
        await page.waitForFunction(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return app.formalPageNumber === 1 && !app.formalRendering;
        });

        const studentPdf = await extractActivePdf(page);
        assert.ok(studentPdf.pageCount >= 1);
        assert.match(studentPdf.text, /H6_LOCAL_STEM/);
        for (const secret of [
            'H6_TEACHER_ANSWER',
            'H6_TEACHER_ANALYSIS',
            'H6_TEACHER_SOLUTION',
            'H6_SOURCE_NOTE'
        ]) {
            assert.equal(
                studentPdf.text.includes(secret),
                false,
                `student PDF leaked ${secret}`
            );
        }
        const studentDownloadEvent = page.waitForEvent('download');
        await page.getByTestId('download-formal-pdf').click();
        const studentDownload = await studentDownloadEvent;
        const studentDownloadPath = await studentDownload.path();
        const studentDownloadBytes = fs.readFileSync(studentDownloadPath);
        assert.equal(
            sha256(studentDownloadBytes),
            sha256(Buffer.from(studentPdf.bytes)),
            'student preview and download must share one PDF artifact'
        );
        assert.match(
            studentDownload.suggestedFilename(),
            /学生版\.pdf$/
        );
        await page.getByTestId('close-formal-preview').click();

        await page.getByTestId('teacher-preview').click();
        await page.getByTestId('formal-preview').click();
        await page.getByTestId('download-formal-pdf').waitFor({
            state: 'visible',
            timeout: 90_000
        });
        const teacherPdf = await extractActivePdf(page);
        assert.match(teacherPdf.text, /H6_LOCAL_STEM/);
        assert.match(teacherPdf.text, /H6_TEACHER_ANSWER/);
        assert.match(teacherPdf.text, /H6_TEACHER_ANALYSIS/);
        assert.match(teacherPdf.text, /H6_TEACHER_SOLUTION/);
        const teacherDownloadEvent = page.waitForEvent('download');
        await page.getByTestId('download-formal-pdf').click();
        const teacherDownload = await teacherDownloadEvent;
        const teacherDownloadPath = await teacherDownload.path();
        assert.equal(
            sha256(fs.readFileSync(teacherDownloadPath)),
            sha256(Buffer.from(teacherPdf.bytes)),
            'teacher preview and download must share one PDF artifact'
        );
        assert.match(
            teacherDownload.suggestedFilename(),
            /教师版\.pdf$/
        );

        const sourceAfterWorkflow = await page.evaluate(async () => {
            const database = globalThis.Qisi.Database.getDatabase();
            return database.questions.get('formal-h6-question');
        });
        assert.equal(sourceAfterWorkflow.stem, 'H6_SOURCE_STEM $x^2+1=5$');
        assert.equal(sourceAfterWorkflow.answer, 'H6_SOURCE_ANSWER');
        assert.deepEqual(pageErrors, []);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(badResponses, []);
        assert.deepEqual(externalRequests, []);
        for (const requiredPath of [
            '/main.html',
            '/handout.html',
            '/workers/qisi-handout-typst-worker.mjs',
            '/vendor/pdfjs-dist/3.11.174/pdf.min.js'
        ]) {
            assert.equal(
                requestedPaths.includes(requiredPath),
                true,
                requiredPath
            );
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
