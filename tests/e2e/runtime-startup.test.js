const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

test('browser startup loads all local modules before app without a project error', {
    timeout: 60000
}, async () => {
    const harness = await startBrowserApp(32101);
    try {
        const result = await harness.page.evaluate(() => ({
            title: document.title,
            batchEntry: document.body.textContent.includes('批量录题'),
            modules: [
                'Utils',
                'SupportRepair',
                'PdfSupportControlledWrite',
                'DocxPipeline',
                'UiEvents',
                'ReviewDraftState'
            ].filter(name => Boolean(window.Qisi?.[name])),
            appLast: [...document.scripts]
                .filter(script => script.src && script.src.includes(location.host))
                .at(-1)?.src.includes('/app.js')
        }));

        assert.match(result.title, /奇思数学 Pro/);
        assert.equal(result.batchEntry, true);
        assert.equal(result.modules.length, 6);
        assert.equal(result.appLast, true);
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
