const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeRuntimeDependencies } = require('../scripts/verify-qisi-runtime-dependencies.js');

const ROOT = path.resolve(__dirname, '..');

test('Phase 3 missing runtime script fails dependency audit', () => {
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const result = analyzeRuntimeDependencies({
        rootDir: ROOT,
        html,
        virtualFiles: { 'qisi-review-draft-state.js': null }
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === 'runtime-script-missing' && error.path === 'qisi-review-draft-state.js'));
});
