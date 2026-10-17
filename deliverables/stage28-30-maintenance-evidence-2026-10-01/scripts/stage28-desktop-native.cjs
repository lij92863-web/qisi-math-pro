const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = 'C:/Users/Administrator/Desktop/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const { makeDraft } = require(path.join(root, 'tests/fixtures/formal-admission-transaction'));
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext(); await context.route('**/api/ai/**', r => r.abort()); await context.route(/^https:/, r => r.abort());
        const page = await context.newPage(); await page.goto('http://127.0.0.1:3000/main.html'); await page.waitForFunction(() => Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const result = await page.evaluate(async fixture => {
            const name = 'isolated-desktop-indexed-stats-race', database = new Dexie(name);
            database.version(8).stores(Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(t => [t, ['draftQuestions', 'draftImages', 'draftImportFiles'].includes(t) ? 'id,batchId' : 'id']))); Qisi.QuestionIndexStorage.configure(database, { policy: Qisi.QuestionDuplicatePolicy }); await database.open();
            try {
                await database.draftImportBatches.put({ id: 'batch-1', status: 'review', customMetadata: 'keep', submittedCount: 0 });
                await database.draftQuestions.put(fixture); await database.draftImages.put({ id: 'image-1', batchId: 'batch-1', status: 'unassigned', url: 'data:raw-evidence' });
                await database.draftImportFiles.put({ id: 'file-1', batchId: 'batch-1', rawText: 'untouched-evidence' });
                const policy = Qisi.FormalAdmissionPolicy, repository = Qisi.StorageRepository.createRepository(database, { admission: { evaluateDraftAdmission: policy.evaluateDraftAdmission, validateAdmissionDecision: policy.validateAdmissionDecision, buildQuestionV2: policy.buildQuestionV2, validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2 } });
                const before = await Qisi.DraftPersistenceService.reloadDraftBatch('batch-1', repository);
                const admissionContext = policy.createAdmissionContext({ mode: 'pdf-ai', actorId: 'fixture-teacher', explicitConfirmation: true, requestId: 'desktop-race', idempotencyKey: 'desktop-race', evaluatedAt: new Date().toISOString(), source: fixture.source });
                const persistence = {
                    reloadDraftBatch: id => Qisi.DraftPersistenceService.reloadDraftBatch(id, repository),
                    persistReviewDraftBatch: command => Qisi.DraftPersistenceService.persistReviewDraftBatch(command, repository),
                    deleteDraftBatch: () => { throw new Error('unused'); },
                    refreshDraftBatchStats: async command => {
                        await repository.confirmDraftToQuestion(fixture.id, policy.evaluateDraftAdmission(fixture, admissionContext), { expectedDraftVersion: 1, idempotencyKey: 'desktop-race', requestId: 'desktop-race', actorId: 'fixture-teacher', questionId: 'formal-desktop', context: admissionContext });
                        return Qisi.DraftPersistenceService.refreshDraftBatchStats(command, repository);
                    }
                };
                const service = Qisi.DraftMaintenanceService.createDraftMaintenanceService({ persistence, dedupeDrafts: value => value, countOptions: value => value.length, problemsForDraft: () => [], preserveRawEvidence: value => value, cleanDisplayFields: value => value });
                const stats = await service.refreshBatchStats({ batchId: 'batch-1' });
                const staleCodes = [];
                for (const key of ['stale-command', stats.readback.batch.draftPersistence.idempotencyKey]) {
                    try { await persistence.persistReviewDraftBatch({ batchId: 'batch-1', drafts: before.questions, images: before.images, files: before.files, batchPatch: { status: 'review' }, expectedVersion: 0, idempotencyKey: key }); }
                    catch (error) { staleCodes.push(error.code); }
                }
                let missingCode;
                try { await Qisi.DraftPersistenceService.refreshDraftBatchStats({ batchId: 'missing', calculateStats: () => ({}), updatedAt: 1 }, repository); }
                catch (error) { missingCode = error.code; }
                const draft = await database.draftQuestions.get(fixture.id);
                return { stats: stats.counts, batchVersion: stats.readback.batch.draftPersistence.version, customMetadata: stats.readback.batch.customMetadata,
                    draftStatus: draft.status, draftVersion: draft.version, submittedQuestionId: draft.submittedQuestionId, formalCount: await database.questions.count(), formalCore: (await database.questions.get('formal-desktop')).duplicateCoreV2, expectedCore: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(fixture), staleCodes, missingCode,
                    imagesUnchanged: JSON.stringify(before.images) === JSON.stringify(await database.draftImages.toArray()), filesUnchanged: JSON.stringify(before.files) === JSON.stringify(await database.draftImportFiles.toArray()) };
            } finally { database.close(); await Dexie.delete(name); }
        }, makeDraft());
        assert.equal(result.formalCore,result.expectedCore); assert.equal(result.stats.submittedCount, 1); assert.equal(result.stats.reviewedCount, 0); assert.equal(result.stats.status, 'completed');
        assert.equal(result.batchVersion, 2); assert.equal(result.draftStatus, 'submitted'); assert.equal(result.draftVersion, 2); assert.equal(result.submittedQuestionId, 'formal-desktop'); assert.equal(result.formalCount, 1);
        assert.deepEqual(result.staleCodes, ['DRAFT_PERSISTENCE_VERSION_CONFLICT', 'DRAFT_PERSISTENCE_IDEMPOTENCY_CONFLICT']); assert.equal(result.missingCode, 'DRAFT_BATCH_NOT_FOUND');
        assert.equal(result.imagesUnchanged, true); assert.equal(result.filesUnchanged, true); assert.equal(result.customMetadata, 'keep');
        const report = { root, origin: 'http://127.0.0.1:3000', paidCalls: 0, nativeIndexedDB: true, isolatedBrowserContext: true, result };
        fs.writeFileSync(path.join(out, 'desktop-native-index-validation.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
