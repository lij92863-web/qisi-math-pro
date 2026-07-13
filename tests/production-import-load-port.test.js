const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Context = require('../qisi-batch-context-service.js');
const ROOT = path.resolve(__dirname, '..');

const seed = () => ({
    batch: {
        id: 'batch-1', sourceVersion: 3, expectedQuestionCount: 2,
        recognitionMode: 'standard'
    },
    files: [
        {
            id: 'file-2', batchId: 'batch-1', fileType: 'pdf',
            filename: 'support.pdf', roles: ['answer'], sourceOrder: 2
        },
        {
            id: 'file-1', batchId: 'batch-1', fileType: 'docx',
            filename: 'questions.docx', roles: ['question'], sourceOrder: 1
        }
    ]
});

const repositoryFor = (data = seed(), calls = []) => ({
    get: async (table, id) => {
        calls.push(['get', table, id]);
        return structuredClone(data.batch);
    },
    findBy: async (table, index, value) => {
        calls.push(['findBy', table, index, value]);
        return structuredClone(data.files);
    }
});

test('loadBatchAndFiles is the callable production port', () => {
    assert.equal(typeof Context.loadBatchAndFiles, 'function');
});

test('loads independent batch/files in repository source order and builds context', async () => {
    const data = seed();
    const calls = [];
    const loaded = await Context.loadBatchAndFiles({
        batchId: 'batch-1', getRoles: file => file.roles
    }, { repository: repositoryFor(data, calls) });
    assert.deepEqual(calls, [
        ['get', 'draftImportBatches', 'batch-1'],
        ['findBy', 'draftImportFiles', 'batchId', 'batch-1']
    ]);
    assert.deepEqual(loaded.files.map(file => file.id), ['file-2', 'file-1']);
    assert.deepEqual(
        loaded.batchContext.sourceManifest.map(source => source.id),
        ['file-2', 'file-1']
    );
    data.batch.expectedQuestionCount = 99;
    data.files[0].filename = 'changed.pdf';
    assert.equal(loaded.batch.expectedQuestionCount, 2);
    assert.equal(loaded.files[0].filename, 'support.pdf');
    assert.equal(loaded.batchContext.userSettings.expectedQuestionCount, 2);
});

test('missing batch preserves the legacy no-op result and avoids the file read', async () => {
    const calls = [];
    const repository = {
        get: async (...args) => {
            calls.push(['get', ...args]);
            return undefined;
        },
        findBy: async (...args) => {
            calls.push(['findBy', ...args]);
            return [];
        }
    };
    assert.equal(await Context.loadBatchAndFiles({
        batchId: 'missing'
    }, { repository }), null);
    assert.deepEqual(calls, [['get', 'draftImportBatches', 'missing']]);
});

test('missing files and repository failures retain stable errors', async () => {
    const missingFiles = repositoryFor({ batch: seed().batch, files: [] });
    await assert.rejects(
        Context.loadBatchAndFiles({ batchId: 'batch-1' }, { repository: missingFiles }),
        error => error.code === 'BATCH_CONTEXT_MISSING_FILE'
    );
    const stable = Object.assign(new Error('stable'), { code: 'storage-read-failed' });
    await assert.rejects(
        Context.loadBatchAndFiles({ batchId: 'batch-1' }, {
            repository: { get: async () => { throw stable; }, findBy: async () => [] }
        }),
        error => error === stable
    );
});

test('cancellation fails before or between reads without a late file read', async () => {
    const before = new AbortController();
    before.abort();
    await assert.rejects(
        Context.loadBatchAndFiles({ batchId: 'batch-1', signal: before.signal }, {
            repository: repositoryFor()
        }),
        error => error.name === 'AbortError' && error.code === 'IMPORT_CANCELLED_LOADING'
    );

    const between = new AbortController();
    let fileRead = false;
    await assert.rejects(
        Context.loadBatchAndFiles({ batchId: 'batch-1', signal: between.signal }, {
            repository: {
                get: async () => {
                    between.abort();
                    return seed().batch;
                },
                findBy: async () => {
                    fileRead = true;
                    return seed().files;
                }
            }
        }),
        error => error.name === 'AbortError' && error.code === 'IMPORT_CANCELLED_LOADING'
    );
    assert.equal(fileRead, false);
});

test('the load port has no write, UI, FormalAdmission, or external transport authority', () => {
    const source = fs.readFileSync(
        path.join(ROOT, 'qisi-batch-context-service.js'), 'utf8'
    );
    assert.doesNotMatch(source, /\.update\s*\(|\.put\s*\(|\.add\s*\(|\.delete\s*\(/);
    assert.doesNotMatch(source, /document\.|Qisi\.AppProxy|FormalAdmission|\bfetch\s*\(/);
    assert.doesNotMatch(source, /InjectedImportTransport|\/api\/ai|OCR|vision/i);
});

test('Bridge production entry calls the shared port and never reads tables inline', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const start = app.indexOf('loadBatchAndFiles: input =>');
    const end = app.indexOf('classifySourceRoles:', start);
    const loading = app.slice(start, end);
    assert.ok(start >= 0 && end > start);
    assert.match(loading, /BatchContextService\.loadBatchAndFiles\s*\(/);
    assert.match(loading, /repository:\s*storageRepository/);
    assert.doesNotMatch(loading, /db\.draftImportBatches\.get/);
    assert.doesNotMatch(loading, /db\.draftImportFiles\.where/);
});
