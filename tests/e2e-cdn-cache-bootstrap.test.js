const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'populate-e2e-cdn-cache.js');
const LOCK_PATH = path.join(ROOT, 'scripts', 'e2e-cdn-assets.lock.json');
const CACHE = path.join(ROOT, 'local-run-artifacts', 'r2-e2e-cdn-cache');

const readLock = () => JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
const cachePathFor = url =>
    path.join(CACHE, `${crypto.createHash('sha256').update(url).digest('hex')}.bin`);

test('the offline browser cache can be rebuilt from the repository alone', () => {
    assert.ok(fs.existsSync(SCRIPT), 'the bootstrap script must be tracked in scripts/');
    // A syntax error would only surface on a fresh clone otherwise.
    execFileSync(process.execPath, ['--check', SCRIPT]);

    const lock = readLock();
    assert.equal(lock.schemaVersion, 'qisi.e2e-cdn-assets.v1');
    const urls = Object.keys(lock.assets);
    assert.ok(urls.length > 50, `the recipe must cover the whole page, saw ${urls.length} assets`);

    // Every CDN entry point main.html loads has to be part of the recipe.
    for (const marker of ['cdn.tailwindcss.com', 'katex', 'vue', 'dexie', 'jszip', 'pdfjs', 'lucide']) {
        assert.ok(
            urls.some(url => url.includes(marker)),
            `the recipe has no entry for ${marker}`
        );
    }
    // KaTeX loads its fonts relative to the stylesheet, so a stylesheet-only recipe is not enough.
    assert.ok(
        urls.some(url => /katex.*\.woff2$/.test(url)),
        'the recipe must include the fonts the stylesheets reference'
    );
    // pdf.js loads its worker lazily, so it never appears in main.html but the DOCX/PDF pipeline
    // cannot render a page without it.
    assert.ok(
        urls.some(url => /pdf\.worker\.min\.js$/.test(url)),
        'the recipe must include the pdf.js worker'
    );

    for (const [url, entry] of Object.entries(lock.assets)) {
        assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${url} needs a pinned content hash`);
        assert.ok(entry.bytes > 0, `${url} needs a recorded size`);
    }
});

test('a cached asset is exactly the pinned asset, so a leftover cache cannot change a run', t => {
    if (!fs.existsSync(CACHE)) {
        t.skip('no local cache on this machine; run node scripts/populate-e2e-cdn-cache.js');
        return;
    }
    const lock = readLock();
    const missing = [];
    const drifted = [];

    for (const [url, entry] of Object.entries(lock.assets)) {
        const bodyPath = cachePathFor(url);
        if (!fs.existsSync(bodyPath)) {
            missing.push(url);
            continue;
        }
        const digest = crypto.createHash('sha256').update(fs.readFileSync(bodyPath)).digest('hex');
        if (digest !== entry.sha256) drifted.push(`${url} (${digest})`);
    }

    assert.deepEqual(
        missing,
        [],
        `the cache is incomplete; run node scripts/populate-e2e-cdn-cache.js\n${missing.join('\n')}`
    );
    assert.deepEqual(
        drifted,
        [],
        `cached assets do not match the pinned bytes; rebuild the cache and review any upstream change\n${drifted.join('\n')}`
    );
});

test('the browser harness tells a fresh clone how to build the cache', () => {
    const harness = fs.readFileSync(path.join(ROOT, 'tests', 'e2e', 'browser-harness.js'), 'utf8');
    assert.match(
        harness,
        /scripts\/populate-e2e-cdn-cache\.js/,
        'a missing cache must fail with the command that builds it'
    );
});
