const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'architecture/runtime-modules.json'), 'utf8'));
const scripts = [...html.matchAll(/<script[^>]*src="\.\/([^"]+)"/g)].map(match => match[1].split(/[?#]/)[0]);

test('main.html loads every local script exactly once and every file exists', () => {
    const duplicates = scripts.filter((file, index) => scripts.indexOf(file) !== index);
    assert.deepEqual([...new Set(duplicates)], [], 'duplicate script tags');
    const missing = scripts.filter(file => !fs.existsSync(path.join(ROOT, file)));
    assert.deepEqual(missing, [], 'script tags pointing at missing files');
});

test('every browser module in the runtime inventory is loaded by main.html', () => {
    const loaded = new Set(scripts);
    const browserModules = inventory.modules.filter(item => item.runtime === 'browser').map(item => item.file);
    const notLoaded = browserModules.filter(file => !loaded.has(file));
    // Retired/replaced chains must be marked dormant instead of pretending to be loaded.
    assert.deepEqual(notLoaded, [], 'browser modules missing from main.html');
});

test('every local script loaded by main.html is a registered runtime module', () => {
    const registered = new Set(inventory.modules.map(item => item.file));
    // The runtime inventory covers qisi-*.js and app.js; vendor/ and plain helper
    // scripts are outside its scope (verify-runtime-modules uses the same rule).
    const unregistered = scripts.filter(file =>
        (/^qisi-[a-z0-9-]+\.js$/.test(file) || file === 'app.js') && !registered.has(file));
    assert.deepEqual(unregistered, [], 'loaded scripts missing from runtime-modules.json');
});
