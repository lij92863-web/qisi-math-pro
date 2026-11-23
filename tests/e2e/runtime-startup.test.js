const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

test('a missing application script leaves a visible startup error and retry button', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(33017);
    try {
        await h.page.route(/\/app\.js(?:\?|$)/, route => route.abort());
        await h.page.reload();
        await h.page.getByRole('alert').filter({ hasText: '题库启动失败' }).waitFor();
        assert.equal(await h.page.getByRole('button', { name: '刷新页面', exact: true }).isVisible(), true);
    } finally { await h.close(); }
});

test('handout storage failure leaves the native question library usable and can be retried without a reload', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(33020);
    try {
        await h.page.evaluate(() => db.questions.put({ id: 'handout-migration-fault', type: '解答题', stem: '迁移失败时仍能查看的题', options: [], images: [], createdAt: 1 }));
        await h.page.addInitScript(() => {
            window.failHandoutMigration = true;
            window.Qisi ||= {};
            Object.defineProperty(window.Qisi, 'HandoutDocument', { configurable: true, set(owner) {
                Object.defineProperty(window.Qisi, 'HandoutDocument', { configurable: true, value: {
                    ...owner,
                    async migrateStorage(database) {
                        if (window.failHandoutMigration) throw new DOMException('migration failed', 'QuotaExceededError');
                        return owner.migrateStorage(database);
                    }
                } });
            } });
        });
        await h.page.reload();
        await h.page.getByRole('alert').filter({ hasText: '题库仍可使用' }).waitFor();
        const nav = h.page.getByRole('navigation', { name: '主导航' });
        await nav.getByRole('button', { name: '题库', exact: true }).click();
        await h.page.getByText('迁移失败时仍能查看的题', { exact: true }).first().waitFor();
        assert.deepEqual(await h.page.evaluate(() => Qisi.Runtime.getRuntimeDependency('AppProxy').backupWorkspace.downloadBackup()),
            { ok: false, code: 'HANDOUT_STORAGE_UNAVAILABLE' });
        await nav.getByRole('button', { name: '讲义', exact: true }).click();
        assert.equal(await h.page.locator('.hc-studio').count(), 0);
        await h.page.evaluate(() => { window.failHandoutMigration = false; });
        await h.page.getByRole('button', { name: '重试讲义存储', exact: true }).click();
        await h.page.locator('.hc-studio').waitFor();
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('manual temp cleanup asks for confirmation and reports the reclaimed space', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(33021);
    let calls = 0, allowCleanup = false;
    try {
        await h.page.route('**/api/maintenance/temp-files/cleanup', route => {
            calls++;
            assert.equal(route.request().method(), 'POST');
            assert.equal(route.request().headers()['x-qisi-temp-cleanup'], '1');
            return route.fulfill({ json: { removed: 2, freedBytes: 1024 ** 2, failed: 0 } });
        });
        h.page.on('dialog', dialog => allowCleanup ? dialog.accept() : dialog.dismiss());
        await h.page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '个人知识点与备份', exact: true }).click();
        const button = h.page.getByRole('button', { name: '清理临时文件', exact: true });
        await button.click();
        assert.equal(calls, 0);
        allowCleanup = true;
        await button.click();
        await h.page.getByText('已清理 2 项临时文件，释放 1.0 MiB。', { exact: true }).waitFor();
        assert.equal(calls, 1);
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

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
                'PdfMultimodalContract',
                'DocxPipeline',
                'UiEvents',
                'ReviewDraftState'
            ].filter(name => Boolean(window.Qisi?.[name])),
            retiredOwners: [
                'ProductionPdfSourcesPort', 'PdfImportCoordinator',
                'PdfCandidateProjection', 'PdfOcrSupportParser',
                'PdfSupportBlockParser', 'PdfSupportControlledWrite', 'PdfQuestionBoundary'
            ].filter(name => Boolean(window.Qisi?.[name])),
            appLast: [...document.scripts]
                .filter(script => script.src && script.src.includes(location.host))
                .at(-1)?.src.includes('/app.js')
        }));

        assert.match(result.title, /奇思数学 Pro/);
        assert.equal(result.batchEntry, true);
        assert.equal(result.modules.length, 6);
        assert.deepEqual(result.retiredOwners, []);
        assert.equal(result.appLast, true);
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});

