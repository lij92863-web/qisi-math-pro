'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const model = require('../qisi-handout-model.js');
const documentPipeline = require('../qisi-handout-document.js');

const ROOT = path.resolve(__dirname, '..');

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
                `local server exited before H5 browser test (${child.exitCode})`
            );
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // The bounded readiness loop intentionally ignores startup races.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not start for H5 browser test');
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

const makeHandout = ({
    withImage = false
} = {}) => model.createHandout({
    title: 'H5 Local Compiler',
    settings: {
        header: {
            enabled: true,
            text: '{title} - {edition}',
            alignment: 'right'
        },
        footer: {
            enabled: true,
            text: '{page}/{pages}',
            alignment: 'center'
        }
    },
    blocks: [{
        id: 'question-h5',
        type: 'question',
        sourceQuestionId: 'source-h5',
        snapshot: {
            snapshotVersion: 1,
            sourceQuestionId: 'source-h5',
            sourceUpdatedAt: '2026-07-29T00:00:00.000Z',
            capturedAt: '2026-07-29T00:01:00.000Z',
            questionNumber: '1',
            stem: 'Compute $x^2+1$ when $x=2$.',
            options: ['$3$', '$4$', '$5$', '$6$'],
            answer: 'C',
            analysis: 'Substitute the value.',
            solution: '$2^2+1=5$.',
            teacherNote: '',
            images: []
        },
        contentOverrides: {},
        display: {
            showQuestionNumber: true,
            showOptions: true,
            showKnowledgePoints: 'inherit',
            showSource: 'inherit',
            showTags: 'inherit',
            answerPlacement: 'end',
            analysisPlacement: 'hidden',
            solutionPlacement: 'end',
            answerSpaceLines: 1
        },
        questionLabel: {
            preset: 'exercise',
            customText: ''
        },
        optionLayout: {
            mode: 'auto'
        },
        images: [],
        latexNormalization: {
            useDisplayFractions: false,
            normalizePunctuation: false,
            normalizeSpacing: false
        }
    }, ...(withImage ? [{
        id: 'image-h5',
        type: 'image',
        assetId: 'asset-h5',
        placement: 'block',
        width: {
            value: 32,
            unit: 'mm'
        },
        alignment: 'center',
        caption: 'Local VFS image'
    }] : [])]
}, {
    id: 'handout-h5-browser',
    now: '2026-07-29T00:02:00.000Z'
});

const runtimePath = pathname =>
    /\/vendor\/(?:typst|mitex)\//.test(pathname)
    || /\/vendor\/typst\/fonts\//.test(pathname)
    || /\/workers\/qisi-handout-typst-worker\.mjs$/.test(pathname);

