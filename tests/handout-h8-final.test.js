'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');

const pdfjsLib = require('../vendor/pdfjs-dist/3.11.174/pdf.min.js');
const documentPipeline = require('../qisi-handout-document.js');
const model = require('../qisi-handout-model.js');
const formulaFixture = require('./fixtures/handout-h8-formulas.json');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ARTIFACT_ROOT = path.join(
    ROOT,
    'local-run-artifacts',
    'handout-h8'
);
const ARTIFACT_ROOT = path.resolve(
    process.env.H8_ARTIFACT_DIR || DEFAULT_ARTIFACT_ROOT
);
const NOW = '2026-07-29T08:00:00.000Z';

pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    ROOT,
    'vendor',
    'pdfjs-dist',
    '3.11.174',
    'pdf.worker.min.js'
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
        server.close(error => error ? reject(error) : resolve(port));
    });
});

const waitForServer = async (origin, child) => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) {
            throw new Error(
                `local server exited before H8 acceptance (${child.exitCode})`
            );
        }
        try {
            const response = await fetch(`${origin}/api/health`, {
                signal: AbortSignal.timeout(1_000)
            });
            if (response.ok) return;
        } catch (_) {
            // Ignore the bounded local startup race.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not start for H8 acceptance');
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

const makeQuestion = ({
    id = 'question-h8',
    stem = 'H8题干 $x^2+1=5$',
    answer = 'H8_ANSWER_SENTINEL',
    analysis = 'H8_ANALYSIS_SENTINEL',
    solution = 'H8_SOLUTION_SENTINEL：$x=2$'
} = {}) => ({
    id,
    type: 'question',
    sourceQuestionId: `source-${id}`,
    snapshot: {
        snapshotVersion: 1,
        sourceQuestionId: `source-${id}`,
        sourceUpdatedAt: NOW,
        capturedAt: NOW,
        questionNumber: '1',
        stem,
        options: ['$1$', '$2$', '$3$', '$4$'],
        answer,
        analysis,
        solution,
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
        analysisPlacement: 'end',
        solutionPlacement: 'end',
        answerSpaceLines: 1
    },
    questionLabel: {
        preset: 'exercise',
        customText: ''
    },
    optionLayout: {
        mode: 'two-columns'
    },
    imageLayout: {
        mode: 'flow',
        columns: 1,
        gapMm: 4
    },
    images: [],
    latexNormalization: {
        useDisplayFractions: false,
        normalizePunctuation: false,
        normalizeSpacing: false
    }
});

const makePageHandout = pageCount => {
    const blocks = [];
    for (let page = 1; page <= pageCount; page += 1) {
        blocks.push({
            id: `h8-page-${page}`,
            type: 'body',
            content: [
                `H8 性能页 ${page}/${pageCount}。`,
                '$$\\frac{x^2}{m}+\\frac{y^2}{n}=1$$',
                '$$\\overrightarrow{AB}\\cdot\\overrightarrow{CD}=0$$',
                '$$\\sum_{i=1}^{n}(x_i-\\bar x)^2=10$$'
            ].join('\n')
        });
        if (page < pageCount) {
            blocks.push({
                id: `h8-break-${page}`,
                type: 'page-break'
            });
        }
    }
    return model.createHandout({
        title: `H8 ${pageCount} 页性能样本`,
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
        blocks
    }, {
        id: `handout-h8-pages-${pageCount}`,
        now: NOW
    });
};

const makeFormulaHandout = () => model.createHandout({
    title: 'H8 真实材料公式兼容性',
    settings: {
        header: {
            enabled: true,
            text: '{title}',
            alignment: 'center'
        },
        footer: {
            enabled: true,
            text: '{page}/{pages}',
            alignment: 'center'
        }
    },
    blocks: formulaFixture.formulas.map((item, index) => ({
        id: `formula-${item.id}`,
        type: 'body',
        content: `${index + 1}. ${item.id}\n$$${item.latex}$$`
    }))
}, {
    id: 'handout-h8-formula-corpus',
    now: NOW
});

const makeEditionHandout = () => model.createHandout({
    title: 'H8 学生教师双版本验收',
    settings: {
        header: {
            enabled: true,
            text: '{title} · {edition}',
            alignment: 'center'
        },
        footer: {
            enabled: true,
            text: '第 {page}/{pages} 页',
            alignment: 'center'
        }
    },
    blocks: [
        {
            id: 'h8-title',
            type: 'heading',
            level: 1,
            text: '函数与向量专题'
        },
        {
            id: 'h8-body',
            type: 'body',
            content: '请独立完成下列题目，过程书写清楚。'
        },
        makeQuestion()
    ]
}, {
    id: 'handout-h8-editions',
    now: NOW
});

const buildMeasured = (handout, edition) => {
    const startedAt = performance.now();
    const generated = documentPipeline.buildTypstDocument(
        handout,
        edition
    );
    return {
        generated,
        sourceGenerationMs: Math.round(
            (performance.now() - startedAt) * 100
        ) / 100
    };
};

const extractPdfText = async bytes => {
    const loading = pdfjsLib.getDocument({
        data: new Uint8Array(bytes),
        disableWorker: true,
        isEvalSupported: false
    });
    const document = await loading.promise;
    const pages = [];
    for (
        let pageNumber = 1;
        pageNumber <= document.numPages;
        pageNumber += 1
    ) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
    }
    await document.destroy();
    return {
        pageCount: pages.length,
        text: pages.join('\n')
    };
};