test('main navigation exposes large task controls, formula search and reusable personal tags', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32102);
    const { page } = harness;
    try {
        await page.setViewportSize({ width: 2560, height: 1060 });
        await page.evaluate(async () => {
            const database = new Dexie('QisiMathVueDB');
            await database.open();
            await database.table('questions').bulkPut([
                { id: 'nav-math-a', stem: '函数搜索样例甲 $f\\left( x \\right)=1$。' },
                { id: 'nav-math-b', stem: '函数搜索样例乙 $f (x)=2$。' },
                { id: 'nav-math-c', stem: '函数搜索样例丙 $f(y)=3$。' }
            ].map((row, index) => ({ ...row, type: '解答题', options: [], createdAt: index + 1 })));
            database.close();
        });
        await page.reload();
        const nav = page.getByRole('navigation', { name: '主导航' });
        const link = name => nav.getByRole('button', { name, exact: true });
        assert.deepEqual(await nav.getByRole('button').allTextContents(),
            ['题库', '试卷', '讲义', '单题录入', '批量录题', '个人知识点与备份']);
        assert.ok((await link('批量录题').boundingBox()).height >= 45);
        await link('批量录题').click();
        await page.locator('.batch-home-upload').click();
        const create = page.locator('.v-batch-create');
        assert.ok((await create.boundingBox()).width >= 1900);
        assert.ok((await create.locator('select').first().boundingBox()).height >= 48);
        assert.ok((await create.locator('.v-dropzone').boundingBox()).height >= 300);
        const search = page.getByRole('search').getByRole('textbox', { name: '搜索题目、知识点' });
        assert.ok((await search.boundingBox()).width >= 300);
        await search.fill('f(x)');
        await search.press('Enter');
        await page.getByText('共 2 道试题', { exact: true }).waitFor();
        const card = page.locator('.question-card').filter({ hasText: '函数搜索样例甲' });
        await card.waitFor();
        assert.equal(await page.locator('.question-card').filter({ hasText: '函数搜索样例丙' }).count(), 0);

        await card.getByRole('button', { name: '编辑', exact: true }).click();
        const tag = card.getByRole('textbox', { name: '手动修改个人知识点' });
        await tag.fill('二次函数探究');
        await card.getByRole('button', { name: '确认更新', exact: true }).click();
        await card.locator('.library-card-editor').waitFor({ state: 'detached' });
        await page.waitForFunction(async () => (await db.questions.get('nav-math-a'))?.personalKnowledge === '二次函数探究');
        await link('个人知识点与备份').click();
        await page.locator('.personal-tree-name').getByText('二次函数探究', { exact: true }).waitFor();
        await link('单题录入').click();
        await page.locator('.v-entry-meta summary').click();
        const entryTag = page.getByRole('textbox', { name: '新个人知识点标签' });
        await entryTag.fill('二次函数探究');
        await page.getByRole('button', { name: '添加并选中' }).click();
        await page.waitForFunction(() => document.querySelector('.v-entry-meta .qisi-personal-tag select')?.value === '二次函数探究');
        assert.equal(await page.locator('.v-entry-meta .qisi-personal-tag option').filter({ hasText: '二次函数探究' }).count(), 1);

        await page.setViewportSize({ width: 740, height: 920 });
        await link('批量录题').click();
        await page.locator('.batch-home-upload').click();
        const columns = await create.locator('.v-create-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns);
        assert.equal(columns.split(' ').length, 1);
        await link('讲义').click();
        await page.getByTestId('handout-studio').waitFor();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});
