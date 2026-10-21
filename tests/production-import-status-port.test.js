const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StatusPort = require('../qisi-production-import-status-port.js');
const ROOT = path.resolve(__dirname, '..');

const makeStatusRepositoryStub = ({ findError = null } = {}) => {
    const updates = [];
    return {
        updates,
        async update(table, id, patch) {
            updates.push({ table, id, patch: structuredClone(patch) });
            return { id, ...patch };
        },
        async findBy() {
            if (findError) throw findError;
            return [{ id: 'file-1' }, { id: 'file-2' }];
        }
    };
};

test('reportProgress preserves the legacy bounded patch and returns it for local UI apply', async () => {
    const repository = makeStatusRepositoryStub();
    const result = await StatusPort.reportProgress({
        batchId: 'batch-1', progress: 120.4, status: 'processing'
    }, { repository, clock: () => 1234 });

    assert.deepEqual(result.patch, {
        progress: 100, status: 'processing', updatedAt: 1234
    });
    assert.deepEqual(repository.updates, [{
        table: 'draftImportBatches', id: 'batch-1', patch: result.patch
    }]);
});

test('reportProgress preserves zero coercion and caller status without owning UI state', async () => {
    const repository = makeStatusRepositoryStub();
    const result = await StatusPort.reportProgress({
        batchId: 'batch-1', progress: Number.NaN, status: 'review'
    }, { repository, clock: () => 2 });
    assert.deepEqual(result.patch, { progress: 0, status: 'review', updatedAt: 2 });
});

test('reportImportFailure writes the legacy batch and optional file failure patches', async () => {
    const repository = makeStatusRepositoryStub();
    const result = await StatusPort.reportImportFailure({
        batchId: 'batch-1', error: new Error('service unavailable'), failFiles: true
    }, { repository, clock: () => 50 });

    assert.deepEqual(result.fileIds, ['file-1', 'file-2']);
    assert.deepEqual(repository.updates, [
        {
            table: 'draftImportBatches', id: 'batch-1',
            patch: {
                status: 'failed', progress: 100, updatedAt: 50,
                errorMessage: 'service unavailable'
            }
        },
        {
            table: 'draftImportFiles', id: 'file-1',
            patch: {
                parseStatus: 'failed', errorMessage: 'service unavailable', updatedAt: 50
            }
        },
        {
            table: 'draftImportFiles', id: 'file-2',
            patch: {
                parseStatus: 'failed', errorMessage: 'service unavailable', updatedAt: 50
            }
        }
    ]);
});

test('file lookup failure retains the legacy best-effort batch failure write', async () => {
    const repository = makeStatusRepositoryStub({ findError: new Error('lookup down') });
    const result = await StatusPort.reportImportFailure({
        batchId: 'batch-1', error: 'failed', failFiles: true
    }, { repository, clock: () => 60 });
    assert.deepEqual(result.fileIds, []);
    assert.equal(repository.updates.length, 1);
    assert.equal(repository.updates[0].table, 'draftImportBatches');
});

test('import failure retains the safe bridge cause on both batch and files', async () => {
    for (const causeCode of ['PDF_EXTERNAL_NOT_CONFIGURED', 'DOCX_IDENTITY_DUPLICATE']) {
        const repository = makeStatusRepositoryStub();
        const error = Object.assign(new Error('IMPORT_RECOGNITION_FAILED'), { causeCode });
        const result = await StatusPort.reportImportFailure({ batchId: 'b', error, failFiles: true }, { repository });
        assert.ok(result.batchPatch.errorMessage.includes(causeCode));
        if (causeCode === 'PDF_EXTERNAL_NOT_CONFIGURED') assert.match(result.batchPatch.errorMessage, /未启用/);
        assert.ok(repository.updates.every(row => row.patch.errorMessage === result.batchPatch.errorMessage));
    }
    const repository = makeStatusRepositoryStub();
    const error = Object.assign(new Error('IMPORT_RECOGNITION_FAILED'), { causeCode: 'raw payload with private text' });
    const result = await StatusPort.reportImportFailure({ batchId: 'b', error }, { repository });
    assert.equal(result.batchPatch.errorMessage, 'IMPORT_RECOGNITION_FAILED');
});

test('invalid input, missing repository, and cancellation fail before writes', async () => {
    const repository = makeStatusRepositoryStub();
    await assert.rejects(
        StatusPort.reportProgress({}, { repository }),
        error => error.code === 'IMPORT_STATUS_INVALID'
    );
    await assert.rejects(
        StatusPort.reportProgress({ batchId: 'batch-1', progress: 1 }, {}),
        error => error.code === 'IMPORT_STATUS_PORT_REQUIRED'
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        StatusPort.reportProgress({ batchId: 'batch-1', progress: 1, signal: controller.signal }, { repository }),
        error => error.name === 'AbortError' && error.code === 'IMPORT_STATUS_ABORTED'
    );
    assert.equal(repository.updates.length, 0);
});

test('safe structured errors persist identically and distinguish query-only recovery', async () => {
    const repository = makeStatusRepositoryStub();
    const error = Object.assign(new Error('private upstream payload'), {
        code: 'IMPORT_RECOGNITION_FAILED', causeCode: 'MINERU_SUBMISSION_UNKNOWN',
        stage: 'submitting', requestId: 'normal-ui:b:source:1:draft:2'
    });
    const result = await StatusPort.reportImportFailure({ batchId: 'b', error, failFiles: true }, { repository });
    const expected = StatusPort.failureDetails(error);
    assert.equal(expected.retryability, 'query-only');
    assert.equal(StatusPort.failureDetails({ code: 'IMPORT_FAILED', causeCode: 'MINERU_NOT_CONFIGURED' }).retryability, 'never');
    assert.ok(repository.updates.every(row => JSON.stringify(row.patch.importError) === JSON.stringify(expected)));
    assert.equal(result.batchPatch.errorMessage, StatusPort.failureMessage(expected));
    assert.doesNotMatch(result.batchPatch.errorMessage, /private/);
    assert.equal(StatusPort.failureDetails({ causeCode: 'secret payload', requestId: 'secret payload' }).causeCode, '');
});

test('repository errors retain identity and no UI callback runs inside the owner', async () => {
    const stable = Object.assign(new Error('write down'), { code: 'write-failed' });
    await assert.rejects(
        StatusPort.reportProgress({ batchId: 'batch-1', progress: 1 }, {
            repository: { update: async () => { throw stable; } }
        }),
        error => error === stable
    );
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-production-import-status-port.js'), 'utf8'
    );
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|toast|reactive|FormalAdmission/);
    assert.doesNotMatch(implementation, /indexedDB|Dexie|\.transaction\s*\(|controlledWrite/i);
});

test('production progress and outer failure paths use the shared owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /ProductionImportStatusPort\.reportProgress\s*\(/);
    const failures = app.match(/ProductionImportStatusPort\.reportImportFailure\s*\(/g) || [];
    assert.equal(failures.length, 1);
    assert.doesNotMatch(app, /processDraftImportBatchV2/);
});