const installOfflineRoute = async (context, origin, evidence) => {
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (
            ['http:', 'https:'].includes(url.protocol)
            && url.origin !== origin
        ) {
            evidence.externalRequests.push(url.href);
            return route.abort('blockedbyclient');
        }
        return route.continue();
    });
};

const openCompilerPage = async (context, origin, evidence) => {
    const page = await context.newPage();
    page.on('pageerror', error => {
        evidence.pageErrors.push(error.message);
    });
    page.on('console', message => {
        if (message.type() === 'error') {
            evidence.consoleErrors.push(message.text());
        }
    });
    page.on('response', response => {
        if (
            response.url().startsWith(origin)
            && response.status() >= 400
        ) {
            evidence.badResponses.push(
                `${response.status()} ${new URL(response.url()).pathname}`
            );
        }
    });
    await page.goto(`${origin}/handout.html`, {
        waitUntil: 'domcontentloaded'
    });
    await page.waitForFunction(
        () => globalThis.__TEX_HANDOUT_READY__ === true,
        null,
        { timeout: 15_000 }
    );
    return page;
};

const compileInPage = async (
    page,
    generated,
    {
        clearCaches = false,
        resetSession = false,
        includePdf = false
    } = {}
) => page.evaluate(async ({
    documentValue,
    clearCachesValue,
    resetSessionValue,
    includePdfValue
}) => {
    if (clearCachesValue) {
        for (const name of await caches.keys()) {
            if (name.startsWith('tex-handout-compiler-')) {
                await caches.delete(name);
            }
        }
        const stale = await caches.open(
            'tex-handout-compiler-h5-stale-h8'
        );
        await stale.put(
            new Request(`${location.origin}/h8-stale`),
            new Response('stale')
        );
    }
    if (resetSessionValue && globalThis.__H8_SESSION__) {
        globalThis.__H8_SESSION__.dispose();
        globalThis.__H8_SESSION__ = null;
    }
    const session = globalThis.__H8_SESSION__
        || Qisi.HandoutPdfSession.createPdfSession();
    globalThis.__H8_SESSION__ = session;
    const memoryBefore = performance.memory?.usedJSHeapSize ?? null;
    let heartbeats = 0;
    const heartbeat = setInterval(() => {
        heartbeats += 1;
    }, 5);
    const startedAt = performance.now();
    try {
        const artifact = await session.compileGenerated(
            documentValue,
            []
        );
        const bytes = session.copyPdfBytes();
        const canvas = document.createElement('canvas');
        const preview = await session.renderPreview(canvas, {
            pageNumber: 1,
            scale: 0.25
        });
        const memoryAfter = performance.memory?.usedJSHeapSize ?? null;
        let pdfBase64 = null;
        if (includePdfValue) {
            let binary = '';
            const chunkSize = 0x8000;
            for (
                let offset = 0;
                offset < bytes.length;
                offset += chunkSize
            ) {
                binary += String.fromCharCode(
                    ...bytes.subarray(offset, offset + chunkSize)
                );
            }
            pdfBase64 = btoa(binary);
        }
        return {
            metrics: artifact.metrics,
            pageCount: preview.pageCount,
            totalMs: Math.round(
                (performance.now() - startedAt) * 100
            ) / 100,
            heartbeats,
            memoryBefore,
            memoryAfter,
            memoryDelta: memoryBefore === null || memoryAfter === null
                ? null
                : memoryAfter - memoryBefore,
            pdfBase64,
            cacheNames: await caches.keys()
        };
    } finally {
        clearInterval(heartbeat);
    }
}, {
    documentValue: generated,
    clearCachesValue: clearCaches,
    resetSessionValue: resetSession,
    includePdfValue: includePdf
});

