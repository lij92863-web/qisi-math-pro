/**
 * Builds the offline asset cache the browser end-to-end tests run against.
 *
 * The tests never touch the network: the harness blocks every https request and serves it from
 * local-run-artifacts/r2-e2e-cdn-cache, so a fresh clone needs one reproducible command before the
 * browser tests can run:
 *
 *   node scripts/populate-e2e-cdn-cache.js
 *
 * The URLs themselves are floating (vue@3, the Tailwind play CDN), so the exact bytes are pinned in
 * scripts/e2e-cdn-assets.lock.json. A later fetch that produces different bytes fails loudly instead
 * of silently testing against a different Vue or Tailwind build; re-pin deliberately with
 * `--update-lock` after reviewing the change.
 *
 * The cache lives in an ignored directory, so no large binary is committed - only the recipe.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'local-run-artifacts', 'r2-e2e-cdn-cache');
const LOCK_PATH = path.join(ROOT, 'scripts', 'e2e-cdn-assets.lock.json');
const HTML = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
const UPDATE_LOCK = process.argv.includes('--update-lock');

const cachePathFor = url =>
    path.join(CACHE, `${crypto.createHash('sha256').update(url).digest('hex')}.bin`);
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const isCss = (url, contentType) =>
    /\.css(\?|$)/i.test(url) || /text\/css/i.test(contentType || '');

const urlsFromHtml = () => {
    const urls = new Set();
    for (const match of HTML.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
        const tag = match[0];
        // `<link rel="preconnect">` only names a host: the browser opens a connection and never
        // downloads anything, so there is nothing to cache for it.
        if (/rel=["']?(?:preconnect|dns-prefetch)["']?/i.test(tag)) continue;
        const urlMatch = tag.match(/(?:src|href)=["'](https:\/\/[^"']+)["']/i);
        if (!urlMatch) continue;
        // The browser normalises a bare host to a trailing slash, and the cache key is the exact
        // request URL, so normalise the same way here.
        urls.add(new URL(urlMatch[1]).href);
    }
    return [...urls];
};

const urlsFromCss = (css, baseUrl) => {
    const urls = new Set();
    for (const match of css.matchAll(/url\(\s*['"]?(https:\/\/[^'")]+)['"]?\s*\)/g)) {
        urls.add(match[1]);
    }
    // KaTeX ships its fonts relative to the stylesheet ("fonts/KaTeX_*.woff2"), so a relative url()
    // has to be resolved against the stylesheet it came from.
    for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        const value = match[1].trim();
        if (!value || value.startsWith('data:') || value.startsWith('#')) continue;
        urls.add(new URL(value, baseUrl).href);
    }
    return [...urls];
};

// Assets the application requests at runtime rather than from main.html:
// - the print document is generated in app.js and pulls its own stylesheet;
// - pdf.js loads its worker lazily the first time a PDF is opened, so the DOCX/PDF pipeline cannot
//   render a source page without it.
const runtimeAssetUrls = () => [
    'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
];

const fetchAsset = async url => {
    const response = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (qisi offline cache builder)' }
    });
    if (!response.ok) throw new Error(`${response.status} for ${url}`);
    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || ''
    };
};

const readLock = () => {
    if (!fs.existsSync(LOCK_PATH)) return null;
    return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
};

const main = async () => {
    fs.mkdirSync(CACHE, { recursive: true });
    const lock = readLock();
    const pinned = lock?.assets || {};
    const fetched = {};
    const drifted = [];
    const queue = [...urlsFromHtml(), ...runtimeAssetUrls()].map(url => ({ url, depth: 0 }));
    const seen = new Set();
    let stored = 0;

    while (queue.length) {
        const { url, depth } = queue.shift();
        if (seen.has(url)) continue;
        seen.add(url);

        let asset;
        try {
            asset = await fetchAsset(url);
            stored += 1;
        } catch (error) {
            console.error(`FAILED ${url}: ${error.message}`);
            process.exitCode = 1;
            continue;
        }

        const digest = sha256(asset.buffer);
        fetched[url] = { sha256: digest, bytes: asset.buffer.length };
        if (pinned[url] && pinned[url].sha256 !== digest) {
            drifted.push(`${url}\n  pinned ${pinned[url].sha256}\n  served ${digest}`);
        }
        fs.writeFileSync(cachePathFor(url), asset.buffer);

        if (depth < 2 && isCss(url, asset.contentType)) {
            for (const nested of urlsFromCss(asset.buffer.toString('utf8'), url)) {
                if (!seen.has(nested)) queue.push({ url: nested, depth: depth + 1 });
            }
        }
    }

    if (process.exitCode) {
        console.error(`[e2e-cdn-cache] some assets could not be fetched; the cache is incomplete`);
        return;
    }

    if (drifted.length) {
        console.error('[e2e-cdn-cache] pinned assets changed upstream:');
        for (const entry of drifted) console.error(`- ${entry}`);
        if (!UPDATE_LOCK) {
            console.error(
                '[e2e-cdn-cache] refusing to re-pin silently. Review the upstream change, then run '
                + 'with --update-lock to record the new bytes.'
            );
            process.exitCode = 1;
            return;
        }
        console.error('[e2e-cdn-cache] --update-lock given, re-pinning the assets above.');
    }

    // The asset list follows the application (main.html plus the runtime extras above); the lock
    // pins the bytes. A new or removed entry refreshes the list without touching the pinned bytes.
    const listChanged = Object.keys(fetched).sort().join('\n')
        !== Object.keys(pinned).sort().join('\n');
    if (!lock || UPDATE_LOCK || drifted.length || listChanged) {
        fs.writeFileSync(LOCK_PATH, `${JSON.stringify({
            schemaVersion: 'qisi.e2e-cdn-assets.v1',
            note: 'Exact bytes the browser end-to-end tests must run against. Regenerate with '
                + 'node scripts/populate-e2e-cdn-cache.js --update-lock after reviewing an upstream change.',
            assets: Object.fromEntries(
                Object.entries(fetched).sort(([left], [right]) => left.localeCompare(right))
            )
        }, null, 2)}\n`);
        console.log(`[e2e-cdn-cache] wrote ${path.relative(ROOT, LOCK_PATH)}`);
    }

    const missing = Object.keys(pinned).filter(url => !fetched[url]);
    if (missing.length) {
        console.error('[e2e-cdn-cache] pinned assets that are no longer referenced:');
        for (const url of missing) console.error(`- ${url}`);
    }

    console.log(`[e2e-cdn-cache] stored ${stored} assets in ${path.relative(ROOT, CACHE)}`);
};

main().catch(error => {
    console.error('E2E_CDN_CACHE_FAILED', error?.stack || error);
    process.exitCode = 1;
});
