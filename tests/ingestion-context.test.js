const test = require('node:test');
const assert = require('node:assert/strict');
const Context = require('../qisi-ingestion-context.js');

test('one pending extraction is shared and changed content cannot reuse it', async () => {
    const file = { id: 'f', uploadPath: 'v1' };
    let loads = 0;
    const deps = {
        read: async f => f.uploadPath,
        load: async () => {
            loads++;
            return { file: name => ({ async: async () => name.includes('document.xml.rels') ? '<Relationships/>' : '<w:document/>' }) };
        }
    };
    const [a, b] = await Promise.all([Context.getDocx(file, deps), Context.getDocx(file, deps)]);
    assert.equal(a, b);
    assert.equal(loads, 1);
    assert.deepEqual(a.trace.stages.map(s => s.stage), ['read', 'unzip', 'document-xml', 'relationships']);
    assert.ok(a.trace.stages.every(s => s.durationMs >= 0 && s.end >= s.start));
    file.uploadPath = 'v2';
    assert.notEqual(await Context.getDocx(file, deps), a);
    assert.equal(loads, 2);
});

test('failed extraction can retry and bounded work reports its stage error', async () => {
    const file = { uploadPath: 'bad' };
    await assert.rejects(Context.getDocx(file, { read: () => { throw Error('read failed'); } }), /read failed/);
    let cancelled = 0;
    const trace = Context.createTrace('timeout');
    await assert.rejects(trace.measure('render', () => Context.withTimeout(
        () => new Promise(() => {}), 10, 'PDF_RENDER_TIMEOUT', () => { cancelled++; }
    )), { code: 'PDF_RENDER_TIMEOUT' });
    assert.equal(cancelled, 1);
    assert.equal(trace.stages[0].errorCode, 'PDF_RENDER_TIMEOUT');
});
