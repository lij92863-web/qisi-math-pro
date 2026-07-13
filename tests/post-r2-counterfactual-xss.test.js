const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Runtime = require('../qisi-runtime.js').Runtime;
const ROOT = path.resolve(__dirname, '..');

test('Phase 3 XSS payload is escaped at startup and preview boundaries', () => {
    const previousDocument = globalThis.document;
    const previousConsole = console.error;
    const deps = ['Vue', 'Dexie', 'JSZip', 'pdfjsLib', 'katex'];
    const prior = Object.fromEntries(deps.map(name => [name, globalThis[name]]));
    const root = { innerHTML: '' };
    globalThis.document = { getElementById: () => root };
    deps.forEach(name => { globalThis[name] = {}; });
    console.error = () => {};
    try {
        Runtime.boot(() => { throw new Error('<img src=x onerror=globalThis.pwned=1><script>pwned()</script>'); });
        assert.doesNotMatch(root.innerHTML, /<script>|<img/);
        assert.match(root.innerHTML, /&lt;script&gt;/);
    } finally {
        globalThis.document = previousDocument;
        console.error = previousConsole;
        deps.forEach(name => prior[name] === undefined ? delete globalThis[name] : globalThis[name] = prior[name]);
    }
    const components = fs.readFileSync(path.join(ROOT, 'qisi-components.js'), 'utf8');
    assert.match(components, /replace\(\/<\/g, '&lt;'\)/);
    assert.match(components, /trust:\s*false/);
    assert.doesNotMatch(components, /trust:\s*true/);
});

test('Phase 3 matrix records XSS', () => {
    const matrix = fs.readFileSync(path.join(ROOT, 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| XSS \|[^\n]+\| PASS \|/);
});
