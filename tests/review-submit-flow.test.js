'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');
const { waitForPageCondition } = require('./helpers/page-waits.js');

const ROOT = path.resolve(__dirname, '..');

const NAV_BATCH = '\u6279\u91cf\u5f55\u9898';
const CONTINUE_REVIEW = '\u7ee7\u7eed\u5ba1\u6838';
const FILTER_PROBLEMS = '\u6709\u95ee\u9898';
const SAVE_DRAFT = '\u4fdd\u5b58\u4fee\u6539';
const SUBMIT_ONE = '\u4e00\u952e\u63d0\u4ea4\u672c\u9898';
const EDIT_MARKER = '\u5ba1\u6838\u540e\u4fee\u6539\u7684\u9898\u5e72';

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            probe.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error('local server exited before startup');
        try {
            const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1_000) });
            if (response.ok) return;
        } catch (_) {
            // bounded readiness loop
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

test('a draft can be reviewed, edited and only then reach the formal bank', {
    timeout: 120_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
                return route.abort('blockedbyclient');
            }
            if (url.pathname.startsWith('/api/ai/') || url.pathname.startsWith('/api/ocr')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ choices: [{ message: { content: '{"questions":[]}' } }] })
                });
            }
            return route.continue();
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            await Promise.all(database.tables.map(table => table.clear()));
            const now = Date.now();
            await database.draftImportBatches.put({
                id: 'submit-review-batch',
                status: 'review',
                progress: 100,
                title: '\u5ba1\u6838\u5230\u5165\u5e93\u9a8c\u6536',
                fileNames: ['\u9898\u76ee.docx'],
                totalCount: 2,
                reviewedCount: 0,
                submittedCount: 0,
                problemCount: 0,
                createdAt: now,
                updatedAt: now
            });
            await database.draftImportFiles.put({
                id: 'submit-review-file',
                batchId: 'submit-review-batch',
                name: '\u9898\u76ee.docx',
                fileName: '\u9898\u76ee.docx',
                role: 'question',
                roles: ['question'],
                fileType: 'docx',
                parseStatus: 'success',
                createdAt: now,
                updatedAt: now
            });
            await database.draftQuestions.bulkPut([
                {
                    id: 'submit-draft-1',
                    batchId: 'submit-review-batch',
                    order: 1,
                    questionNumber: '1',
                    status: 'draft',
                    duplicateStatus: 'new',
                    selected: true,
                    grade: '\u9ad8\u4e8c',
                    type: '\u5355\u9009\u9898',
                    diff: '\u4e2d\u7b49',
                    year: '2026',
                    stem: '\u5f85\u5ba1\u9898\u4e00 $x=1$',
                    options: ['$1$', '$2$', '$3$', '$4$'],
                    answer: 'A',
                    solution: '\u5f85\u5ba1\u89e3\u6790\u4e00',
                    images: [],
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: 'submit-draft-2',
                    batchId: 'submit-review-batch',
                    order: 2,
                    questionNumber: '2',
                    // Deliberately incomplete so the problem filter has something to find.
                    status: 'draft',
                    duplicateStatus: 'new',
                    selected: true,
                    grade: '\u9ad8\u4e8c',
                    type: '\u89e3\u7b54\u9898',
                    diff: '\u4e2d\u7b49',
                    year: '2026',
                    stem: '\u5f85\u5ba1\u9898\u4e8c $y=2$',
                    options: ['', '', '', ''],
                    answer: '',
                    solution: '',
                    images: [],
                    createdAt: now + 1,
                    updatedAt: now + 1
                }
            ]);
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });

        // The review page is the only place a draft may become a formal question.
        await navigation.getByRole('button', { name: NAV_BATCH, exact: true }).click();
        await page.getByRole('button', { name: CONTINUE_REVIEW }).first().click();
        const navItems = page.locator('.batch-question-nav-item');
        await navItems.first().waitFor({ state: 'visible', timeout: 20_000 });
        assert.equal(await navItems.count(), 2, 'both drafts must be listed for review');

        // A draft with no answer must be discoverable through the problem filter.
        await page.getByRole('button', { name: FILTER_PROBLEMS, exact: true }).click();
        await page.waitForTimeout(300);
        const problemsShown = await page.locator('.batch-question-nav-item').count();
        assert.ok(problemsShown >= 1, 'the incomplete draft must appear under 有问题');
        await page.getByRole('button', { name: '\u5168\u90e8', exact: true }).click();
        await page.waitForTimeout(200);

        // Nothing is in the bank before the explicit submit.
        const beforeSubmit = await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            return database.questions.count();
        });
        assert.equal(beforeSubmit, 0, 'a draft must never reach the bank on its own');

        // Edit the first draft and save the edit explicitly.
        await page.locator('.batch-question-nav-item').first().click();
        const draftEditor = page.locator('textarea').filter({
            hasText: ''
        }).first();
        const editorTextarea = page.getByPlaceholder(
            '\u5728\u8fd9\u91cc\u81ea\u7531\u7f16\u8f91\u9898\u5e72\u3001\u9009\u9879\u548c\u56fe\u7247 LaTeX\u3002\u53ea\u6709\u70b9\u51fb\u201c\u4fdd\u5b58\u4fee\u6539\u201d\u65f6\u624d\u4f1a\u6b63\u5f0f\u5199\u5165\u9898\u76ee\u3002',
            { exact: true }
        );
        await editorTextarea.waitFor({ state: 'visible' });
        const originalSource = await editorTextarea.inputValue();
        await editorTextarea.fill(`${EDIT_MARKER}\n${originalSource}`);
        await page.getByRole('button', { name: SAVE_DRAFT, exact: true }).click();

        await waitForPageCondition(page, async marker => {
            const database = window.Qisi.Database.getDatabase();
            const row = await database.draftQuestions.get('submit-draft-1');
            return String(row?.stem || '').includes(marker);
        }, EDIT_MARKER, { timeoutMs: 15_000, label: 'the saved draft edit' });

        const stillNotInBank = await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            return database.questions.count();
        });
        assert.equal(stillNotInBank, 0, 'saving a draft edit must not write the formal bank');

        // Submit exactly one draft.
        await page.getByRole('button', { name: SUBMIT_ONE, exact: true }).click();
        const snapshot = () => page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            return {
                formalCount: await database.questions.count(),
                draftStatus: (await database.draftQuestions.get('submit-draft-1'))?.status || '',
                batchSubmitted: (await database.draftImportBatches.get('submit-review-batch'))?.submittedCount || 0
            };
        });
        const timeline = [];
        for (let attempt = 0; attempt < 60; attempt += 1) {
            timeline.push(await snapshot());
            if (timeline[timeline.length - 1].formalCount === 1) break;
            await page.waitForTimeout(200);
        }

        const state = await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            const formal = await database.questions.toArray();
            const draft = await database.draftQuestions.get('submit-draft-1');
            const other = await database.draftQuestions.get('submit-draft-2');
            const batch = await database.draftImportBatches.get('submit-review-batch');
            return {
                formalCount: formal.length,
                formalStem: String(formal[0]?.stem || ''),
                formalOptions: (formal[0]?.options || []).map(value => String(value || '')),
                formalAnswer: String(formal[0]?.answer || ''),
                formalSolution: String(formal[0]?.solution || ''),
                formalGrade: String(formal[0]?.grade || ''),
                formalType: String(formal[0]?.type || ''),
                formalDiff: String(formal[0]?.diff || ''),
                draftOptions: (draft?.options || []).map(value => String(value || '')),
                draftAnswer: String(draft?.answer || ''),
                draftSolution: String(draft?.solution || ''),
                submittedStatus: draft?.status || '',
                otherStatus: other?.status || '',
                submittedCount: batch?.submittedCount || 0
            };
        });

        assert.equal(
            state.formalCount,
            1,
            'exactly the submitted draft becomes a formal question; timeline: ' + JSON.stringify(timeline.slice(-6))
        );
        assert.match(state.formalStem, new RegExp(EDIT_MARKER), 'the reviewed edit is what gets stored');
        assert.equal(state.submittedStatus, 'submitted', 'the submitted draft is marked as such');
        assert.notEqual(state.otherStatus, 'submitted', 'the other draft must stay out of the bank');
        assert.equal(state.submittedCount, 1, 'the batch summary must count the submission');

        // Field consistency across the review -> formal step: nothing may be dropped or reordered.
        assert.deepEqual(state.formalOptions, state.draftOptions, 'options must survive submission unchanged');
        assert.equal(state.formalAnswer, state.draftAnswer, 'the answer must survive submission');
        assert.equal(state.formalSolution, state.draftSolution, 'the solution must survive submission');
        assert.equal(state.formalGrade, '\u9ad8\u4e8c', 'the reviewed grade must be kept');
        assert.equal(state.formalType, '\u5355\u9009\u9898', 'the reviewed type must be kept');
        assert.equal(state.formalDiff, '\u4e2d\u7b49', 'the reviewed difficulty must be kept');

        // Re-entering the page must show the same state.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await navigation.getByRole('button', { name: NAV_BATCH, exact: true }).click();
        await page.getByRole('button', { name: CONTINUE_REVIEW }).first().click();
        await navItems.first().waitFor({ state: 'visible', timeout: 20_000 });
        const afterReload = await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            return {
                formalCount: await database.questions.count(),
                submitted: (await database.draftQuestions.get('submit-draft-1'))?.status || ''
            };
        });
        assert.equal(afterReload.formalCount, 1, 'the formal question survives a reload');
        assert.equal(afterReload.submitted, 'submitted', 'the draft state survives a reload');

        assert.deepEqual(pageErrors, [], `page errors: ${serverOutput.join('').slice(-300)}`);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});

