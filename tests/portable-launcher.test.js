const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('Windows launcher starts the tracked local server without a temporary helper', () => {
    const launcher = fs.readFileSync(path.join(ROOT, 'open-app.cmd'), 'utf8');

    assert.match(launcher, /Start-Process -FilePath 'node\.exe'/);
    assert.match(launcher, /qisi-local-server\.js/);
    assert.match(launcher, /-WindowStyle Hidden/);
    assert.doesNotMatch(launcher, /tmp[\\/]start-/i);
    assert.doesNotMatch(launcher, /LibreOffice|soffice/i);
});