test('H5 production compiler stays lazy, caches locally, previews and fails closed', {
    timeout: 240_000
}, async () => {
    const generated = documentPipeline.buildTypstDocument(
        makeHandout(),
        'student'
    );
    const imageGenerated = documentPipeline.buildTypstDocument(
        makeHandout({ withImage: true }),
        'student',
        {
            assetPathById: {
                'asset-h5': '/assets/001-asset-h5.svg'
            }
        }
    );
    const formulaMap = generated.lineMap.find(item =>
        item.formulaId === 'question-h5:stem:1'
    );
    assert.ok(formulaMap, 'H4 must expose formula-level line mapping');

    const sourceLines = generated.source.split('\n');
    sourceLines[formulaMap.startLine] =
        '#h5_unknown_formula_symbol';
    const invalidGenerated = {
        ...generated,
        source: sourceLines.join('\n')
    };

    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
    const output = [];
    const child = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: {
            ...process.env,
            PORT: String(port)
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    child.stdout.on('data', chunk => output.push(chunk.toString()));
    child.stderr.on('data', chunk => output.push(chunk.toString()));

    let browser;
    let context;
    let blockChineseFont = false;
    try {
        await waitForServer(origin, child);
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();
        const externalRequests = [];
        const requestedPaths = [];
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (
                ['http:', 'https:'].includes(url.protocol)
                && url.origin !== origin
            ) {
                externalRequests.push(url.href);
                return route.abort('blockedbyclient');
            }
            if (
                blockChineseFont
                && url.pathname.endsWith(
                    '/NotoSerifCJKsc-Regular.otf'
                )
            ) {
                return route.abort('failed');
            }
            requestedPaths.push(url.pathname);
            return route.continue();
        });

        const page = await context.newPage();
        await page.goto(`${origin}/main.html`, {
            waitUntil: 'domcontentloaded'
        });
        assert.equal(
            requestedPaths.some(runtimePath),
            false,
            'normal main-page startup must not request H5 compiler assets'
        );

        requestedPaths.length = 0;
        await page.goto(`${origin}/handout.html`, {
            waitUntil: 'domcontentloaded'
        });
        await page.waitForFunction(
            () => globalThis.__TEX_HANDOUT_READY__ === true,
            null,
            { timeout: 15_000 }
        );
        assert.ok(requestedPaths.includes(
            '/qisi-handout-compiler-client.js'
        ));
        assert.ok(requestedPaths.includes(
            '/qisi-handout-pdf-session.js'
        ));
        assert.equal(requestedPaths.some(runtimePath), false);
        assert.equal(
            requestedPaths.some(pathname =>
                /\/vendor\/pdfjs-dist\//.test(pathname)
            ),
            false,
            'PDF.js must stay lazy until formal preview'
        );

        const cold = await page.evaluate(async documentValue => {
            for (const name of await caches.keys()) {
                if (name.startsWith('tex-handout-compiler-')) {
                    await caches.delete(name);
                }
            }
            const stale = await caches.open(
                'tex-handout-compiler-stale-v0'
            );
            await stale.put(
                new Request(`${location.origin}/stale`),
                new Response('stale')
            );
            let heartbeats = 0;
            const heartbeat = setInterval(() => {
                heartbeats += 1;
            }, 5);
            const session =
                Qisi.HandoutPdfSession.createPdfSession();
            globalThis.__H5_SESSION__ = session;
            try {
                const artifact = await session.compileGenerated(
                    documentValue,
                    []
                );
                const bytes = session.copyPdfBytes();
                const descriptor =
                    session.getDownloadDescriptor('student.pdf');
                return {
                    signature: String.fromCharCode(...bytes.slice(0, 5)),
                    byteLength: bytes.byteLength,
                    previewUrl: session.getPreviewUrl(),
                    downloadUrl: descriptor.href,
                    metrics: artifact.metrics,
                    heartbeats,
                    cacheNames: await caches.keys()
                };
            } finally {
                clearInterval(heartbeat);
            }
        }, generated);

        assert.equal(cold.signature, '%PDF-');
        assert.ok(cold.byteLength > 1_000);
        assert.equal(cold.previewUrl, cold.downloadUrl);
        assert.ok(cold.heartbeats > 0);
        assert.ok(cold.metrics.cacheMisses >= 10);
        assert.ok(cold.cacheNames.some(name =>
            name.startsWith('tex-handout-compiler-h5-')
        ));
        assert.equal(
            cold.cacheNames.includes(
                'tex-handout-compiler-stale-v0'
            ),
            false
        );
        assert.ok(requestedPaths.some(pathname =>
            pathname.endsWith(
                '/workers/qisi-handout-typst-worker.mjs'
            )
        ));
        assert.ok(requestedPaths.some(pathname =>
            pathname.endsWith(
                '/typst_ts_web_compiler_bg.wasm'
            )
        ));
        assert.ok(requestedPaths.some(pathname =>
            pathname.endsWith('/mitex.wasm')
        ));
        assert.ok(requestedPaths.some(pathname =>
            pathname.endsWith('/NotoSerifCJKsc-Regular.otf')
        ));

        const vfs = await page.evaluate(
            async documentValue => {
                const record = {
                    id: 'asset-h5',
                    handoutId: 'handout-h5-browser',
                    mimeType: 'image/svg+xml',
                    blob: new Blob([
                        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#2563eb"/></svg>'
                    ], {
                        type: 'image/svg+xml'
                    })
                };
                await globalThis.__H5_SESSION__
                    .compileGenerated(documentValue, [record]);
                return {
                    signature: String.fromCharCode(
                        ...globalThis.__H5_SESSION__
                            .copyPdfBytes()
                            .slice(0, 5)
                    ),
                    byteLength: globalThis.__H5_SESSION__
                        .copyPdfBytes()
                        .byteLength
                };
            },
            imageGenerated
        );
        assert.equal(vfs.signature, '%PDF-');
        assert.ok(vfs.byteLength > 1_000);

        const beforePdfJs = requestedPaths.length;
        const preview = await page.evaluate(async () => {
            const canvas = document.createElement('canvas');
            canvas.dataset.h5Preview = 'true';
            document.body.appendChild(canvas);
            const result = await globalThis.__H5_SESSION__
                .renderPreview(canvas, {
                    pageNumber: 1,
                    scale: 1
                });
            const descriptor = globalThis.__H5_SESSION__
                .getDownloadDescriptor('student.pdf');
            const downloaded = new Uint8Array(
                await (
                    await fetch(descriptor.href)
                ).arrayBuffer()
            );
            const memory = globalThis.__H5_SESSION__
                .copyPdfBytes();
            const digest = async bytes => Array.from(
                new Uint8Array(
                    await crypto.subtle.digest('SHA-256', bytes)
                )
            ).map(value => value.toString(16).padStart(2, '0'))
                .join('');
            return {
                ...result,
                previewUrl:
                    globalThis.__H5_SESSION__.getPreviewUrl(),
                downloadUrl: descriptor.href,
                downloadedHash: await digest(downloaded),
                memoryHash: await digest(memory)
            };
        });
        assert.equal(preview.pageNumber, 1);
        assert.ok(preview.pageCount >= 1);
        assert.ok(preview.width > 100);
        assert.ok(preview.height > 100);
        assert.equal(preview.previewUrl, preview.downloadUrl);
        assert.equal(preview.downloadedHash, preview.memoryHash);
        assert.ok(
            requestedPaths.slice(beforePdfJs).some(pathname =>
                pathname.endsWith('/pdf.min.js')
            )
        );
        assert.ok(
            requestedPaths.slice(beforePdfJs).some(pathname =>
                pathname.endsWith('/pdf.worker.min.js')
            )
        );

        const coldRuntimeRequests = requestedPaths
            .filter(pathname =>
                /typst_ts_web_compiler_bg\.wasm|\/vendor\/mitex\/|\/vendor\/typst\/fonts\//
                    .test(pathname)
            ).length;
        const warm = await page.evaluate(async documentValue => {
            globalThis.__H5_SESSION__.dispose();
            const session =
                Qisi.HandoutPdfSession.createPdfSession();
            globalThis.__H5_SESSION__ = session;
            const artifact = await session.compileGenerated(
                documentValue,
                []
            );
            return {
                signature: String.fromCharCode(
                    ...session.copyPdfBytes().slice(0, 5)
                ),
                metrics: artifact.metrics
            };
        }, generated);
        assert.equal(warm.signature, '%PDF-');
        assert.ok(warm.metrics.cacheHits >= 10);
        assert.equal(warm.metrics.cacheMisses, 0);
        const warmRuntimeRequests = requestedPaths
            .filter(pathname =>
                /typst_ts_web_compiler_bg\.wasm|\/vendor\/mitex\/|\/vendor\/typst\/fonts\//
                    .test(pathname)
            ).length;
        assert.equal(warmRuntimeRequests, coldRuntimeRequests);

        const cancelledAndRetried = await page.evaluate(
            async documentValue => {
                globalThis.__H5_SESSION__.dispose();
                const session =
                    Qisi.HandoutPdfSession.createPdfSession();
                globalThis.__H5_SESSION__ = session;
                const pending = session.compileGenerated(
                    documentValue,
                    []
                );
                await Promise.resolve();
                const cancelled = session.cancel(
                    'H5 acceptance cancellation'
                );
                let cancellation = null;
                try {
                    await pending;
                } catch (error) {
                    cancellation = {
                        name: error.name,
                        code: error.code
                    };
                }
                const artifact = await session.compileGenerated(
                    documentValue,
                    []
                );
                return {
                    cancelled,
                    cancellation,
                    signature: String.fromCharCode(
                        ...session.copyPdfBytes().slice(0, 5)
                    ),
                    metrics: artifact.metrics
                };
            },
            generated
        );
        assert.equal(cancelledAndRetried.cancelled, true);
        assert.deepEqual(cancelledAndRetried.cancellation, {
            name: 'AbortError',
            code: 'HANDOUT_COMPILE_CANCELLED'
        });
        assert.equal(cancelledAndRetried.signature, '%PDF-');

        const formulaFailure = await page.evaluate(
            async documentValue => {
                let errorResult = null;
                try {
                    await globalThis.__H5_SESSION__
                        .compileGenerated(documentValue, []);
                } catch (error) {
                    errorResult = {
                        code: error.code,
                        diagnostics: error.diagnostics
                    };
                }
                return {
                    errorResult,
                    hasArtifact:
                        globalThis.__H5_SESSION__.hasArtifact(),
                    state: globalThis.__H5_SESSION__.getState()
                };
            },
            invalidGenerated
        );
        assert.equal(
            formulaFailure.errorResult.code,
            'HANDOUT_COMPILE_FAILED'
        );
        assert.equal(formulaFailure.hasArtifact, false);
        assert.ok(formulaFailure.errorResult.diagnostics.some(
            diagnostic =>
                diagnostic.formulaId === 'question-h5:stem:1'
                && diagnostic.severity === 'error'
        ));

        blockChineseFont = true;
        const fontFailure = await page.evaluate(
            async documentValue => {
                globalThis.__H5_SESSION__.dispose();
                for (const name of await caches.keys()) {
                    if (name.startsWith(
                        'tex-handout-compiler-'
                    )) {
                        await caches.delete(name);
                    }
                }
                const session =
                    Qisi.HandoutPdfSession.createPdfSession();
                globalThis.__H5_SESSION__ = session;
                let failure = null;
                try {
                    await session.compileGenerated(
                        documentValue,
                        []
                    );
                } catch (error) {
                    failure = {
                        code: error.code,
                        diagnostics: error.diagnostics
                    };
                }
                return {
                    failure,
                    hasArtifact: session.hasArtifact()
                };
            },
            generated
        );
        blockChineseFont = false;
        assert.equal(fontFailure.hasArtifact, false);
        assert.equal(fontFailure.failure.code, 'HANDOUT_COMPILE_FAILED');
        assert.ok(fontFailure.failure.diagnostics.some(
            diagnostic =>
                diagnostic.code === 'HANDOUT_COMPILER_FONT_MISSING'
        ));

        const recovered = await page.evaluate(
            async documentValue => {
                const artifact = await globalThis.__H5_SESSION__
                    .compileGenerated(documentValue, []);
                return {
                    signature: String.fromCharCode(
                        ...globalThis.__H5_SESSION__
                            .copyPdfBytes()
                            .slice(0, 5)
                    ),
                    metrics: artifact.metrics
                };
            },
            generated
        );
        assert.equal(recovered.signature, '%PDF-');

        const lifecycle = await page.evaluate(() => {
            const session = globalThis.__H5_SESSION__;
            const url = session.getPreviewUrl();
            session.closePreview();
            return {
                url,
                hasArtifact: session.hasArtifact(),
                state: session.getState()
            };
        });
        assert.equal(lifecycle.hasArtifact, false);
        assert.equal(lifecycle.state.phase, 'idle');
        assert.ok(lifecycle.url.startsWith('blob:'));
        assert.deepEqual(externalRequests, []);
    } catch (error) {
        error.message += `\nH5 server output:\n${output.join('')}`;
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(child);
    }
});
