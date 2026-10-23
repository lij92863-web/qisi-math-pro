const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('retired DOCX vision keeps historical drafts readable, rejects reruns and preserves the actual screenshot input', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32858);
    try {
        await h.page.addInitScript(() => {
            window.auditManualOcrCalls = [];
            window.auditStrictFactoryCalls = 0; window.auditStrictExecutions = 0;
            window.Qisi = window.Qisi || {};
            Object.defineProperty(window.Qisi, 'QwenVisionSourcePort', { configurable: true,
                set(owner) { Object.defineProperty(window.Qisi, 'QwenVisionSourcePort', { configurable: true,
                    value: Object.freeze({ ...owner,
                    createStrictQuestionPageRecognizer(...args) {
                        ++window.auditStrictFactoryCalls;
                        const recognize = owner.createStrictQuestionPageRecognizer(...args);
                        return (...inputs) => { ++window.auditStrictExecutions; return recognize(...inputs); };
                    }, createProductionOcrRuntime(ports) {
                        const runtime = owner.createProductionOcrRuntime(ports);
                        return Object.freeze({ ...runtime, documentOcrSource: Object.freeze({ ...runtime.documentOcrSource,
                            async recognizeManualQuestion(url) {
                                window.auditManualOcrCalls.push({ image: /^data:image\//.test(url) });
                                return 'I1 screenshot fixture text';
                            }
                        }) });
                    } }) }); }
            });
        });
        await h.page.reload();
        await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const batchId = await H.seedReviewBatch(h.page, { batchId: 'i1_historical_vision' });
        await h.page.evaluate(async batchId => {
            const db = new Dexie('QisiMathVueDB'); await db.open();
            try {
                await db.table('draftImportBatches').update(batchId, { producerMode: 'docx-vision', sourceType: 'docx' });
                await db.table('draftImportFiles').where('batchId').equals(batchId).delete();
                await db.table('draftImportFiles').put({ id: batchId + '_docx', batchId, filename: 'historical.docx',
                    fileType: 'docx', role: 'question', roles: ['question'], producerMode: 'docx-vision',
                    uploadPath: 'data:application/octet-stream;base64,UEs=', size: 2, status: 'ready', createdAt: 1 });
                await db.table('draftQuestions').where('batchId').equals(batchId).modify(q => {
                    q.source.mode = 'docx-vision'; q.sourceMode = 'docx-vision'; q.rawText = 'HISTORICAL_RAW';
                });
            } finally { db.close(); }
        }, batchId);
        const before = await H.getDbSnapshot(h.page);
        await H.callProxy(h.page, 'openBatchReview', batchId);
        const history = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { batchId: p.activeBatchId, source: p.activeDraftQuestion.source, sourceMode: p.activeDraftQuestion.sourceMode,
                text: p.activeDraftEditorBuffer, rawText: p.activeDraftQuestion.rawText };
        });
        assert.equal(history.sourceMode, 'docx-vision'); assert.equal(history.rawText, 'HISTORICAL_RAW');
        let rerun;
        try { await H.callProxy(h.page, 'runBatchRecognition', batchId); rerun = { unexpectedSuccess: true }; }
        catch (error) { rerun = { rejected: true, message: String(error.message) }; }
        assert.equal(rerun.rejected, true);
        assert.match(rerun.message, /PRODUCTION_IMPORT_PRODUCER_RETIRED/);
        const after = await H.getDbSnapshot(h.page);
        assert.deepEqual(after.drafts, before.drafts, 'rerun preserves historical question bytes');
        assert.equal(after.batches.find(row => row.id === batchId).producerMode, 'docx-vision');
        const runtime = await h.page.evaluate(() => ({
            visionLoader: [...document.scripts].some(script => /qisi-production-docx-vision-source-port|qisi-docx-vision-reconciler/.test(script.src)),
            visionGlobal: Boolean(window.Qisi.ProductionDocxVisionSourcePort),
            screenshotRuntime: typeof window.Qisi.QwenVisionSourcePort.createProductionOcrRuntime,
            bridgeFactory: typeof window.Qisi.ProductionImportBridge.createProductionImportBridge
            , strictFactoryCalls: window.auditStrictFactoryCalls, strictExecutions: window.auditStrictExecutions
        }));
        assert.equal(runtime.visionLoader, false); assert.equal(runtime.visionGlobal, false);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'entry'; });
        await h.page.locator('.entry-side-panel input[type=file]').setInputFiles({ name: 'i1-screenshot.png', mimeType: 'image/png',
            buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
        await h.page.waitForFunction(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').ocrDraftStore.rawText.includes('I1 screenshot'));
        const screenshot = await h.page.evaluate(() => ({ calls: window.auditManualOcrCalls,
            text: window.Qisi.Runtime.getRuntimeDependency('AppProxy').ocrDraftStore.rawText }));
        assert.deepEqual(screenshot.calls, [{ image: true }]);
        H.assertNoRuntimeErrors(h);
        assert.equal(runtime.strictFactoryCalls, 0, 'retired strict instance must not be constructed');
        assert.equal(runtime.strictExecutions, 0, 'screenshot recognition does not depend on retired strict execution');
        assert.equal(after.questions.length, 0);
    } finally { await h.close(); }
});
