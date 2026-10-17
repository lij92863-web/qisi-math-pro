const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const desktop = 'C:/Users/Administrator/Desktop/题库系统', source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage27-stats';
const { chromium } = require(path.join(desktop, 'node_modules/playwright'));
const { makeDraft } = require(path.join(source, 'tests/fixtures/formal-admission-transaction'));
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext(); await context.route('**/api/ai/**', r => r.abort()); await context.route(/^https:/, r => r.abort());
        const page = await context.newPage(); await page.goto('http://127.0.0.1:3000/main.html'); await page.waitForFunction(() => Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const result = await page.evaluate(async fixture => {
            const name = 'isolated-stage27-baseline-race', db = new Dexie(name);
            db.version(1).stores(Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(t => [t, ['draftQuestions', 'draftImages', 'draftImportFiles'].includes(t) ? 'id,batchId' : 'id']))); await db.open();
            try {
                await db.draftImportBatches.put({ id: 'batch-1', status: 'review', submittedCount: 0 }); await db.draftQuestions.put(fixture);
                const policy = Qisi.FormalAdmissionPolicy, repository = Qisi.StorageRepository.createRepository(db, { admission: { evaluateDraftAdmission: policy.evaluateDraftAdmission, validateAdmissionDecision: policy.validateAdmissionDecision, buildQuestionV2: policy.buildQuestionV2, validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2 } });
                const context = policy.createAdmissionContext({ mode: 'pdf-ai', actorId: 'isolated-race', explicitConfirmation: true, requestId: 'race-request', idempotencyKey: 'race-request', evaluatedAt: new Date().toISOString(), source: fixture.source });
                let committed;
                const persistence = {
                    reloadDraftBatch: id => Qisi.DraftPersistenceService.reloadDraftBatch(id, repository),
                    persistReviewDraftBatch: async command => {
                        committed = await repository.confirmDraftToQuestion(fixture.id, policy.evaluateDraftAdmission(fixture, context), { expectedDraftVersion: 1, idempotencyKey: 'race-request', requestId: 'race-request', actorId: 'isolated-race', questionId: 'formal-race', context });
                        return Qisi.DraftPersistenceService.persistReviewDraftBatch(command, repository);
                    },
                    deleteDraftBatch: () => { throw new Error('unused'); }
                };
                const service = Qisi.DraftMaintenanceService.createDraftMaintenanceService({ persistence, dedupeDrafts: value => value, countOptions: value => value.length, problemsForDraft: () => [], preserveRawEvidence: value => value, cleanDisplayFields: value => value });
                await service.refreshBatchStats({ batchId: 'batch-1' });
                const draft = await db.draftQuestions.get(fixture.id), batch = await db.draftImportBatches.get('batch-1');
                return { formalCount: await db.questions.count(), committedQuestionId: committed.question.id, draftStatus: draft.status, draftVersion: draft.version, submittedQuestionId: draft.submittedQuestionId || '', submittedCount: batch.submittedCount };
            } finally { db.close(); await Dexie.delete(name); }
        }, makeDraft());
        assert.equal(result.formalCount, 1); assert.equal(result.draftStatus, 'reviewed'); assert.equal(result.draftVersion, 1); assert.equal(result.submittedQuestionId, ''); assert.equal(result.submittedCount, 0);
        fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'baseline-native-race.json'), JSON.stringify({ paidCalls: 0, isolatedContext: true, nativeIndexedDB: true, scope: 'Statistics loads old draft, real formal transaction commits, old statistics replaces the draft despite formal commit.', result }, null, 2)); console.log(JSON.stringify(result));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
