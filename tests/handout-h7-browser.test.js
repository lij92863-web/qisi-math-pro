'use strict';

const assert = require('node:assert/strict');
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

const reservePort = () => new Promise((resolve, reject) => {
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
                `local server exited before H7 acceptance (${child.exitCode})`
            );
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // Ignore the expected bounded startup race.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not start for H7 acceptance');
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

const extractPdfText = page => page.evaluate(async () => {
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
    return pages.join('\n');
});

test('H7 completes batch, conflict, layout, region asset and single-question preview workflow', {
    timeout: 180_000
}, async () => {
    const port = await reservePort();
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
    const pageErrors = [];
    const consoleErrors = [];
    const badResponses = [];

    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext({
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
        await page.evaluate(async imageBytes => {
            const database = globalThis.Qisi.Database.getDatabase();
            const blob = new Blob([
                new Uint8Array(imageBytes)
            ], {
                type: 'image/png'
            });
            for (const id of ['h7-image-1', 'h7-image-2']) {
                await database.images.put({
                    id,
                    blob,
                    createdAt: '2026-07-29T04:00:00.000Z'
                });
            }
            await database.questions.bulkPut([
                {
                    id: 'h7-question-1',
                    questionNumber: '1',
                    createdAt: '2026-07-29T04:00:00.000Z',
                    updatedAt: '2026-07-29T04:10:00.000Z',
                    type: '单选题',
                    grade: '高二',
                    stem: 'H7_SOURCE_ONE $x=1$',
                    options: ['1', '2', '3', '4'],
                    answer: 'H7_ANSWER_ONE',
                    analysis: 'H7_ANALYSIS_ONE',
                    solution: 'H7_SOLUTION_ONE',
                    images: [
                        {
                            id: 'h7-image-1',
                            placement: 'below-stem',
                            width: {
                                value: 42,
                                unit: 'percent'
                            },
                            alignment: 'center',
                            caption: 'H7 图一'
                        },
                        {
                            id: 'h7-image-2',
                            placement: 'below-stem',
                            width: {
                                value: 42,
                                unit: 'percent'
                            },
                            alignment: 'center',
                            caption: 'H7 图二'
                        }
                    ]
                },
                {
                    id: 'h7-question-2',
                    questionNumber: '2',
                    createdAt: '2026-07-29T04:00:00.000Z',
                    updatedAt: '2026-07-29T04:10:00.000Z',
                    type: '填空题',
                    grade: '高二',
                    stem: 'H7_SOURCE_TWO $y=2$',
                    options: [],
                    answer: 'H7_ANSWER_TWO',
                    analysis: 'H7_ANALYSIS_TWO',
                    solution: 'H7_SOLUTION_TWO',
                    images: []
                }
            ]);
        }, [...tinyPng]);

        await page.getByTestId('new-handout').click();
        for (const [index, id] of [
            'h7-question-1',
            'h7-question-2'
        ].entries()) {
            await page.getByTestId('open-question-library').click();
            await page.locator(`[data-question-id="${id}"]`).click();
            await page.waitForFunction(
                expected =>
                    globalThis.__TEX_HANDOUT_APP__
                        .questionBlocks.length === expected,
                index + 1
            );
        }
        assert.equal(
            await page.locator('.editor-block.block-question').count(),
            2
        );

        await page.getByTestId('open-batch-settings').click();
        await page.locator('.batch-select input').nth(0).check();
        await page.locator('.batch-select input').nth(1).check();
        await page.getByTestId('batch-option-layout')
            .selectOption('two-columns');
        await page.getByTestId('batch-image-layout')
            .selectOption('row');
        await page.locator(
            '.batch-settings-grid label',
            { hasText: '自定义标签' }
        ).locator('input').fill('H7批量标签');
        await page.getByTestId('apply-batch-settings').click();

        const afterBatch = await page.evaluate(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return app.questionBlocks.map(block => ({
                mode: block.optionLayout.mode,
                imageMode: block.imageLayout.mode,
                labels: block.displayLabels
            }));
        });
        assert.ok(afterBatch.every(item => item.mode === 'two-columns'));
        assert.ok(afterBatch.every(item => item.imageMode === 'row'));
        assert.ok(afterBatch.every(item =>
            item.labels[0].value === 'H7批量标签'
        ));

        const firstBlockId = await page.evaluate(() =>
            globalThis.__TEX_HANDOUT_APP__.questionBlocks[0].id
        );
        await page.locator(
            `[data-block-id="${firstBlockId}"]`
        ).click();
        await page.getByTestId('tab-content').click();
        await page.locator(
            '.inspector-form textarea'
        ).fill('H7_LOCAL_CONFLICT');
        await page.getByTestId('tab-labels').click();
        await page.getByTestId('custom-display-label')
            .fill('H7单题标签');
        await page.getByTestId('custom-display-label')
            .locator('xpath=following-sibling::button')
            .click();
        await page.getByTestId('tab-images').click();
        await page.getByTestId('question-image-layout')
            .selectOption('row');

        await page.evaluate(async () => {
            const database = globalThis.Qisi.Database.getDatabase();
            await database.questions.update(
                'h7-question-1',
                {
                    updatedAt: '2026-07-29T05:00:00.000Z',
                    stem: 'H7_SOURCE_REFRESHED',
                    answer: 'H7_ANSWER_REFRESHED'
                }
            );
        });
        await page.getByTestId('tab-source').click();
        await page.getByTestId('check-source-update').click();
        const stemRow = page.locator(
            '.source-field-row',
            { hasText: 'stem' }
        );
        await stemRow.locator('input').nth(0).check();
        await stemRow.locator('input').nth(1).check();
        await page.getByTestId('apply-source-update').click();
        try {
            await page.waitForFunction(() => {
                const app = globalThis.__TEX_HANDOUT_APP__;
                const block = app.questionBlocks[0];
                return (
                    block.snapshot.stem === 'H7_SOURCE_REFRESHED'
                    && block.snapshot.answer === 'H7_ANSWER_REFRESHED'
                    && !('stem' in block.contentOverrides)
                );
            }, null, {
                timeout: 10_000
            });
        } catch (error) {
            const state = await page.evaluate(() => {
                const app = globalThis.__TEX_HANDOUT_APP__;
                return {
                    notice: app.notice,
                    sourceCheck: app.sourceCheck,
                    selected: app.sourceUpdateFields,
                    accepted: app.acceptedSourceConflicts,
                    first: app.questionBlocks[0]
                };
            });
            throw new Error(
                `${error.message}\nH7 source update state: ${JSON.stringify(state)}`
            );
        }

        await page.getByTestId('open-global-settings').click();
        await page.getByTestId('global-header').click();
        await page.getByTestId('header-background-enabled')
            .setChecked(true);
        await page.getByTestId('header-background-bleed')
            .setChecked(true);
        await page.getByTestId('header-scope')
            .selectOption('first-only');
        await page.locator('.region-slot-card').first()
            .locator('input[type="file"]')
            .setInputFiles({
                name: 'h7-logo.png',
                mimeType: 'image/png',
                buffer: tinyPng
            });
        await page.getByTestId('header-left')
            .fill('H7_HEADER {title}');
        await page.getByTestId('save-now').click();
        await page.waitForFunction(() => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            return (
                app.saveStatus === 'saved'
                && !app.saving
                && !app.editor.dirty
            );
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('handout-title').waitFor({
            state: 'visible',
            timeout: 15_000
        });

        const persisted = await page.evaluate(async () => {
            const app = globalThis.__TEX_HANDOUT_APP__;
            const database = globalThis.Qisi.Database.getDatabase();
            const source = await database.questions.get(
                'h7-question-1'
            );
            return {
                questionCount: app.questionBlocks.length,
                sourceStem: source.stem,
                sourceAnswer: source.answer,
                first: app.questionBlocks[0],
                header: app.editor.handout.settings.header
            };
        });
        assert.equal(persisted.questionCount, 2);
        assert.equal(persisted.sourceStem, 'H7_SOURCE_REFRESHED');
        assert.equal(persisted.sourceAnswer, 'H7_ANSWER_REFRESHED');
        assert.equal(persisted.first.imageLayout.mode, 'row');
        assert.ok(persisted.first.displayLabels.some(
            label => label.value === 'H7单题标签'
        ));
        assert.equal(persisted.header.background.enabled, true);
        assert.equal(persisted.header.background.bleed, true);
        assert.equal(persisted.header.scope, 'first-only');
        assert.ok(persisted.header.slots.left.assetId);

        await page.locator(
            `[data-block-id="${firstBlockId}"]`
        ).click();
        await page.getByTestId('tab-source').click();
        await page.getByTestId('teacher-preview').click();
        await page.getByTestId('single-question-formal-preview').click();
        await page.getByTestId('download-formal-pdf').waitFor({
            state: 'visible',
            timeout: 90_000
        });
        await page.waitForFunction(
            () => typeof globalThis.pdfjsLib?.getDocument === 'function',
            null,
            { timeout: 30_000 }
        );
        const singlePdfText = await extractPdfText(page);
        const compactPdfText = singlePdfText.replace(/\s+/g, '');
        assert.match(compactPdfText, /H7_SOURCE_REFRESHED/);
        assert.equal(
            compactPdfText.includes('H7_SOURCE_TWO'),
            false
        );
        assert.match(compactPdfText, /H7单题标签/);
        assert.equal(
            await page.evaluate(() =>
                globalThis.__TEX_HANDOUT_APP__.formalScopeLabel
            ),
            '单题'
        );

        assert.deepEqual(pageErrors, []);
        assert.deepEqual(consoleErrors, []);
        assert.deepEqual(badResponses, []);
        assert.deepEqual(externalRequests, []);
    } catch (error) {
        error.message += `\nLocal server output:\n${output.join('')}`;
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(server);
    }
});
