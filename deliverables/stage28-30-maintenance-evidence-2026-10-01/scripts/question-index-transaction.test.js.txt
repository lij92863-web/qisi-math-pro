const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
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
        for (const file of ['vendor/dexie/dexie.min.js', 'qisi-docx-producer-identity-contract.js',
            'qisi-recognition-contracts.js', 'qisi-formal-admission-policy.js', 'qisi-question-duplicate-policy.js',
            'qisi-question-index-storage.js', 'qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-draft-maintenance-service.js']) {
            const baseline = process.env.QISI_STAGE28_BASELINE && path.join(process.env.QISI_STAGE28_BASELINE, file);
            await page.addScriptTag({ path: baseline && fs.existsSync(baseline) ? baseline : path.resolve(__dirname, '..', file) });
        }
        await page.evaluate(fixture => {
            window.fixture = fixture;
            window.schema = Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(name => [name,
                ['draftQuestions', 'draftImportFiles'].includes(name) ? 'id,batchId' : name === 'draftImages' ? 'id,batchId,questionId' : 'id']));
            window.openFixture = async (indexed = true) => {
                const db = new Dexie('isolated-index-maintenance'); db.version(8).stores(schema);
                if (indexed) Qisi.QuestionIndexStorage.configure(db, { policy: Qisi.QuestionDuplicatePolicy });
                await db.open(); return db;
            };
            window.seedDrafts = async (db, drafts = [fixture]) => {
                await db.draftImportBatches.put({ id: 'batch-1', status: 'review', draftPersistence: { version: 0, idempotencyKey: 'initial', signature: 'initial' } });
                await db.draftQuestions.bulkPut(drafts);
                await db.draftImages.put({ id: 'image-1', batchId: 'batch-1', questionId: fixture.id, rawEvidence: 'image-raw' });
                await db.draftImportFiles.put({ id: 'file-1', batchId: 'batch-1', rawText: 'file-raw' });
            };
            const policy = Qisi.FormalAdmissionPolicy;
            window.makeRepo = db => Qisi.StorageRepository.createRepository(db, { admission: {
                evaluateDraftAdmission: policy.evaluateDraftAdmission, validateAdmissionDecision: policy.validateAdmissionDecision,
                buildQuestionV2: policy.buildQuestionV2, validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2
            } });
            window.formalCommit = (repo, draft = fixture, key = draft.id) => {
                const context = policy.createAdmissionContext({ mode: 'pdf-ai', actorId: 'fixture-teacher', explicitConfirmation: true,
                    requestId: key, idempotencyKey: key, evaluatedAt: new Date().toISOString(), source: draft.source });
                return repo.confirmDraftToQuestion(draft.id, policy.evaluateDraftAdmission(draft, context), {
                    expectedDraftVersion: draft.version, requestId: key, idempotencyKey: key, actorId: 'fixture-teacher', questionId: 'formal-' + draft.id, context
                });
            };
            window.makePersistence = repo => Object.fromEntries(['reloadDraftBatch', 'persistReviewDraftBatch', 'deleteDraftBatch', 'refreshDraftBatchStats']
                .map(method => [method, (...args) => Qisi.DraftPersistenceService[method](...args, repo)]));
        }, makeDraft());
        return await work(page);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
};

