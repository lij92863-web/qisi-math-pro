const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Context = require('../qisi-batch-context-service.js');
const ROOT = path.resolve(__dirname, '..');

const validInput = () => ({
    batchId: 'batch-1',
    batch: { id: 'batch-1', sourceVersion: 3, expectedQuestionCount: 12, recognitionMode: 'standard' },
    files: [
        { id: 'f1', batchId: 'batch-1', filename: 'questions.docx', fileType: 'docx', createdAt: 1, roles: ['question'], rawText: 'private' },
        { id: 'f2', batchId: 'batch-1', filename: 'support.pdf', fileType: 'pdf', createdAt: 2, roles: ['answer', 'solution'] }
    ],
    expectedSourceVersion: 3,
    userSettings: { locale: 'zh-CN' },
    engineConfig: { engineId: 'legacy-current' }
});

test('creates immutable metadata/settings/engine/source snapshots without content', () => {
    const input = validInput();
    const context = Context.createBatchContext(input);
    assert.equal(context.batchId, 'batch-1');
    assert.equal(context.batchMetadata.expectedQuestionCount, 12);
    assert.equal(context.userSettings.expectedQuestionCount, 12);
    assert.equal(context.engineConfig.recognitionMode, 'standard');
    assert.equal(context.sourceManifest.length, 2);
    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(context.sourceManifest[0]), true);
    assert.equal(JSON.stringify(context).includes('private'), false);
    input.batch.expectedQuestionCount = 99;
    input.files[0].filename = 'changed.docx';
    assert.equal(context.batchMetadata.expectedQuestionCount, 12);
    assert.equal(context.sourceManifest[0].filename, 'questions.docx');
});

for (const [name, mutate, code] of [
    ['missing batch', input => { input.batch = null; }, 'BATCH_CONTEXT_MISSING_BATCH'],
    ['missing file', input => { input.files = []; }, 'BATCH_CONTEXT_MISSING_FILE'],
    ['stale source', input => { input.expectedSourceVersion = 4; }, 'BATCH_CONTEXT_STALE_SOURCE'],
    ['duplicate file', input => { input.files.push({ ...input.files[0] }); }, 'BATCH_CONTEXT_DUPLICATE_FILE'],
    ['unsupported type', input => { input.files[0].fileType = 'exe'; }, 'BATCH_CONTEXT_UNSUPPORTED_TYPE']
]) {
    test(`${name} fails with stable code`, () => {
        const input = validInput();
        mutate(input);
        assert.throws(() => Context.createBatchContext(input), error => error.code === code);
    });
}

test('production app uses the context owner and loads it before app', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    assert.match(app, /Qisi\.BatchContextService\.loadBatchAndFiles\s*\(/);
    assert.match(app, /repository:\s*storageRepository/);
    assert.match(app, /batchContext\.userSettings\.expectedQuestionCount/);
    assert.match(app, /batchContext\.engineConfig\.recognitionMode/);
    assert.match(app, /files:\s*batchContext\.sourceManifest/);
    assert.doesNotMatch(app, /const batchExpectedCount\s*=\s*\n\s*Math\.max/);
    assert.doesNotMatch(app, /const recognitionMode\s*=\s*batch\.recognitionMode/);
    assert.ok(html.indexOf('qisi-batch-context-service.js') < html.indexOf('app.js'));
    const source = fs.readFileSync(path.join(ROOT, 'qisi-batch-context-service.js'), 'utf8');
    assert.doesNotMatch(source, /indexedDB|\.transaction\s*\(|\.put\s*\(|\.add\s*\(|\.delete\s*\(/);
    assert.doesNotMatch(source, /document\.|window\.|\bfetch\s*\(/);
});
