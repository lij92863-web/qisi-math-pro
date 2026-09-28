const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

function instanceIdFor(root) {
  const realRoot = fs.realpathSync.native(path.resolve(root));
  const normalized = process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 20);
}

function probeLocalInstance({ root, port, timeoutMs = 2000 }) {
  const expected = instanceIdFor(root);
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/api/health' }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 4096) request.destroy(new Error('health response too large'));
      });
      response.on('end', () => {
        try {
          const health = JSON.parse(body);
          resolve(response.statusCode === 200 && health?.ok === true
            && health?.service === 'qisi-local-server'
            && health?.instanceId === expected ? 'same' : 'other');
        } catch {
          resolve('other');
        }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('health request timed out')));
    request.on('error', error => {
      resolve(error?.code === 'ECONNREFUSED' ? 'absent' : 'other');
    });
  });
}

module.exports = { instanceIdFor, probeLocalInstance };
