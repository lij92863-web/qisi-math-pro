const test = require('node:test');
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
            const afterWriteAbort = new AbortController();
            const tablePrototype = Object.getPrototypeOf(fixtureDb.draftImportBatches);
            const originalUpdate = tablePrototype.update;
            tablePrototype.update = function (...args) {
                const name = this.name;
                return originalUpdate.apply(this, args).then(result => {
                    if (name === 'draftImportBatches') afterWriteAbort.abort();
                    return result;
                });
            };
            try {
                await makeMaintenance(() => []).refreshBatchStats({ batchId: 'batch-1', signal: afterWriteAbort.signal });
            } catch (error) { failures.push(error.code); }
            finally { tablePrototype.update = originalUpdate; }
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
    assert.deepEqual(result.failures, ['DRAFT_PERSISTENCE_WRITE_FAILED', 'DRAFT_PERSISTENCE_CANCELLED', 'DRAFT_PERSISTENCE_CANCELLED']);
    assert.equal(result.staleCode, 'DRAFT_PERSISTENCE_VERSION_CONFLICT');
    assert.equal(result.version, 1); assert.equal(result.key, 'maintenance:stats:batch-1:0');
    assert.deepEqual(result.afterStale.questions, result.before.questions);
    assert.deepEqual(result.afterStale.images, result.before.images);
    assert.deepEqual(result.afterStale.files, result.before.files);
});
