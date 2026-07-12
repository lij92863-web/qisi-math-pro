const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const CDN_CACHE = path.join(
    ROOT,
    'local-run-artifacts',
    'r2-e2e-cdn-cache'
);

const contentTypeFor = url => {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
    if (pathname.endsWith('.woff2')) return 'font/woff2';
    if (pathname.endsWith('.woff')) return 'font/woff';
    if (pathname.endsWith('.json')) return 'application/json';
    return 'application/javascript; charset=utf-8';
};

const cachedExternalAsset = async url => {
    fs.mkdirSync(CDN_CACHE, { recursive: true });
    const key = crypto.createHash('sha256').update(url).digest('hex');
    const bodyPath = path.join(CDN_CACHE, `${key}.bin`);

    if (fs.existsSync(bodyPath)) {
        return fs.readFileSync(bodyPath);
    }

    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(12000)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${url}`);
            }
            const body = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(bodyPath, body);
            return body;
        } catch (error) {
            lastError = error;
            await new Promise(resolve =>
                setTimeout(resolve, 200 * (attempt + 1))
            );
        }
    }

    throw lastError;
};

const requestOk = url => new Promise(resolve => {
    const request = http.get(url, response => {
        response.resume();
        resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('error', () => resolve(false));
    request.setTimeout(1000, () => {
        request.destroy();
        resolve(false);
    });
});

const waitForHealth = async (url, child) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        if (child.exitCode != null) {
            throw new Error(`local server exited early with ${child.exitCode}`);
        }
        if (await requestOk(url)) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`local server did not become healthy: ${url}`);
};

const startBrowserApp = async (port) => {
    const output = [];
    const child = spawn(
        process.execPath,
        ['qisi-local-server.js'],
        {
            cwd: ROOT,
            env: {
                ...process.env,
                PORT: String(port)
            },
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );
    child.stdout.on('data', chunk => output.push(String(chunk)));
    child.stderr.on('data', chunk => output.push(String(chunk)));

    const stopServer = () => new Promise(resolve => {
        if (child.exitCode != null) {
            resolve();
            return;
        }

        const timeout = setTimeout(resolve, 3000);
        child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
        });
        child.kill('SIGKILL');
    });

    const origin = `http://127.0.0.1:${port}`;
    await waitForHealth(`${origin}/api/health`, child);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        acceptDownloads: true
    });
    const forbiddenRequests = [];
    const pageErrors = [];
    const consoleErrors = [];

    await context.route('**/api/ai/**', async route => {
        forbiddenRequests.push(route.request().url());
        await route.abort('blockedbyclient');
    });
    await context.route(/^https:\/\//, async route => {
        const url = route.request().url();
        try {
            const body = await cachedExternalAsset(url);
            await route.fulfill({
                status: 200,
                body,
                headers: {
                    'content-type': contentTypeFor(url),
                    'access-control-allow-origin': '*',
                    'cache-control': 'public, max-age=31536000'
                }
            });
        } catch {
            await route.continue();
        }
    });

    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
    page.on('console', message => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });

    try {
        await page.goto(`${origin}/main.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await page.waitForFunction(
            () => Boolean(
                window.Qisi?.Runtime
                    ?.getRuntimeDependency('AppProxy')
            ),
            null,
            { timeout: 30000 }
        );
    } catch (error) {
        await context.close();
        await browser.close();
        await stopServer();
        throw new Error([
            error?.message || String(error),
            ...pageErrors,
            ...consoleErrors,
            ...output
        ].join('\n'));
    }

    const close = async () => {
        await context.close();
        await browser.close();
        await stopServer();
    };

    return {
        root: ROOT,
        origin,
        page,
        context,
        child,
        output,
        forbiddenRequests,
        pageErrors,
        consoleErrors,
        close
    };
};

const callProxy = (page, method, ...args) =>
    page.evaluate(
        async ({ methodName, methodArgs }) => {
            const proxy =
                window.Qisi?.Runtime
                    ?.getRuntimeDependency('AppProxy');
            if (!proxy || typeof proxy[methodName] !== 'function') {
                throw new Error(`Vue proxy method unavailable: ${methodName}`);
            }
            return proxy[methodName](...methodArgs);
        },
        {
            methodName: method,
            methodArgs: args
        }
    );

const withDb = (page, callbackSource, payload) =>
    page.evaluate(
        async ({ source, value }) => {
            const db = new window.Dexie('QisiMathVueDB');
            await db.open();
            try {
                const callback = (0, eval)(`(${source})`);
                return await callback(db, value);
            } finally {
                db.close();
            }
        },
        {
            source: callbackSource.toString(),
            value: payload
        }
    );

const seedReviewBatch = (page, {
    batchId = 'e2e_batch',
    title = 'E2E DOCX + PDF mock'
} = {}) =>
    withDb(
        page,
        async (db, value) => {
            const now = Date.now();
            await db.table('draftImportBatches').put({
                id: value.batchId,
                title: value.title,
                sourceType: 'mixed',
                sourceFileName: 'mock-question.docx + mock-support.pdf',
                status: 'review',
                progress: 100,
                totalCount: 2,
                reviewedCount: 0,
                submittedCount: 0,
                problemCount: 1,
                unassignedImageCount: 0,
                createdAt: now,
                updatedAt: now
            });
            await db.table('draftImportFiles').bulkPut([
                {
                    id: `${value.batchId}_docx`,
                    batchId: value.batchId,
                    filename: 'mock-question.docx',
                    fileType: 'docx',
                    role: 'question',
                    roles: ['question'],
                    parseStatus: 'completed',
                    createdAt: now
                },
                {
                    id: `${value.batchId}_pdf`,
                    batchId: value.batchId,
                    filename: 'mock-support.pdf',
                    fileType: 'pdf',
                    role: 'answer',
                    roles: ['answer', 'solution'],
                    parseStatus: 'safe-partial',
                    createdAt: now
                }
            ]);
            await db.table('draftQuestions').bulkPut([
                {
                    id: `${value.batchId}_q1`,
                    batchId: value.batchId,
                    order: 1,
                    questionNumber: '1',
                    status: 'pending',
                    duplicateStatus: 'none',
                    selected: true,
                    grade: '高一',
                    diff: '中等',
                    type: '单选题',
                    stem: 'E2E original stem',
                    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
                    answer: 'A',
                    solution: 'Original solution',
                    images: [],
                    warnings: [],
                    source: 'mock-question.docx',
                    sourceTrace: {
                        sourceFile: 'mock-question.docx',
                        sourceType: 'docx'
                    },
                    imageReviewStatus: 'none',
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: `${value.batchId}_q2`,
                    batchId: value.batchId,
                    order: 2,
                    questionNumber: '2',
                    status: 'pending',
                    duplicateStatus: 'none',
                    selected: true,
                    grade: '高一',
                    diff: '中等',
                    type: '解答题',
                    stem: 'PDF safe partial question',
                    options: ['', '', '', ''],
                    answer: '',
                    solution: 'Evidence-only partial solution',
                    images: [],
                    warnings: [
                        'pdf-safe-partial',
                        'missing_answer',
                        'manual-review-required'
                    ],
                    supportLevel: 'prefix',
                    manualReviewRequired: true,
                    source: 'mock-support.pdf',
                    sourceTrace: {
                        sourceFile: 'mock-support.pdf',
                        sourceType: 'pdf',
                        page: 1
                    },
                    imageReviewStatus: 'none',
                    createdAt: now,
                    updatedAt: now
                }
            ]);
            return value.batchId;
        },
        { batchId, title }
    );

const getDbSnapshot = page =>
    withDb(
        page,
        async db => ({
            questions: await db.table('questions').toArray(),
            batches: await db.table('draftImportBatches').toArray(),
            drafts: await db.table('draftQuestions').toArray()
        }),
        null
    );

const waitForDbSnapshot = async (
    page,
    predicate,
    {
        timeout = 15000,
        interval = 100
    } = {}
) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeout) {
        const snapshot = await getDbSnapshot(page);
        if (predicate(snapshot)) {
            return snapshot;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('timed out waiting for IndexedDB state');
};

const clearE2eData = page =>
    withDb(
        page,
        async db => {
            const tables = [
                'questions',
                'images',
                'draftImportBatches',
                'draftImportFiles',
                'draftQuestions',
                'draftImages'
            ];
            for (const name of tables) {
                await db.table(name).clear();
            }
            return true;
        },
        null
    );

const assertNoRuntimeErrors = harness => {
    if (harness.forbiddenRequests.length) {
        throw new Error(
            `real AI/OCR requests attempted: ${harness.forbiddenRequests.join(', ')}`
        );
    }
    if (harness.pageErrors.length) {
        throw new Error(
            `page errors: ${harness.pageErrors.join('\n')}`
        );
    }
    if (harness.consoleErrors.length) {
        throw new Error(
            `console errors: ${harness.consoleErrors.join('\n')}`
        );
    }
};

module.exports = {
    startBrowserApp,
    callProxy,
    seedReviewBatch,
    getDbSnapshot,
    waitForDbSnapshot,
    clearE2eData,
    assertNoRuntimeErrors
};
