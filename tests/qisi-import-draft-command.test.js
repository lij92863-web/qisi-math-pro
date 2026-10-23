const test = require('node:test');
const assert = require('node:assert/strict');
const command = require('../qisi-import-draft-command.js');

const baseCommand = (overrides = {}) => ({
    batchId: 'b1',
    drafts: [{ id: 'd1' }],
    images: [{ id: 'i1' }],
    sourceFiles: [{ id: 'f1' }, { id: 'f2' }],
    batchPatch: { updatedAt: 111, status: 'parsed' },
    warnings: ['w1'],
    unmatched: ['u1'],
    idempotencyKey: 'k1',
    expectedVersion: 2,
    signal: 'sig',
    ...overrides
});

test('mineru evidence is stored per file with filtered tasks and partial status', () => {
    const patch = command.filePatchFor({
        file: { id: 'f1' },
        command: baseCommand({
            pdfEvidence: {
                protocol: 'pdf-mineru-v1',
                tasks: [{ sourceId: 'f1' }, { sourceId: 'f2' }],
                unassigned: [{ source_id: 'f1' }, { source_id: 'f2' }],
                errors: [{ sourceId: 'f1' }]
            }
        })
    });
    assert.equal(patch.pdfMineruEvidence.tasks.length, 1);
    assert.equal(patch.pdfMineruEvidence.unassigned.length, 1);
    assert.equal(patch.parseStatus, 'partial');
    assert.equal(patch.errorMessage, '');
    assert.equal(patch.updatedAt, 111);
    assert.equal(patch.id, 'f1');
});

test('external and legacy evidence use their own fields', () => {
    for (const [protocol, field] of [['pdf-external-v2', 'pdfExternalEvidence'], ['other', 'pdfV1Evidence']]) {
        const patch = command.filePatchFor({
            file: { id: 'f1' },
            command: baseCommand({ pdfEvidence: { protocol, tasks: [], unassigned: [], errors: [] } })
        });
        assert.ok(field in patch, field);
        assert.equal(patch.parseStatus, 'success');
    }
});

test('files without evidence are marked success and keep their fields', () => {
    const patch = command.filePatchFor({ file: { id: 'f9', filename: 'x.docx' }, command: baseCommand() });
    assert.equal(patch.parseStatus, 'success');
    assert.equal(patch.filename, 'x.docx');
    assert.equal(patch.pdfMineruEvidence, undefined);
});

test('buildPersistReviewDraftBatchCall forwards the mapped payload once', () => {
    const calls = [];
    const persist = payload => { calls.push(payload); return 'ok'; };
    const result = command.buildPersistReviewDraftBatchCall({ command: baseCommand(), persist });
    assert.equal(result, 'ok');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].batchPatch.status, 'parsed');
    assert.deepEqual(calls[0].batchPatch.importWarnings, ['w1']);
    assert.deepEqual(calls[0].batchPatch.unmatchedAnswers, ['u1']);
    assert.equal(calls[0].files.length, 2);
    assert.equal(calls[0].expectedVersion, 2);
});

test('buildPersistReviewDraftBatchCall fails closed without a persist callback', () => {
    assert.throws(() => command.buildPersistReviewDraftBatchCall({ command: baseCommand() }),
        error => error.code === 'IMPORT_DRAFT_COMMAND_SERVICE_REQUIRED');
    assert.throws(() => command.buildPersistReviewDraftBatchCall({ command: null, persist: () => {} }),
        error => error.code === 'IMPORT_DRAFT_COMMAND_SERVICE_REQUIRED');
});

test('PDF producer assembly preserves source bytes and evidence while using the exact batch read scope', async () => {
    let ports;
    const calls = [], runner = () => {};
    const renderPages = () => {}, getRoles = file => file.roles;
    const factory = { createProducer(value) { ports = value; return runner; } };
    const storage = { async findBy(...args) { calls.push(['read', ...args]); return [{ id: 'old', batchId: 'b' }]; },
        async put(...args) { calls.push(['write', ...args]); return 'stored'; } };
    assert.equal(command.createPdfProducer({ producer: factory, storage, renderPages, getRoles, clock: () => 90 }), runner);
    assert.equal(ports.renderPages, renderPages); assert.equal(ports.getRoles, getRoles);
    assert.deepEqual(await ports.getExistingDrafts('b'), [{ id: 'old', batchId: 'b' }]);
    const file = Object.freeze({ id: 'f', batchId: 'b', uploadPath: 'data:application/pdf;base64,EXACT_BYTES',
        sourceVersion: 7, roles: Object.freeze(['question']), updatedAt: 1 });
    const evidence = Object.freeze({ protocol: 'pdf-mineru-v1', sourceSha256: 'a'.repeat(64), blocks: Object.freeze([]) });
    assert.equal(await ports.persistSourceEvidence(file, evidence), 'stored');
    assert.deepEqual(calls[0], ['read', 'draftQuestions', 'batchId', 'b']);
    assert.deepEqual(calls[1], ['write', 'draftImportFiles', { ...file, pdfMineruEvidence: evidence, updatedAt: 90 }]);
    assert.equal(file.updatedAt, 1); assert.equal(file.pdfMineruEvidence, undefined);
});

test('PDF assembly exposes read and source-evidence rejection without manufacturing empty drafts or success', async () => {
    let ports;
    const storage = { async findBy() { throw new Error('read rejected'); }, async put() { throw new Error('evidence rejected'); } };
    command.createPdfProducer({ producer: { createProducer(value) { ports = value; return () => {}; } },
        storage, renderPages() {}, getRoles() {} });
    await assert.rejects(ports.getExistingDrafts('b'), /read rejected/);
    const file = { id: 'f', batchId: 'b', updatedAt: 1 };
    await assert.rejects(ports.persistSourceEvidence(file, {}), /evidence rejected/);
    assert.deepEqual(file, { id: 'f', batchId: 'b', updatedAt: 1 });
});

test('PDF producer assembly requires explicit source, storage and renderer ports', () => {
    assert.throws(() => command.createPdfProducer(), error => error.code === 'IMPORT_DRAFT_COMMAND_SOURCE_PORT_REQUIRED');
});
