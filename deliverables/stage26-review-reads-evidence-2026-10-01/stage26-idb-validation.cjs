const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统';
const desktop = 'C:/Users/Administrator/Desktop/题库系统';
const out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage26-review-reads';
const { chromium } = require(path.join(desktop, 'node_modules/playwright'));
(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        await context.route('**/api/ai/**', r => r.abort()); await context.route(/^https:/, r => r.abort());
        const page = await context.newPage(); await page.goto('http://127.0.0.1:3000/main.html');
        await page.waitForFunction(() => Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        if (!process.argv.includes('--desktop')) for (const name of ['qisi-storage-repository.js', 'qisi-draft-persistence-service.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(source, name), 'utf8') });
        const result = await page.evaluate(async () => {
            const name = 'isolated-stage26-coherent-view', db = new Dexie(name);
            db.version(1).stores({ draftImportBatches: 'id', draftQuestions: 'id,batchId', draftImages: 'id,batchId,questionId' }); await db.open();
            try {
                await db.draftImportBatches.put({ id: 'b1', marker: 1 });
                await db.draftQuestions.put({ id: 'd1', batchId: 'b1', version: 1 });
                await db.draftImages.put({ id: 'i1', batchId: 'b1', questionId: 'd1', marker: 1 });
                const repository = Qisi.StorageRepository.createRepository(db);
                const tablePrototype = Object.getPrototypeOf(db.draftImportBatches), originalGet = tablePrototype.get;
                let pendingWriter, triggered = false;
                tablePrototype.get = function (...args) {
                    const tableName = this.name;
                    return originalGet.apply(this, args).then(row => {
                        if (tableName === 'draftImportBatches' && !triggered) {
                            triggered = true;
                            pendingWriter = Dexie.ignoreTransaction(() => db.transaction('rw', db.draftImportBatches, db.draftQuestions, db.draftImages, async () => {
                                await db.draftImportBatches.update('b1', { marker: 2 });
                                await db.draftQuestions.update('d1', { version: 2 });
                                await db.draftImages.update('i1', { marker: 2 });
                            }));
                        }
                        return row;
                    });
                };
                const first = await Qisi.DraftPersistenceService.reloadDraftReview('b1', 'd1', repository);
                await pendingWriter;
                const second = await Qisi.DraftPersistenceService.reloadDraftReview('b1', 'd1', repository);
                tablePrototype.get = originalGet;
                await db.draftImages.update('i1', { batchId: 'other' });
                let associationCode;
                try { await Qisi.DraftPersistenceService.reloadDraftReview('b1', 'd1', repository); } catch (error) { associationCode = error.code; }
                await db.draftImages.update('i1', { batchId: 'b1' }); await db.draftQuestions.delete('d1');
                const missing = await Qisi.DraftPersistenceService.reloadDraftReview('b1', 'd1', repository);
                return { first: [first.batch.marker, first.draft.version, first.images[0].marker], second: [second.batch.marker, second.draft.version, second.images[0].marker], associationCode, missingDraft: missing.draft === undefined, imageEvidencePreserved: missing.images.length === 1 };
            } finally { db.close(); await Dexie.delete(name); }
        });
        assert.deepEqual(result.first, [1, 1, 1]); assert.deepEqual(result.second, [2, 2, 2]);
        assert.equal(result.associationCode, 'DRAFT_PERSISTENCE_ASSOCIATION_INVALID'); assert.equal(result.missingDraft, true); assert.equal(result.imageEvidencePreserved, true);
        const report = { nativeIndexedDB: true, isolatedContext: true, target: process.argv.includes('--desktop') ? desktop : source, paidCalls: 0, result };
        fs.writeFileSync(path.join(out, process.argv.includes('--desktop') ? 'desktop-idb-validation.json' : 'source-idb-validation.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
