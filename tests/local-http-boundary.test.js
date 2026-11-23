const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const {
  isAllowedLocalHost, isAllowedLocalOrigin, publicRootAssets, isPublicAsset
} = require('../qisi-local-http-boundary');

const ROOT = path.resolve(__dirname, '..');

test('local request boundary rejects foreign hosts and origins', () => {
  assert.equal(isAllowedLocalHost('localhost:3000', 3000), true);
  assert.equal(isAllowedLocalHost('127.0.0.1:3000', 3000), true);
  for (const host of ['example.com:3000', '192.168.1.4:3000', 'localhost:3001', 'localhost.evil:3000']) {
    assert.equal(isAllowedLocalHost(host, 3000), false, host);
  }
  assert.equal(isAllowedLocalOrigin(undefined, 3000), true);
  assert.equal(isAllowedLocalOrigin('http://localhost:3000', 3000), true);
  assert.equal(isAllowedLocalOrigin('http://127.0.0.1:3000', 3000), true);
  for (const origin of ['null', 'https://localhost:3000', 'http://example.com:3000', 'http://localhost:3001', 'http://localhost:3000.evil']) {
    assert.equal(isAllowedLocalOrigin(origin, 3000), false, origin);
  }
});

test('static boundary serves browser assets but not project files', () => {
  const assets = publicRootAssets(fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8'));
  for (const item of ['/main.html', '/app.js', '/app.css', '/qisi-components.js', '/vendor/pdfjs/pdf.worker.min.js', '/vendor/katex/fonts/KaTeX_Main-Regular.woff2']) {
    assert.equal(isPublicAsset(item, assets), true, item);
  }
  for (const item of ['/qisi-local-server.js', '/qisi-local-http-boundary.js', '/package.json', '/.env', '/tmp/uploads/private.docx', '/tests/secure-logger.test.js', '/vendor/../.env', '/%2eenv']) {
    assert.equal(isPublicAsset(item, assets), false, item);
  }
});

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health', headers: { Host: host }, agent: false }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}

test('local server keeps browser and API usable while blocking foreign requests and private files', { timeout: 20000 }, async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['qisi-local-server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
    windowsHide: true
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (child.exitCode !== null) break;
      try {
        const response = await fetch(`${base}/api/health`);
        ready = response.ok;
        if (ready) break;
      } catch { /* startup in progress */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'local service started');
    assert.equal((await fetch(`${base}/main.html`)).status, 200);
    assert.equal((await fetch(`${base}/qisi-components.js`)).status, 200);
    assert.equal((await fetch(`${base}/vendor/pdfjs/pdf.worker.min.js`)).status, 200);
    assert.equal((await fetch(`${base}/qisi-local-server.js`)).status, 404);
    assert.equal((await fetch(`${base}/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/ai/health`, { headers: { Origin: 'http://evil.example' } })).status, 403);
    assert.equal((await fetch(`${base}/api/health`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(await requestWithHost(port, `evil.example:${port}`), 403);
    const preflight = await fetch(`${base}/api/ai/${'chat'}`, {
      method: 'OPTIONS',
      headers: { Origin: `http://localhost:${port}`, 'Access-Control-Request-Method': 'POST' }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), `http://localhost:${port}`);
  } finally {
    child.kill();
  }
});
