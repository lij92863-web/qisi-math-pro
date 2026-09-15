'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { startBrowserApp, assertNoRuntimeErrors } = require('./browser-harness.js');

const ENTRY_BUTTON = '新题目录入';
const VIEW_ROOTS = {
    entry: '.entry-layout',
    batchImport: '.batch-import-page',
    library: '.library-layout',
    exam: '.exam-builder',
    personal: '.personal-layout',
    template: '.template-layout'
};

function visibleViews(page) {
    return page.evaluate(roots => Object.entries(roots)
        .filter(([, selector]) => {
            const node = document.querySelector(selector);
            return Boolean(node) && node.offsetParent !== null;
        })
        .map(([name]) => name), VIEW_ROOTS);
}

test('the remembered view never overwrites a navigation the teacher already clicked', {
    timeout: 90_000
}, async () => {
    const harness = await startBrowserApp(32123);
    const { page } = harness;

    try {
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        // Make the first awaited startup step slow. This is the same situation as a slow
        // database load, and it is what let the startup restore reach past a user click.
        await page.addInitScript(() => {
            try {
                Object.defineProperty(navigator.storage, 'persist', {
                    configurable: true,
                    value: () => new Promise(resolve => setTimeout(resolve, 1500))
                });
            } catch {
                // A browser without a patchable storage manager keeps the fast path.
            }
        });

        await page.evaluate(() => window.localStorage.setItem('qisi_last_view', 'library'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await navigation.getByRole('button', { name: ENTRY_BUTTON, exact: true }).click();
        await page.waitForTimeout(2_600);
        assert.deepEqual(
            await visibleViews(page),
            ['entry'],
            'a startup restore must not take away the view the teacher just opened'
        );

        await page.evaluate(() => window.localStorage.setItem('qisi_last_view', 'library'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });
        await page.waitForTimeout(2_600);
        assert.deepEqual(
            await visibleViews(page),
            ['library'],
            'the remembered view must still be restored when nothing was clicked'
        );

        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
