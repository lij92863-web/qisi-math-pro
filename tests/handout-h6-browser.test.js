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
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding'
            ]
        });
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
        // Record every write to the handout store with the calling stack, so a revision the editor
        // never adopts can be attributed to the code path that wrote it.
        await page.evaluate(() => {
            const database = window.Qisi.Database.getDatabase();
            window.__qisiH6Writes = [];
            const shorten = () => String(new Error('write').stack || '')
                .split('\n')
                .slice(1, 7)
                .map(line => line.trim().replace(/^at\s+/, ''))
                .join(' | ');
            database.handouts.hook('creating', (primKey, obj) => {
                window.__qisiH6Writes.push({
                    kind: 'creating', revision: obj?.revision, stack: shorten()
                });
            });
            database.handouts.hook('updating', (mods, primKey, obj) => {
                window.__qisiH6Writes.push({
                    kind: 'updating',
                    revision: mods?.revision ?? obj?.revision,
                    updatedAt: String(mods?.updatedAt || obj?.updatedAt || ''),
                    stack: shorten()
                });
            });

            // Attribute a write to the application action that caused it.
            window.__qisiH6Calls = [];
            const app = globalThis.__TEX_HANDOUT_APP__;
            const track = name => {
                const original = app?.[name];
                if (typeof original !== 'function') return;
                app[name] = async (...args) => {
                    const entry = {
                        name,
                        at: Date.now(),
                        beforeRevision: app.editor?.handout?.revision,
                        dirty: Boolean(app.editor?.dirty)
                    };
                    try {
                        const result = await original.apply(app, args);
                        entry.afterRevision = app.editor?.handout?.revision;
                        entry.afterStatus = app.saveStatus;
                        entry.ok = true;
                        window.__qisiH6Calls.push(entry);
                        return result;
                    } catch (error) {
                        entry.afterRevision = app.editor?.handout?.revision;
                        entry.error = String(error?.message || error);
                        entry.ok = false;
                        window.__qisiH6Calls.push(entry);
                        throw error;
                    }
                };
            };
            [
                'flushSave', 'insertQuestion', 'applyEditor', 'loadEditor',
                'duplicateCurrent', 'deleteCurrentHandout', 'saveAndReturnToBank',
                'storeUploadedImage', 'refreshAssetUrls'
            ].forEach(track);

            // A revision timeline shows whether the editor ever adopted what the store holds.
            window.__qisiH6Revisions = [];

            // Wrap the editor-state module so a revision that moves backwards can be attributed to
            // the exact transition that produced it.
            window.__qisiH6StateCalls = [];
            const editorState = window.Qisi.HandoutEditorState;
            if (editorState) {
                for (const name of Object.keys(editorState)) {
                    const original = editorState[name];
                    if (typeof original !== 'function') continue;
                    editorState[name] = (...args) => {
                        const before = args[0]?.handout?.revision;
                        const result = original(...args);
                        const after = result?.handout?.revision;
                        if (before !== after) {
                            window.__qisiH6StateCalls.push({
                                name,
                                at: Date.now(),
                                from: before,
                                to: after,
                                stack: String(new Error('state').stack || '')
                                    .split('\n').slice(1, 6).map(line => line.trim()).join(' | ')
                            });
                        }
                        return result;
                    };
                }
            }
            let lastRevision = null;
            window.__qisiH6Sampler = setInterval(async () => {
                const revision = app?.editor?.handout?.revision;
                if (revision === lastRevision) return;
                lastRevision = revision;
                let storedRevision = null;
                try {
                    storedRevision = (await database.handouts.get(app?.editor?.handout?.id))?.revision ?? null;
                } catch (_) {
                    storedRevision = null;
                }
                window.__qisiH6Revisions.push({ at: Date.now(), revision, storedRevision });
            }, 100);
        });

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

        const directFrame = page.locator(
            '.block-question .direct-image-frame'
        ).first();
        await directFrame.click();
        const beforeResize = await page.evaluate(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return app.selectedQuestion.images[0].width.value;
        });
        const resizeHandle = page.locator(
            '.block-question .image-resize-handle.handle-south-east'
        );
        const handleBox = await resizeHandle.boundingBox();
        assert.ok(handleBox);
        await resizeHandle.hover();
        await page.mouse.move(
            handleBox.x + handleBox.width / 2,
            handleBox.y + handleBox.height / 2
        );
        await page.mouse.down();
        await page.waitForFunction(() => {
            const interaction =
                globalThis.__TEX_HANDOUT_APP__?.imageManipulation;
            return interaction?.active
                && interaction.mode === 'resize';
        });
        await page.mouse.move(
            handleBox.x + handleBox.width / 2 + 48,
            handleBox.y + handleBox.height / 2 + 48,
            { steps: 4 }
        );
        await page.waitForFunction(() => {
            const interaction =
                globalThis.__TEX_HANDOUT_APP__?.imageManipulation;
            return (
                interaction?.active
                && interaction.previewWidthPx
                    > interaction.resizeSession.startWidthPx
            );
        });
        await page.mouse.up();
        const afterResize = await page.evaluate(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return app.selectedQuestion.images[0].width.value;
        });
        assert.ok(
            afterResize > beforeResize,
            `corner drag must persist a larger structured width (${beforeResize} -> ${afterResize})`
        );

        const moveFrameBox = await directFrame.boundingBox();
        assert.ok(moveFrameBox);
        await page.mouse.move(
            moveFrameBox.x + moveFrameBox.width / 2,
            moveFrameBox.y + moveFrameBox.height / 2
        );
        await page.mouse.down();
        const dropTarget = page.locator(
            '[data-image-drop="options-right"]'
        );
        await dropTarget.waitFor({ state: 'visible' });
        const dropBox = await dropTarget.boundingBox();
        assert.ok(dropBox);
        await page.mouse.move(
            dropBox.x + dropBox.width / 2,
            dropBox.y + dropBox.height / 2,
            { steps: 4 }
        );
        await page.mouse.up();
        assert.equal(
            await page.evaluate(() =>
                globalThis.__TEX_HANDOUT_APP__
                    .selectedQuestion.images[0].placement
            ),
            'right-of-options'
        );

        const performanceFixture = await page.evaluate(async () => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            const model = globalThis.Qisi.HandoutModel;
            const stateTools = globalThis.Qisi.HandoutEditorState;
            const originalEditor = app.editor;
            const sourceBlock = originalEditor.handout.blocks.find(
                block => block.type === 'question'
            );
            const cleanSourceBlock = model.cloneValue(sourceBlock);
            globalThis.__H9_PERF_EDITOR__ = originalEditor;
            const clones = Array.from(
                { length: 49 },
                (_, index) => ({
                    ...model.cloneValue(cleanSourceBlock),
                    id: `h9-performance-question-${index + 2}`,
                    images: cleanSourceBlock.images.map(image => ({
                        ...model.cloneValue(image),
                        id:
                            `${image.id}-performance-${index + 2}`
                    }))
                })
            );
            const handout = model.assertValidHandout({
                ...originalEditor.handout,
                blocks: [
                    ...originalEditor.handout.blocks,
                    ...clones
                ]
            });
            app.editor = stateTools.createEditorState(handout);
            app.selectEditorBlock(sourceBlock.id);
            await app.$nextTick();
            return {
                sourceBlockId: sourceBlock.id,
                formalPhase: app.formalState.phase
            };
        });
        assert.equal(
            await page.locator('.block-question').count(),
            50
        );
        const performanceFrame = page.locator(
            '.block-question .direct-image-frame'
        ).first();
        await performanceFrame.click();
        const performanceHandle = page.locator(
            '.block-question .image-resize-handle.handle-south-east'
        ).first();
        const performanceHandleBox =
            await performanceHandle.boundingBox();
        assert.ok(performanceHandleBox);
        const dragStartedAt = Date.now();
        const performanceStart = {
            x: performanceHandleBox.x
                + performanceHandleBox.width / 2,
            y: performanceHandleBox.y
                + performanceHandleBox.height / 2
        };
        await performanceHandle.dispatchEvent('pointerdown', {
            pointerId: 901,
            pointerType: 'mouse',
            button: 0,
            buttons: 1,
            clientX: performanceStart.x,
            clientY: performanceStart.y
        });
        await page.waitForFunction(() => {
            const interaction =
                globalThis.__TEX_HANDOUT_APP__?.imageManipulation;
            return interaction?.active
                && interaction.mode === 'resize';
        });
        await page.evaluate(start => {
            window.dispatchEvent(new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 901,
                pointerType: 'mouse',
                buttons: 1,
                clientX: start.x + 32,
                clientY: start.y + 24
            }));
        }, performanceStart);
        await page.waitForFunction(() => {
            const interaction =
                globalThis.__TEX_HANDOUT_APP__?.imageManipulation;
            return (
                interaction?.active
                && interaction.previewWidthPx
                    > interaction.resizeSession.startWidthPx
            );
        });
        await page.evaluate(start => {
            window.dispatchEvent(new PointerEvent('pointerup', {
                bubbles: true,
                pointerId: 901,
                pointerType: 'mouse',
                button: 0,
                buttons: 0,
                clientX: start.x + 32,
                clientY: start.y + 24
            }));
        }, performanceStart);
        const dragElapsedMs = Date.now() - dragStartedAt;
        assert.ok(
            dragElapsedMs < 2500,
            `50-question corner drag took ${dragElapsedMs} ms`
        );
        assert.equal(
            await page.evaluate(() =>
                globalThis.__TEX_HANDOUT_APP__.formalState.phase
            ),
            performanceFixture.formalPhase,
            'pointer drag must not start formal PDF compilation'
        );
        await page.evaluate(async blockId => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            app.editor = globalThis.__H9_PERF_EDITOR__;
            delete globalThis.__H9_PERF_EDITOR__;
            app.selectEditorBlock(blockId);
            await app.$nextTick();
        }, performanceFixture.sourceBlockId);

        await page.getByTestId('tab-tables').click();
        await page.getByTestId('add-question-table').click();
        await page.locator('[data-table-cell="0-0"]')
            .fill('$x$');
        await page.locator('[data-table-cell="0-1"]')
            .fill('$f(x)$');
        assert.equal(
            await page.locator(
                '.block-question .structured-question-table'
            ).count(),
            1
        );

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
        await page.getByTestId('tab-display').click();
        await page.getByLabel('显示二维码').setChecked(true);
        await page.getByLabel('允许教师版显示备注')
            .setChecked(true);

        try {
            await page.getByTestId('open-global-settings').click();
        } catch (clickError) {
            const diagnostics = await page.evaluate(() => ({
                notice: (document.querySelector('.notice')?.textContent || '').trim(),
                saveState: document.querySelector('.save-state')?.className || '',
                fatal: (document.querySelector('.fatal-panel')?.textContent || '').trim().slice(0, 200)
            })).catch(error => ({ diagnosticsUnavailable: String(error?.message || error) }));
            console.error('H6_SETTINGS_CLICK_DIAGNOSTICS=' + JSON.stringify(diagnostics));
            throw clickError;
        }
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
                && (
                    (
                        !app.editor?.dirty
                        && app.saveStatus === 'saved'
                    )
                    || app.saveStatus === 'error'
                )
            );
        }, null, {
            timeout: 60_000
        });
        const saveOutcome = await page.evaluate(() => {
            return (async () => {
                const app = globalThis.__TEX_HANDOUT_APP__;
                let stored = null;
                try {
                    const database = window.Qisi.Database.getDatabase();
                    stored = await database.handouts.get(app.editor?.handout?.id);
                } catch (error) {
                    stored = { readError: String(error?.message || error) };
                }
                return {
                    status: app.saveStatus,
                    dirty: app.editor?.dirty,
                    notice: app.notice,
                    revision: app.editor?.handout?.revision,
                    updatedAt: app.editor?.handout?.updatedAt,
                    // A conflict means the stored revision moved ahead of the editor, so both sides
                    // are reported to make the cause visible instead of only the symptom.
                    storedRevision: stored?.revision,
                    storedUpdatedAt: stored?.updatedAt,
                    writes: (window.__qisiH6Writes || []).slice(-8),
                    calls: (window.__qisiH6Calls || []).slice(-40),
                    revisions: (window.__qisiH6Revisions || []).slice(-20),
                    stateCalls: (window.__qisiH6StateCalls || []).slice(-20)
                };
            })();
        });
        assert.equal(
            saveOutcome.status,
            'saved',
            JSON.stringify(saveOutcome)
        );
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
        assert.ok(
            await page.evaluate(() =>
                globalThis.__TEX_HANDOUT_APP__
                    .questionBlocks[0].images[0].width.value
            ) > beforeResize
        );
        assert.equal(
            await page.evaluate(() =>
                globalThis.__TEX_HANDOUT_APP__
                    .questionBlocks[0].tables.length
            ),
            1
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
