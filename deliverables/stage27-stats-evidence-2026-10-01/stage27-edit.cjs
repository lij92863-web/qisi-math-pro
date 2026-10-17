const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage27-stats';
const manifest = [];
function edit(name, work) {
    const file = path.join(root, name), exists = fs.existsSync(file), before = exists ? fs.readFileSync(file, 'utf8') : '';
    const after = work(before.replace(/\r\n/g, '\n')).replace(/\n/g, before.includes('\r\n') ? '\r\n' : '\n');
    const backup = path.join(out, 'source-before', name); if (fs.existsSync(backup)) throw new Error('Already edited: ' + name);
    fs.mkdirSync(path.dirname(backup), { recursive: true }); if (exists) fs.writeFileSync(backup, before);
    fs.writeFileSync(file, after);
    manifest.push({ name, existed: exists, beforeSha256: exists ? crypto.createHash('sha256').update(before).digest('hex') : null, afterSha256: crypto.createHash('sha256').update(after).digest('hex') });
}
function replace(text, before, after) { if (text.split(before).length !== 2) throw new Error('Anchor count ' + before.slice(0, 70)); return text.replace(before, after); }
if (process.argv[2] === 'tests') {
    edit('tests/draft-stats-transaction.test.js', () => `const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { makeDraft } = require('./fixtures/formal-admission-transaction');

const runNative = async work => {
    const server = http.createServer((_request, response) => response.end('<!doctype html>'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + server.address().port);
        for (const file of [
            'vendor/dexie/dexie.min.js', 'qisi-docx-producer-identity-contract.js',
            'qisi-recognition-contracts.js', 'qisi-formal-admission-policy.js',
            'qisi-question-duplicate-policy.js', 'qisi-storage-repository.js',
            'qisi-draft-persistence-service.js', 'qisi-draft-maintenance-service.js'
        ]) await page.addScriptTag({ path: path.resolve(__dirname, '..', file) });
        await page.evaluate(async fixture => {
            window.fixture = fixture;
            window.fixtureDb = new Dexie('isolated-native-stats');
            fixtureDb.version(1).stores(Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(name => [name,
                ['draftQuestions', 'draftImages', 'draftImportFiles'].includes(name) ? 'id,batchId' : 'id'
            ])));
            await fixtureDb.open();
            await fixtureDb.draftImportBatches.put({ id: 'batch-1', status: 'review', customMetadata: 'keep', draftPersistence: { version: 0, idempotencyKey: 'initial', signature: 'initial' } });
            await fixtureDb.draftQuestions.put(fixture);
            await fixtureDb.draftImages.put({ id: 'i1', batchId: 'batch-1', status: 'unassigned', url: 'data:fixture-evidence' });
            await fixtureDb.draftImportFiles.put({ id: 'f1', batchId: 'batch-1', rawText: 'raw file evidence' });
            const policy = Qisi.FormalAdmissionPolicy;
            window.repository = Qisi.StorageRepository.createRepository(fixtureDb, { admission: {
                evaluateDraftAdmission: policy.evaluateDraftAdmission, validateAdmissionDecision: policy.validateAdmissionDecision,
                buildQuestionV2: policy.buildQuestionV2, validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2
            } });
            window.persistence = Object.fromEntries(['reloadDraftBatch', 'persistReviewDraftBatch', 'deleteDraftBatch', 'refreshDraftBatchStats'].map(method => [method,
                (...args) => Qisi.DraftPersistenceService[method](...args, repository)
            ]));
            window.makeMaintenance = problemsForDraft => Qisi.DraftMaintenanceService.createDraftMaintenanceService({ persistence,
                dedupeDrafts: value => value, countOptions: value => value.length, problemsForDraft,
                preserveRawEvidence: value => value, cleanDisplayFields: value => value, clock: () => 100
            });
            window.commitFormal = async () => {
                const context = policy.createAdmissionContext({ mode: 'pdf-ai', actorId: 'fixture-teacher', explicitConfirmation: true,
                    requestId: 'stats-race', idempotencyKey: 'stats-race', evaluatedAt: new Date().toISOString(), source: fixture.source });
                return repository.confirmDraftToQuestion(fixture.id, policy.evaluateDraftAdmission(fixture, context), {
                    expectedDraftVersion: 1, requestId: 'stats-race', idempotencyKey: 'stats-race', actorId: 'fixture-teacher', questionId: 'formal-1', context
                });
            };
        }, makeDraft());
        return await work(page);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
};

test('native statistics serialize with formal commit and never replace draft/image/file rows', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        try {
            let writer;
            const first = await makeMaintenance(() => {
                writer = Dexie.ignoreTransaction(() => commitFormal());
                return [];
            }).refreshBatchStats({ batchId: 'batch-1' });
            await writer;
            const committedDraft = await fixtureDb.draftQuestions.get(fixture.id);
            const imageBefore = await fixtureDb.draftImages.toArray(), fileBefore = await fixtureDb.draftImportFiles.toArray();
            const tablePrototype = Object.getPrototypeOf(fixtureDb.questions), writes = [], originals = {};
            for (const method of ['put', 'bulkPut', 'update', 'delete', 'clear']) {
                originals[method] = tablePrototype[method];
                tablePrototype[method] = function (...args) { writes.push(this.name + '.' + method); return originals[method].apply(this, args); };
            }
            let second;
            try { second = await makeMaintenance(() => []).refreshBatchStats({ batchId: 'batch-1' }); }
            finally { Object.assign(tablePrototype, originals); }
            return { firstCounts: first.counts, secondCounts: second.counts,
                firstVersion: first.readback.batch.draftPersistence.version, secondVersion: second.readback.batch.draftPersistence.version,
                committedDraft, finalDraft: await fixtureDb.draftQuestions.get(fixture.id), formalCount: await fixtureDb.questions.count(),
                imageBefore, imageAfter: await fixtureDb.draftImages.toArray(), fileBefore, fileAfter: await fixtureDb.draftImportFiles.toArray(),
                writes, customMetadata: second.readback.batch.customMetadata
            };
        } finally { fixtureDb.close(); await Dexie.delete('isolated-native-stats'); }
    }));
    assert.equal(result.firstCounts.submittedCount, 0);
    assert.equal(result.secondCounts.submittedCount, 1);
    assert.equal(result.secondCounts.reviewedCount, 0);
    assert.equal(result.secondCounts.status, 'completed');
    assert.equal(result.secondCounts.unassignedImageCount, 1);
    assert.equal(result.firstVersion, 1); assert.equal(result.secondVersion, 2);
    assert.equal(result.formalCount, 1); assert.equal(result.finalDraft.status, 'submitted');
    assert.equal(result.finalDraft.version, 2); assert.equal(result.finalDraft.submittedQuestionId, 'formal-1');
    assert.deepEqual(result.finalDraft, result.committedDraft);
    assert.deepEqual(result.imageAfter, result.imageBefore); assert.deepEqual(result.fileAfter, result.fileBefore);
    assert.deepEqual(result.writes, ['draftImportBatches.update']);
    assert.equal(result.customMetadata, 'keep');
});

test('native statistics rollback on calculation/cancellation and invalidate stale batch replacement', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        try {
            const before = await persistence.reloadDraftBatch('batch-1');
            const failures = [];
            const signal = new AbortController();
            for (const [calculate, options] of [
                [() => { throw new Error('fixture calculation failure'); }, {}],
                [() => { signal.abort(); return []; }, { signal: signal.signal }]
            ]) {
                try { await makeMaintenance(calculate).refreshBatchStats({ batchId: 'batch-1', ...options }); }
                catch (error) { failures.push(error.code); }
            }
            const afterFailure = await persistence.reloadDraftBatch('batch-1');
            const refreshed = await makeMaintenance(() => []).refreshBatchStats({ batchId: 'batch-1' });
            let staleCode;
            try { await persistence.persistReviewDraftBatch({ batchId: 'batch-1', drafts: before.questions, images: before.images, files: before.files,
                batchPatch: { status: 'review' }, expectedVersion: 0, idempotencyKey: 'stale-command' }); }
            catch (error) { staleCode = error.code; }
            const afterStale = await persistence.reloadDraftBatch('batch-1');
            return { before, afterFailure, failures, staleCode, version: refreshed.readback.batch.draftPersistence.version,
                key: refreshed.readback.batch.draftPersistence.idempotencyKey, afterStale };
        } finally { fixtureDb.close(); await Dexie.delete('isolated-native-stats'); }
    }));
    assert.deepEqual(result.afterFailure, result.before);
    assert.deepEqual(result.failures, ['DRAFT_PERSISTENCE_WRITE_FAILED', 'DRAFT_PERSISTENCE_CANCELLED']);
    assert.equal(result.staleCode, 'DRAFT_PERSISTENCE_VERSION_CONFLICT');
    assert.equal(result.version, 1); assert.equal(result.key, 'maintenance:stats:batch-1:0');
    assert.deepEqual(result.afterStale.questions, result.before.questions);
    assert.deepEqual(result.afterStale.images, result.before.images);
    assert.deepEqual(result.afterStale.files, result.before.files);
});
`);
} else if (process.argv[2] === 'implementation') {
    edit('qisi-storage-repository.js', text => {
        text = replace(text, '        const loadDraftBatch = async batchId => ({', `        const refreshDraftBatchStats = (batchId, { buildUpdate, signal }) => {
            requireId(batchId, 'batch.id');
            const assertActive = () => {
                if (signal?.aborted) {
                    throw Object.assign(new Error('DRAFT_PERSISTENCE_CANCELLED'), {
                        name: 'AbortError'
                    });
                }
            };
            assertActive();
            return transaction(
                ['draftImportBatches', 'draftQuestions', 'draftImages'],
                async () => {
                    const batchTable = table('draftImportBatches');
                    const batch = await batchTable.get(batchId);
                    if (!batch) {
                        throw new StorageRepositoryError(
                            'draft-batch-not-found', 'DRAFT_BATCH_NOT_FOUND', { batchId }
                        );
                    }
                    const questions = await table('draftQuestions')
                        .where('batchId').equals(batchId).toArray();
                    const images = await table('draftImages')
                        .where('batchId').equals(batchId).toArray();
                    assertActive();
                    const { counts, batchPatch } = buildUpdate({ batch, questions, images });
                    assertActive();
                    await batchTable.update(batchId, clone(batchPatch));
                    assertActive();
                    const readback = await batchTable.get(batchId);
                    assertActive();
                    return { counts: clone(counts), readback: { batch: clone(readback) } };
                }
            );
        };
        const loadDraftBatch = async batchId => ({`);
        return replace(text, '            loadDraftBatch, loadDraftReview, createDraftBatch, persistReviewDraftBatch,', '            loadDraftBatch, loadDraftReview, refreshDraftBatchStats,\n            createDraftBatch, persistReviewDraftBatch,');
    });
    edit('qisi-draft-persistence-service.js', text => {
        text = replace(text, '    const validateAssociatedRows = (rows, batchId) => {', `    const refreshDraftBatchStats = async (command, repository) => {
        requirePorts(repository, ['refreshDraftBatchStats']);
        const batchId = requireId(command?.batchId, 'DRAFT_BATCH_ID_REQUIRED');
        if (typeof command.calculateStats !== 'function') {
            throw createError('DRAFT_PERSISTENCE_INPUT_INVALID');
        }
        assertActive(command.signal);
        try {
            return await withRepositoryLock(repository, () => repository.refreshDraftBatchStats(batchId, {
                signal: command.signal,
                buildUpdate: loaded => {
                    const counts = command.calculateStats(loaded);
                    const version = currentVersion(loaded.batch);
                    return {
                        counts,
                        batchPatch: {
                            ...counts,
                            updatedAt: command.updatedAt,
                            draftPersistence: {
                                ...loaded.batch.draftPersistence,
                                version: version + 1,
                                idempotencyKey: \`maintenance:stats:\${batchId}:\${version}\`,
                                signature: JSON.stringify(counts)
                            }
                        }
                    };
                }
            }));
        } catch (error) {
            rethrowOrWrap(error, 'DRAFT_PERSISTENCE_WRITE_FAILED');
        }
    };

    const validateAssociatedRows = (rows, batchId) => {`);
        return replace(text, '        reloadDraftReview,', '        reloadDraftReview,\n        refreshDraftBatchStats,');
    });
    edit('qisi-draft-maintenance-service.js', text => {
        text = replace(text, "            'persistReviewDraftBatch',", "            'persistReviewDraftBatch',\n            'refreshDraftBatchStats',");
        const start = text.indexOf('        const refreshBatchStats = async'), end = text.indexOf('        const dedupeBatchDrafts = async', start);
        if (start < 0 || end < 0) throw new Error('Stats anchors');
        return text.slice(0, start) + `        const refreshBatchStats = async ({ batchId, signal } = {}) => {
            const id = String(batchId || '').trim();
            if (!id) throw error('DRAFT_MAINTENANCE_INPUT_INVALID');
            assertActive(signal);
            const result = await persistence.refreshDraftBatchStats({
                batchId: id, calculateStats: countsFor, updatedAt: clock(), signal
            });
            assertActive(signal);
            for (const [key, value] of Object.entries(result.counts)) {
                if (result.readback.batch?.[key] !== value) {
                    throw error('DRAFT_MAINTENANCE_READBACK_MISMATCH', {
                        batchId: id, field: key
                    });
                }
            }
            return result;
        };

` + text.slice(end);
    });
    edit('app.js', text => replace(text, '                    deleteDraftBatch: (batchId, options) =>', `                    refreshDraftBatchStats: command =>
                        Qisi.DraftPersistenceService.refreshDraftBatchStats(
                            command, storageRepository
                        ),
                    deleteDraftBatch: (batchId, options) =>`));
    edit('main.html', text => {
        for (const name of ['qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-draft-maintenance-service.js', 'app.js']) {
            const pattern = new RegExp('(' + name.replaceAll('.', '\\.') + '\\?v=)[^" ]+');
            if (!pattern.test(text)) throw new Error('Cache anchor ' + name);
            text = text.replace(pattern, '$1atomic-batch-stats-01');
        }
        return text;
    });
    edit('docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json', text => text.replace(/"range": \[(\d+), (\d+)\]/g, (_match, start, end) => '"range": [' + (+start + 4) + ', ' + (+end + 4) + ']'));
    edit('tests/draft-maintenance-service.test.js', text => replace(text, '        deleteDraftBatch: async () => {', `        refreshDraftBatchStats: async command => {
            if (writeError) throw writeError;
            const counts = command.calculateStats(clone(state));
            state.batch = {
                ...state.batch,
                ...(ignorePatch ? {} : counts),
                updatedAt: command.updatedAt,
                draftPersistence: { version: state.batch.draftPersistence.version + 1 }
            };
            return { counts, readback: { batch: clone(state.batch) } };
        },
        deleteDraftBatch: async () => {`));
} else throw new Error('Specify tests or implementation');
fs.writeFileSync(path.join(out, process.argv[2] + '-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ phase: process.argv[2], files: manifest.map(item => item.name) }));