test('native v8 upgrade and all question writers maintain content-derived indexes atomically', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        let db = await openFixture(false);
        const original = { id: 'legacy', stem: 'a__b', options: [], answer: 'A', solution: 'keep solution', rawText: 'raw evidence',
            exportFingerprint: 'a__b__', duplicateCoreV2: 'forged', admission: { requestId: 'old-request', idempotencyKey: 'old-key' },
            images: [{ blob: new Blob(['binary']) }] };
        try {
            await db.questions.put(original); db.close(); db = await openFixture();
            const upgraded = await db.questions.get('legacy');
            const fields = ['duplicateCoreV2', 'duplicateStemV2', 'formalRequestId', 'formalIdempotencyKey'];
            const strip = value => Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)));
            const originalContent = strip(original), upgradedContent = strip(upgraded);
            const blobSame = await original.images[0].blob.text() === await upgraded.images[0].blob.text();
            delete originalContent.images; delete upgradedContent.images;
            await db.questions.update('legacy', { 'options.0': 'A|B', 'admission.requestId': 'new-request', duplicateCoreV2: 'attacker' });
            const nested = await db.questions.get('legacy');
            const oldRequestCount = await db.questions.where('formalRequestId').equals('old-request').count();
            await db.questions.update('legacy', { deletedAt: 1 });
            const inactiveCount = await db.questions.where('duplicateCoreV2').equals(nested.duplicateCoreV2).count();
            await db.questions.update('legacy', { deletedAt: undefined });
            const restoredCount = await db.questions.where('duplicateCoreV2').equals(nested.duplicateCoreV2).count();
            await db.questions.bulkPut([{ ...original, stem: 'restored from old backup', duplicateCoreV2: 'stale-cache' }]);
            const fromBackup = await db.questions.get('legacy');
            const before = await db.questions.toArray();
            let rollback;
            try { await db.transaction('rw', db.questions, async () => {
                await db.questions.update('legacy', { stem: 'rollback' });
                await db.questions.put({ id: 'rollback-new', stem: 'rollback new', options: [] });
                throw new Error('forced rollback');
            }); } catch (_) { rollback = true; }
            const after = await db.questions.toArray();
            return { originalContent, upgradedContent, blobSame, version: db.verno,
                upgradedKey: upgraded.duplicateCoreV2, expectedKey: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(original),
                nestedKey: nested.duplicateCoreV2, nestedExpected: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(nested),
                nestedRequest: nested.formalRequestId, oldRequestCount, inactiveCount, restoredCount,
                backupKey: fromBackup.duplicateCoreV2, backupExpected: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(fromBackup),
                rollback, unchanged: JSON.stringify(before) === JSON.stringify(after), rollbackIndexCount: await db.questions.where('duplicateStemV2').equals('rollback').count() };
        } finally { db.close(); await Dexie.delete('isolated-index-maintenance'); }
    }));
    assert.equal(result.version, 9); assert.deepEqual(result.upgradedContent, result.originalContent); assert.equal(result.blobSame, true);
    assert.equal(result.upgradedKey, result.expectedKey); assert.equal(result.nestedKey, result.nestedExpected);
    assert.equal(result.nestedRequest, 'new-request'); assert.equal(result.oldRequestCount, 0);
    assert.equal(result.inactiveCount, 0); assert.equal(result.restoredCount, 1);
    assert.equal(result.backupKey, result.backupExpected); assert.equal(result.rollback, true); assert.equal(result.unchanged, true); assert.equal(result.rollbackIndexCount, 0);
});

