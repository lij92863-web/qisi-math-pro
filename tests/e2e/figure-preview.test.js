const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, waitForDbSnapshot, assertNoRuntimeErrors } = require('./browser-harness');

test('题库选择题拖图到中间时保留选项网格且保存和刷新不改变位置', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32311);
    const { page } = harness;
    try {
        await page.setViewportSize({ width: 1600, height: 980 });
        const questionId = 'choice-position';
        const caption = '选择题配图位置';
        await page.evaluate(({ id, caption }) => db.transaction('rw', db.questions, db.images, async () => {
            const imageId = 'choice-illustration';
            const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="230" height="124"><rect width="230" height="124" fill="white"/><path d="M20 110 L205 110 L105 10Z" fill="none" stroke="black"/></svg>'], { type: 'image/svg+xml' });
            await db.images.put({ id: imageId, blob, createdAt: 1 });
            await db.questions.put({
                id, type: '单选题', stem: '选择题排版回归。已知函数 $f(x)=x^2$，请结合配图选择正确答案。',
                options: ['$1$', '$2$', '$3$', '$4$ [[IMAGE:' + imageId + ']]'], answer: 'A', solution: '根据题干条件计算。',
                images: [{ id: imageId, align: 'center', layout: { width: 230, x: 1, y: 8, caption } }],
                createdAt: 1, updatedAt: 1
            });
        }), { id: questionId, caption });
        const openLibrary = () => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '题库', exact: true }).click();
        await page.reload();
        await openLibrary();
        const card = page.locator('.question-card').filter({ hasText: '选择题排版回归' });
        const image = card.locator('.qisi-flow-image img:visible');
        await image.waitFor();
        const dragToCenter = async () => {
            const original = await image.boundingBox();
            const flow = await card.locator('[data-qisi-question-flow]').boundingBox();
            const targetX = flow.x + (flow.width - original.width) * .5;
            const targetY = flow.y + 58;
            await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2);
            await page.mouse.down();
            await page.mouse.move(targetX + original.width / 2, targetY + original.height / 2, { steps: 15 });
            await card.locator('.qisi-flow-stacked img:visible').waitFor();
            const live = await image.boundingBox();
            assert.ok(Math.abs(live.x - targetX) < 3 && Math.abs(live.y - targetY) < 3, JSON.stringify({ live, targetX, targetY }));
            await page.mouse.up();
        };
        await dragToCenter();

        const save = card.getByRole('button', { name: '确认更新', exact: true });
        await save.waitFor();
        const undo = card.getByRole('button', { name: '撤回', exact: true });
        assert.equal(await undo.isEnabled(), true);
        await page.keyboard.press('Control+z');
        await card.locator('.qisi-flow-stacked').waitFor({state:'detached'});
        assert.equal(await undo.isDisabled(), true);
        await dragToCenter();
        const editor = card.getByRole('textbox', { name: '题干源码' });
        const source = await editor.inputValue();
        await editor.fill(source.replace('$1$', '这是一个内容较长、需要按实际宽度重新排版的选项。'.repeat(5)));
        await card.locator('.gaokao-options[data-options="1"]').waitFor();
        await editor.press('Control+z');
        assert.equal(await editor.inputValue(), source);
        await card.locator('.gaokao-options[data-options="4"]').waitFor();
        const positions = () => card.locator('[data-qisi-question-flow]').evaluate(async host => {
            await Promise.all([...host.querySelectorAll('.qisi-flow-image img')].map(image => image.decode()));
            const origin = host.getBoundingClientRect();
            return [...host.querySelectorAll('.qisi-flow-image img, .option-label')].map(node => {
                const box = node.getBoundingClientRect();
                return [box.x - origin.x, box.y - origin.y, box.width, box.height].map(value => Math.round(value));
            });
        });
        const before = await positions();
        assert.equal(before.length, 5);
        assert.equal(new Set(before.slice(1).map(box => box[1])).size, 1);
        assert.ok(before[1][1] >= before[0][1] + before[0][3] - 2);
        await save.click();
        await save.waitFor({ state: 'detached' });
        const state = await waitForDbSnapshot(page, state => state.questions.some(q => q.id === questionId && q.updatedAt > 1));
        assert.equal(state.questions.find(q => q.id === questionId).options.length, 4);
        assert.deepEqual(await positions(), before);
        await page.reload();
        await openLibrary();
        await card.getByText(caption, { exact: true }).waitFor();
        assert.deepEqual(await positions(), before);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题库多小问题的偏右配图旁仍能排下小问，刷新后也不留空行', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(32312);
    const { page } = h;
    try {
        await page.setViewportSize({width:1600,height:980});
        await page.evaluate(async () => {
            const id = 'multipart-layout-figure';
            await db.images.put({ id, blob: new Blob([
                '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="185"><circle cx="130" cy="93" r="79" stroke="black" fill="white"/></svg>'
            ], {type:'image/svg+xml'}), createdAt:1 });
            await db.questions.put({
                id:'multipart-layout', type:'解答题', createdAt:1, updatedAt:1, systemKnowledge:'直线和圆的方程',
                stem:'如图，点 $P$ 在直线上运动，过它作圆的两条切线。\n(1) 求第一小问中切点弦的方程。\n(2) 求第二小问中点的轨迹。\n(3) 求第三小问中线段的最小值。\n[[IMAGE:' + id + ']]',
                images:[{id, align:'center', layout:{width:260,x:.64,y:38,anchor:'origin'}}]
            });
        });
        await page.reload();
        await page.getByRole('navigation', {name:'主导航'}).getByRole('button', {name:'题库', exact:true}).click();
        const stem = page.locator('.question-card [data-question-stem]').filter({hasText:'第一小问'});
        await stem.waitFor();
        assert.equal(await page.getByText('知识点：未设置', {exact:true}).count(), 0);
        const result = await stem.evaluate(element => {
            const image = element.parentElement.querySelector('figure img').getBoundingClientRect();
            const textNodes = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            const lines = [];
            for (let node; (node = textNodes.nextNode());) {
                const match = node.textContent.match(/第[一二三]小问/);
                if (!match) continue;
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const box = range.getBoundingClientRect();
                lines.push({right:box.right, top:box.top, bottom:box.bottom});
            }
            return {lines, image:{left:image.left, top:image.top, bottom:image.bottom}};
        });
        assert.equal(result.lines.length, 3);
        assert.ok(result.lines[2].top < result.image.bottom - 25, JSON.stringify(result));
        assert.ok(result.lines[2].bottom > result.image.top && result.lines[2].right < result.image.left, JSON.stringify(result));
        assert.ok(result.lines[2].top - result.lines[0].top < 125, JSON.stringify(result));
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('单题录入、题库、讲义共享配图布局，入库和重载保留尺寸与标题', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32308);
    const { page } = harness;
    try {
        page.setDefaultTimeout(7500);
        await page.setViewportSize({ width: 1500, height: 1000 });
        const nav = name => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true });
        const entry = page.locator('.v-single-entry');
        const entryPreview = entry.locator('.v-entry-preview');
        const title = '配图交互测试题';
        await nav('单题录入').click();
        await entry.getByLabel('单题 LaTeX 源码').fill(title + '。已知 $f(x)=x^2$，根据题图解释其性质。'.repeat(10) + '\nA. 1\nB. 2\nC. 3\nD. 4');
        assert.equal(await entryPreview.getByLabel('图标题').count(), 0);
        await entry.locator('.v-entry-meta summary').click();
        await entry.locator('.entry-drop-zone input').setInputFiles({
            name: 'triangle.svg',
            mimeType: 'image/svg+xml',
            buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="150"><path d="M12 135L238 135L125 12Z" fill="none" stroke="black" stroke-width="4"/></svg>')
        });
        const image = entryPreview.locator('.math-content img');
        await image.waitFor();
        await image.click();
        await entryPreview.getByRole('button', { name: '左上缩放角' }).waitFor();
        await entryPreview.getByLabel('图片对齐').selectOption('right');
        const entryCaption = entryPreview.getByLabel('图标题');
        await entryCaption.fill('录入配图');
        await entryCaption.press('Tab');
        const laidOut = entryPreview.locator('[data-qisi-question-flow] > .qisi-flow-right img');
        await laidOut.waitFor();
        const laidOutBox = await laidOut.boundingBox();
        assert.ok(laidOutBox.width > 55 && laidOutBox.height > 30, JSON.stringify(laidOutBox));
        await entryPreview.locator('.qisi-flow-right figcaption').getByText('录入配图').waitFor();
        await entry.getByRole('button', { name: '确认无误，保存入库' }).click();
        let snapshot = await waitForDbSnapshot(page, state => state.questions.some(q => q.stem.includes(title)));
        assert.equal(snapshot.questions[0].images[0].layout.caption, '录入配图');
        assert.equal(snapshot.questions[0].images[0].layout.x, 1);

        await nav('题库').click();
        const card = page.locator('.question-card').filter({ hasText: title });
        const cardImage = card.locator('.qisi-flow-image img');
        await cardImage.click();
        const rightBottom = card.getByRole('button', { name: '右下缩放角' });
        await rightBottom.waitFor();
        const original = await cardImage.boundingBox();
        const corner = await rightBottom.boundingBox();
        const start = { x: corner.x + corner.width / 2, y: corner.y + corner.height / 2 };
        await page.mouse.move(start.x - 2, start.y);
        await page.mouse.down();
        await page.mouse.move(start.x - 62, start.y + 44, { steps: 12 });
        const live = await card.locator('.qisi-flow-image img:visible').boundingBox();
        assert.ok(live.width < original.width - 35);
        assert.ok(live.height > original.height + 25);
        await page.mouse.up();
        await card.getByRole('button', { name: '确认更新', exact: true }).waitFor();
        const cardCaption = card.getByLabel('图标题');
        await cardCaption.fill('题库改过的图');
        await cardCaption.press('Tab');
        await card.getByRole('button', { name: '确认更新', exact: true }).click();
        snapshot = await waitForDbSnapshot(page, state => state.questions[0]?.images[0]?.layout?.caption === '题库改过的图');
        assert.ok(snapshot.questions[0].images[0].layout.height > 0);

        await page.reload();
        await nav('题库').click();
        await card.locator('figcaption').getByText('题库改过的图').waitFor();
        await card.getByRole('button', { name: '选题', exact: true }).click();
        await page.locator('.v-topnav').getByRole('button', { name: /试题篮/ }).click();
        await page.getByRole('button', { name: '前往试卷', exact: true }).click();
        const studio = page.getByTestId('handout-studio');
        await studio.getByRole('dialog', { name: '选题' }).getByRole('button', { name: '加入试卷', exact: true }).click();
        await studio.locator('.hc-sheet .qisi-flow-image figcaption').getByText('题库改过的图').waitFor();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});
