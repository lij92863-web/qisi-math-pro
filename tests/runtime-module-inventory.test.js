const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInventory, verify } = require('../scripts/verify-runtime-modules');
const fixture = () => ({ inventory: { schemaVersion: 'qisi.runtime-file-inventory.v1',
    modules: [{ file: 'qisi-policy.js', runtime: 'browser' }] },
    actualFiles: ['qisi-policy.js'], browserFiles: ['qisi-policy.js'] });
test('both architecture views resolve the authoritative complete runtime inventory', () => {
    assert.deepEqual(verify(), { valid: true, errors: [] });
});
test('unregistered files, duplicates, missing files and wrong browser roles are rejected', () => {
    assert.equal(validateInventory(fixture()).valid, true);
    const unknown = fixture(); unknown.actualFiles.push('qisi-unknown.js');
    assert.ok(validateInventory(unknown).errors.includes('unregistered-module:qisi-unknown.js'));
    const duplicate = fixture(); duplicate.inventory.modules.push(duplicate.inventory.modules[0]);
    assert.equal(validateInventory(duplicate).valid, false);
    const missing = fixture(); missing.actualFiles = [];
    assert.equal(validateInventory(missing).valid, false);
    const wrong = fixture(); wrong.inventory.modules[0].runtime = 'node';
    assert.equal(validateInventory(wrong).valid, false);
});
