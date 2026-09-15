const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

// The launcher searches a ten-port window, so this test must own a window that no other
// concurrently running test can claim. Windows allocates ephemeral ports from 49152 upwards,
// so ports below that range stay private to this test.
const LAUNCHER_TEST_BASE_PORTS = Array.from({ length: 64 }, (_, index) => 34100 + index * 17);

function isPortAvailable(port) {
    return new Promise(resolve => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', () => resolve(false));
        probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
    });
}

async function startForeignService(handler) {
    for (const base of LAUNCHER_TEST_BASE_PORTS) {
        const foreign = http.createServer(handler);
        const bound = await new Promise(resolve => {
            foreign.once('error', () => resolve(false));
            foreign.listen(base, '127.0.0.1', () => resolve(true));
        });
        if (!bound) continue;

        for (let offset = 1; offset <= 10; offset++) {
            if (await isPortAvailable(base + offset)) {
                return { foreign, basePort: base };
            }
        }
        await new Promise(resolve => foreign.close(resolve));
    }
    throw new Error('no private launcher port window is available on this machine');
}

test('Windows launcher starts the tracked local server without a temporary helper', () => {
    const launcher = fs.readFileSync(path.join(ROOT, 'open-app.cmd'), 'utf8');
    const alias = fs.readFileSync(path.join(ROOT, 'qisi-server.cmd'), 'utf8');
    const readiness = fs.readFileSync(path.join(ROOT, 'scripts', 'start-qisi.ps1'), 'utf8');

    assert.match(launcher, /-File "%~dp0scripts\\start-qisi\.ps1"/);
    assert.match(launcher, /-ProjectRoot "%~dp0\."/);
    assert.match(launcher, /-OpenBrowser/);
    assert.doesNotMatch(launcher, /-ProjectRoot "%~dp0"/);
    assert.doesNotMatch(launcher, /timeout\s+\/t/i);
    assert.doesNotMatch(launcher, /tmp[\\/]start-/i);
    assert.doesNotMatch(launcher, /LibreOffice|soffice/i);
    assert.match(alias, /call "%~dp0open-app\.cmd"/);
    assert.match(readiness, /Get-Command 'node\.exe'/);
    assert.match(readiness, /Start-Process[\s\S]*-FilePath \$node\.Source/);
    assert.match(readiness, /qisi-local-server\.js/);
    assert.match(readiness, /-WindowStyle Hidden/);
    assert.match(readiness, /\/api\/health/);
    assert.match(readiness, /payload\.service -eq 'qisi-local-server'/);
    assert.match(readiness, /payload\.buildId -eq \$expectedBuildId/);
    assert.match(readiness, /Security\.Cryptography\.SHA256/);
    assert.match(readiness, /Test-TcpPort/);
    assert.match(readiness, /\$Port \+ 10/);
    assert.match(readiness, /AddSeconds\(\$ReadyTimeoutSeconds\)/);
    assert.match(readiness, /while \(\(Get-Date\) -lt \$deadline\)/);
    assert.match(readiness, /Start-Sleep -Milliseconds 100/);
    assert.doesNotMatch(readiness, /Stop-Process|taskkill/i);
    assert.doesNotMatch(readiness, /LibreOffice|soffice/i);
});

function runLauncher(port) {
    return new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', path.join(ROOT, 'scripts', 'start-qisi.ps1'),
            '-ProjectRoot', ROOT,
            '-Port', String(port),
            '-ReadyTimeoutSeconds', '8'
        ], {
            cwd: ROOT,
            windowsHide: true
        });
        const stdout = [];
        const stderr = [];
        child.stdout.on('data', chunk => stdout.push(chunk));
        child.stderr.on('data', chunk => stderr.push(chunk));
        child.once('error', reject);
        child.once('exit', code => resolve({
            code,
            stdout: Buffer.concat(stdout).toString('utf8'),
            stderr: Buffer.concat(stderr).toString('utf8')
        }));
    });
}

test('launcher skips a foreign port, starts quickly, then reuses the exact TEX service', {
    timeout: 30_000
}, async t => {
    const { foreign, basePort } = await startForeignService((request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, service: 'other-service' }));
    });
    t.after(() => new Promise(resolve => foreign.close(resolve)));
    let qisiPid = 0;
    t.after(() => {
        if (qisiPid) {
            try {
                process.kill(qisiPid);
            } catch {
                // The known child may already have exited during cleanup.
            }
        }
    });

    const startedAt = Date.now();
    const first = await runLauncher(basePort);
    const elapsedMs = Date.now() - startedAt;
    assert.equal(first.code, 0, first.stderr || first.stdout);
    assert.ok(elapsedMs < 6_000, `launcher took ${elapsedMs} ms`);
    const url = first.stdout.match(/^QISI_URL=(.+)$/m)?.[1]?.trim();
    qisiPid = Number(first.stdout.match(/^QISI_PID=(\d+)$/m)?.[1] || 0);
    assert.ok(url, first.stdout);
    assert.ok(qisiPid > 0, first.stdout);
    assert.notEqual(new URL(url).port, String(basePort));

    const health = await fetch(new URL('/api/health', url));
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, 'qisi-local-server');

    const foreignHealth = await fetch(`http://127.0.0.1:${basePort}/api/health`);
    assert.equal((await foreignHealth.json()).service, 'other-service');

    const second = await runLauncher(basePort);
    assert.equal(second.code, 0, second.stderr || second.stdout);
    assert.equal(second.stdout.match(/^QISI_URL=(.+)$/m)?.[1]?.trim(), url);
    assert.match(second.stdout, /^QISI_PID=\s*$/m);
});
