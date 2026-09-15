const test = require('node:test');
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const rich = require('../qisi-docx-rich-content.js');
const reader = require('../qisi-docx-mtef-reader.js');
const { translateWithFaultIsolation } = require('../qisi-mathtype-native-guard.js');
const { createQisiLocalServer } = require('../qisi-local-server.js');

const header = Buffer.from([5, 1, 0, 7, 8, 68, 83, 77, 84, 55, 0, 1]);
const charX = Buffer.from([2, 0, 131, 120, 0]);
const mtef = Buffer.concat([header, charX, Buffer.from([0])]);
const equations = ['a', 'b'].map(id => ({ id, mtefBase64: mtef.toString('base64') }));
const response = equations => ({ ok: true, json: async () => ({ equations }) });

function mediaFor(bytes) {
    const company = Buffer.from('Design Science, Inc.\0');
    const wmf = Buffer.alloc(18 + company.length + bytes.length);
    wmf.write('AppsMFC');
    wmf.writeInt32LE(bytes.length, 14);
    company.copy(wmf, 18);
    bytes.copy(wmf, 18 + company.length);
    return new Map([['a', { ext: 'wmf', url: `data:image/wmf;base64,${wmf.toString('base64')}` }]]);
}

test('native transport failure still recovers evidenced formula locally', async () => {
    let calls = 0;
    const result = await rich.translateMathTypeMedia(mediaFor(mtef), {
        fetchImpl: async () => { calls++; throw new TypeError('fetch failed'); }
    });
    assert.equal(result.mathByRid.get('a'), 'x');
    assert.equal(result.translated, result.requested);
    assert.equal(calls, 1);
    assert.ok(result.diagnostics.some(row => row.code === 'MATHTYPE_MTEF_FALLBACK_USED'));
});

test('successful native MathType translation remains the primary formula source', async () => {
    const result = await rich.translateMathTypeMedia(mediaFor(mtef), {
        fetchImpl: async () => response([{ id: 'a', ok: true, code: 'MATHTYPE_LATEX_OK', latex: 'y' }])
    });
    assert.equal(result.mathByRid.get('a'), 'y');
    assert.equal(result.diagnostics.some(row => row.code === 'MATHTYPE_MTEF_FALLBACK_USED'), false);
});

test('missing, duplicate and foreign native IDs cannot silently lose or misattach equations', async () => {
    for (const rows of [[], [{ id: 'other', ok: true, latex: 'WRONG' }],
        [{ id: 'a', ok: true, latex: 'WRONG' }, { id: 'a', ok: true, latex: 'WRONG' }]]) {
        const result = await rich.requestMathTypeTranslations(equations, { fetchImpl: async () => response(rows) });
        assert.deepEqual(result.map(row => row.id), ['a', 'b']);
        assert.ok(result.every(row => !row.ok && !row.latex));
    }
    const result = await rich.requestMathTypeTranslations(equations, {
        fetchImpl: async () => response([{ id: 'b', ok: true, latex: 'y' }])
    });
    assert.equal(result[0].ok, false);
    assert.equal(result[1].latex, 'y');
});

test('native timeout yields failed rows for local fallback', async () => {
    const result = await rich.requestMathTypeTranslations(equations, {
        timeoutMs: 10,
        fetchImpl: async (_, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        })
    });
    assert.ok(result.every(row => row.code === 'MATHTYPE_NATIVE_TIMEOUT' && !row.ok));
});

test('repeated native process crashes have a total attempt bound and preserve every ID', async () => {
    let calls = 0;
    const rows = Array.from({ length: 512 }, (_, i) => ({ id: String(i) }));
    const result = await translateWithFaultIsolation(rows, async () => {
        calls++;
        throw Object.assign(new Error('crash'), { code: 'MATHTYPE_NATIVE_PROCESS_FAILED', isolatable: true });
    });
    assert.ok(calls <= 15);
    assert.deepEqual(result.equations.map(row => row.id), rows.map(row => row.id));
    assert.ok(result.equations.every(row => !row.ok));
});

test('truncated dimensions cannot hang the formula reader', async () => {
    const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        parentPort.postMessage(require(workerData.module).mtefToLatex(workerData.bytes));
    `, { eval: true, workerData: {
        module: require.resolve('../qisi-docx-mtef-reader.js'),
        bytes: Buffer.concat([header, Buffer.from([18, 0, 1])])
    } });
    try {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('MTEF reader hung')), 2000);
            worker.once('message', value => { clearTimeout(timer); resolve(value); });
            worker.once('error', error => { clearTimeout(timer); reject(error); });
        });
        assert.equal(result.ok, false);
    } finally { await worker.terminate(); }
});

test('truncated formulas and unsupported accents are rejected instead of returning changed math', () => {
    assert.equal(reader.mtefToLatex(mtef).latex, 'x');
    for (const bytes of [mtef.subarray(0, -1),
        Buffer.concat([header, charX, Buffer.from([102, 50, 1])]),
        Buffer.concat([header, Buffer.from([2, 1, 131, 120, 0, 6, 0, 2, 0, 0])])]) {
        const result = reader.mtefToLatex(bytes);
        assert.equal(result.ok, false);
        assert.equal(result.latex, '');
    }
});

async function proxyRequest(t, fetchImpl) {
    const service = createQisiLocalServer({ port: 0, dashscopeApiKey: 'test-only', aiFetchRetryDelayMs: 0, fetchImpl });
    await service.start();
    t.after(() => service.close());
    return fetch(`http://127.0.0.1:${service.port}/api/ai/` + 'chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen-test', messages: [] })
    });
}

test('PDF proxy recovers transient gateway errors without changing the request', async t => {
    const bodies = [];
    const result = await proxyRequest(t, async (_, options) => {
        bodies.push(options.body);
        return new Response(bodies.length < 3 ? 'gateway unavailable' : '{"ok":true}', { status: bodies.length < 3 ? 502 : 200 });
    });
    assert.equal(result.status, 200);
    assert.equal(bodies.length, 3);
    assert.equal(new Set(bodies).size, 1);
});

test('persistent gateway error remains a failure after bounded retries', async t => {
    let calls = 0;
    const result = await proxyRequest(t, async () => { calls++; return new Response('unavailable', { status: 503 }); });
    assert.equal(result.status, 503);
    assert.equal(calls, 3);
});

test('network cause produces a readable error without exposing private error text', async t => {
    const result = await proxyRequest(t, async () => {
        throw new TypeError('private credential text', { cause: { code: 'ENOTFOUND' } });
    });
    const payload = await result.json();
    assert.equal(result.status, 502);
    assert.match(payload.message, /DNS/);
    assert.doesNotMatch(JSON.stringify(payload), /private credential/);
});

test('connection timeouts are not mislabeled as generic 502 fetch failures', async t => {
    const result = await proxyRequest(t, async () => {
        throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
    });
    assert.equal(result.status, 504);
    assert.equal((await result.json()).code, 'AI_PROXY_TIMEOUT');
});