test('native indexed formal decisions preserve first exact priority and cross-connection uniqueness', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        const db = await openFixture(), peer = await openFixture();
        try {
            await seedDrafts(db, [fixture, { ...fixture, id: 'draft-peer' }]);
            const repo = makeRepo(db), other = makeRepo(peer);
            const tablePrototype = Object.getPrototypeOf(db.questions), originalArray = tablePrototype.toArray;
            let fullReads = 0;
            tablePrototype.toArray = function (...args) { if (this.name === 'questions') fullReads++; return originalArray.apply(this, args); };
            let race;
            try { race = await Promise.allSettled([formalCommit(repo), formalCommit(other, { ...fixture, id: 'draft-peer' })]); }
            finally { tablePrototype.toArray = originalArray; }
            const committed = await db.draftQuestions.where('status').equals('submitted').first();
            const committedFixture = committed.id === fixture.id ? fixture : { ...fixture, id: 'draft-peer' };
            const batchBeforeReplay = await db.draftImportBatches.get('batch-1');
            const replay = await formalCommit(other, committedFixture);
            const batchAfterReplay = await db.draftImportBatches.get('batch-1');
            await db.questions.clear();
            await db.draftQuestions.update(fixture.id, { ...fixture });
            await db.questions.bulkPut([
                { id: 'a-similar', stem: fixture.stem, options: ['different'], answer: 'A' },
                { id: 'b-deleted', ...fixture, id: 'b-deleted', deletedAt: 1 },
                { ...fixture, id: 'c-exact', answer: 'B' }, { ...fixture, id: 'd-exact', answer: 'A' }
            ]);
            const active = (await db.questions.toArray()).filter(q => !q.deletedAt);
            const reference = Qisi.QuestionDuplicatePolicy.evaluate({ candidate: fixture, existingQuestions: active });
            let indexedDecision;
            try { await formalCommit(repo); } catch (error) { indexedDecision = error.details.duplicateDecision; }
            // Same request used by a different draft is rejected before content admission.
            await db.questions.clear();
            await db.questions.put({ id: 'request-conflict', stem: 'other content', options: [], admission: { requestId: fixture.id, draftId: 'different' } });
            let requestCode;
            try { await formalCommit(repo); } catch (error) { requestCode = error.code; }
            return { race: race.map(r => r.status === 'fulfilled' ? 'accepted' : r.reason.code).sort(), fullReads,
                version: batchBeforeReplay.draftPersistence.version, replay: replay.idempotent,
                replayUnchanged: JSON.stringify(batchBeforeReplay) === JSON.stringify(batchAfterReplay), reference, indexedDecision, requestCode };
        } finally { db.close(); peer.close(); await Dexie.delete('isolated-index-maintenance'); }
    }));
    assert.deepEqual(result.race, ['DUPLICATE_EXACT', 'accepted']); assert.equal(result.fullReads, 0);
    assert.equal(result.version, 1); assert.equal(result.replay, true); assert.equal(result.replayUnchanged, true);
    assert.deepEqual(result.indexedDecision, result.reference); assert.equal(result.requestCode, 'idempotency-conflict');
});

test('native dedupe cleanup and draft-edit snapshots cannot undo a later formal commit', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        const db = await openFixture();
        try {
            const repo = makeRepo(db), codes = [], preserved = [];
            for (const method of ['dedupeBatchDrafts', 'cleanupDisplayFields', 'persistReviewDraftCommand']) {
                await db.questions.clear(); await seedDrafts(db);
                const base = makePersistence(repo);
                const interleavedRepo = { ...repo, persistReviewDraftBatch: async (...args) => {
                    await formalCommit(repo); return repo.persistReviewDraftBatch(...args);
                } };
                const persistence = { ...base, persistReviewDraftBatch: command => Qisi.DraftPersistenceService.persistReviewDraftBatch(command, interleavedRepo) };
                const maintenance = Qisi.DraftMaintenanceService.createDraftMaintenanceService({ persistence,
                    dedupeDrafts: (drafts, { draftImages }) => ({ drafts, draftImages }), countOptions: options => options.length,
                    problemsForDraft: () => [], preserveRawEvidence: q => q, cleanDisplayFields: q => { q.solution += ' cleaned'; } });
                try {
                    if (method === 'persistReviewDraftCommand') {
                        await Qisi.DraftPersistenceService.persistReviewDraftCommand({ batchId: 'batch-1', draft: { ...fixture, solution: 'edited' },
                            expectedDraftVersion: 1 }, interleavedRepo);
                    } else await maintenance[method]({ batchId: 'batch-1' });
                    codes.push('unexpected success');
                } catch (error) { codes.push(error.code); }
                const draft = await db.draftQuestions.get(fixture.id), batch = await db.draftImportBatches.get('batch-1');
                preserved.push({ status: draft.status, version: draft.version, questionId: draft.submittedQuestionId,
                    solution: draft.solution, provenance: draft.fieldProvenance, formal: await db.questions.count(), batchVersion: batch.draftPersistence.version,
                    image: await db.draftImages.get('image-1'), file: await db.draftImportFiles.get('file-1') });
            }
            return { codes, preserved, expectedProvenance: fixture.fieldProvenance };
        } finally { db.close(); await Dexie.delete('isolated-index-maintenance'); }
    }));
    assert.deepEqual(result.codes, Array(3).fill('DRAFT_PERSISTENCE_VERSION_CONFLICT'));
    for (const row of result.preserved) {
        assert.equal(row.status, 'submitted'); assert.equal(row.version, 2); assert.equal(row.questionId, 'formal-draft-1');
        assert.equal(row.solution, 'Solution'); assert.deepEqual(row.provenance, result.expectedProvenance);
        assert.equal(row.formal, 1); assert.equal(row.batchVersion, 1);
        assert.equal(row.image.rawEvidence, 'image-raw'); assert.equal(row.file.rawText, 'file-raw');
    }
});

