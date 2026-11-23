const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { startBrowserApp, assertNoRuntimeErrors } = require('./browser-harness');

const figure = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="250" height="180"><path d="M10 170 L240 170 L125 12 Z" fill="none" stroke="black" stroke-width="3"/></svg>').toString('base64');

test('immediate navigation recovers a handout edit whose regular save has not finished', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(33018);
    try {
        const { page } = h;
        await page.getByRole('button', { name: '讲义', exact: true }).click();
        await page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.$refs.handout?.ready);
        const id = await page.evaluate(async () => {
            const studio = Qisi.Runtime.getRuntimeDependency('AppProxy').$refs.handout;
            studio.saveTail = new Promise(() => {});
            studio.doc.blocks.push(Qisi.HandoutDocument.block('text', { text: '立即关页前的正文' }));
            await Vue.nextTick();
            return studio.doc.id;
        });
        await page.reload();
        await page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.databaseStatus === '');
        const doc = await page.evaluate(id => Qisi.HandoutDocument.store.get('doc:' + id), id);
        assert.equal(doc.blocks[0].text, '立即关页前的正文');
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('export reports the printed question number and stops when a live source was deleted', { timeout: 30000 }, async () => {
    const h = await startBrowserApp(32998);
    try {
        const { page } = h;
        await page.evaluate(async () => {
            await db.questions.put({ id: 'print-reference', stem: '求 $x^2 的值', createdAt: 1, images: [], options: [], type: '解答题' });
            Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'handout';
        });
        await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.$refs.handout?.ready);
        await page.evaluate(() => {
            const studio = Qisi.Runtime.getRuntimeDependency('AppProxy').$refs.handout;
            studio.doc.settings.firstQuestion = 7;
            studio.doc.blocks = [
                Qisi.HandoutDocument.block('title', { text: '合成讲义' }),
                Qisi.HandoutDocument.block('heading', { text: '一、函数' }),
                Qisi.HandoutDocument.block('question', { questionId: 'print-reference' })
            ];
            window.confirm = message => { window.formulaWarning = message; return false; };
        });
        const button = page.getByRole('button', { name: '导出 PDF', exact: true });
        await page.locator('.hc-sheet .hc-stem').waitFor();
        await button.click();
        assert.match(await page.evaluate(() => window.formulaWarning), /第 7 题/);
        await page.evaluate(() => db.questions.delete('print-reference'));
        await page.locator('.hc-sheet .hc-missing').waitFor();
        await button.click();
        await page.getByText(/第 7 题的题库引用已失效/).waitFor();
        assert.equal(h.context.pages().length, 1);
        assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

async function dragRow(page, grip, target, direction, duringDrag, firstMoves) {
    const source = await grip.boundingBox();
    const destination = await target.boundingBox();
    const x = source.x + source.width / 2;
    await page.mouse.move(x, source.y + source.height / 2);
    await page.mouse.down();
    await firstMoves?.(distance => page.mouse.move(x, source.y + source.height / 2 + distance));
    await page.mouse.move(x, destination.y + destination.height * (direction === 'down' ? .9 : .1), { steps: 18 });
    await duringDrag?.();
    await page.mouse.up();
}

async function assertFormulaMatchesStem(scope) {
    const typography = await scope.locator('.hc-sheet .hc-stem .katex').first().evaluate(formula => {
        const math = getComputedStyle(formula);
        const stem = getComputedStyle(formula.closest('.hc-stem'));
        return [math.fontSize, stem.fontSize, math.fontWeight, stem.fontWeight, math.webkitTextStrokeWidth];
    });
    const [mathSize, stemSize, mathWeight, stemWeight, stroke] = typography;
    assert.equal(mathSize, stemSize);
    assert.equal(mathWeight, stemWeight);
    assert.equal(mathWeight, '400');
    assert.equal(stroke, '0px');
}

test('不同列宽、字号、缩放和图片尺寸下，块下配图遵守同一间距约束', async () => {
    const harness = await startBrowserApp(32642);
    try {
        const errors = await harness.page.evaluate(async url => {
            const D = Qisi.HandoutDocument;
            const settings = D.create().settings;
            settings.showAnswer = settings.showSolution = true;
            const stage = document.createElement('div');
            stage.className = 'hc-studio';
            stage.style.cssText = 'position:fixed;left:-10000px;top:0;min-width:0;transform-origin:top left';
            document.body.append(stage);
            const sample = new Image();
            sample.src = url;
            await sample.decode();
            const errors = [];
            for (const width of [263, 477, 721]) for (const size of [13, 21]) {
                for (const scale of [.65, 1, 1.9]) for (const anchor of ['stem', 'options']) {
                    for (const x of [0, .5, 1]) {
                        const gap = x === 0 ? 0 : x === .5 ? 12 : 64;
                        const layout = { width: x === 0 ? width + 50 : 143, x, gap, anchor, y: 600 };
                        const q = D.question({ id: 'probe', type: '单选题', stem: '已知函数 $f(x)=x^2$，根据配图判断。'.repeat(7),
                            options: ['一', '二', '三', '四'], answer: '一', solution: '根据图像判断。', images: [{ id: 'p', url, layout }] });
                        const entry = D.block('question', { style: { size }, optionsMode: x === 0 ? '1' : x === .5 ? '2' : '4' });
                        stage.style.width = width + 'px';
                        stage.style.transform = 'scale(' + scale + ')';
                        stage.innerHTML = D.wrap(entry, q, settings, 1, D.contentParts(entry, q, settings));
                        const image = stage.querySelector('.qisi-flow-anchored img').getBoundingClientRect();
                        const group = stage.querySelector('.hc-' + anchor).getBoundingClientRect();
                        const body = stage.querySelector('.hc-block-body').getBoundingClientRect();
                        const actual = (image.top - group.bottom) / scale;
                        if (Math.abs(actual - gap) > .2 || image.left < body.left - .2 || image.right > body.right + .2) {
                            errors.push({ width, size, scale, anchor, x, actual, gap });
                        }
                        if (anchor === 'stem' && x === 0) {
                            const options = stage.querySelector('.hc-options').getBoundingClientRect();
                            if (options.top < image.bottom - .2) errors.push({ width, size, scale, options: options.top, image: image.bottom });
                        }
                        const answer = stage.querySelector('.hc-support')?.getBoundingClientRect();
                        const lowest = Math.max(image.bottom, stage.querySelector('.hc-stem').getBoundingClientRect().bottom,
                            stage.querySelector('.hc-options').getBoundingClientRect().bottom);
                        if (!(answer?.top >= lowest - .2)) errors.push({ width, size, scale, anchor, x, answer: answer?.top, lowest });

                        layout.anchor = 'origin';
                        layout.y = 80;
                        stage.innerHTML = D.wrap(entry, q, settings, 1, D.contentParts(entry, q, settings));
                        const floated = stage.querySelector('.qisi-flow-picture').getBoundingClientRect();
                        const following = stage.querySelector('.hc-support').getBoundingClientRect();
                        if (following.top < floated.bottom - .2) errors.push({ width, size, scale, x, answer: following.top, bottom: floated.bottom });
                    }
                }
            }
            stage.remove();
            return errors;
        }, figure);
        assert.deepEqual(errors, []);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题图跟随题干或选项，预览、重排、保存重开和打印保留文档间距', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32641);
    const { page } = harness;
    try {
        await page.setViewportSize({ width: 1600, height: 980 });
        const splitId = await page.evaluate(async url => {
            const D = Qisi.HandoutDocument;
            const doc = D.create();
            doc.settings.mode = 'single';
            doc.settings.showAnswer = true;
            const layouts = [{ width: 205, x: .5, y: 420 },
                { width: 123, x: .97, y: 300, anchor: 'stem', gap: 7 },
                { width: 190, x: .94, y: 550, anchor: 'options', gap: 64 }];
            doc.blocks = layouts.map((layout, index) => {
                const id = 'g' + index;
                const snapshot = D.question({ id, type: '单选题', stem: '根据函数图像判断。'.repeat(12 - index * 4),
                    options: ['$1$', '$2$', '$3$', '$4$'], answer: index ? 'B' : '',
                    images: [{ id, url, layout, align: index === 0 ? 'float-right' : 'center' }] });
                return D.block('question', { questionId: id, snapshot, optionsMode: ['auto','1','1'][index] });
            });
            const split = D.block('question', { split: true, snapshot: D.question({
                id: 'split', type: '单选题', stem: '观察图形。[[IMAGE:split-img]]\n' + '请结合图形判断函数的单调性。\n'.repeat(50),
                options: ['增函数', '减函数'], answer: '增函数。[[IMAGE:answer-img]]', images: [
                    { id: 'split-img', url, layout: { anchor: 'options', width: 130, gap: 10, x: .5, y: 15 } },
                    { id: 'answer-img', url, field: 'answer', layout: { anchor: 'origin', width: 58, x: 1, y: 4 } }
                ]
            }) });
            doc.blocks.push(split);
            await D.store.save(doc);
            return split.id;
        }, figure);
        const open = () => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '讲义', exact: true }).click();
        await open();
        const studio = page.getByTestId('handout-studio');
        const block = i => studio.locator('.hc-sheet .hc-kind-question').nth(i);
        const editor = studio.getByRole('dialog', { name: '编辑内容' });
        const preview = editor.locator('.hc-edit-column .hc-block');
        const gap = (scope, anchor) => scope.evaluate((el, name) => {
            const body = el.querySelector('.hc-block-body');
            const figure = body.querySelector('.qisi-flow-anchored img');
            const group = body.querySelector('.hc-' + name);
            const scale = body.getBoundingClientRect().width / parseFloat(getComputedStyle(body).width);
            return (figure.getBoundingClientRect().top - group.getBoundingClientRect().bottom) / scale;
        }, anchor);
        const check = async (scope, name, expected) => {
            // Off-screen sheets use content-visibility:auto and can have no
            // painted geometry until the browser scrolls that sheet into view.
            const picture = scope.locator('.qisi-flow-anchored img');
            await picture.scrollIntoViewIfNeeded();
            const value = await gap(scope, name);
            assert.ok(Math.abs(value - expected) < .2, JSON.stringify({ value, expected, name }));
        };
        const checkBeside = async scope => {
            await scope.locator('.qisi-flow-anchored img').scrollIntoViewIfNeeded();
            const layout = await scope.evaluate(el => {
                const group = el.querySelector('.hc-options');
                const options = group.getBoundingClientRect();
                const image = el.querySelector('.qisi-flow-anchored img').getBoundingClientRect();
                return {
                    beside: options.right <= image.left && options.top < image.bottom && options.bottom > image.top,
                    topDifference: Math.abs(options.top - image.top),
                    options: options.toJSON(), image: image.toJSON(),
                    stem: el.querySelector('.hc-stem').getBoundingClientRect().toJSON()
                };
            });
            assert.equal(layout.beside, true, JSON.stringify(layout));
            assert.ok(layout.topDifference < 2, JSON.stringify(layout));
        };
        await check(block(0), 'options', 12);  // historical absolute position
        await check(block(1), 'stem', 7);
        await checkBeside(block(1));
        await check(block(2), 'options', 64);  // deliberately saved whitespace
        const fragments = studio.locator('.hc-sheet [data-block="' + splitId + '"]');
        assert.ok(await fragments.count() > 1);
        assert.equal(await fragments.locator('[data-image-id="split-img"] img').count(), 1);
        await check(fragments.filter({ has: page.locator('.hc-options') }), 'options', 10);
        const assertAnswerOrder = async fragments => {
            const answer = fragments.locator('.hc-support');
            await answer.scrollIntoViewIfNeeded();
            assert.equal(await answer.locator('[data-image-id="answer-img"] img').count(), 1);
            const order = await fragments.evaluateAll(parts => {
                const prompt = parts.find(part => part.querySelector('.hc-options'));
                const answerPart = parts.find(part => part.querySelector('.hc-support'));
                if (prompt !== answerPart) return parts.indexOf(prompt) < parts.indexOf(answerPart);
                const promptBottom = prompt.querySelector('.qisi-flow-picture').getBoundingClientRect().bottom;
                return answerPart.querySelector('.hc-support').getBoundingClientRect().top >= promptBottom - .2;
            });
            assert.equal(order, true);
        };
        await assertAnswerOrder(fragments);
        await block(1).locator('.hc-stem').dblclick();
        await checkBeside(preview);
        await editor.getByRole('button', { name: '取消', exact: true }).click();
        await block(0).locator('.hc-stem').dblclick();
        await check(preview, 'options', 12);
        const image = preview.locator('.qisi-flow-anchored img');
        const r = await image.boundingBox();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 9, y + 16, { steps: 8 });
        await page.mouse.up();
        await preview.locator('.qisi-flow-anchored:not([data-legacy-position]) img').waitFor();
        const chosen = await gap(preview, 'options');
        assert.ok(chosen > 20 && chosen < 32, String(chosen));
        await editor.getByLabel('题干 LaTeX').fill('设函数 $f(x)=x^2$，结合图形判断下列命题。'.repeat(14));
        await check(preview, 'options', chosen);
        await page.setViewportSize({ width: 1100, height: 820 });
        await check(preview, 'options', chosen);
        await editor.getByRole('button', { name: '保存内容' }).click();
        await block(0).locator('.hc-stem').filter({ hasText: '结合图形判断下列命题' }).waitFor();
        await check(block(0), 'options', chosen);
        await studio.getByRole('button', { name: '双列', exact: true }).click();
        await studio.getByLabel('页面尺寸').selectOption('a4');
        await page.waitForFunction(() => document.querySelector('.hc-sheet .hc-column')?.offsetWidth < 500);
        await check(block(0), 'options', chosen);
        await check(block(1), 'stem', 7);
        await checkBeside(block(1));
        await check(block(2), 'options', 64);
        await assertAnswerOrder(fragments);
        await studio.getByRole('button', { name: '保存讲义', exact: true }).click();
        await studio.getByText('讲义已保存', { exact: true }).waitFor();
        await page.reload();
        await open();
        await check(block(0), 'options', chosen);
        const popup = page.waitForEvent('popup');
        await studio.getByRole('button', { name: '导出 PDF' }).click();
        const print = await popup;
        await print.waitForFunction(() => document.querySelector('.hc-print-action')?.disabled === false);
        await check(print.locator('.hc-kind-question').first(), 'options', chosen);
        await checkBeside(print.locator('.hc-kind-question').nth(1));
        await assertAnswerOrder(print.locator('.hc-sheet [data-block="' + splitId + '"]'));
        await print.close();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('右侧配图从题干末行开始时，左侧能容纳的选项保持并排', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32644);
    const { page } = harness;
    try {
        await page.evaluate(async url => {
            const D = Qisi.HandoutDocument;
            const doc = D.create();
            doc.settings = D.bodyTemplate().settings;
            doc.blocks = ['1', 'auto'].map(optionsMode => D.block('question', { optionsMode, snapshot: D.question({
                id: optionsMode, type: '单选题', stem: '折扇是我国古老文化的延续。折扇常以字画的形式体现传统文化，也有善良善行的寓意。'.repeat(3) +
                    '图乙是扇形的一部分，若两个圆弧所在圆的半径分别为 $12$ 和 $27$，则圆台的侧面积是（　）。[[IMAGE:fan]]',
                options: ['$292\\pi$', '$\\frac{1330\\sqrt 2}{3}\\pi$', '$195\\pi$', '$243\\pi$'],
                images: [{ id: 'fan', url, layout: { width: optionsMode === 'auto' ? 475 : 302, height: 132, x: 1, y: 67, anchor: 'origin' } }]
            }) }));
            await D.store.save(doc);
        }, figure);
        const open = () => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '讲义', exact: true }).click();
        const studio = page.getByTestId('handout-studio');
        const assertBeside = async block => {
            await block.locator('[data-image-id="fan"] img').scrollIntoViewIfNeeded();
            const bounds = await block.evaluate(el => {
                const rect = selector => el.querySelector(selector).getBoundingClientRect().toJSON();
                return { stem: rect('.hc-stem'), image: rect('[data-image-id="fan"] img'), options: rect('.hc-options') };
            });
            const { stem, image, options } = bounds;
            assert.ok(image.top < stem.bottom && image.bottom > stem.bottom, JSON.stringify(bounds));
            assert.ok(options.right <= image.left + 1 && options.top < image.bottom && options.bottom > image.top, JSON.stringify(bounds));
            assert.equal(await block.locator('.hc-option').count(), 4);
        };
        const blocks = studio.locator('.hc-sheet .hc-kind-question');
        await open();
        await assertBeside(blocks.first());
        await assertBeside(blocks.last());
        await blocks.first().locator('.hc-stem').dblclick();
        const editor = studio.getByRole('dialog', { name: '编辑内容' });
        const preview = editor.locator('.hc-edit-column .hc-block');
        await assertBeside(preview);
        const image = preview.locator('[data-image-id="fan"] img');
        const { x, y, width, height } = await image.boundingBox();
        await page.mouse.move(x + width / 2, y + height / 2);
        await page.mouse.down();
        await page.mouse.move(x + width / 2 - 14, y + height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForFunction(start => document.querySelector('.hc-edit-column [data-image-id="fan"] img')?.getBoundingClientRect().left < start - 8, x);
        await assertBeside(preview);
        await editor.getByRole('button', { name: '保存内容' }).click();
        await page.reload();
        await open();
        await assertBeside(blocks.first());
        const popup = page.waitForEvent('popup');
        await studio.getByRole('button', { name: '导出 PDF' }).click();
        const print = await popup;
        await print.waitForFunction(() => document.querySelector('.hc-print-action')?.disabled === false);
        await assertBeside(print.locator('.hc-kind-question').first());
        await assertBeside(print.locator('.hc-kind-question').last());
        await print.close();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('长解析利用上一页的剩余空间并在页脚前自动续排，导出保留全文', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32643);
    const { page } = harness;
    try {
        const ids = await page.evaluate(async () => {
            const D = Qisi.HandoutDocument;
            const doc = D.create();
            Object.assign(doc.settings, { mode: 'single', paper: '3:2', showSolution: true });
            const previous = D.block('text', { text: '上一题的解析', space: 180 });
            const question = D.block('question', { snapshot: D.question({ id: 'long-solution',
                stem: '求曲线交点和外接圆面积。',
                solution: Array.from({ length: 27 }, (_, index) => `${index === 0 ? '推导开头' : index === 26 ? '推导结尾' : '继续推导'}：\n\n$$\nx+${index + 1}=0\n$$`).join('\n\n') }) });
            const next = D.block('question', { breakBefore: 'page', snapshot: D.question({ id: 'short', stem: '手动另起一页。' }) });
            doc.blocks = [previous, question, next];
            await D.store.save(doc);
            return [question.id, next.id];
        });
        await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '讲义', exact: true }).click();
        const studio = page.getByTestId('handout-studio');
        const assertPagination = async scope => {
            const fragments = scope.locator(`[data-sheet] [data-block="${ids[0]}"]`);
            await fragments.first().waitFor({ state: 'attached' });
            assert.equal(await fragments.first().evaluate(node => node.closest('[data-sheet]').dataset.sheet), '1');
            assert.match(await fragments.first().textContent(), /推导开头/);
            assert.ok(await fragments.count() >= 3);
            assert.deepEqual(await fragments.locator('annotation').allTextContents(),
                Array.from({ length: 27 }, (_, index) => `x+${index + 1}=0`));
            assert.equal(await fragments.locator('.hc-stem').count(), 1);
            assert.equal(await fragments.locator('.hc-support b').filter({ hasText: '解析' }).count(), 1);
            const last = fragments.last();
            assert.match(await last.textContent(), /推导结尾/);
            assert.equal(await scope.locator(`[data-block="${ids[1]}"]`).evaluate(node => Number(node.closest('[data-sheet]').dataset.sheet)),
                1 + await last.evaluate(node => Number(node.closest('[data-sheet]').dataset.sheet)));
            for (const fragment of await fragments.all()) {
                await fragment.scrollIntoViewIfNeeded();
                assert.equal(await fragment.evaluate(node => {
                    const sheet = node.closest('.hc-sheet');
                    const margin = 20 * 96 / 25.4;
                    const scale = sheet.getBoundingClientRect().width / sheet.offsetWidth;
                    return node.getBoundingClientRect().bottom <= sheet.getBoundingClientRect().bottom - margin * scale + 1;
                }), true);
            }
        };
        await assertPagination(studio);
        assert.equal(await studio.locator('.hc-overflow').count(), 0);
        const popup = page.waitForEvent('popup');
        await studio.getByRole('button', { name: '导出 PDF' }).click();
        const print = await popup;
        await print.waitForFunction(() => document.querySelector('.hc-print-action')?.disabled === false);
        await assertPagination(print);
        await print.close();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('试卷与讲义共享编辑器，支持拖动、分页、配图、留白、保存及 PDF', { timeout: 90000 }, async () => {
    const harness = await startBrowserApp(32289);
    const { page } = harness;
    try {
        page.setDefaultTimeout(8000);
        await page.setViewportSize({ width: 1560, height: 960 });
        await page.evaluate(async image => {
            const db = new Dexie('QisiMathVueDB');
            await db.open();
            const fixture = Array.from({ length: 20 }, (_, index) => ({
                id: `handout-test-${index + 1}`, type: '单选题', grade: '高一', diff: '中等', questionNumber: index + 1,
                stem: `示例题 ${index + 1}　设 $x=\\frac{${index + 1}}{2}$，求 $x^2$ 的值。${index === 1 ? '已知条件请结合配图理解。'.repeat(8) + ' [[IMAGE:diagram]]' : ''}`,
                options: ['$1$', '$2$', '$3$', '$4$'], answer: 'A', solution: '把数值代入 $x^2$。',
                images: index === 1 ? [{ id: 'diagram', align: 'center' }] : [], createdAt: index + 1
            }));
            await db.table('questions').bulkPut(fixture);
            const response = await fetch(image);
            await db.table('images').put({ id: 'diagram', blob: await response.blob(), createdAt: 1 });
            db.close();
            localStorage.setItem('qisi_exam_cart', JSON.stringify(fixture.map(q => q.id).reverse()));
        }, figure);
        await page.reload();
        const nav = page.locator('.v-topnav nav');
        await nav.getByRole('button', { name: '试卷', exact: true }).click();
        const studio = page.getByTestId('handout-studio');
        const btn = name => studio.getByRole('button', { name, exact: true });
        const tool = name => studio.locator('.hc-inspector').getByRole('button', { name, exact: true });
        assert.equal(await studio.getByLabel('试卷名称').inputValue(), '未命名试卷');
        await btn('我的试卷').click();
        await studio.getByRole('dialog', { name: '我的试卷' }).getByRole('button', { name: '新建试卷' }).waitFor();
        await btn('关闭对话框').click();
        await studio.getByLabel('试卷名称').fill('函数专题自检');
        await studio.getByRole('button', { name: /试题篮/ }).click();
        await studio.getByLabel('导入题目排序').selectOption('ascending');
        await studio.getByRole('button', { name: '加入试卷', exact: true }).first().waitFor();
        const pickerCheckbox = studio.locator('.hc-question-card input[type=checkbox]').first();
        await pickerCheckbox.click();
        assert.equal(await pickerCheckbox.isChecked(), true);
        assert.equal(await pickerCheckbox.evaluate(node => getComputedStyle(node).caretColor), 'rgba(0, 0, 0, 0)');
        await pickerCheckbox.press('Space');
        assert.equal(await pickerCheckbox.isChecked(), false);
        await btn('导入全部匹配').click();
        const blocks = studio.locator('.hc-sheet .hc-kind-question');
        await blocks.nth(19).waitFor({ state: 'attached' });
        assert.match(await blocks.first().innerText(), /示例题\s*1/);
        assert.equal(await studio.locator('.hc-sheet .katex').count() > 20, true);
        await assertFormulaMatchesStem(studio);
        await nav.getByRole('button', { name: '讲义', exact: true }).click();
        assert.equal(await studio.getByLabel('讲义名称').inputValue(), '函数专题自检');
        assert.equal(await blocks.count(), 20);

        await blocks.first().locator('.hc-stem').dblclick();
        const editor = studio.getByRole('dialog', { name: '编辑内容' });
        const editorSource = editor.getByLabel('题干 LaTeX');
        const preview = editor.getByRole('region', { name: '内容预览' });
        const finalStem = '长题的最后一行';
        assert.ok((await editor.boundingBox()).width > 1250);
        await editorSource.fill('已知函数 f(x) 的定义域为实数集，求它的性质。'.repeat(8) + '\n' + finalStem);
        await editor.getByLabel('答案', { exact: true }).fill('第一步：写出定义域。\n第二步：验证结果。');
        const metrics = await preview.evaluate(node => {
            const stem = node.querySelector('.hc-stem');
            const support = node.querySelector('.hc-support');
            const scale = Number(stem.closest('[data-paper-scale]').dataset.paperScale);
            return [parseFloat(getComputedStyle(stem).fontSize) * scale, parseFloat(getComputedStyle(support).fontSize) * scale,
                stem.offsetHeight / parseFloat(getComputedStyle(stem).lineHeight), node.scrollWidth, node.clientWidth];
        });
        assert.ok(metrics[0] >= 18 && metrics[0] <= 22 && metrics[1] >= 17, JSON.stringify(metrics));
        assert.ok(metrics[2] > 3 && metrics[3] === metrics[4]);
        assert.match(await preview.innerText(), /长题的最后一行[\s\S]*第一步：写出定义域。\n第二步：验证结果。/);
        await btn('取消').click();

        const rows = studio.locator('.hc-object');
        const paperRow = index => studio.locator('.hc-sheet [data-paper-draggable]').nth(index);
        const originalRows = await rows.evaluateAll(items => items.map(item => item.dataset.entry));
        const displaced = paperRow(1).locator('.hc-paper-content');
        const initialTop = (await displaced.boundingBox()).y;
        await dragRow(page, blocks.first().locator('.hc-stem'), paperRow(2), 'down', async () => {
            await studio.locator('.hc-paper-drop-line').waitFor({ state: 'visible' });
            const id = await paperRow(1).getAttribute('data-block');
            await page.waitForFunction(({ id, initialTop }) =>
                document.querySelector(`.hc-sheet [data-block="${id}"] .hc-paper-content`).getBoundingClientRect().top < initialTop - 4,
                { id, initialTop });
            assert.deepEqual(await rows.evaluateAll(items => items.map(item => item.dataset.entry)), originalRows);
        }, async move => {
            await move(9);
            await page.waitForFunction(top => document.querySelectorAll('.hc-sheet .hc-paper-content')[1]
                .getBoundingClientRect().top < top - 4, initialTop);
            const earlyTop = (await displaced.boundingBox()).y;
            await move(18);
            await page.waitForFunction(top => document.querySelectorAll('.hc-sheet .hc-paper-content')[1]
                .getBoundingClientRect().top < top - 4, earlyTop);
            assert.deepEqual(await rows.evaluateAll(items => items.map(item => item.dataset.entry)), originalRows);
        });
        await page.waitForFunction(() => /^示例题 1\D/.test(document.querySelectorAll('.hc-object-label')[2].textContent));
        await page.waitForFunction(() => document.querySelectorAll('.hc-sheet .hc-stem')[2].textContent.includes('示例题 1'));
        await studio.locator('.hc-paper-ghost').waitFor({ state: 'detached' });
        await page.keyboard.press('Control+z');
        await page.waitForFunction(() => /^示例题 1\D/.test(document.querySelector('.hc-object-label').textContent));
        await page.waitForFunction(() => document.querySelector('.hc-sheet .hc-stem').textContent.includes('示例题 1'));
        await dragRow(page, blocks.nth(2).locator('.hc-stem'), paperRow(0), 'up', async () => {
            await studio.locator('.hc-paper-drop-line').waitFor({ state: 'visible' });
            await page.keyboard.press('Escape');
        });
        assert.deepEqual(await rows.evaluateAll(items => items.map(item => item.dataset.entry)), originalRows);
        assert.equal(await studio.locator('.hc-paper-ghost').count(), 0);
        await dragRow(page, blocks.first().locator('.hc-stem'), paperRow(2), 'down');
        await page.waitForFunction(() => document.querySelectorAll('.hc-sheet .hc-stem')[2].textContent.includes('示例题 1'));
        await page.waitForFunction(() => !document.querySelector('.hc-paper-ghost') &&
            [...document.querySelectorAll('.hc-sheet .hc-paper-content')].every(node => node.getAnimations().length === 0));
        await dragRow(page, blocks.nth(2).locator('.hc-stem'), paperRow(0), 'up');
        await page.waitForFunction(() => /^示例题 1\D/.test(document.querySelector('.hc-object-label').textContent));
        assert.equal(await rows.first().locator('button').count(), 1);
        const first = rows.filter({ hasText: /示例题 1\D/ }).first();
        await dragRow(page, first.locator('.hc-object-label'), rows.nth(2), 'down');
        await page.waitForFunction(() => document.querySelectorAll('.hc-object-label')[2].textContent.includes('示例题 1'));
        await page.waitForFunction(() => [...document.querySelectorAll('.hc-object')].every(row => !row.style.transform));
        await dragRow(page, first.getByRole('checkbox'), rows.first(), 'up');
        await page.waitForFunction(() => /^示例题 1\D/.test(document.querySelector('.hc-object-label').textContent));
        await rows.first().locator('.hc-object-text').click();
        await rows.nth(2).locator('.hc-object-text').click({ modifiers: ['Shift'] });
        assert.equal(await studio.locator('.hc-object-active').count(), 3);
        await tool('元素组织').click();
        await tool('按原题号升序').click();
        assert.match(await rows.first().innerText(), /示例题 1/);
        await tool('全部工具').click();
        await tool('预设内容').click();
        await studio.locator('.hc-preset').filter({ hasText: '讲义标题' }).getByRole('button', { name: '插入开头' }).click();
        await rows.first().locator('.hc-object-text').dblclick();
        await studio.getByLabel('文本内容').fill('函数专题练习');
        await btn('保存内容').click();
        await studio.locator('.hc-kind-title').getByText('函数专题练习').waitFor();
        await tool('全部工具').click();

        const withImage = blocks.nth(1);
        assert.match(await withImage.innerText(), /示例题\s*2/);
        assert.equal(await withImage.locator('img').count(), 1, (await withImage.innerHTML()).slice(0, 300));
        await withImage.locator('img').dblclick();
        const imageDock = editor.locator('.qisi-figure-dock');
        await imageDock.waitFor();
        assert.equal(await editor.getByLabel('宽度 px').count(), 0);
        assert.equal(await editor.getByLabel('相对题目位置').count(), 0);
        const figurePreview = preview.locator('img').first();
        await figurePreview.click();
        const handle = editor.getByRole('button', { name: '右下缩放角' });
        await handle.waitFor();
        assert.equal(await editor.locator('.qisi-figure-outline button:visible').count(), 4);
        const initialImage = await figurePreview.boundingBox();
        const handleBox = await handle.boundingBox();
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.keyboard.down('Shift');
        await page.mouse.move(handleBox.x + handleBox.width / 2 - 42, handleBox.y + handleBox.height / 2 - 6, { steps: 12 });
        const resizedLive = await preview.locator('.qisi-flow-image img').boundingBox();
        assert.ok(resizedLive.width < initialImage.width - 20);
        assert.ok(Math.abs(resizedLive.width / resizedLive.height - initialImage.width / initialImage.height) < .06);
        await page.mouse.up();
        await page.keyboard.up('Shift');
        const settledImage = preview.locator('.qisi-flow-image img');
        await settledImage.waitFor();
        await settledImage.scrollIntoViewIfNeeded();
        const positioned = await settledImage.boundingBox();
        const stemBox = await preview.locator('.hc-stem').boundingBox();
        const startPoint = { x: positioned.x + positioned.width / 2, y: positioned.y + positioned.height / 2 };
        const hits = await page.evaluate(({ x, y }) => document.elementsFromPoint(x, y).slice(0, 7)
            .map(node => [node.tagName, node.getAttribute('class'), getComputedStyle(node).pointerEvents]), startPoint);
        assert.equal(hits[0][0], 'IMG', JSON.stringify({ positioned, stemBox, startPoint, hits }));
        await page.mouse.move(startPoint.x, startPoint.y);
        await page.mouse.down();
        await page.mouse.move(stemBox.x + stemBox.width - positioned.width / 2 - 4, stemBox.y + positioned.height / 2 + 4, { steps: 14 });
        await page.waitForFunction(() => !!document.querySelector('.hc-edit-preview .qisi-flow-image.qisi-flow-right'), null, { timeout: 1500 }).catch(async cause => {
            const figures = await preview.locator('.qisi-flow-image').evaluateAll(nodes => nodes.map(node => [node.className, node.getAttribute('style'), getComputedStyle(node).display]));
            throw new Error(JSON.stringify({ positioned, stemBox, figures }), { cause });
        });
        const figureFlow = await preview.locator('.qisi-flow-image.qisi-flow-right:visible').evaluate(figure => {
            const image = figure.querySelector('img').getBoundingClientRect();
            const stem = figure.closest('.hc-block-body').querySelector('.hc-stem');
            const text = [...stem.childNodes].find(node => node.nodeType === 3 && node.textContent.trim().length > 10);
            if (!text) return false;
            const range = new Range();
            range.selectNodeContents(text);
            const nearby = [...range.getClientRects()].filter(row => row.top < image.bottom && row.bottom > image.top);
            return nearby.length > 0 && nearby.every(row => row.right <= image.left + 2);
        });
        assert.equal(figureFlow, true);
        await page.mouse.up();
        const answer = preview.locator('.hc-support b').first();
        const answerBefore = await answer.boundingBox();
        const imageBefore = await settledImage.boundingBox();
        const questionBox = await preview.locator('.hc-block-body').boundingBox();
        const targetX = questionBox.x + (questionBox.width - imageBefore.width) * .46;
        const targetY = answerBefore.y - 3;
        await page.mouse.move(imageBefore.x + imageBefore.width / 2, imageBefore.y + imageBefore.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetX + imageBefore.width / 2, targetY + imageBefore.height / 2, { steps: 16 });
        const centerImage = preview.locator('.qisi-flow-stacked img:visible');
        await centerImage.waitFor();
        const moved = await centerImage.boundingBox();
        assert.ok(Math.abs(moved.x - targetX) < 3 && Math.abs(moved.y - targetY) < 3, JSON.stringify({ moved, targetX, targetY }));
        const answerDuring = await answer.boundingBox();
        assert.ok(Math.abs(answerDuring.y - answerBefore.y) > 10);
        assert.ok(answerDuring.y >= moved.y + moved.height - 2);
        await page.mouse.up();
        const beforeAnswerDrag = await answer.boundingBox();
        const beforeCenterDrag = await centerImage.boundingBox();
        const nextCenterY = beforeCenterDrag.y + 40;
        await page.mouse.move(beforeCenterDrag.x + beforeCenterDrag.width / 2, beforeCenterDrag.y + beforeCenterDrag.height / 2);
        await page.mouse.down();
        await page.mouse.move(beforeCenterDrag.x + beforeCenterDrag.width / 2 + 27, nextCenterY + beforeCenterDrag.height / 2, { steps: 12 });
        const movedOverAnswer = await centerImage.boundingBox();
        const reflowedAnswer = await answer.boundingBox();
        assert.ok(Math.abs(movedOverAnswer.y - nextCenterY) < 3);
        assert.ok(reflowedAnswer.y > beforeAnswerDrag.y + 30);
        assert.ok(reflowedAnswer.y >= movedOverAnswer.y + movedOverAnswer.height - 2, JSON.stringify({ movedOverAnswer, reflowedAnswer }));
        await page.mouse.up();
        const finalPicture = await centerImage.boundingBox();
        const afterCenter = await answer.boundingBox();
        await page.mouse.move(finalPicture.x + finalPicture.width / 2, finalPicture.y + finalPicture.height / 2);
        await page.mouse.down();
        const rightX = questionBox.x + questionBox.width - finalPicture.width / 2 - 4;
        await page.mouse.move(rightX, afterCenter.y + 20 + finalPicture.height / 2, { steps: 12 });
        const sidePicture = preview.locator('.qisi-flow-right:not(.qisi-flow-stacked):visible .qisi-flow-picture');
        await sidePicture.waitFor();
        const lowerFigure = await sidePicture.boundingBox();
        const lowerAnswer = await answer.boundingBox();
        assert.ok(lowerAnswer.y >= lowerFigure.y + lowerFigure.height - 2, JSON.stringify({ lowerAnswer, lowerFigure }));
        await page.mouse.move(questionBox.x + questionBox.width - finalPicture.width / 2 - 4,
            questionBox.y + finalPicture.height / 2 + 5, { steps: 12 });
        await page.mouse.up();
        await imageDock.getByLabel('图片对齐').selectOption('right');
        await imageDock.getByLabel('图标题').fill('图 1');
        await imageDock.getByLabel('图标题').press('Tab');
        await btn('保存内容').click();
        await withImage.locator('figcaption').getByText('图 1').waitFor({ state: 'attached' });
        assert.equal(await withImage.locator('img').count(), 1);

        await btn('双列').click();
        await tool('页面配置').click();
        await studio.getByLabel('编号方式').selectOption('half');
        await tool('分栏与密封线').click();
        await studio.getByLabel('双列栏间距 mm').fill('12');
        await studio.getByLabel('显示栏间线').check();
        await studio.getByLabel('显示密封线').check();
        assert.equal(await studio.locator('.hc-sheet').first().locator('.hc-separator').count(), 1);
        assert.equal(await studio.locator('.hc-sheet').first().locator('.hc-band-footer').count(), 2);
        const beforeSpace = await studio.locator('.hc-sheet').count();
        await btn('仅题目').click();
        await studio.getByRole('slider', { name: /批量底部留白/ }).fill('120');
        await page.waitForFunction(count => document.querySelectorAll('.hc-sheet').length > count, beforeSpace);
        assert.equal(await studio.locator('.hc-writing-space').count(), 20);
        assert.match(await studio.locator('.hc-band-footer').last().textContent(), /第\s+\d+\s*\/\s*\d+\s+页/);
        await studio.getByRole('slider', { name: /批量底部留白/ }).fill('0');
        await btn('单列').click();
        await studio.getByLabel('页面尺寸', { exact: true }).selectOption('3:2');
        await tool('全部工具').click();
        await tool('布局规则').click();
        await studio.getByLabel('每页最多题目数').fill('1');
        await tool('开始执行').click();
        await studio.locator('[data-sheet="20"]').waitFor({ state: 'attached' });
        assert.equal(await studio.locator('.hc-sheet').count(), 20);
        assert.equal(await studio.locator('.hc-sheet').first().locator('.hc-kind-question').count(), 1);
        await studio.getByLabel('预览缩放', { exact: true }).fill('58');
        await studio.locator('.hc-canvas').evaluate(canvas => { canvas.scrollTop = 0; canvas.scrollLeft = 0; });
        const pictureGrip = blocks.nth(1).locator('img');
        const firstPageTarget = studio.locator('[data-sheet="1"] [data-paper-draggable]').last();
        await dragRow(page, pictureGrip, firstPageTarget, 'up', async () => {
            await studio.locator('.hc-paper-drop-line').waitFor({ state: 'visible' });
        });
        await page.waitForFunction(() => /示例题\s*2/.test(document.querySelector('[data-sheet="1"] .hc-stem')?.textContent || ''));
        const ordered = await rows.filter({ hasText: /示例题 2\D/ }).first().getAttribute('data-entry');
        assert.equal(await studio.locator('[data-sheet="1"] .hc-kind-question').evaluate(node => node.closest('[data-block]').dataset.block), ordered);
        await btn('保存讲义').click();
        await studio.getByText('讲义已保存', { exact: true }).waitFor();

        const popupPromise = page.waitForEvent('popup');
        await btn('导出 PDF').click();
        const popup = await popupPromise;
        await popup.locator('.hc-sheet').nth(19).waitFor({ state: 'attached' });
        await popup.waitForFunction(() => document.querySelector('.hc-print-action')?.disabled === false);
        assert.equal(await popup.locator('.hc-columns').first().evaluate(node => getComputedStyle(node).position), 'absolute');
        await assertFormulaMatchesStem(popup);
        const pdf = await popup.pdf({ preferCSSPageSize: true, printBackground: true });
        assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
        assert.match(pdf.toString('latin1'), /\/Count 20\b/);
        await popup.close();
        const downloadPromise = page.waitForEvent('download');
        await btn('分享讲义').click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), '函数专题自检.json');
        const portable = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
        const portableFigure = portable.blocks.find(item => item.snapshot?.id === 'handout-test-2');
        assert.match(portableFigure.snapshot.images[0].url, /^data:image\/svg\+xml;base64,/);

        await page.reload();
        await nav.getByRole('button', { name: '讲义', exact: true }).click();
        await studio.locator('[data-sheet="20"]').waitFor({ state: 'attached' });
        assert.equal(await studio.getByLabel('讲义名称').inputValue(), '函数专题自检');
        await nav.getByRole('button', { name: '试卷', exact: true }).click();
        assert.equal(await studio.getByLabel('试卷名称').inputValue(), '函数专题自检');
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('qisi_exam_cart'))), Array.from({ length: 20 }, (_, index) => `handout-test-${20 - index}`));
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('讲义的设置、知识、编辑、模板和溢出处理通过正常入口生效', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32291);
    const { page } = harness;
    try {
        page.setDefaultTimeout(8000);
        await page.locator('.v-topnav nav').getByRole('button', { name: '讲义', exact: true }).click();
        const studio = page.getByTestId('handout-studio');
        const btn = name => studio.getByRole('button', { name, exact: true });
        const panel = studio.locator('.hc-inspector');
        const tool = name => panel.getByRole('button', { name, exact: true });
        const open = async name => {
            if (await tool('全部工具').count()) await tool('全部工具').click();
            await tool(name).click();
        };
        const textBlocks = studio.locator('.hc-sheet .hc-kind-text');
        await tool('添加文本').click();
        const source = studio.getByLabel('文本内容');
        await source.fill('课堂练习第一段');
        await source.press('End');
        await source.press('Enter');
        await page.keyboard.insertText('根据条件回答');
        const editPreview = studio.locator('.hc-edit-preview .hc-block');
        assert.equal(await editPreview.innerText(), '课堂练习第一段\n根据条件回答');
        await source.press('Enter');
        await source.press('Enter');
        await page.keyboard.insertText('最后化简 $x^2+2x+1$');
        assert.equal(await editPreview.locator('br').count(), 3);
        await btn('保存内容').click();
        await textBlocks.first().waitFor();
        assert.equal(await textBlocks.first().locator('br').count(), 3);
        await tool('添加知识').click();
        await btn('手写知识说明').click();
        await studio.getByLabel('文本内容').fill('知识点：二次函数');
        await btn('保存内容').click();
        await studio.locator('.hc-sheet .hc-kind-knowledge').getByText('知识点：二次函数').waitFor();

        await studio.getByLabel('选择第 2 项').uncheck();
        await studio.getByLabel('选择第 1 项').check();
        await open('经典盒子');
        await tool('应用到选中').click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.hc-sheet .hc-kind-text')).borderLeftWidth === '4px');
        await tool('移除盒子').click();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.hc-sheet .hc-kind-text')).borderLeftWidth === '0px');
        await open('字体样式');
        await panel.getByLabel('字号', { exact: true }).first().fill('24');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.hc-sheet .hc-kind-text')).fontSize === '24px');
        await open('元素组织');
        await tool('复制选中').click();
        await tool('插入到末尾').click();
        await textBlocks.nth(1).waitFor({ state: 'attached' });
        await open('分页 / 移动');
        await tool('段前换页').click();
        await studio.locator('[data-sheet="2"]').waitFor({ state: 'attached' });
        await tool('清除分页标记').click();
        await studio.locator('[data-sheet="2"]').waitFor({ state: 'detached' });

        await open('页面配置');
        await panel.getByLabel('显示此插槽').check();
        await panel.getByLabel('内容', { exact: true }).fill('校本资料');
        await studio.locator('.hc-band-header').getByText('校本资料').waitFor({ state: 'attached' });
        const paperCanvas = studio.locator('.hc-canvas');
        const header = paperCanvas.getByRole('button', { name: '页眉', exact: true });
        const footer = paperCanvas.getByRole('button', { name: '页脚', exact: true });
        await header.first().click();
        assert.equal(await header.first().getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('Backspace');
        await header.first().waitFor({ state: 'detached' });
        await page.keyboard.press('Control+z');
        await header.first().getByText('校本资料').waitFor();
        await footer.first().click();
        await btn('删除页脚').click();
        await footer.first().waitFor({ state: 'detached' });
        await page.keyboard.press('Control+z');
        await footer.first().waitFor();
        await tool('图文水印').click();
        await panel.getByLabel('水印文字').fill('教师用');
        await studio.locator('.hc-watermark').getByText('教师用').waitFor({ state: 'attached' });
        await tool('边距边框').click();
        await tool('默认边框').click();
        assert.equal(await studio.locator('.hc-page-frame').count(), 1);
        await tool('自定义模板').click();
        await panel.getByLabel('模板名称').fill('校本版式');
        await tool('把当前设置保存为模板').click();
        await panel.getByText('校本版式', { exact: true }).waitFor();

        await studio.getByLabel('页面尺寸', { exact: true }).selectOption('3:2');
        await btn('全选').click();
        await studio.locator('.hc-selection-bar').getByRole('slider').fill('420');
        await studio.locator('.hc-overflow').first().waitFor({ state: 'attached' });
        await btn('导出 PDF').click();
        await studio.getByRole('alert').getByText(/超过纸面高度/).waitFor();
        await studio.locator('.hc-selection-bar').getByRole('slider').fill('0');
        await studio.locator('.hc-overflow').first().waitFor({ state: 'detached' });
        await tool('应用').click();
        assert.equal(await studio.getByLabel('页面尺寸', { exact: true }).inputValue(), 'a4');
        await btn('取消选择').click();

        await btn('图片处理').click();
        const data = Buffer.from(figure.split(',')[1], 'base64');
        await studio.locator('.hc-upload input').setInputFiles({ name: 'diagram.svg', mimeType: 'image/svg+xml', buffer: data });
        await btn('使用选中图片').click();
        await studio.getByLabel('剪去左侧 %').fill('10');
        await btn('处理并插入').click();
        const cropped = studio.locator('.hc-sheet .hc-kind-image img').first();
        await cropped.waitFor({ state: 'attached' });
        await page.waitForFunction(() => document.querySelector('.hc-sheet .hc-kind-image img').naturalWidth === 225);
        assert.match(await cropped.getAttribute('src'), /^data:image\/png;base64,/);

        const firstText = textBlocks.first();
        const firstId = await firstText.evaluate(node => node.closest('[data-block]').dataset.block);
        const firstRow = studio.locator(`[data-entry="${firstId}"]`);
        await firstText.click();
        const name = studio.getByLabel('讲义名称');
        await name.fill('快捷键测试X');
        await name.press('End');
        await name.press('Backspace');
        assert.equal(await name.inputValue(), '快捷键测试');
        assert.equal(await firstRow.count(), 1);
        await firstText.dblclick();
        await source.fill('修改文字X');
        await source.press('End');
        await source.press('Backspace');
        assert.equal(await source.inputValue(), '修改文字');
        assert.equal(await firstRow.count(), 1);
        await btn('取消').click();
        await firstText.click();
        await page.keyboard.press('Backspace');
        await firstRow.waitFor({ state: 'detached' });
        await studio.locator(`.hc-sheet [data-block="${firstId}"]`).waitFor({ state: 'detached' });
        assert.equal(await textBlocks.count(), 1);
        assert.equal(await cropped.count(), 1);
        await page.keyboard.press('Control+z');
        await firstRow.waitFor();
        const restored = studio.locator(`.hc-sheet [data-block="${firstId}"]`);
        await restored.click();
        await page.keyboard.press('Backspace');
        await restored.waitFor({ state: 'detached' });

        const knowledgeRow = studio.locator('.hc-object').filter({ hasText: '知识点：二次函数' });
        await knowledgeRow.getByRole('checkbox').check();
        await page.keyboard.press('Backspace');
        await knowledgeRow.waitFor({ state: 'detached' });
        const all = btn('全选');
        await studio.getByLabel('选择第 1 项').check();
        assert.equal(await all.getAttribute('aria-pressed'), 'false');
        await all.click();
        assert.equal(await all.getAttribute('aria-pressed'), 'true');
        assert.equal(await studio.locator('.hc-object input:checked').count(), 2);
        await all.click();
        assert.equal(await all.getAttribute('aria-pressed'), 'false');
        assert.equal(await studio.locator('.hc-object input:checked').count(), 0);

        const paper = studio.locator('.hc-sheet').first();
        const canvas = studio.locator('.hc-canvas');
        const slider = studio.getByRole('slider', { name: '预览缩放' });
        await canvas.evaluate(node => { node.scrollTop = 0; });
        await paper.click({ position: { x: 18, y: 24 } });
        await page.keyboard.press('Control+a');
        assert.equal(await studio.locator('.hc-object input:checked').count(), 2);
        await paper.click({ position: { x: 18, y: 24 } });
        assert.equal(await studio.locator('.hc-object input:checked').count(), 0);
        assert.equal(await studio.locator('.hc-sheet .hc-selected').count(), 0);
        const beforeZoom = Number(await slider.inputValue());
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -240);
        await page.waitForFunction(value => Number(document.querySelector('[aria-label="预览缩放"]').value) > value, beforeZoom);
        await page.mouse.wheel(0, 240);
        await page.keyboard.up('Control');
        await page.waitForFunction(value => Math.abs(Number(document.querySelector('[aria-label="预览缩放"]').value) - value) <= 1, beforeZoom);
        const paperSize = studio.getByLabel('页面尺寸', { exact: true });
        const previousSize = await paperSize.inputValue();
        await paperSize.selectOption('a4h');
        await canvas.focus();
        await page.keyboard.press('Control+z');
        assert.equal(await paperSize.inputValue(), previousSize);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('正文模板真实排版和导出，分隔线可拖动且适宽随画布更新', { timeout: 90000 }, async () => {
    const harness = await startBrowserApp(32292);
    const { page } = harness;
    try {
        await page.setViewportSize({ width: 1640, height: 1040 });
        const nav = page.locator('.v-topnav nav').getByRole('button', { name: '讲义', exact: true });
        await nav.click();
        const studio = page.getByTestId('handout-studio');
        const btn = name => studio.getByRole('button', { name, exact: true });
        const tool = name => studio.locator('.hc-inspector').getByRole('button', { name, exact: true });
        const sheets = studio.locator('.hc-sheet');
        const splitter = studio.getByRole('separator', { name: '调整右侧工具栏宽度' });
        await page.waitForFunction(() => Number(document.querySelector('.hc-splitter').getAttribute('aria-valuenow')) > 0);
        const panelWidth = () => splitter.getAttribute('aria-valuenow').then(Number);
        const buttonSize = () => tool('页面配置').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
        const initialFont = await buttonSize();
        const initial = await panelWidth();
        const hit = await splitter.boundingBox();
        await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
        assert.equal(await splitter.evaluate(node => getComputedStyle(node).cursor), 'ew-resize');
        await page.mouse.down();
        await page.mouse.move(hit.x + hit.width / 2 - 120, hit.y + hit.height / 2, { steps: 16 });
        await page.mouse.up();
        assert.equal(await panelWidth(), initial + 120);
        assert.ok(await buttonSize() > initialFont + 1);
        const fit = () => page.evaluate(() => {
            const canvas = document.querySelector('.hc-canvas');
            const style = getComputedStyle(canvas);
            const width = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const paper = canvas.querySelector('.hc-sheet')?.getBoundingClientRect().width;
            return Math.abs(width - paper) < 2 && canvas.scrollWidth <= canvas.clientWidth + 1;
        });
        await sheets.first().waitFor();
        assert.ok(await fit());
        await studio.getByLabel('预览缩放', { exact: true }).fill('175');
        assert.equal(await btn('适宽').getAttribute('aria-pressed'), 'false');
        assert.equal(await studio.getByLabel('预览恢复到 100%').innerText(), '175%');
        await btn('适宽').click();
        assert.ok(await fit());
        await page.reload();
        await nav.click();
        await page.waitForFunction(width => Number(document.querySelector('.hc-splitter')?.getAttribute('aria-valuenow')) === width, initial + 120);
        await splitter.press('ArrowRight');
        assert.equal(await panelWidth(), initial + 104);
        await splitter.dblclick();
        assert.equal(await panelWidth(), initial);

        await tool('模板素材').click();
        await tool('应用正文模板').click();
        await tool('插入正文模块').click();
        const insert = name => studio.locator('.hc-preset').filter({ has: page.getByText(name, { exact: true }) })
            .getByRole('button', { name: '插入末尾' }).click();
        for (const name of ['章标题', '内容提要', '节标题', '定理框', '易错提醒', '章末练习']) await insert(name);
        await studio.locator('.hc-object-text').nth(3).dblclick();
        await studio.getByLabel('定理标题').fill('定理 1.1');
        await studio.getByLabel('文本内容').fill('函数 Function 满足 $$f(x)=x^2+2x+1.$$');
        await btn('保存内容').click();
        const theorem = sheets.locator('.hc-body24-theorem');
        await theorem.getByText('定理 1.1', { exact: true }).waitFor();
        assert.equal(await sheets.locator('.hc-body24-overview').count(), 1);
        assert.equal(await sheets.locator('.hc-body24-note').count(), 1);
        assert.equal(await sheets.locator('.hc-body24-exercises').count(), 1);
        assert.equal(await sheets.first().locator('.hc-band-header').count(), 0);
        assert.equal(await theorem.locator('.hc-block-body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 248, 239)');
        assert.match(await theorem.evaluate(node => getComputedStyle(node).fontFamily), /KaTeX_Main.*Noto Serif SC/);
        assert.equal(await theorem.locator('.katex-display .katex').count(), 1);
        await tool('全部工具').click();
        await tool('分页 / 移动').click();
        await tool('段前换页').click();
        await sheets.nth(1).locator('.hc-band-footer').getByText('2', { exact: true }).waitFor();
        await sheets.nth(1).locator('.hc-band-header').getByText(/练习/).waitFor();
        assert.ok(await fit());
        const printed = page.waitForEvent('popup');
        await btn('导出 PDF').click();
        const popup = await printed;
        await popup.waitForFunction(() => document.querySelector('.hc-print-action')?.disabled === false);
        await popup.locator('.hc-body24-theorem .katex').waitFor();
        assert.equal(await popup.locator('.hc-body24-theorem .hc-block-body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 248, 239)');
        assert.equal(await popup.evaluate(() => document.fonts.check('13px "Noto Serif SC"', '函数') && document.fonts.check('13px KaTeX_Main', 'Function')), true);
        const pdf = await popup.pdf({ preferCSSPageSize: true, printBackground: true });
        assert.match(pdf.toString('latin1'), /\/Count 2\b/);
        await popup.close();

        await tool('全部工具').click();
        await tool('模板素材').click();
        await tool('编辑模板 24讲义 · 正文').click();
        const editor = studio.getByRole('dialog', { name: '编辑正文模板' });
        await editor.getByLabel('正文模板名称').fill('校本二次函数正文');
        await editor.getByLabel('章节与页码').fill('#37308a');
        await editor.getByLabel('定理框底色').fill('#d8faef');
        await editor.getByLabel('定理框边框').fill('#3b8d70');
        await editor.getByLabel('定理标签底色').fill('#67dbb2');
        await editor.getByLabel('定理正文文字').fill('#184a3a');
        await editor.getByLabel('定理标签', { exact: true }).fill('常用结论');
        await editor.getByLabel('定理框内容').fill('顶点横坐标为 $-\\frac{b}{2a}$。');
        const editorBounds = await editor.boundingBox();
        assert.ok(editorBounds.width > 1000);
        await editor.getByRole('button', { name: '添加模块' }).click();
        await editor.getByLabel('模块名称').fill('课堂探究');
        await editor.getByLabel('模块内容').fill('说明 $f(x)$ 的增减性。');
        await editor.getByLabel('框底色', { exact: true }).fill('#e3efff');
        const modulePreview = editor.getByLabel('模块预览');
        assert.equal(await modulePreview.locator('.katex').count(), 1);
        assert.equal(await modulePreview.locator('.hc-block-body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(227, 239, 255)');
        await editor.getByRole('button', { name: '添加模块' }).click();
        await editor.getByLabel('模块名称').fill('我的小节');
        await editor.getByLabel('模块样式').selectOption('heading');
        await editor.getByLabel('模块内容').fill('方法归纳');
        await editor.getByRole('button', { name: '保存模板', exact: true }).click();
        await tool('编辑模板 校本二次函数正文').waitFor();
        await btn('保存讲义').click();
        await studio.getByText('讲义已保存', { exact: true }).waitFor();
        await page.reload();
        await nav.click();
        await tool('模板素材').click();
        await tool('编辑模板 校本二次函数正文').waitFor();
        await tool('应用正文模板').click();
        const oldTheorem = theorem.filter({ hasText: '定理 1.1' });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.hc-sheet .hc-body24-theorem .hc-block-body')).backgroundColor === 'rgb(216, 250, 239)');
        assert.match(await oldTheorem.textContent(), /Function/);
        await tool('插入正文模块').click();
        await insert('定理框');
        const custom = theorem.filter({ hasText: '常用结论' });
        await custom.getByText('常用结论', { exact: true }).waitFor({ state: 'attached' });
        assert.match(await custom.textContent(), /顶点横坐标为/);
        assert.equal(await custom.locator('.katex').count(), 1);
        await insert('课堂探究');
        await insert('我的小节');
        const moduleBox = sheets.locator('.hc-module-box');
        await moduleBox.getByText('课堂探究', { exact: true }).waitFor({ state: 'attached' });
        await sheets.locator('.hc-kind-heading').getByText('方法归纳', { exact: true }).waitFor({ state: 'attached' });
        await moduleBox.getByText('课堂探究', { exact: true }).dblclick();
        await studio.getByLabel('模块标题').fill('课堂任务');
        await studio.getByLabel('文本内容').fill('画出 $f(x)$ 的图像。');
        await btn('保存内容').click();
        await moduleBox.getByText('课堂任务', { exact: true }).waitFor({ state: 'attached' });
        const exported = page.waitForEvent('popup');
        await btn('导出 PDF').click();
        const customPopup = await exported;
        await customPopup.waitForFunction(() => document.querySelector('.hc-print-action')?.disabled === false);
        const printedBox = customPopup.locator('.hc-body24-theorem').filter({ hasText: '常用结论' });
        assert.deepEqual(await printedBox.locator('.hc-block-body').evaluate(node => {
            const css = getComputedStyle(node);
            return [css.backgroundColor, css.borderTopColor, css.color];
        }), ['rgb(216, 250, 239)', 'rgb(59, 141, 112)', 'rgb(24, 74, 58)']);
        assert.equal(await customPopup.locator('.hc-module-box .hc-block-body').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(227, 239, 255)');
        await customPopup.close();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});
