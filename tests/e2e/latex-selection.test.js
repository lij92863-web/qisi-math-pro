const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

const highlight = 'qisi-latex-selection';
const sentence = '将韦达定理所得两式代入';
const firstFormula = '$\\frac{x+y}{2}$';
const secondFormula = '\\[\\frac{a-b}{3}\\]';
const source = '第一步：' + sentence + '，得到 ' + firstFormula + '。\n第二步：' + sentence + '，化简为\n' + secondFormula;
const nav = (page, name) => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }).click();

async function selectText(editor, text) {
    await editor.evaluate((input, text) => {
        const index = input.value.lastIndexOf(text);
        if (index < 0) throw new Error('Missing source text: ' + text);
        input.focus();
        input.setSelectionRange(index, index + text.length);
    }, text);
}

async function highlightedText(page, expected, field) {
    await page.waitForFunction(({ name, expected, field }) => {
        const ranges = [...(CSS.highlights.get(name) || [])];
        return ranges.map(range => range.toString()).join('') === expected &&
            (!field || ranges.every(range => range.startContainer.parentElement.closest('[data-latex-preview]')?.dataset.latexPreview === field));
    }, { name: highlight, expected, field });
    return page.evaluate(name => [...CSS.highlights.get(name)].map(range => ({
        line: range.startContainer.textContent,
        field: range.startContainer.parentElement.closest('[data-latex-preview]').dataset.latexPreview,
        background: getComputedStyle(range.startContainer.parentElement, '::highlight(' + name + ')').backgroundColor
    })), highlight);
}

async function clear(page) {
    await page.waitForFunction(name => !CSS.highlights.has(name) &&
        !document.querySelector('[data-latex-selection-mark]'), highlight);
}

test('单题录入精准区分重复文字，并高亮公式、选项及对应栏', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(32362);
    const { page } = h;
    try {
        page.setDefaultTimeout(6500);
        await nav(page, '单题录入');
        const editor = page.getByRole('textbox', { name: '单题 LaTeX 源码' });
        await page.getByRole('button', { name: '解析内容', exact: true }).click();
        await editor.fill(source);
        await selectText(editor, sentence);
        const [rendered] = await highlightedText(page, sentence);
        assert.match(rendered.line, /第二步/);
        assert.equal(rendered.field, 'solution');
        assert.equal(rendered.background, 'rgb(255, 226, 138)');
        await selectText(editor, 'a-b');
        const formula = page.locator('[data-latex-preview="solution"] [data-latex-selection-mark]');
        await formula.waitFor();
        assert.equal(await formula.locator('annotation').textContent(), '\\frac{a-b}{3}');
        assert.equal(await editor.inputValue(), source);
        await page.getByRole('button', { name: '题目内容', exact: true }).click();
        await clear(page);

        const choice = '选项定位。\nA. 同字选项\nB. 同字选项\nC. 其他';
        await editor.fill(choice);
        await selectText(editor, '同字选项');
        await highlightedText(page, '同字选项');
        assert.equal(await page.evaluate(name => {
            const [range] = CSS.highlights.get(name);
            return range.startContainer.parentElement.closest('.gaokao-option').querySelector('.option-label').textContent;
        }, highlight), 'B.');
        await editor.press('ArrowRight');
        await clear(page);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('批量录题中分屏题干、答案和解析分别同步至预览', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(32363);
    const { page } = h;
    try {
        page.setDefaultTimeout(6500);
        const id = await H.seedReviewBatch(page, { batchId: 'latex_selection' });
        await nav(page, '批量录题');
        await H.callProxy(page, 'openBatchReview', id);
        await page.getByRole('button', { name: /分屏编辑/ }).click();
        const stem = page.getByRole('textbox', { name: '题目 LaTeX 源码', exact: true });
        await stem.fill(source + '\nA. 甲\nB. 乙\nC. 丙\nD. 丁');
        await selectText(stem, sentence);
        assert.equal((await highlightedText(page, sentence))[0].field, 'stem');
        await page.getByRole('button', { name: '答案内容', exact: true }).click();
        await clear(page);
        const answer = page.getByRole('textbox', { name: '答案源码', exact: true });
        await answer.fill('答案：' + sentence);
        await selectText(answer, sentence);
        assert.equal((await highlightedText(page, sentence))[0].field, 'answer');
        await page.getByRole('button', { name: '解析内容', exact: true }).click();
        await clear(page);
        const solution = page.getByRole('textbox', { name: '解析源码', exact: true });
        await solution.fill(source);
        await selectText(solution, 'a-b');
        await page.locator('[data-latex-preview="solution"] [data-latex-selection-mark]').waitFor();
        assert.equal(await solution.inputValue(), source);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('讲义和试卷内容编辑分别高亮题干、选项和解析，纸面不含临时标记', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(32364);
    const { page } = h;
    try {
        page.setDefaultTimeout(6500);
        await page.evaluate(async ({ source, sentence }) => {
            await db.questions.put({
                id: 'latex-selection-paper', stem: '试卷和讲义高亮题', type: '单选题', createdAt: 20,
                options: [sentence, sentence, '其他选项'], solution: source, answer: 'B', images: []
            });
            localStorage.setItem('qisi_exam_cart', JSON.stringify(['latex-selection-paper']));
        }, { source, sentence });
        await page.reload();
        for (const term of ['讲义', '试卷']) {
            await nav(page, term);
            const studio = page.getByTestId('handout-studio');
            const block = studio.locator('.hc-sheet .hc-kind-question').filter({ hasText: '试卷和讲义高亮题' });
            if (!await block.count()) {
                await studio.getByRole('button', { name: /试题篮/ }).click();
                await studio.getByRole('button', { name: '加入' + term, exact: true }).click();
            }
            await block.locator('.hc-stem').dblclick();
            const editor = studio.getByRole('dialog', { name: '编辑内容' });
            const stem = editor.getByLabel('题干 LaTeX');
            await selectText(stem, '高亮题');
            assert.equal((await highlightedText(page, '高亮题'))[0].field, 'stem');
            await selectText(editor.getByLabel('选项 B'), sentence);
            assert.equal((await highlightedText(page, sentence))[0].field, 'option-1');
            const solution = editor.getByLabel('解析', { exact: true });
            await selectText(solution, sentence);
            assert.match((await highlightedText(page, sentence, 'solution'))[0].line, /第二步/);
            await selectText(solution, 'a-b');
            await editor.locator('[data-latex-preview="solution"] [data-latex-selection-mark]').waitFor();
            assert.equal(await studio.locator('.hc-sheet [data-latex-selection-mark]').count(), 0);
            await editor.getByRole('button', { name: '取消', exact: true }).click();
            await clear(page);
        }
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
