const test = require('node:test');
const assert = require('node:assert/strict');
const {
    startBrowserApp,
    installBrowserEngineInjection,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

const fetchInPage = (page, url, options) =>
    page.evaluate(async ({ target, init }) => {
        try {
            const response = await fetch(target, init);
            return { ok: true, status: response.status };
        } catch (error) {
            return { ok: false, message: String(error?.message || error) };
        }
    }, { target: url, init: options });

test('unmocked MinerU requests are aborted and reported as forbidden', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32195);
    try {
        const result = await fetchInPage(harness.page, '/api/mineru/status');
        assert.equal(result.ok, false, 'unmocked MinerU request must not succeed');
        assert.ok(
            harness.forbiddenRequests.some(url => new URL(url).pathname === '/api/mineru/status'),
            `blocked request must be recorded, got ${JSON.stringify(harness.forbiddenRequests)}`
        );
        assert.throws(
            () => assertNoRuntimeErrors(harness),
            /real AI\/OCR requests attempted: .*\/api\/mineru\/status/
        );
    } finally {
        await harness.close();
    }
});

test('MinerU fixture keeps every request local and fails closed on unknown endpoints', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32196);
    try {
        const engine = await installBrowserEngineInjection(harness.page, {});

        const status = await harness.page.evaluate(async () =>
            (await fetch('/api/mineru/status')).json()
        );
        assert.deepEqual(status, { configured: true });

        const unknown = await fetchInPage(
            harness.page,
            '/api/mineru/image?job=a&sourceId=a&name=figure.png'
        );
        assert.equal(unknown.ok, false, 'unknown MinerU endpoint must fail locally');
        assert.deepEqual(
            engine.blockedRequests.map(url => new URL(url).pathname),
            ['/api/mineru/image']
        );

        const missingFixture = await harness.page.evaluate(async () => {
            const form = new FormData();
            form.append('file', new File([new Uint8Array([1, 2, 3])], 'no-fixture.pdf', {
                type: 'application/pdf'
            }));
            const response = await fetch('/api/mineru/parse', {
                method: 'POST',
                body: form
            });
            return { status: response.status, body: await response.json() };
        });
        assert.equal(missingFixture.status, 502);
        assert.equal(missingFixture.body.code, 'MINERU_RESPONSE_INVALID');

        assert.deepEqual(
            engine.calls.map(call => call.endpoint),
            ['/api/mineru/parse'],
            'only the explicit fixture parse may be recorded as a call'
        );
        assert.equal(
            harness.forbiddenRequests.length,
            0,
            `no request may reach the real network: ${JSON.stringify(harness.forbiddenRequests)}`
        );
    } finally {
        await harness.close();
    }
});

test('engine injection does not replace production PDF configuration', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32197);
    try {
        const snapshot = () => harness.page.evaluate(() => ({
            qisiKeys: Object.keys(window.Qisi || {}).sort(),
            pdfExternal: JSON.stringify(window.Qisi?.Config?.pdfExternal ?? null)
        }));
        const before = await snapshot();
        await installBrowserEngineInjection(harness.page, {});
        const after = await snapshot();
        assert.deepEqual(after, before);
    } finally {
        await harness.close();
    }
});