const launchPersistent = async profileDirectory =>
    chromium.launchPersistentContext(profileDirectory, {
        headless: true,
        viewport: {
            width: 1680,
            height: 1050
        },
        args: [
            '--enable-precise-memory-info'
        ]
    });

test('H8 produces real-formula, performance, offline and edition evidence', {
    timeout: 360_000
}, async () => {
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
    const profileDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'tex-handout-h8-')
    );
    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
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
    server.stdout.on('data', chunk => {
        serverOutput.push(chunk.toString());
    });
    server.stderr.on('data', chunk => {
        serverOutput.push(chunk.toString());
    });

    const evidence = {
        externalRequests: [],
        pageErrors: [],
        consoleErrors: [],
        badResponses: []
    };
    let context;
    let restartedContext;
    try {
        await waitForServer(origin, server);
        context = await launchPersistent(profileDirectory);
        await installOfflineRoute(context, origin, evidence);
        const page = await openCompilerPage(context, origin, evidence);

        const pageDocuments = {};
        for (const count of [5, 20, 50]) {
            pageDocuments[count] = buildMeasured(
                makePageHandout(count),
                'student'
            );
        }
        const formulaDocument = buildMeasured(
            makeFormulaHandout(),
            'student'
        );
        const editionHandout = makeEditionHandout();
        const studentDocument = buildMeasured(
            editionHandout,
            'student'
        );
        const teacherDocument = buildMeasured(
            editionHandout,
            'teacher'
        );

        const cold = await compileInPage(
            page,
            pageDocuments[5].generated,
            {
                clearCaches: true,
                resetSession: true
            }
        );
        const warm = await compileInPage(
            page,
            pageDocuments[5].generated
        );
        const formula = await compileInPage(
            page,
            formulaDocument.generated,
            { includePdf: true }
        );
        const page20 = await compileInPage(
            page,
            pageDocuments[20].generated
        );
        const page50 = await compileInPage(
            page,
            pageDocuments[50].generated
        );
        const student = await compileInPage(
            page,
            studentDocument.generated,
            { includePdf: true }
        );
        const teacher = await compileInPage(
            page,
            teacherDocument.generated,
            { includePdf: true }
        );

        const formulaBytes = Buffer.from(
            formula.pdfBase64,
            'base64'
        );
        const studentBytes = Buffer.from(
            student.pdfBase64,
            'base64'
        );
        const teacherBytes = Buffer.from(
            teacher.pdfBase64,
            'base64'
        );
        const studentPath = path.join(
            ARTIFACT_ROOT,
            'h8-student-example.pdf'
        );
        const teacherPath = path.join(
            ARTIFACT_ROOT,
            'h8-teacher-example.pdf'
        );
        fs.writeFileSync(
            path.join(
                ARTIFACT_ROOT,
                'h8-formula-compatibility.pdf'
            ),
            formulaBytes
        );
        fs.writeFileSync(studentPath, studentBytes);
        fs.writeFileSync(teacherPath, teacherBytes);

        const studentText = await extractPdfText(studentBytes);
        const teacherText = await extractPdfText(teacherBytes);
        const leakageSentinels = [
            'H8_ANSWER_SENTINEL',
            'H8_ANALYSIS_SENTINEL',
            'H8_SOLUTION_SENTINEL'
        ];
        const leakage = leakageSentinels.filter(
            sentinel => studentText.text.includes(sentinel)
        );
        const teacherMissing = leakageSentinels.filter(
            sentinel => !teacherText.text.includes(sentinel)
        );

        await context.close();
        context = null;
        restartedContext = await launchPersistent(profileDirectory);
        const restartedEvidence = {
            externalRequests: [],
            pageErrors: [],
            consoleErrors: [],
            badResponses: []
        };
        await installOfflineRoute(
            restartedContext,
            origin,
            restartedEvidence
        );
        const restartedPage = await openCompilerPage(
            restartedContext,
            origin,
            restartedEvidence
        );
        const restarted = await compileInPage(
            restartedPage,
            pageDocuments[5].generated,
            {
                resetSession: true
            }
        );
        for (const key of Object.keys(evidence)) {
            evidence[key].push(...restartedEvidence[key]);
        }

        const performanceRows = [
            ['5-cold', pageDocuments[5], cold],
            ['5-warm', pageDocuments[5], warm],
            ['20-warm', pageDocuments[20], page20],
            ['50-warm', pageDocuments[50], page50],
            ['5-browser-restart-cache', pageDocuments[5], restarted]
        ].map(([label, documentValue, result]) => ({
            label,
            requestedPages: Number(label.split('-')[0]),
            producedPages: result.pageCount,
            sourceGenerationMs: documentValue.sourceGenerationMs,
            sourceBytes: Buffer.byteLength(
                documentValue.generated.source
            ),
            ...result.metrics,
            totalMs: result.totalMs,
            heartbeatCount: result.heartbeats,
            memoryBefore: result.memoryBefore,
            memoryAfter: result.memoryAfter,
            memoryDelta: result.memoryDelta
        }));

        const report = {
            schemaVersion: 1,
            stage: 'H8',
            formulaCompatibility: {
                source: formulaFixture.source,
                acceptanceQuestionBankCount: 0,
                formulaCount: formulaFixture.formulas.length,
                passed: formulaFixture.formulas.map(item => item.id),
                failed: [],
                sourceGenerationMs:
                    formulaDocument.sourceGenerationMs,
                compileMetrics: formula.metrics,
                producedPages: formula.pageCount,
                pdfBytes: formulaBytes.byteLength
            },
            performance: performanceRows,
            offline: {
                externalNetworkBlocked: true,
                coldLocalAssetCompilePassed: cold.pageCount === 5,
                warmCompilePassed: warm.pageCount === 5,
                browserRestartCompilePassed:
                    restarted.pageCount === 5,
                browserRestartCacheHits:
                    restarted.metrics.cacheHits,
                browserRestartCacheMisses:
                    restarted.metrics.cacheMisses,
                staleCacheRemoved: !cold.cacheNames.includes(
                    'tex-handout-compiler-h5-stale-h8'
                )
            },
            editions: {
                student: {
                    pageCount: studentText.pageCount,
                    pdfBytes: studentBytes.byteLength,
                    leakedSentinels: leakage
                },
                teacher: {
                    pageCount: teacherText.pageCount,
                    pdfBytes: teacherBytes.byteLength,
                    missingSentinels: teacherMissing
                }
            },
            browserRuntime: evidence
        };
        fs.writeFileSync(
            path.join(ARTIFACT_ROOT, 'h8-metrics.json'),
            `${JSON.stringify(report, null, 2)}\n`,
            'utf8'
        );

        assert.equal(formula.pageCount >= 1, true);
        assert.equal(
            formulaFixture.formulas.length,
            32
        );
        assert.deepEqual(
            performanceRows.map(row => row.producedPages),
            [5, 5, 20, 50, 5]
        );
        assert.equal(cold.metrics.runtimeCold, true);
        assert.ok(cold.metrics.cacheMisses >= 10);
        assert.ok(cold.metrics.assetLoadMs >= 0);
        assert.ok(cold.metrics.fontLoadMs >= 0);
        assert.ok(cold.metrics.compilerInitMs >= 0);
        assert.ok(cold.metrics.preflightMs >= 0);
        assert.ok(cold.metrics.pdfGenerationMs >= 0);
        assert.equal(warm.metrics.runtimeCold, false);
        assert.equal(warm.metrics.cacheMisses, cold.metrics.cacheMisses);
        assert.ok(cold.heartbeats > 0);
        assert.ok(page20.heartbeats > 0);
        assert.ok(page50.heartbeats > 0);
        assert.equal(restarted.metrics.cacheMisses, 0);
        assert.ok(restarted.metrics.cacheHits >= 10);
        assert.equal(
            restarted.cacheNames.includes(
                'tex-handout-compiler-h5-stale-h8'
            ),
            false
        );
        assert.deepEqual(leakage, []);
        assert.deepEqual(teacherMissing, []);
        assert.equal(evidence.externalRequests.length, 0);
        assert.deepEqual(evidence.pageErrors, []);
        assert.deepEqual(evidence.consoleErrors, []);
        assert.deepEqual(evidence.badResponses, []);
    } catch (error) {
        throw new Error([
            error?.stack || error,
            '--- local server output ---',
            serverOutput.join('')
        ].join('\n'));
    } finally {
        if (context) await context.close();
        if (restartedContext) await restartedContext.close();
        await stopProcess(server);
        fs.rmSync(profileDirectory, {
            recursive: true,
            force: true
        });
    }
});
