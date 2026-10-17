const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const desktop = 'C:/Users/Administrator/Desktop/题库系统';
const out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage26-review-reads';
const { chromium } = require(path.join(desktop, 'node_modules/playwright'));
const { makeDraft } = require(path.join(source, 'tests/fixtures/formal-admission-transaction'));
const names = ['qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-review-workflow-service.js'];
const programs = Object.fromEntries(['before', 'after'].map(mode => [mode, names.map(name => fs.readFileSync(path.join(mode === 'before' ? path.join(out, 'source-before') : source, name), 'utf8'))]));
(async () => {
    const browser = await chromium.launch({ headless: true });
    const report = { date: '2026-10-01', paidCalls: 0, nativeIndexedDB: true, scope: 'Production reviewed-batch coordinator, validator, admission, independent formal transactions, image Blob conversion, final stats persistence/readback. Isolated fixture DB; excludes seed setup, UI render and AI.', samples: [] };
    try {
        const context = await browser.newContext();
        await context.route('**/api/ai/**', r => r.abort());
        await context.route(/^https:/, r => r.abort());
        for (let round = 0; round < 3; round++) for (const [n, d] of [[1000, 20], [1000, 400], [10000, 400]]) for (const mode of (round % 2 ? ['after', 'before'] : ['before', 'after'])) {
            const page = await context.newPage();
            await page.goto('http://127.0.0.1:3000/main.html');
            await page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
            for (const content of programs[mode]) await page.addScriptTag({ content });
            const sample = await page.evaluate(async ({ n, d, mode, round, fixture }) => {
                const m = 20, name = `isolated-review-reads-${mode}-${n}-${d}-${round}`, db = new Dexie(name);
                const schema = Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(t => [t, ['draftQuestions', 'draftImportFiles'].includes(t) ? 'id,batchId' : t === 'draftImages' ? 'id,batchId,questionId' : 'id']));
                db.version(1).stores(schema); await db.open();
                let restore = () => {};
                try {
                    const url = 'data:image/png;base64,' + btoa('x'.repeat(4096));
                    await db.questions.bulkPut(Array.from({ length: n }, (_, i) => ({ id: `existing-${i}`, stem: `既有题${i}`, options: ['1', '2', '3', '4'], answer: 'A' })));
                    await db.draftImportBatches.put({ id: 'batch-1', status: 'review', submittedCount: 0 });
                    await db.draftImportFiles.put({ id: 'file-1', batchId: 'batch-1', parseStatus: 'success' });
                    const drafts = Array.from({ length: d }, (_, i) => ({ ...fixture, id: `draft-${i}`, order: i, stem: `新题${i}`, questionNumber: String(i + 1) }));
                    await db.draftQuestions.bulkPut(drafts);
                    await db.draftImages.bulkPut(drafts.map(item => ({ id: `image-${item.id}`, batchId: 'batch-1', questionId: item.id, status: 'bound', url })));
                    const metrics = { formalReads: 0, formalRows: 0, draftIndexedRows: 0, imageIndexedRows: 0, imageUrlChars: 0, batchLoads: 0, reviewLoads: 0 };
                    const tablePrototype = Object.getPrototypeOf(db.questions), originalTableRead = tablePrototype.toArray;
                    const collectionPrototype = Object.getPrototypeOf(db.draftQuestions.where('batchId').equals('batch-1')), originalCollectionRead = collectionPrototype.toArray;
                    tablePrototype.toArray = function (...args) { return originalTableRead.apply(this, args).then(rows => { if (this.name === 'questions') { metrics.formalReads++; metrics.formalRows += rows.length; } return rows; }); };
                    collectionPrototype.toArray = function (...args) { const tableName = this._ctx.table.name; return originalCollectionRead.apply(this, args).then(rows => { if (tableName === 'draftQuestions') metrics.draftIndexedRows += rows.length; if (tableName === 'draftImages') { metrics.imageIndexedRows += rows.length; metrics.imageUrlChars += rows.reduce((sum, row) => sum + (row.url?.length || 0), 0); } return rows; }); };
                    restore = () => { tablePrototype.toArray = originalTableRead; collectionPrototype.toArray = originalCollectionRead; };
                    const policy = Qisi.FormalAdmissionPolicy;
                    const repository = Qisi.StorageRepository.createRepository(db, { admission: { evaluateDraftAdmission: policy.evaluateDraftAdmission, validateAdmissionDecision: policy.validateAdmissionDecision, buildQuestionV2: policy.buildQuestionV2, validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2 } });
                    const persistence = Object.fromEntries(['persistReviewDraftCommand', 'persistReviewDraftBatch', 'deleteDraftBatch'].map(method => [method, (...args) => Qisi.DraftPersistenceService[method](...args, repository)]));
                    persistence.reloadDraftBatch = (...args) => { metrics.batchLoads++; return Qisi.DraftPersistenceService.reloadDraftBatch(...args, repository); };
                    persistence.reloadDraftReview = (...args) => { metrics.reviewLoads++; return Qisi.DraftPersistenceService.reloadDraftReview(...args, repository); };
                    const validator = Qisi.ProductionReviewValidator.createProductionReviewValidator({ policy });
                    const maintenance = Qisi.DraftMaintenanceService.createDraftMaintenanceService({ persistence, dedupeDrafts: value => value, countOptions: options => options?.length || 0, problemsForDraft: draft => validator.validate(draft).errors, preserveRawEvidence: value => value, cleanDisplayFields: value => value });
                    const formalSubmit = Qisi.BatchFormalSubmit.createBatchFormalSubmit({ policy, repository, createStateMachine: Qisi.ImportStateMachine.createImportStateMachine });
                    const workflow = Qisi.ReviewWorkflowService.createReviewWorkflowService({ persistence, reviewController: Qisi.ReviewController.createReviewController({ validateDraft: draft => validator.validate(draft), formalFields: policy.FORMAL_FIELDS }), validateDraft: draft => validator.validate(draft), normalizeDraft: value => value, formalSubmit, refreshBatchStats: command => maintenance.refreshBatchStats(command), mergeImages: (left, right) => [...left, ...right], dataUrlToBlob: async value => (await fetch(value)).blob() });
                    const start = performance.now();
                    const result = await workflow.submitReviewedBatch({ batchId: 'batch-1', draftIds: drafts.slice(0, m).map(item => item.id), requestId: 'isolated-batch' });
                    const elapsedMs = performance.now() - start;
                    if (result.okCount !== m || result.failedCount) throw new Error(JSON.stringify(result.results.map(item => ({ draftId: item.draftId, code: item.code, accepted: item.accepted, errors: item.validation?.errors }))));
                    restore();
                    const count = await db.questions.count(), images = await db.images.toArray(), batch = await db.draftImportBatches.get('batch-1');
                    const statuses = await db.draftQuestions.toArray();
                    if (statuses.filter(item => item.status === 'submitted').length !== m || statuses.some(item => item.version !== (Number(item.order) < m ? 2 : 1))) throw new Error('Draft status/version mismatch');
                    return { mode, n, d, m, round, elapsedMs, ...metrics, count, formalImageCount: images.length, formalImageBytes: images.reduce((sum, image) => sum + image.blob.size, 0), submittedCount: batch.submittedCount };
                } finally { restore(); db.close(); await Dexie.delete(name); }
            }, { n, d, mode, round, fixture: makeDraft() });
            assert.equal(sample.count, n + 20); assert.equal(sample.formalReads, 20); assert.equal(sample.formalRows, 20 * n + 190); assert.equal(sample.formalImageCount, 20); assert.equal(sample.formalImageBytes, 81920); assert.equal(sample.submittedCount, 20);
            assert.equal(sample.batchLoads, mode === 'before' ? 43 : 3); assert.equal(sample.reviewLoads, mode === 'before' ? 0 : 40);
            assert.equal(sample.imageIndexedRows, mode === 'before' ? 43 * d : 3 * d + 40);
            report.samples.push(sample); console.log(JSON.stringify(sample)); await page.close();
        }
        fs.writeFileSync(path.join(out, 'native-workflow-metrics.json'), JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
