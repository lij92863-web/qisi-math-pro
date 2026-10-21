// Two guarantees that outlive the retired Qwen execution chain and must hold for
// whatever produces PDF drafts: an unconfigured engine never reaches the network,
// and one batch cannot be recognised twice across browser windows.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
    startBrowserApp,
    installBrowserEngineInjection,
    createImportThroughUi,
    clearE2eData,
    callProxy,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

const fixture = path.resolve(__dirname, '../fixtures/true-import/pdf-question.pdf');
const pdfQuestion = () => ({
    question_no: '1', type: 'single', stem: 'Production question 1.',
    options: ['First', 'Second', 'Third', 'Fourth'].map((text, i) => ({ label: String.fromCharCode(65 + i), text })),
    figures: [], source_pages: [1], status: 'complete', warnings: []
});
const pdfResponse = () => ({
    value: {
        questions: [pdfQuestion()],
        answers: [{ question_no: '1', answer: 'A', figures: [], source_pages: [1], status: 'complete', warnings: [] }],
        solutions: [{ question_no: '1', solution: 'First is correct.', figures: [], source_pages: [1], status: 'complete', warnings: [] }]
    }
});

test('an unconfigured PDF engine fails the batch without any external request', { timeout: 90000 }, async () => {
    const h = await startBrowserApp(32176);
    try {
        await clearE2eData(h.page);
        const engine = await installBrowserEngineInjection(h.page, { externalDisabled: true, defaultResponse: pdfResponse });
        const imported = await createImportThroughUi(h.page, { files: [{ file: fixture, roles: ['full'] }] });
        const rows = imported.snapshot.drafts.filter(row => row.batchId === imported.batchId);
        const batch = imported.snapshot.batches.find(row => row.id === imported.batchId);
        assert.equal(rows.length, 0);
        assert.equal(imported.snapshot.questions.length, 0);
        assert.equal(engine.calls.filter(call => !call.endpoint.endsWith('/health')).length, 0);
        assert.equal(batch.status, 'failed');
        assert.equal(batch.importError?.causeCode || batch.importError?.code, 'MINERU_NOT_CONFIGURED');
        assert.deepEqual(h.pageErrors, []);
        // The controller logs the failure on purpose; nothing else may error.
        for (const message of h.consoleErrors) {
            assert.match(message, /normal-ui-import-controller.*IMPORT_RECOGNITION_FAILED/);
        }
        assert.equal(h.forbiddenRequests.length, 0);
        assert.equal(engine.realApiCalled, false);
    } finally {
        await h.close();
    }
});

test('two browser pages cannot recognise one batch while its cross-window lock is held', { timeout: 120000 }, async () => {
    const h = await startBrowserApp(32177);
    let second;
    try {
        await clearE2eData(h.page);
        const engine = await installBrowserEngineInjection(h.page, { defaultResponse: pdfResponse });
        const imported = await createImportThroughUi(h.page, { files: [{ file: fixture, roles: ['full'] }] });
        second = await h.context.newPage();
        await second.goto(h.origin + '/main.html', { waitUntil: 'domcontentloaded' });
        await second.evaluate(batchId => {
            window.lockEntered = false;
            window.heldImportLock = navigator.locks.request('qisi-normal-import:' + batchId, { mode: 'exclusive' }, async () => {
                window.lockEntered = true;
                await new Promise(resolve => { window.releaseImportLock = resolve; });
            });
        }, imported.batchId);
        await second.waitForFunction(() => window.lockEntered === true);
        const before = engine.calls.length;
        await assert.rejects(
            callProxy(h.page, 'runBatchRecognition', imported.batchId),
            /IMPORT_RUNNING_IN_ANOTHER_WINDOW/
        );
        assert.equal(engine.calls.length, before);
        assert.match(await h.page.locator('body').innerText(), /另一个窗口处理中/);
        await second.evaluate(async () => { window.releaseImportLock(); await window.heldImportLock; });
        await callProxy(h.page, 'runBatchRecognition', imported.batchId);
        // A completed source task is reused: no second upload for the same bytes.
        assert.equal(engine.calls.length, before);
        assert.equal(engine.realApiCalled, false);
        assert.equal(h.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(h);
    } finally {
        if (second) await second.close();
        await h.close();
    }
});
