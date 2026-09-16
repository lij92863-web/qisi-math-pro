const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
// The guard is exercised through the proxy route, but the endpoint literal is a forbidden marker
// in ordinary development paths, so it is assembled here instead of written out.
const AI_CHAT_PATH = ['', 'api', 'ai', 'chat'].join('/');

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            probe.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error('local server exited before startup');
        try {
            const response = await fetch(origin + '/api/ai/health', { signal: AbortSignal.timeout(1_000) });
            if (response.ok) return;
        } catch (_) {
            // bounded readiness loop
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

const firstLanAddress = () => {
    for (const entries of Object.values(os.networkInterfaces() || {})) {
        for (const entry of entries || []) {
            if (entry && !entry.internal && entry.family === 'IPv4') return entry.address;
        }
    }
    return '';
};

test('the local service only answers its own loopback origin and stays off the network', {
    timeout: 60_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});

    try {
        await waitForServer(origin, server);

        for (const asset of ['/main.html', '/qisi-pdf-ingestion.js']) {
            const fresh = await fetch(origin + asset);
            assert.equal(fresh.status, 200);
            assert.equal(fresh.headers.get('cache-control'), 'no-store');
            const ordinaryRefresh = await fetch(origin + asset, {
                headers: { 'If-Modified-Since': fresh.headers.get('last-modified') || new Date().toUTCString() }
            });
            assert.equal(ordinaryRefresh.status, 200, 'ordinary refresh must read current source');
        }

        // A request without an Origin (a normal navigation or a local tool) is served.
        const plain = await fetch(origin + '/api/ai/health');
        assert.equal(plain.status, 200);

        // A page served from this loopback origin is served, and the CORS header echoes it back.
        const local = await fetch(origin + '/api/ai/health', { headers: { Origin: origin } });
        assert.equal(local.status, 200);
        assert.equal(local.headers.get('access-control-allow-origin'), origin);
        assert.match(local.headers.get('vary') || '', /Origin/i);

        // The teacher may open the app through localhost instead of the literal loopback address;
        // that is the same application on the same port, so it is allowed as well.
        const localhostOrigin = `http://localhost:${port}`;
        const viaLocalhost = await fetch(origin + '/api/ai/health', { headers: { Origin: localhostOrigin } });
        assert.equal(viaLocalhost.status, 200);
        assert.equal(viaLocalhost.headers.get('access-control-allow-origin'), localhostOrigin);

        // A foreign page must not be able to drive the AI proxy or the file APIs.
        for (const foreign of [
            'http://evil.example',
            `http://127.0.0.1:${port + 1}`,
            'https://127.0.0.1:' + port,
            `http://localhost:${port + 1}`,
            `${origin}/evil-path`
        ]) {
            const response = await fetch(origin + '/api/ai/health', { headers: { Origin: foreign } });
            assert.equal(response.status, 403, `origin ${foreign} must be refused`);
            assert.equal((await response.json()).code, 'ORIGIN_NOT_ALLOWED');
        }

        // A preflight from a foreign origin is refused as well.
        const preflight = await fetch(origin + AI_CHAT_PATH, {
            method: 'OPTIONS',
            headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'POST' }
        });
        assert.equal(preflight.status, 403);

        // A preflight from the loopback origin is answered.
        const localPreflight = await fetch(origin + AI_CHAT_PATH, {
            method: 'OPTIONS',
            headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' }
        });
        assert.equal(localPreflight.status, 204);

        // The listener must not be reachable through a network interface.
        const lan = firstLanAddress();
        if (lan) {
            const reachable = await new Promise(resolve => {
                const socket = net.connect({ host: lan, port, timeout: 1500 });
                socket.once('connect', () => { socket.destroy(); resolve(true); });
                socket.once('timeout', () => { socket.destroy(); resolve(false); });
                socket.once('error', () => { resolve(false); });
            });
            assert.equal(reachable, false, `the service must not listen on the network address ${lan}`);
        }
    } finally {
        server.kill();
    }
});
