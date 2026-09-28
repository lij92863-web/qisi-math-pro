const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { instanceIdFor, probeLocalInstance } = require('../qisi-local-instance');

const root = path.resolve(__dirname, '..');

async function withHealth(health, callback) {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(health));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('launcher recognizes only this installation', async () => {
  await withHealth({
    ok: true,
    service: 'qisi-local-server',
    instanceId: instanceIdFor(root)
  }, async port => {
    assert.equal(await probeLocalInstance({ root, port }), 'same');
  });
  await withHealth({
    ok: true,
    service: 'qisi-local-server',
    instanceId: instanceIdFor(path.dirname(root))
  }, async port => {
    assert.equal(await probeLocalInstance({ root, port }), 'other');
  });
  await withHealth({ ok: true, service: 'qisi-local-server' }, async port => {
    assert.equal(await probeLocalInstance({ root, port }), 'other');
  });
});

test('launcher distinguishes an unused port from an unrelated response', async () => {
  const port = await withHealth({}, async activePort => activePort);
  assert.equal(await probeLocalInstance({ root, port }), 'absent');
  await withHealth({ status: 'unrelated' }, async activePort => {
    assert.equal(await probeLocalInstance({ root, port: activePort }), 'other');
  });
});
