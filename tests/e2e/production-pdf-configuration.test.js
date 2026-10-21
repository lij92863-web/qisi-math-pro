const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startBrowserApp, createImportThroughUi, getDbSnapshot, assertNoRuntimeErrors } = require('./browser-harness.js');

test('unconfigured production PDF UI reports its cause without enabling a mock provider', { timeout: 60000 }, async () => {
    const h = await startBrowserApp(32191);
    try {
        // Only the local capability I/O is mocked; use the shipped UI factory.
        await h.page.route('**/api/mineru/status', route => route.fulfill({ json: { configured: false } }));
        const defaultPdfConfig = await h.page.evaluate(() => ({
            enabled: window.Qisi.Config.pdfExternal.enabled,
            mode: window.Qisi.Config.pdfExternal.mode
        }));
        assert.deepEqual(defaultPdfConfig, {
            enabled: false,
            mode: 'parse-organize-text'
        });
        const imported = await createImportThroughUi(h.page, {
            files: [{ file: path.resolve(__dirname, '../fixtures/true-import/pdf-question.pdf'), roles: ['full'] }]
        });
        const batch = imported.snapshot.batches.find(row => row.id === imported.batchId);
        assert.equal(batch.status, 'failed');
        assert.match(batch.errorMessage, /MINERU_NOT_CONFIGURED/);
        assert.match(batch.errorMessage, /未配置/);
        assert.equal(imported.snapshot.drafts.length, 0);
        assert.equal(imported.snapshot.questions.length, 0);
        assert.deepEqual(await h.page.evaluate(() => ({
            enabled: window.Qisi.Config.pdfExternal.enabled,
            mode: window.Qisi.Config.pdfExternal.mode
        })), defaultPdfConfig);
        assert.deepEqual(h.forbiddenRequests, []);
        await h.page.reload();
        const saved = (await getDbSnapshot(h.page)).batches.find(row => row.id === batch.id);
        assert.equal(saved.errorMessage, batch.errorMessage);
        await h.page.getByRole('button', { name: '批量录题', exact: true }).click();
        await h.page.getByText(batch.errorMessage, { exact: true }).waitFor();
        const expectedFailure = '[QISI_LOG] {stage: normal-ui-import-controller, code: IMPORT_RECOGNITION_FAILED}';
        assert.deepEqual(h.consoleErrors, [expectedFailure]);
        assertNoRuntimeErrors({ ...h, consoleErrors: h.consoleErrors.filter(message => message !== expectedFailure) });
    } finally { await h.close(); }
});
