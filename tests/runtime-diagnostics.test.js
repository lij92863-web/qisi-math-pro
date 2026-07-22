'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Runtime } = require('../qisi-runtime.js');

test('runtime diagnostics are opt-in through an explicit local switch', () => {
    assert.equal(Runtime.shouldEnableDiagnostics(), false);
    assert.equal(Runtime.shouldEnableDiagnostics({ search: '?qisiDebug=1' }), true);
    assert.equal(Runtime.shouldEnableDiagnostics({ search: '?qisiDebug=true' }), true);
    assert.equal(Runtime.shouldEnableDiagnostics({ storageValue: '1' }), true);
    assert.equal(Runtime.shouldEnableDiagnostics({ search: '?debug=1' }), false);
});

test('runtime diagnostic console exposes the complete application console contract', () => {
    for (const method of [
        'log', 'info', 'debug', 'group', 'groupCollapsed', 'groupEnd',
        'table', 'warn', 'error'
    ]) {
        assert.equal(typeof Runtime.console[method], 'function', method);
    }
});
