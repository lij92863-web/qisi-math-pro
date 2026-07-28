const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('Windows launcher starts the tracked local server without a temporary helper', () => {
    const launcher = fs.readFileSync(path.join(ROOT, 'open-app.cmd'), 'utf8');
    const readiness = fs.readFileSync(path.join(ROOT, 'scripts', 'start-qisi.ps1'), 'utf8');

    assert.match(launcher, /-File "%~dp0scripts\\start-qisi\.ps1"/);
    assert.match(launcher, /-ProjectRoot "%~dp0\."/);
    assert.doesNotMatch(launcher, /-ProjectRoot "%~dp0"/);
    assert.doesNotMatch(launcher, /timeout\s+\/t/i);
    assert.doesNotMatch(launcher, /tmp[\\/]start-/i);
    assert.doesNotMatch(launcher, /LibreOffice|soffice/i);
    assert.match(readiness, /Get-Command 'node\.exe'/);
    assert.match(readiness, /Start-Process[\s\S]*-FilePath \$node\.Source/);
    assert.match(readiness, /qisi-local-server\.js/);
    assert.match(readiness, /-WindowStyle Hidden/);
    assert.match(readiness, /http:\/\/127\.0\.0\.1:\$Port\/api\/health/);
    assert.match(readiness, /Invoke-WebRequest[\s\S]*-Uri \$healthUrl/);
    assert.match(readiness, /AddSeconds\(\$ReadyTimeoutSeconds\)/);
    assert.match(readiness, /while \(\(Get-Date\) -lt \$deadline\)/);
    assert.match(readiness, /Start-Sleep -Milliseconds 250/);
    assert.doesNotMatch(readiness, /LibreOffice|soffice/i);
});
