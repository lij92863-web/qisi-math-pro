const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Controller = require('../qisi-normal-ui-import-controller.js');
const ROOT = path.resolve(__dirname, '..');

test('a Bridge failure is sanitized and never invokes a legacy fallback', async () => {
    let bridgeCalls = 0;
    let reviewCalls = 0;
    const controller = Controller.createNormalUiImportController({
        bridge: { run: async () => {
            bridgeCalls += 1;
            const error = new Error('PRIVATE_SOURCE_TEXT and stack');
            error.code = 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED';
            throw error;
        } },
        loadBatch: async () => ({
            id: 'batch-1', sourceType: 'docx', sourceVersion: 1
        }),
        applyReviewModel: async () => { reviewCalls += 1; }
    });
    await assert.rejects(controller.run('batch-1'), error =>
        error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED' &&
        !/PRIVATE_SOURCE_TEXT|stack/.test(error.message)
    );
    assert.equal(bridgeCalls, 1);
    assert.equal(reviewCalls, 0);
});

test('production runtime contains no loaded or callable legacy fallback', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    assert.doesNotMatch(app, /runLegacyBatch|legacyBatchRunCoordinator\.run/);
    assert.doesNotMatch(html, /qisi-legacy-batch-run-coordinator\.js/);
    assert.doesNotMatch(html, /qisi-injected-import-path\.js/);
});
