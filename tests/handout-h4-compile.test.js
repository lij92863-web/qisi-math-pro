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
                `local server exited before H4 compile (${child.exitCode})`
            );
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // The bounded readiness loop intentionally ignores transient startup.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not start for H4 compile');
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

const makeCompileHandout = () => model.createHandout({
    title: '函数与方程讲义',
    settings: {
        header: {
            enabled: true,
            text: '{title} · {edition}',
            alignment: 'right'
        },
        footer: {
            enabled: true,
            text: '第 {page}/{pages} 页',
            alignment: 'center'
        }
    },
    blocks: [{
        id: 'heading',
        type: 'heading',
        level: 1,
        text: '一、基础训练'
    }, {
        id: 'question',
        type: 'question',
        sourceQuestionId: 'source-question',
        snapshot: {
            snapshotVersion: 1,
            sourceQuestionId: 'source-question',
            sourceUpdatedAt: '2026-07-28T08:00:00.000Z',
            capturedAt: '2026-07-29T09:00:00.000Z',
            questionNumber: '1',
            stem: '已知 $f(x)=x^2+1$，求 $f(2)$。',
            options: ['$3$', '$4$', '$5$', '$6$'],
            answer: 'C',
            analysis: '代入计算。',
            solution: '$f(2)=2^2+1=5$。',
            teacherNote: '注意平方。',
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
            analysisPlacement: 'after-question',
            solutionPlacement: 'end',
            answerSpaceLines: 2
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
    }]
}, {
    id: 'handout-h4-compile',
    now: '2026-07-29T09:00:00.000Z'
});

test('H4 central student and teacher Typst documents compile locally', {
    timeout: 180_000
}, async () => {
    const handout = makeCompileHandout();
    const student = documentPipeline.buildTypstDocument(
        handout,
        'student'
    );
    const teacher = documentPipeline.buildTypstDocument(
        handout,
        'teacher'
    );
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
    try {
        await waitForServer(origin, child);
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();
        const externalRequests = [];
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
        await page.goto(`${origin}/prototypes/handout-typst/index.html`, {
            waitUntil: 'domcontentloaded'
        });
        const results = await page.evaluate(async documents => {
            const worker = new Worker(
                '/prototypes/handout-typst/compiler-worker.mjs',
                {
                    type: 'module',
                    name: 'tex-h4-template-acceptance'
                }
            );
            const compile = document => new Promise((resolve, reject) => {
                const requestId = `h1-h4-${document.edition}`;
                const timer = setTimeout(() => {
                    reject(new Error(`H4 ${document.edition} compile timeout`));
                }, 120_000);
                const onMessage = event => {
                    if (event.data?.requestId !== requestId) return;
                    if (event.data?.type === 'progress') return;
                    clearTimeout(timer);
                    worker.removeEventListener('message', onMessage);
                    if (event.data?.type === 'compiled') {
                        const bytes = new Uint8Array(event.data.pdfBytes);
                        resolve({
                            edition: document.edition,
                            byteLength: bytes.byteLength,
                            signature: String.fromCharCode(...bytes.slice(0, 5)),
                            diagnostics: event.data.diagnostics || []
                        });
                        return;
                    }
                    const error = new Error(event.data?.error || 'compile failed');
                    error.diagnostics = event.data?.diagnostics || [];
                    reject(error);
                };
                worker.addEventListener('message', onMessage);
                worker.postMessage({
                    type: 'compile',
                    requestId,
                    source: document.source,
                    lineMap: document.lineMap
                });
            });

            try {
                const compiled = [];
                for (const document of documents) {
                    compiled.push(await compile(document));
                }
                return compiled;
            } finally {
                worker.terminate();
            }
        }, [
            {
                edition: student.edition,
                source: student.source,
                lineMap: student.lineMap
            },
            {
                edition: teacher.edition,
                source: teacher.source,
                lineMap: teacher.lineMap
            }
        ]);

        assert.deepEqual(
            results.map(item => item.edition),
            ['student', 'teacher']
        );
        assert.ok(results.every(item => item.signature === '%PDF-'));
        assert.ok(results.every(item => item.byteLength > 1_000));
        assert.ok(results.every(item =>
            !item.diagnostics.some(diagnostic =>
                diagnostic.severity === 'error'
            )
        ));
        assert.deepEqual(externalRequests, []);
    } catch (error) {
        error.message += `\nH4 server output:\n${output.join('')}`;
        throw error;
    } finally {
        await context?.close().catch(() => {});
        await browser?.close().catch(() => {});
        await stopProcess(child);
    }
});
