const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, assertNoRuntimeErrors } = require('./browser-harness');

const indicator = page => page.locator('.qisi-middle-scroll-indicator');
const openView = (page, name) => page.getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name, exact: true }).click();

async function scrollPosition(panel) {
    return panel.evaluate(el => el.scrollTop);
}

async function waitForScroll(panel, boundary, direction = 1) {
    const handle = await panel.elementHandle();
    await panel.page().waitForFunction(
        ([el, limit, sign]) => sign * (el.scrollTop - limit) > 0,
        [handle, boundary, direction],
        { timeout: 5000 }
    );
    await handle.dispose();
}

async function middleAnchor(panel, hold = false) {
    const { width, height } = await panel.boundingBox();
    const position = { x: width * 0.45, y: height * 0.42 };
    await panel.hover({ position });
    const { x, y } = await panel.boundingBox();
    const anchor = { x: x + position.x, y: y + position.y };
    const mouse = panel.page().mouse;
    await mouse.move(anchor.x, anchor.y);
    await mouse.down({ button: 'middle' });
    if (!hold) await mouse.up({ button: 'middle' });
    await indicator(panel.page()).waitFor();
    return anchor;
}

test('题库长解析支持中键双向滚动，普通滚轮可继续滚动，并保留最后一段的公式', { timeout: 45000 }, async () => {
    const h = await startBrowserApp(32367);
    try {
        const { page } = h;
        await page.setViewportSize({ width: 1440, height: 850 });
        const steps = Array.from({ length: 96 }, (_, i) =>
            `第 ${i + 1} 步化简 $x^2+y^2$。\n\\[\\frac{\\sqrt{${i + 2}}}{2}=a_${i}\\]\n继续计算。\n`);
        await page.evaluate(async solution => {
            await db.questions.put({
                id: 'middle-scroll-long-solution', stem: '长解析中键滚动测试题',
                type: '解答题', solution, createdAt: 1, updatedAt: 1
            });
        }, steps.join('\n') + '最终结论 $x=42$。');
        await page.reload();
        await openView(page, '题库');
        const panel = page.locator('.library-layout .question-flow');
        const card = panel.locator('.question-card');
        await card.waitFor();
        const solution = card.locator('[data-image-region="solution"]');
        assert.equal(await solution.count(), 0);
        await card.getByRole('button', { name: '解析', exact: true }).click();
        const chunks = solution.locator('.library-support-chunk');
        assert.ok(await chunks.count() > 2);
        const lastFormula = chunks.last().locator('.katex').last();
        assert.equal(await lastFormula.evaluate(el => el.checkVisibility({ contentVisibilityAuto: true })), false);

        const { x, y } = await middleAnchor(panel);
        const initial = await scrollPosition(panel);
        await page.mouse.move(x, y + 120);
        await waitForScroll(panel, initial + 150);
        await page.mouse.move(x, y - 110);
        await waitForScroll(panel, initial + 80, -1);
        await page.mouse.click(x, y, { button: 'middle' });
        await indicator(page).waitFor({ state: 'detached' });
        const stopped = await scrollPosition(panel);
        await page.mouse.wheel(0, 260);
        await waitForScroll(panel, stopped + 100);
        await lastFormula.evaluate(el => el.scrollIntoView({ block: 'center' }));
        assert.equal(await lastFormula.evaluate(el => el.checkVisibility({ contentVisibilityAuto: true })), true);
        assert.equal(await lastFormula.locator('annotation').textContent(), 'x=42');
        assertNoRuntimeErrors(h);
    } finally {
        await h.close();
    }
});

