const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_HTML = path.join(ROOT, 'main.html');

const EXPECTED_LOCAL_SCRIPT_PATHS = [
    './qisi-a4-exam-template.js',
    './qisi-config.js',
    './qisi-exam-grouping.js',
    './qisi-runtime.js',
    './qisi-utils.js',
    './qisi-db.js',
    './qisi-backup.js',
    './qisi-docx-layout.js',
    './qisi-components.js',
    './qisi-file-dispatcher.js',
    './qisi-docx-ole-reader.js',
    './qisi-docx-mtef-reader.js',
    './qisi-docx-latex-content.js',
    './qisi-docx-table-latex.js',
    './qisi-docx-question-structure.js',
    './qisi-docx-rich-content.js',
    './qisi-docx-support-content.js',
    './qisi-batch-importer.js',
    './qisi-support-parser.js',
    './qisi-support-repair.js',
    './qisi-pdf-content-integrity.js',
    './qisi-pdf-support-aligner.js',
    './qisi-pdf-support-block-parser.js',
    './qisi-pdf-support-controlled-write.js',
    './qisi-pdf-safe-partial-pipeline.js',
    './qisi-docx-pipeline.js',
    './qisi-ui-events.js',
    './qisi-review-draft-state.js',
    './app.js'
];

const readStartTags = (html, tagName) => {
    const lower = html.toLowerCase();
    const needle = `<${tagName.toLowerCase()}`;
    const tags = [];
    let cursor = 0;

    while (cursor < html.length) {
        const start = lower.indexOf(needle, cursor);
        if (start < 0) break;

        const boundary = lower[start + needle.length] || '';
        if (boundary && !/[\s/>]/.test(boundary)) {
            cursor = start + needle.length;
            continue;
        }

        let quote = '';
        let end = start + needle.length;
        for (; end < html.length; end += 1) {
            const char = html[end];
            if (quote) {
                if (char === quote && html[end - 1] !== '\\') quote = '';
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
            } else if (char === '>') {
                break;
            }
        }

        assert.ok(end < html.length, `unterminated <${tagName}> start tag`);
        tags.push(html.slice(start, end + 1));
        cursor = end + 1;
    }

    return tags;
};

const parseAttributes = (startTag) => {
    const attributes = new Map();
    let cursor = startTag.indexOf(' ');
    if (cursor < 0) return attributes;

    while (cursor < startTag.length) {
        while (/\s/.test(startTag[cursor] || '')) cursor += 1;
        if (startTag[cursor] === '>' || startTag[cursor] === '/') break;

        const nameStart = cursor;
        while (cursor < startTag.length && !/[\s=/>]/.test(startTag[cursor])) cursor += 1;
        const name = startTag.slice(nameStart, cursor).toLowerCase();
        while (/\s/.test(startTag[cursor] || '')) cursor += 1;

        let value = '';
        if (startTag[cursor] === '=') {
            cursor += 1;
            while (/\s/.test(startTag[cursor] || '')) cursor += 1;
            const quote = startTag[cursor];
            if (quote === '"' || quote === "'") {
                cursor += 1;
                const valueStart = cursor;
                while (cursor < startTag.length && startTag[cursor] !== quote) cursor += 1;
                value = startTag.slice(valueStart, cursor);
                if (startTag[cursor] === quote) cursor += 1;
            } else {
                const valueStart = cursor;
                while (cursor < startTag.length && !/[\s>]/.test(startTag[cursor])) cursor += 1;
                value = startTag.slice(valueStart, cursor);
            }
        }

        if (name) attributes.set(name, value);
    }

    return attributes;
};

const stripQueryAndHash = (src) => src.split(/[?#]/, 1)[0];
const isLocalScript = (src) => !/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(src);

test('main.html freezes the parsed production script sequence', () => {
    const html = fs.readFileSync(MAIN_HTML, 'utf8');
    const scriptTags = readStartTags(html, 'script');
    const scriptSources = scriptTags.map((tag, index) => {
        const src = parseAttributes(tag).get('src');
        assert.ok(src, `production script tag ${index + 1} must declare src`);
        return src;
    });
    const localPaths = scriptSources
        .filter(isLocalScript)
        .map(stripQueryAndHash);

    assert.deepEqual(
        localPaths,
        EXPECTED_LOCAL_SCRIPT_PATHS,
        'local production scripts changed order or membership; update the manifest only after dependency review'
    );
    assert.equal(
        new Set(localPaths).size,
        localPaths.length,
        'each local production script must be loaded exactly once'
    );
    assert.equal(
        stripQueryAndHash(scriptSources.at(-1)),
        './app.js',
        'app.js must be the final production script src'
    );
});

test('main.html preserves PDF controlled-write and Route B boundaries', () => {
    const html = fs.readFileSync(MAIN_HTML, 'utf8');
    const localPaths = readStartTags(html, 'script')
        .map(tag => parseAttributes(tag).get('src'))
        .filter(Boolean)
        .filter(isLocalScript)
        .map(stripQueryAndHash);
    const controlledWriteIndex = localPaths.indexOf('./qisi-pdf-support-controlled-write.js');
    const appIndex = localPaths.indexOf('./app.js');

    assert.ok(controlledWriteIndex >= 0, 'controlled-write production script must exist');
    assert.ok(controlledWriteIndex < appIndex, 'controlled-write must load before app.js');
    assert.equal(
        localPaths.some(src => /answer-only-ai/i.test(src)),
        false,
        'Route B answer-only AI module must remain outside production scripts'
    );
});
