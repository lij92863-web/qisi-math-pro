const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createNavigationRecorder } = require('../../scripts/golden/navigation.cjs');
const { traceStep, caseFailure } = require('../../scripts/golden/run.cjs');

test('a real document navigation destroys the pending operation and leaves its frame, loader and context evidence', { timeout: 30000 }, async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    let recorder;
    try {
        await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<a href="/next?private=value#secret">navigate</a>' }));
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:33581/start');
        recorder = createNavigationRecorder(await context.newCDPSession(page));
        await recorder.start();
        const started = page.waitForEvent('console', message => message.text() === 'pending-operation-started');
        const trace = [];
        const failure = traceStep(trace, 'pending-operation', () => page.evaluate(async () => {
            console.info('pending-operation-started');
            await new Promise(() => {});
        })).catch(error => error);
        await started;
        await page.locator('a').click();
        const original = await failure;
        assert.match(original.message, /Execution context was destroyed/);
        const result = caseFailure('intentional-navigation', original);
        assert.equal(result.ok, false);
        assert.equal(result.failureStage, 'pending-operation');
        const snapshot = recorder.snapshot();
        const request = snapshot.events.find(e => e.kind === 'Network.documentRequest' && e.url.endsWith('/next'));
        assert.ok(request, JSON.stringify(snapshot));
        assert.ok(request.frameId);
        assert.ok(request.loaderId);
        assert.ok(snapshot.events.some(e => e.kind === 'Page.frameNavigated' && e.loaderId === request.loaderId));
        assert.ok(snapshot.events.some(e => ['Runtime.executionContextsCleared', 'Runtime.executionContextDestroyed'].includes(e.kind)));
        assert.ok(snapshot.events.some(e => e.kind === 'Page.frameRequestedNavigation' && e.reason === 'anchorClick'));
        assert.doesNotMatch(JSON.stringify(snapshot), /private=value|#secret/);
    } finally {
        recorder?.stop();
        await context.close();
        await browser.close();
    }
});
