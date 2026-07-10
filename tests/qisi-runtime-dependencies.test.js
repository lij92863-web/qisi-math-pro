const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    analyzeRuntimeDependencies
} = require('../scripts/verify-qisi-runtime-dependencies.js');

const ROOT = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

const analyze = (html, virtualFiles = {}) =>
    analyzeRuntimeDependencies({
        rootDir: ROOT,
        html,
        virtualFiles
    });

const codes = result => result.errors.map(error => error.code);

test('current runtime scripts and app namespaces are valid', () => {
    const result = analyze(MAIN);
    assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
    assert.equal(result.scripts.at(-1), 'app.js');
    assert.ok(result.uses.includes('ReviewDraftState'));
    assert.ok(result.uses.includes('UiEvents'));
});

test('missing qisi-review-draft-state script is rejected', () => {
    const html = MAIN.replace(
        /^.*qisi-review-draft-state\.js.*\r?\n/m,
        ''
    );
    const result = analyze(html);
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes('runtime-namespace-undefined'));
    assert.ok(result.errors.some(error =>
        error.namespace === 'ReviewDraftState'
    ));
});

test('missing qisi-ui-events script is rejected', () => {
    const html = MAIN.replace(
        /^.*qisi-ui-events\.js.*\r?\n/m,
        ''
    );
    const result = analyze(html);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error =>
        error.code === 'runtime-namespace-undefined' &&
        error.namespace === 'UiEvents'
    ));
});

test('a dependency loaded after app.js is rejected', () => {
    const uiLine = MAIN.match(/^.*qisi-ui-events\.js.*$/m)[0];
    const withoutUi = MAIN.replace(uiLine, '');
    const html = withoutUi.replace(
        /(<script[^>]+app\.js[^>]*><\/script>)/,
        `$1\n${uiLine}`
    );
    const result = analyze(html);
    assert.equal(result.ok, false);
    assert.ok(codes(result).includes('runtime-app-not-last'));
    assert.ok(result.errors.some(error =>
        error.code === 'runtime-owner-after-app' &&
        error.namespace === 'UiEvents'
    ));
});

test('misspelled app namespace is rejected', () => {
    const result = analyze(MAIN, {
        'app.js': `${APP}\nwindow.Qisi.Utiils.findNode([],'x');`
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error =>
        error.code === 'runtime-namespace-undefined' &&
        error.namespace === 'Utiils'
    ));
});

test('a missing module file is rejected', () => {
    const html = MAIN.replace(
        './qisi-ui-events.js',
        './qisi-ui-events-missing.js'
    );
    const result = analyze(html);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error =>
        error.code === 'runtime-script-missing' &&
        error.path === 'qisi-ui-events-missing.js'
    ));
});

test('two files defining the same namespace owner are rejected', () => {
    const duplicateTag =
        '<script src="./qisi-duplicate-utils.js"></script>';
    const html = MAIN.replace(
        /(<script[^>]+app\.js[^>]*><\/script>)/,
        `${duplicateTag}\n$1`
    );
    const result = analyze(html, {
        'qisi-duplicate-utils.js':
            'globalThis.Qisi = globalThis.Qisi || {}; globalThis.Qisi.Utils = {};'
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error =>
        error.code === 'runtime-duplicate-owner' &&
        error.namespace === 'Utils'
    ));
});

test('app use of an undefined namespace is rejected', () => {
    const result = analyze(MAIN, {
        'app.js': `${APP}\nwindow.Qisi.NotRegistered.run();`
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error =>
        error.code === 'runtime-namespace-undefined' &&
        error.namespace === 'NotRegistered'
    ));
});