test('源码编辑框、讲义及试卷纸面各自滚动，抬起中键和 Esc 均可停止', { timeout: 45000 }, async () => {
    const h = await startBrowserApp(32368);
    try {
        const { page } = h;
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.databaseStatus === '');
        const editor = page.getByRole('textbox', { name: '单题 LaTeX 源码' });
        const source = '保留输入内容 $x^2$。\n'.repeat(70);
        await editor.fill(source);
        const editorScrollRange = await editor.evaluate(el => {
            el.setSelectionRange(0, 4);
            el.scrollTop = 0;
            return el.scrollHeight - el.clientHeight;
        });
        assert.ok(editorScrollRange > 100);
        const entry = await middleAnchor(editor, true);
        await page.mouse.move(entry.x, entry.y + 80);
        await waitForScroll(editor, 60);
        await page.mouse.up({ button: 'middle' });
        await indicator(page).waitFor({ state: 'detached' });
        assert.equal(await editor.inputValue(), source);
        assert.deepEqual(await editor.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 4]);

        for (const name of ['讲义', '试卷']) {
            await openView(page, name);
            await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').$refs.handout?.ready);
            const canvas = page.getByLabel(name + '纸面预览');
            await canvas.waitFor();
            await page.getByRole('slider', { name: '预览缩放' }).fill('160');
            await canvas.evaluate(el => { el.scrollTop = 0; });
            const { x, y } = await middleAnchor(canvas);
            const initial = await scrollPosition(canvas);
            await page.mouse.move(x, y + 100);
            await waitForScroll(canvas, initial + 70);
            await page.keyboard.press('Escape');
            await indicator(page).waitFor({ state: 'detached' });
        }

        await page.getByRole('button', { name: '添加知识', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '选知识点' });
        const dialogBody = dialog.locator('.hc-dialog-body');
        await dialogBody.waitFor();
        const paperBefore = await scrollPosition(page.getByLabel('试卷纸面预览'));
        const { x, y } = await middleAnchor(dialogBody);
        await page.mouse.move(x, y + 100);
        await waitForScroll(dialogBody, 50);
        assert.equal(await scrollPosition(page.getByLabel('试卷纸面预览')), paperBefore);
        await page.keyboard.press('Escape');
        await indicator(page).waitFor({ state: 'detached' });
        assert.equal(await dialog.isVisible(), true);
        assertNoRuntimeErrors(h);
    } finally {
        await h.close();
    }
});

test('批量任务与个人知识点列表支持中键滚动，程序切换页面时会退出滚动', { timeout: 45000 }, async () => {
    const h = await startBrowserApp(32369);
    try {
        const { page } = h;
        await page.setViewportSize({ width: 1440, height: 850 });
        await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.databaseStatus === '');
        await page.evaluate(async () => {
            const rows = Array.from({ length: 40 }, (_, i) => i + 1);
            await db.draftImportBatches.bulkPut(rows.map(i => ({
                id: 'scroll-batch-' + i, title: '滚动测试任务 ' + i,
                status: 'completed', totalCount: 1, submittedCount: 1, progress: 100,
                createdAt: i, updatedAt: i
            })));
            await db.personalKnowledge.put({
                id: 'tree',
                nodes: rows.map(i => ({ id: 'scroll-knowledge-' + i, name: '滚动测试知识点 ' + i, children: [] }))
            });
        });
        await page.reload();
        await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.databaseStatus === '');
        await openView(page, '批量录题');
        await page.getByText('滚动测试任务 40', { exact: true }).waitFor();
        const body = page.locator('.main-content');
        const batch = await middleAnchor(body);
        await page.mouse.move(batch.x, batch.y + 100);
        await waitForScroll(body, 100);
        await page.evaluate(() => { Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'entry'; });
        await indicator(page).waitFor({ state: 'detached' });

        await openView(page, '个人知识点与备份');
        await page.locator('.personal-tree-body').getByText('滚动测试知识点 40', { exact: true }).waitFor();
        const initial = await scrollPosition(body);
        const personal = await middleAnchor(body);
        await page.mouse.move(personal.x, personal.y + 100);
        await waitForScroll(body, initial + 100);
        await page.keyboard.press('Escape');
        await indicator(page).waitFor({ state: 'detached' });
        assertNoRuntimeErrors(h);
    } finally {
        await h.close();
    }
});
