const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const desktop = 'C:/Users/Administrator/Desktop/题库系统';
const out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const { chromium } = require(path.join(desktop, 'node_modules/playwright'));
const { makeDraft } = require(path.join(source, 'tests/fixtures/formal-admission-transaction'));
const names = ['qisi-question-duplicate-policy.js', 'qisi-question-index-storage.js', 'qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-draft-maintenance-service.js'];
const programs = Object.fromEntries(['before', 'after'].map(mode => [mode, names.map(name => fs.readFileSync(path.join(mode === 'before' && fs.existsSync(path.join(out, 'source-before', name)) ? path.join(out, 'source-before') : source, name), 'utf8'))]));
(async () => {
    const browser = await chromium.launch({ headless: true });
    const report = { date: '2026-10-01', paidCalls: 0, nativeIndexedDB: true, scope: 'Stages28-30 native complete reviewed-batch workflow: stage27 v8 transaction-local scan versus v9 maintained tuple indexes and compound submitted count. Isolated fixture DB; seed setup, UI render and AI excluded.', samples: [] };
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
                const m = 20, name = `isolated-stage28-maintenance-${mode}-${n}-${d}-${round}`, db = new Dexie(name);
                const schema = Object.fromEntries(Qisi.StorageRepository.BACKUP_TABLES.map(t => [t, ['draftQuestions', 'draftImportFiles'].includes(t) ? 'id,batchId' : t === 'draftImages' ? 'id,batchId,questionId' : 'id']));
                db.version(8).stores(schema); if (mode === 'after') Qisi.QuestionIndexStorage.configure(db, { policy: Qisi.QuestionDuplicatePolicy }); await db.open();
                let restore = () => {};
                try {
                    const url = 'data:image/png;base64,' + btoa('x'.repeat(4096));
                    await db.questions.bulkPut(Array.from({ length: n }, (_, i) => ({ id: `existing-${i}`, stem: `既有题${i}`, options: ['1', '2', '3', '4'], answer: 'A' })));
                    await db.draftImportBatches.put({ id: 'batch-1', status: 'review', submittedCount: 0 });
                    await db.draftImportFiles.put({ id: 'file-1', batchId: 'batch-1', parseStatus: 'success' });
                    const drafts = Array.from({ length: d }, (_, i) => ({ ...fixture, id: `draft-${i}`, order: i, stem: `新题${i}`, questionNumber: String(i + 1) }));
                    await db.draftQuestions.bulkPut(drafts);
                    await db.draftImages.bulkPut(drafts.map(item => ({ id: `image-${item.id}`, batchId: 'batch-1', questionId: item.id, status: 'bound', url })));
                    const metrics = { formalReads: 0, formalRows: 0, indexedQuestionReads: 0, indexedQuestionRows: 0, submittedCountQueries: 0, draftIndexedRows: 0, imageIndexedRows: 0, imageUrlChars: 0, batchLoads: 0, reviewLoads: 0, draftBulkWriteRows: 0, imageBulkWriteRows: 0, fileBulkWriteRows: 0, deletedDraftRows: 0, deletedImageRows: 0 };
                    const tablePrototype = Object.getPrototypeOf(db.questions), originalTableRead = tablePrototype.toArray, originalBulkPut = tablePrototype.bulkPut;
                    const collectionPrototype = Object.getPrototypeOf(db.draftQuestions.where('batchId').equals('batch-1')), originalCollectionRead = collectionPrototype.toArray, originalDelete = collectionPrototype.delete, originalCount = collectionPrototype.count;
                    tablePrototype.toArray = function (...args) { return originalTableRead.apply(this, args).then(rows => { if (this.name === 'questions') { metrics.formalReads++; metrics.formalRows += rows.length; } return rows; }); };
                    collectionPrototype.toArray = function (callback) { const tableName = this._ctx.table.name; return originalCollectionRead.call(this).then(rows => { if (tableName === 'questions' && this._ctx.index) { metrics.indexedQuestionReads++; metrics.indexedQuestionRows += rows.length; } if (tableName === 'draftQuestions') metrics.draftIndexedRows += rows.length; if (tableName === 'draftImages') { metrics.imageIndexedRows += rows.length; metrics.imageUrlChars += rows.reduce((sum, row) => sum + (row.url?.length || 0), 0); } return typeof callback === 'function' ? callback(rows) : rows; }); };
                    collectionPrototype.count = function (...args) { if (this._ctx.table.name === 'draftQuestions' && this._ctx.index === '[batchId+status]') metrics.submittedCountQueries++; return originalCount.apply(this, args); };
                    tablePrototype.bulkPut = function (rows, ...args) { const key = { draftQuestions: 'draftBulkWriteRows', draftImages: 'imageBulkWriteRows', draftImportFiles: 'fileBulkWriteRows' }[this.name]; if (key) metrics[key] += rows.length; return originalBulkPut.call(this, rows, ...args); };
                    collectionPrototype.delete = function (...args) { const name = this._ctx.table.name; return originalDelete.apply(this, args).then(count => { if (name === 'draftQuestions') metrics.deletedDraftRows += count; if (name === 'draftImages') metrics.deletedImageRows += count; return count; }); };
                    restore = () => { tablePrototype.toArray = originalTableRead; tablePrototype.bulkPut = originalBulkPut; collectionPrototype.toArray = originalCollectionRead; collectionPrototype.delete = originalDelete; collectionPrototype.count = originalCount; };
                    const policy = Qisi.FormalAdmissionPolicy;
                    const repositoryBase = Qisi.StorageRepository.createRepository(db, { admission: { evaluateDraftAdmission: policy.evaluateDraftAdmission, validateAdmissionDecision: policy.validateAdmissionDecision, buildQuestionV2: policy.buildQuestionV2, validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2 } });
                    const repositoryErrors = [];
                    const repository = { ...repositoryBase, confirmDraftToQuestion: async (...args) => { try { return await repositoryBase.confirmDraftToQuestion(...args); } catch (e) { repositoryErrors.push({ code: e.code, message: e.message, details: e.details }); throw e; } } };
                    const persistence = Object.fromEntries(['persistReviewDraftCommand', 'persistReviewDraftBatch', 'deleteDraftBatch', 'refreshDraftBatchStats'].map(method => [method, (...args) => Qisi.DraftPersistenceService[method](...args, repository)]));
                    persistence.reloadDraftBatch = (...args) => { metrics.batchLoads++; return Qisi.DraftPersistenceService.reloadDraftBatch(...args, repository); };
                    persistence.reloadDraftReview = (...args) => { metrics.reviewLoads++; return Qisi.DraftPersistenceService.reloadDraftReview(...args, repository); };
                    const validator = Qisi.ProductionReviewValidator.createProductionReviewValidator({ policy });
                    const maintenance = Qisi.DraftMaintenanceService.createDraftMaintenanceService({ persistence, dedupeDrafts: value => value, countOptions: options => options?.length || 0, problemsForDraft: draft => validator.validate(draft).errors, preserveRawEvidence: value => value, cleanDisplayFields: value => value });
                    const formalSubmit = Qisi.BatchFormalSubmit.createBatchFormalSubmit({ policy, repository, createStateMachine: Qisi.ImportStateMachine.createImportStateMachine });
                    const workflow = Qisi.ReviewWorkflowService.createReviewWorkflowService({ persistence, reviewController: Qisi.ReviewController.createReviewController({ validateDraft: draft => validator.validate(draft), formalFields: policy.FORMAL_FIELDS }), validateDraft: draft => validator.validate(draft), normalizeDraft: value => value, formalSubmit, refreshBatchStats: command => maintenance.refreshBatchStats(command), mergeImages: (left, right) => [...left, ...right], dataUrlToBlob: async value => (await fetch(value)).blob() });
                    const start = performance.now();
                    const result = await workflow.submitReviewedBatch({ batchId: 'batch-1', draftIds: drafts.slice(0, m).map(item => item.id), requestId: 'isolated-batch' });
                    const elapsedMs = performance.now() - start;
                    if (result.okCount !== m || result.failedCount) throw new Error(JSON.stringify({repositoryErrors, failed: result.results.map(item => ({ draftId: item.draftId, code: item.code, accepted: item.accepted, errors: item.validation?.errors, full: item })) }));
                    restore();
                    const count = await db.questions.count(), images = await db.images.toArray(), batch = await db.draftImportBatches.get('batch-1');
                    const statuses = await db.draftQuestions.toArray();
                    if (statuses.filter(item => item.status === 'submitted').length !== m || statuses.some(item => item.version !== (Number(item.order) < m ? 2 : 1))) throw new Error('Draft status/version mismatch');
                    return { mode, n, d, m, round, elapsedMs, ...metrics, count, formalImageCount: images.length, formalImageBytes: images.reduce((sum, image) => sum + image.blob.size, 0), submittedCount: batch.submittedCount };
                } finally { restore(); db.close(); await Dexie.delete(name); }
            }, { n, d, mode, round, fixture: makeDraft() });
            assert.equal(sample.count, n + 20); assert.equal(sample.formalReads, mode === 'before' ? 20 : 0); assert.equal(sample.formalRows, mode === 'before' ? 20 * n + 190 : 0); assert.equal(sample.indexedQuestionReads, mode === 'after' ? 80 : 0); assert.equal(sample.submittedCountQueries, mode === 'after' ? 20 : 0); assert.equal(sample.formalImageCount, 20); assert.equal(sample.formalImageBytes, 81920); assert.equal(sample.submittedCount, 20);
            assert.equal(sample.batchLoads, 1); assert.equal(sample.reviewLoads, 40);
            assert.equal(sample.imageIndexedRows, 2 * d + 40);
            assert.equal(sample.draftIndexedRows, mode === 'before' ? 22 * d : 2 * d);
            assert.equal(sample.draftBulkWriteRows, 0); assert.equal(sample.imageBulkWriteRows, 0); assert.equal(sample.fileBulkWriteRows, 0);
            assert.equal(sample.deletedDraftRows, 0); assert.equal(sample.deletedImageRows, 0);
            report.samples.push(sample); console.log(JSON.stringify(sample)); await page.close();
        }
        fs.writeFileSync(path.join(out, 'native-workflow-metrics.json'), JSON.stringify(report, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
