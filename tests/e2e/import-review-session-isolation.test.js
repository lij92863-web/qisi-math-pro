const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const H = require('./browser-harness');
const fixture = name => path.resolve(__dirname, '../fixtures/true-import', name);

test('a completed DOCX import cannot replace another review visit or its newer unsaved source', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32860);
    try {
        await h.page.addInitScript(() => {
            window.Qisi = window.Qisi || {};
            const gate = new Promise(resolve => { window.auditReleaseImport = resolve; });
            Object.defineProperty(window.Qisi, 'ProductionImportBridge', { configurable: true,
                set(owner) { Object.defineProperty(window.Qisi, 'ProductionImportBridge', { configurable: true,
                    value: Object.freeze({ ...owner, createProductionImportBridge(ports) {
                        const bridge = owner.createProductionImportBridge(ports);
                        return Object.freeze({ ...bridge, async run(...args) {
                            const result = await bridge.run(...args); window.auditImportReady = true;
                            await gate; return result;
                        } });
                    } }) }); }
            });
            Object.defineProperty(window.Qisi, 'NormalUiImportController', { configurable: true,
                set(owner) { Object.defineProperty(window.Qisi, 'NormalUiImportController', { configurable: true,
                    value: Object.freeze({ ...owner, createNormalUiImportController(ports) {
                        const controller = owner.createNormalUiImportController(ports);
                        return Object.freeze({ ...controller, run(...args) {
                            return controller.run(...args).finally(() => { window.auditImportUiDone = true; });
                        } });
                    } }) }); }
            });
        });
        await h.page.reload(); await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const previous = await H.seedReviewBatch(h.page, { batchId: 'import_existing_review' });
        const imported = await H.createImportThroughUi(h.page, { files: [
            { file: fixture('docx-question.docx'), roles: ['question'] },
            { file: fixture('docx-answer.docx'), roles: ['answer'] },
            { file: fixture('docx-solution.docx'), roles: ['solution'] }
        ] });
        await h.page.waitForFunction(() => window.auditImportReady);
        await H.callProxy(h.page, 'openBatchReview', previous);
        await h.page.locator('.batch-latex-source-editor').fill('My newer review source\nA. one\nB. two\nC. three\nD. four');
        await h.page.evaluate(previous => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            p.activeDraftQuestion.year = '2048'; p.selectedDraftIds = [previous + '_q2']; window.auditReleaseImport();
        }, previous);
        await h.page.waitForFunction(() => window.auditImportUiDone);
        const ui = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { batchId: p.activeBatchId, source: p.activeDraftEditorBuffer,
                selected: [...p.selectedDraftIds], year: p.activeDraftQuestion.year, dirty: p.activeDraftEditorDirty, toast: p.batchToast };
        });
        assert.equal(ui.batchId, previous); assert.match(ui.source, /My newer review source/);
        assert.equal(ui.year, '2048'); assert.equal(ui.dirty, true); assert.deepEqual(ui.selected, [previous + '_q2']);
        assert.match(ui.toast, /任务列表打开审核/);
        const snapshot = await H.getDbSnapshot(h.page);
        assert.equal(snapshot.batches.find(row => row.id === imported.batchId).status, 'review');
        const draft = snapshot.drafts.find(row => row.batchId === imported.batchId);
        assert.equal(draft.answer, 'A'); assert.match(draft.solution, /declared stable answer/);
        assert.equal(snapshot.questions.length, 0);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('normal DOCX review initializes its source while the unused document-cache instance is absent', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32861);
    try {
        await h.page.addInitScript(() => {
            window.auditDocumentSourceConstructed = 0;
            window.Qisi = window.Qisi || {};
            Object.defineProperty(window.Qisi, 'BrowserDocumentSource', { configurable: true,
                set(owner) { Object.defineProperty(window.Qisi, 'BrowserDocumentSource', { configurable: true,
                    value: Object.freeze({ ...owner, createBrowserDocumentSource(...args) {
                        ++window.auditDocumentSourceConstructed; return owner.createBrowserDocumentSource(...args);
                    } }) }); }
            });
        });
        await h.page.reload(); await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const imported = await H.createImportThroughUi(h.page, { files: [{ file: fixture('docx-question.docx'), roles: ['full'] }] });
        await h.page.waitForFunction(batchId => window.Qisi.Runtime.getRuntimeDependency('AppProxy').activeBatchId === batchId, imported.batchId);
        const ui = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { source: p.activeDraftEditorBuffer, stem: p.activeDraftQuestion.stem,
                dirty: p.activeDraftEditorDirty, constructed: window.auditDocumentSourceConstructed,
                compatibilityFactory: typeof window.Qisi.BrowserDocumentSource.createBrowserDocumentSource };
        });
        assert.ok(ui.source.includes(ui.stem)); assert.equal(ui.dirty, false);
        assert.equal(ui.constructed, 0); assert.equal(ui.compatibilityFactory, 'function');
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
