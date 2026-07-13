const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('every visible batch-import command converges on explicit Bridge production mode', () => {
    const app = read('app.js');
    const controller = read('qisi-normal-ui-import-controller.js');
    const template = read('main.html');
    assert.match(template, /@click="createDraftImportBatch"/);
    assert.match(template, /@click="runBatchRecognition\(batch\.id\)"/);
    assert.match(template, /@click="rerunActiveBatchRecognition"/);
    assert.match(app, /ProductionImportBridge\.createProductionImportBridge/);
    assert.match(app, /createNormalUiImportController\s*\(\s*\{[\s\S]*bridge:\s*productionImportBridge/);
    assert.match(controller, /ports\.bridge\.run\s*\(\s*\{[\s\S]*mode:\s*'production'/);
    assert.doesNotMatch(app, /legacyBatchRunCoordinator\.run\s*\(/);
    assert.doesNotMatch(app, /InjectedImportPath\.createInjectedImportPath/);
});

test('the normal UI has no legacy fallback or direct giant-owner proxy entry', () => {
    const app = read('app.js');
    assert.doesNotMatch(app, /runLegacyBatch/);
    assert.doesNotMatch(app, /actualFunction:\s*'processDraftImportBatch'/);
    const returned = app.slice(app.lastIndexOf('return {'));
    assert.doesNotMatch(returned, /\bprocessDraftImportBatch\b/);
});

test('unsafe batch-only image and text routes are removed without touching manual OCR inputs', () => {
    const template = read('main.html');
    const batchAccept = template.match(/accept="([^"]*\.docx[^"]*)"/)?.[1] || '';
    assert.doesNotMatch(batchAccept, /\.jpg|\.jpeg|\.png|\.webp|\.txt/);
    assert.match(template, /accept="image\/\*"/);
});
