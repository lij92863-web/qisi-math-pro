const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('proxy driver retains an otherwise unreferenced pending promise across GC until actual navigation', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(32862);
    let navigationCount = 0;
    const observe = frame => { if (frame === h.page.mainFrame()) ++navigationCount; };
    h.page.on('framenavigated', observe);
    try {
        await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            window.auditProxyDispatchCount = 0;
            p.auditResolvedPromise = () => { ++window.auditProxyDispatchCount; return Promise.resolve({ answer: 42 }); };
            p.auditDetachedPromise = () => new Promise(() => { window.auditPromiseStarted = true; });
        });
        const listeners = h.page.listenerCount('framenavigated');
        assert.deepEqual(await H.callProxy(h.page, 'auditResolvedPromise'), { answer: 42 });
        assert.equal(h.page.listenerCount('framenavigated'), listeners);
        assert.deepEqual(await h.page.evaluate(() => ({ calls: window.auditProxyDispatchCount, retained: Boolean(window.__qisiHarnessProxyTasks) })), { calls: 1, retained: false });
        const session = await h.context.newCDPSession(h.page);
        let observed;
        const running = H.callProxy(h.page, 'auditDetachedPromise').then(value => { observed = { value }; }, error => { observed = { error: error.message }; });
        await h.page.waitForFunction(() => window.auditPromiseStarted);
        await session.send('HeapProfiler.collectGarbage');
        await session.send('HeapProfiler.collectGarbage');
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(navigationCount, 0);
        assert.equal(observed, undefined, 'GC alone must not destroy an operation whose page is still alive');
        await h.page.reload(); await running;
        assert.match(observed.error, /context was destroyed|navigation|disposed|closed/i);
        await session.detach();
        H.assertNoRuntimeErrors(h);
    } finally { h.page.off('framenavigated', observe); await h.close(); }
});

test('proxy driver preserves rejection and does not turn a real navigation into success', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(32863);
    try {
        await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            p.auditRejectPromise = () => Promise.reject(new Error('PROXY_ORIGINAL_FAILURE'));
            p.auditNavigatePromise = () => new Promise(() => { setTimeout(() => location.reload(), 20); });
        });
        await assert.rejects(H.callProxy(h.page, 'auditRejectPromise'), /PROXY_ORIGINAL_FAILURE/);
        const navigation = h.page.waitForEvent('framenavigated', { predicate: frame => frame === h.page.mainFrame() });
        await assert.rejects(H.callProxy(h.page, 'auditNavigatePromise'), /context was destroyed|navigation|disposed|closed/i);
        await navigation;
    } finally { await h.close(); }
});
