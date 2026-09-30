const test = require('node:test');
const assert = require('node:assert/strict');
const { createAiRequestLimiter, networkFailureCode } = require('../qisi-local-ai-request-policy');
test('concurrent leases are bounded and release is idempotent', () => {
    const limit = createAiRequestLimiter({ maxConcurrent: 2 });
    const a = limit.acquire(), b = limit.acquire();
    assert.equal(a.ok, true); assert.equal(b.ok, true);
    assert.equal(limit.acquire().code, 'AI_PROXY_BUSY');
    a.release(); a.release();
    const c = limit.acquire(); assert.equal(c.ok, true);
    assert.equal(limit.acquire().ok, false);
    b.release(); c.release();
});
test('rate bucket bounds starts and replenishes only elapsed allowance', () => {
    let now = 0;
    const limit = createAiRequestLimiter({ capacity: 2, windowMs: 2000, clock: () => now });
    for (let i = 0; i < 2; i++) limit.acquire().release();
    assert.equal(limit.acquire().code, 'AI_PROXY_RATE_LIMIT');
    now = 500; assert.equal(limit.acquire().ok, false);
    now = 1000; limit.acquire().release();
    assert.equal(limit.acquire().ok, false);
    now = -1000; assert.equal(limit.acquire().ok, false);
    now = 100000; for (let i = 0; i < 2; i++) limit.acquire().release();
    assert.equal(limit.acquire().ok, false);
});
test('busy rejections do not burn request tokens and invalid clocks fail closed', () => {
    let now = 0;
    const limit = createAiRequestLimiter({ capacity: 2, maxConcurrent: 1, clock: () => now });
    const a = limit.acquire(); assert.equal(limit.acquire().code, 'AI_PROXY_BUSY');
    a.release(); limit.acquire().release();
    now = NaN; assert.equal(limit.acquire().ok, false);
    assert.throws(() => createAiRequestLimiter({ capacity: 0 }), TypeError);
});
test('diagnostics expose only closed network codes, never exception text or secrets', () => {
    assert.equal(networkFailureCode({ cause: { code: 'ECONNRESET' } }), 'ECONNRESET');
    assert.equal(networkFailureCode({ code: 'ETIMEDOUT' }), 'ETIMEDOUT');
    assert.equal(networkFailureCode({ cause: { code: 'sk-secret-value' }, message: 'credential' }), 'NETWORK_FAILURE');
    assert.equal(networkFailureCode(null), 'NETWORK_FAILURE');
});
