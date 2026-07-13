const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('the giant legacy batch owner is deleted and cannot be reached from AppProxy', () => {
    const app = read('app.js');
    const controller = read('qisi-normal-ui-import-controller.js');
    assert.doesNotMatch(app, /const\s+processDraftImportBatch\s*=/);
    assert.doesNotMatch(app.slice(app.lastIndexOf('return {')), /\bprocessDraftImportBatch\b/);
    assert.match(app, /normalUiImportController\.run\(batchId/);
    assert.match(controller, /mode:\s*'production'/);
});

test('legacy coordinator and injected compatibility path are not production-loaded', () => {
    const html = read('main.html');
    assert.doesNotMatch(html, /qisi-legacy-batch-run-coordinator\.js/);
    assert.doesNotMatch(html, /qisi-injected-import-path\.js/);
    assert.match(html, /qisi-production-import-bridge\.js/);
    assert.match(html, /qisi-normal-ui-import-controller\.js/);
});