test('submitting the same draft twice cannot create a second formal question', {
    timeout: 120_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});

    let browser;
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
                return route.abort('blockedbyclient');
            }
            return route.continue();
        });
        const page = await context.newPage();

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });
        await page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            await Promise.all(database.tables.map(table => table.clear()));
            const now = Date.now();
            await database.draftImportBatches.put({
                id: 'double-submit-batch',
                status: 'review',
                progress: 100,
                title: '\u91cd\u590d\u63d0\u4ea4\u9a8c\u6536',
                fileNames: ['\u9898\u76ee.docx'],
                totalCount: 1,
                submittedCount: 0,
                createdAt: now,
                updatedAt: now
            });
            await database.draftQuestions.put({
                id: 'double-submit-draft',
                batchId: 'double-submit-batch',
                order: 1,
                questionNumber: '1',
                status: 'draft',
                duplicateStatus: 'new',
                selected: true,
                grade: '\u9ad8\u4e8c',
                type: '\u5355\u9009\u9898',
                diff: '\u4e2d\u7b49',
                stem: '\u91cd\u590d\u63d0\u4ea4\u9a8c\u6536 $z=3$',
                options: ['$1$', '$2$', '$3$', '$4$'],
                answer: 'C',
                solution: '\u91cd\u590d\u63d0\u4ea4\u89e3\u6790',
                images: [],
                createdAt: now,
                updatedAt: now
            });
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await navigation.getByRole('button', { name: NAV_BATCH, exact: true }).click();
        await page.getByRole('button', { name: CONTINUE_REVIEW }).first().click();
        await page.locator('.batch-question-nav-item').first().waitFor({ state: 'visible', timeout: 20_000 });

        const submitButton = page.getByRole('button', { name: SUBMIT_ONE, exact: true });
        await submitButton.click();
        // A second click lands while the first submission is still settling. A button that is
        // already disabled, or a handler that is idempotent, is what keeps the bank clean.
        await submitButton.click({ timeout: 2_000 }).catch(() => {});

        const readOutcome = () => page.evaluate(async () => {
            const database = window.Qisi.Database.getDatabase();
            const formal = await database.questions.toArray();
            const batch = await database.draftImportBatches.get('double-submit-batch');
            return {
                formalCount: formal.length,
                submittedCount: batch?.submittedCount || 0
            };
        });
        const timeline = [];
        const deadline = Date.now() + 20_000;
        let outcome = await readOutcome();
        while ((outcome.formalCount !== 1 || outcome.submittedCount !== 1) && Date.now() < deadline) {
            timeline.push(outcome);
            await page.waitForTimeout(250);
            outcome = await readOutcome();
        }

        assert.equal(
            outcome.formalCount,
            1,
            `a double click must not duplicate the question; timeline: ${JSON.stringify(timeline.slice(-6))}`
        );
        assert.equal(
            outcome.submittedCount,
            1,
            `the batch must count exactly one submission; timeline: ${JSON.stringify(timeline.slice(-6))}`
        );
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});
