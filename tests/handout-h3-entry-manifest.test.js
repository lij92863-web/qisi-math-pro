'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const manifest = require('../scripts/production-entry-manifest.js');

const normalize = value => String(value || '')
    .split(/[?#]/, 1)[0]
    .replace(/^\.\//, '');

const readSources = (html, tag, attribute) => [
    ...html.matchAll(
        new RegExp(
            `<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*(["'])(.*?)\\1[^>]*>`,
            'gi'
        )
    )
].map(match => normalize(match[2]));

test('H3 handout entry uses one pinned local script and style manifest', () => {
    const html = fs.readFileSync(
        path.join(ROOT, 'handout.html'),
        'utf8'
    );
    const scripts = readSources(html, 'script', 'src');
    const styles = readSources(html, 'link', 'href');

    assert.deepEqual(scripts, manifest.handoutBrowserScriptOrder);
    assert.deepEqual(styles, manifest.handoutBrowserStyleOrder);
    assert.equal(new Set(scripts).size, scripts.length);
    assert.equal(new Set(styles).size, styles.length);
    assert.equal(scripts.at(-1), 'qisi-handout-app.js');
    assert.equal(
        scripts.some(file =>
            /(?:^|\/)vendor\/(?:typst|mitex|pdfjs)|compiler-worker|compiler-client/i.test(file)
        ),
        false,
        'the isolated entry may load the pure H4 template but not the formal compiler runtime'
    );
    assert.equal(
        scripts.some(file => /^https?:/i.test(file)),
        false,
        'H3 entry must not depend on a CDN'
    );
});

test('H3 isolated app does not add handout code to main.html or app.js', () => {
    const main = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    for (const file of manifest.categoryFiles['browser-handout-entry']) {
        assert.equal(main.includes(file), false);
    }
    assert.doesNotMatch(app, /HandoutEditorState|HandoutPreview|handoutAssets/);
});
