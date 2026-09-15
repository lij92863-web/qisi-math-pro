const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { normalizeServerHost, isLoopbackHost } = require('../qisi-local-server.js');

const ROOT = path.resolve(__dirname, '..');

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
            const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1_000) });
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

const canConnect = (host, port) => new Promise(resolve => {
    const socket = net.connect({ host, port, timeout: 1500 });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
});

test('only a loopback host is accepted, everything else falls back to loopback', () => {
    for (const accepted of ['127.0.0.1', 'localhost', '::1', '[::1]', ' LOCALHOST ']) {
        assert.equal(isLoopbackHost(accepted), true, `${accepted} is loopback`);
    }
    for (const rejected of [
        '0.0.0.0', '::', '', '   ', 'evil.example', '127.0.0.1.evil.example',
        '10.0.0.5', '192.168.1.20', '[0.0.0.0]'
    ]) {
        assert.equal(isLoopbackHost(rejected), false, `${rejected} is not loopback`);
        assert.equal(
            normalizeServerHost(rejected),
            '127.0.0.1',
            `${rejected} must not be honoured as a bind address`
        );
    }

    assert.equal(normalizeServerHost('127.0.0.1'), '127.0.0.1');
    assert.equal(normalizeServerHost('localhost'), 'localhost');
    assert.equal(normalizeServerHost('::1'), '::1');
    assert.equal(normalizeServerHost('[::1]'), '::1');
});

test('QISI_HOST cannot put the local service on the network', {
    timeout: 60_000
}, async () => {
    const lan = firstLanAddress();
    const port = await reserveLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;

    // Both a wildcard bind and a bind to this machine's own network address used to be honoured,
    // which exposed the AI proxy and the file APIs to the local network.
    const requested = ['0.0.0.0', ...(lan ? [lan] : [])];

    for (const host of requested) {
        const output = [];
        const server = spawn(process.execPath, ['qisi-local-server.js'], {
            cwd: ROOT,
            env: { ...process.env, PORT: String(port), QISI_HOST: host },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        server.stdout.on('data', chunk => output.push(chunk.toString()));
        server.stderr.on('data', chunk => output.push(chunk.toString()));

        try {
            await waitForServer(origin, server);

            if (lan) {
                assert.equal(
                    await canConnect(lan, port),
                    false,
                    `QISI_HOST=${host} must not expose the service on the network address ${lan}`
                );
            }
            assert.equal(
                await canConnect('127.0.0.1', port),
                true,
                'the service must still serve the teacher on loopback'
            );
            assert.match(
                output.join(''),
                /HOST_NOT_LOOPBACK/,
                'the fallback must be reported, not silent'
            );
        } finally {
            server.kill();
        }
    }
});