test('native batch delete checks version inside transaction and cancellation rolls back every table', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        const db = await openFixture();
        try {
            await seedDrafts(db); const repo = makeRepo(db);
            const interleaved = { ...repo, deleteDraftBatch: async (...args) => {
                await formalCommit(repo); return repo.deleteDraftBatch(...args);
            } };
            let stale;
            try { await Qisi.DraftPersistenceService.deleteDraftBatch('batch-1', interleaved, { expectedVersion: 0 }); }
            catch (error) { stale = error.code; }
            const before = await repo.loadDraftBatch('batch-1');
            const signal = new AbortController(), proto = Object.getPrototypeOf(db.draftImportBatches), original = proto.delete;
            proto.delete = function (...args) { const name = this.name; return original.apply(this, args).then(value => {
                if (name === 'draftImportBatches') signal.abort(); return value;
            }); };
            let aborted;
            try { await Qisi.DraftPersistenceService.deleteDraftBatch('batch-1', repo, { expectedVersion: 1, signal: signal.signal }); }
            catch (error) { aborted = error.code; }
            finally { proto.delete = original; }
            const afterAbort = await repo.loadDraftBatch('batch-1');
            await Qisi.DraftPersistenceService.deleteDraftBatch('batch-1', repo, { expectedVersion: 1 });
            return { stale, aborted, before, afterAbort, formal: await db.questions.count(),
                batch: await db.draftImportBatches.count(), drafts: await db.draftQuestions.count(), images: await db.draftImages.count(), files: await db.draftImportFiles.count() };
        } finally { db.close(); await Dexie.delete('isolated-index-maintenance'); }
    }));
    assert.equal(result.stale, 'DRAFT_PERSISTENCE_VERSION_CONFLICT'); assert.equal(result.aborted, 'DRAFT_PERSISTENCE_CANCELLED');
    assert.equal(result.before.questions[0].status, 'submitted'); assert.deepEqual(result.afterAbort, result.before);
    assert.equal(result.formal, 1); assert.deepEqual([result.batch, result.drafts, result.images, result.files], [0, 0, 0, 0]);
});

test('failed native index upgrade keeps the complete v8 database and can retry', { timeout: 30000 }, async () => {
    const result = await runNative(page => page.evaluate(async () => {
        const old = await openFixture(false);
        const original = { id: 'legacy-upgrade', stem: 'legacy', options: ['A'], rawText: 'preserve evidence' };
        await old.questions.put(original); old.close();
        const failed = new Dexie('isolated-index-maintenance'); failed.version(8).stores(schema);
        Qisi.QuestionIndexStorage.configure(failed, { policy: { ...Qisi.QuestionDuplicatePolicy,
            canonicalCoreFingerprint: () => { throw new Error('fixture upgrade failure'); } } });
        let failure;
        try { await failed.open(); } catch (_) { failure = true; } finally { failed.close(); }
        const untouched = await openFixture(false);
        const oldVersion = untouched.verno, oldRecord = await untouched.questions.get(original.id);
        untouched.close(); const upgraded = await openFixture();
        try { return { failure, oldVersion, oldRecord, original, newVersion: upgraded.verno,
            key: (await upgraded.questions.get(original.id)).duplicateCoreV2,
            expectedKey: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(original) }; }
        finally { upgraded.close(); await Dexie.delete('isolated-index-maintenance'); }
    }));
    assert.equal(result.failure, true); assert.equal(result.oldVersion, 8); assert.deepEqual(result.oldRecord, result.original);
    assert.equal(result.newVersion, 9); assert.equal(result.key, result.expectedKey);
});
