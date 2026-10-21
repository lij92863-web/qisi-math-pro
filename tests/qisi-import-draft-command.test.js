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
