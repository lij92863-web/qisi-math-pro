const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, clearE2eData, assertNoRuntimeErrors } = require('./browser-harness');

test('legacy ZIP preview commits plain records and recomputes colliding fingerprints', { timeout: 90000 }, async () => {
    const harness = await startBrowserApp(32228);
    const { page } = harness;
    page.on('dialog', dialog => dialog.accept());
    try {
        const result = await page.evaluate(async () => {
            const app = Qisi.Runtime.getRuntimeDependency('AppProxy');
            const raw = [
                { id: 'legacy-a', type: '填空题', stem: 'a__b', options: [], answer: '1', images: [], rawText: 'raw-a', exportFingerprint: 'a__b__' },
                { id: 'legacy-b', type: '填空题', stem: 'a', options: ['b__'], answer: '2', images: [], rawText: 'raw-b', exportFingerprint: 'a__b__' }
            ];
            const zip = new JSZip();
            zip.file('manifest.json', JSON.stringify({ schemaVersion: '1.0', packageType: 'qisi-question-bank', createdBy: { name: 'fixture-legacy' } }));
            zip.file('questions.json', JSON.stringify(raw));
            const file = new File([await zip.generateAsync({ type: 'blob' })], 'legacy-fixture.zip', { type: 'application/zip' });
            await app.handleImportBankFileChange({ target: { files: [file], value: '' } });
            const previewCount = app.pendingImportPreview?.rawQuestions.length;
            await app.confirmImportBankPreview();
            const imported = await db.externalQuestions.toArray();
            const plan = await Qisi.ExportService.createExportService({ coreFingerprint: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint,
                stemFingerprint: Qisi.QuestionDuplicatePolicy.canonicalStemFingerprint }).build(raw);
            return { previewCount, importCount: imported.length, keys: imported.map(q => q.sourceFingerprint),
                legacyRemoved: imported.every(q => q.exportFingerprint === undefined), raw: imported.map(q => q.rawText),
                formalCount: await db.questions.count(), exportKeys: plan.questions.map(q => q.exportFingerprint), schema: plan.manifest.schemaVersion };
        });
        assert.equal(result.previewCount, 2); assert.equal(result.importCount, 2);
        assert.notEqual(result.keys[0], result.keys[1]); assert.deepEqual(result.keys, result.exportKeys);
        assert.equal(result.legacyRemoved, true); assert.deepEqual(result.raw, ['raw-a', 'raw-b']);
        assert.equal(result.formalCount, 0); assert.equal(result.schema, '1.0');
        assertNoRuntimeErrors(harness);
        await clearE2eData(page);
    } finally { await harness.close(); }
});
