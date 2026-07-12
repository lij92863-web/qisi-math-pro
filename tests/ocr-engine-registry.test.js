const test = require('node:test');
const assert = require('node:assert/strict');
const { createRegistry } = require('../qisi-ocr-engine-registry.js');

const engine = result => ({
    healthCheck: async () => ({ ok: true }), getCapabilities: () => ({ mock: true }),
    recognizePage: async () => result, recognizeDocument: async () => result,
    cancel: () => true
});

test('registers, lists, selects default, and recognizes', async () => {
    const registry = createRegistry();
    registry.registerEngine('one', engine({ id: 1 }));
    registry.registerEngine('two', engine({ id: 2 }), { makeDefault: true });
    assert.equal(registry.getEngine(), registry.getEngine('two'));
    assert.equal(registry.listEngines().length, 2);
    assert.deepEqual(await registry.recognizePage({}, {}), { id: 2 });
    registry.setDefault('one');
    assert.deepEqual(await registry.recognizeDocument({}, {}), { id: 1 });
});

test('rejects duplicate or incomplete engines and enforces timeout', async () => {
    const registry = createRegistry({ timeoutMs: 5 });
    assert.throws(() => registry.registerEngine('bad', {}), /missing/);
    registry.registerEngine('slow', {
        ...engine(null), recognizePage: () => new Promise(() => {})
    });
    await assert.rejects(registry.recognizePage({}), error => error.code === 'ocr-timeout');
    assert.throws(() => registry.registerEngine('slow', engine(null)), /already/);
});
