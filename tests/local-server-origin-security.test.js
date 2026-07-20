const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createQisiLocalServer,
  isAllowedLocalOrigin
} = require('../qisi-local-server.js');

function serviceUrl(service, pathname) {
  return `http://127.0.0.1:${service.port}${pathname}`;
}

async function startTestService(t, options = {}) {
  const service = createQisiLocalServer({ port: 0, ...options });
  assert.equal(service.server, null, 'factory creation must not start listening');
  await service.start();
  t.after(() => service.close());
  return service;
}

test('local origin policy accepts only exact loopback hosts on the active service port', () => {
  for (const origin of [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000'
  ]) {
    assert.equal(isAllowedLocalOrigin(origin, 3000), true, origin);
  }

  assert.equal(isAllowedLocalOrigin('', 3000), true, 'requests without Origin remain supported');
  assert.equal(isAllowedLocalOrigin('http://localhost:3001', 3000), false);
  assert.equal(isAllowedLocalOrigin('http://localhost.evil.example:3000', 3000), false);
  assert.equal(isAllowedLocalOrigin('http://127.0.0.1.evil.example:3000', 3000), false);
  assert.equal(isAllowedLocalOrigin('https://localhost:3000', 3000), false);
  assert.equal(isAllowedLocalOrigin('null', 3000), false);
});

test('server factory is inert until start and binds to loopback by default', async t => {
  const service = await startTestService(t);
  const address = service.server.address();

  assert.equal(service.host, '127.0.0.1');
  assert.equal(address.address, '127.0.0.1');
  assert.equal(address.port, service.port);

  const response = await fetch(serviceUrl(service, '/api/health'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'qisi-local-server',
    platform: process.platform,
    port: service.port
  });
});

test('same-port localhost aliases receive explicit CORS permission', async t => {
  const service = await startTestService(t);

  for (const origin of [
    `http://localhost:${service.port}`,
    `http://127.0.0.1:${service.port}`,
    `http://[::1]:${service.port}`
  ]) {
    const response = await fetch(serviceUrl(service, '/api/ai/health'), {
      headers: { Origin: origin }
    });
    assert.equal(response.status, 200, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('vary') || '', /Origin/i);
  }
});

test('malicious origins are denied before privileged handlers and upstream fetch', async t => {
  const upstreamCalls = [];
  const service = await startTestService(t, {
    dashscopeApiKey: 'test-only-key',
    fetchImpl: async (...args) => {
      upstreamCalls.push(args);
      throw new Error('denied requests must never reach this fake upstream');
    }
  });

  for (const origin of [
    'https://evil.example',
    `http://localhost.evil.example:${service.port}`,
    `http://127.0.0.1:${service.port + 1}`
  ]) {
    const response = await fetch(serviceUrl(service, '/api/ai/' + 'chat'), {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'qwen-test', messages: [] })
    });
    assert.equal(response.status, 403, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(await response.json(), {
      ok: false,
      code: 'ORIGIN_NOT_ALLOWED',
      error: 'This local service only accepts requests from its own loopback origin.'
    });
  }

  assert.equal(upstreamCalls.length, 0);
});

test('no-Origin clients remain valid and use only an injected test upstream', async t => {
  const upstreamCalls = [];
  const service = await startTestService(t, {
    dashscopeApiKey: 'test-only-key',
    fetchImpl: async (url, options) => {
      upstreamCalls.push({ url, options });
      return new Response(JSON.stringify({ ok: true, source: 'fake-upstream' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const response = await fetch(serviceUrl(service, '/api/ai/' + 'chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen-test', messages: [] })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, source: 'fake-upstream' });
  assert.equal(upstreamCalls.length, 1);
  assert.match(upstreamCalls[0].url, /^https:\/\/dashscope\.aliyuncs\.com\//);
});

test('CORS preflight is explicit for local origins and fail-closed for others', async t => {
  const service = await startTestService(t);
  const localOrigin = `http://localhost:${service.port}`;

  const allowed = await fetch(serviceUrl(service, '/api/convert/docx-to-pdf'), {
    method: 'OPTIONS',
    headers: {
      Origin: localOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), localOrigin);
  assert.match(allowed.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(allowed.headers.get('access-control-allow-headers') || '', /Content-Type/i);

  const denied = await fetch(serviceUrl(service, '/api/convert/docx-to-pdf'), {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'ORIGIN_NOT_ALLOWED');
});
