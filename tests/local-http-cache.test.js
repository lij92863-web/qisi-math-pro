const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
test('public assets revalidate by ETag while private files remain unavailable', { timeout: 20000 }, async () => {
    const port = await new Promise(resolve => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const value = server.address().port; server.close(() => resolve(value));
        });
    });
    const child = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) },
        stdio: 'ignore', windowsHide: true
    });
    const base = `http://127.0.0.1:${port}`;
    try {
        let ready = false;
        for (let i = 0; i < 60; i++) {
            try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(ready, true);
        const first = await fetch(base + '/main.html');
        const etag = first.headers.get('etag'); await first.text();
        assert.equal(first.status, 200); assert.ok(etag);
        assert.match(first.headers.get('cache-control'), /max-age=0/);
        // Node fetch injects Cache-Control: no-cache for manual conditional headers.
        // Use a normal HTTP revalidation request, as a browser cache does.
        const second = await new Promise((resolve, reject) => {
            const request = http.get(base + '/main.html', { headers: { 'If-None-Match': etag } }, response => {
                let body = ''; response.on('data', chunk => { body += chunk; });
                response.on('end', () => resolve({ status: response.statusCode, body }));
            });
            request.once('error', reject);
        });
        assert.equal(second.status, 304); assert.equal(second.body, '');
        assert.equal((await fetch(base + '/qisi-local-server.js')).status, 404);
        const localhostPage = path => new Promise((resolve, reject) => {
            http.get(base + path, { headers: { Host: `localhost:${port}` } }, response => {
                response.setEncoding('utf8');
                let body = '';
                response.on('data', chunk => { body += chunk; });
                response.on('end', () => resolve(body));
            }).once('error', reject);
        });
        assert.ok((await localhostPage('/main.html')).includes(base + '/main.html'));
        assert.ok((await localhostPage('/')).includes('legacy=backup'));
        assert.match(await localhostPage('/main.html?legacy=backup'), /id="app-tpl"/);
    } finally { child.kill(); }
});
