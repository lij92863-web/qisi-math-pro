const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, installBrowserEngineInjection, getDbSnapshot, waitForDbSnapshot, assertNoRuntimeErrors } = require('./browser-harness');

async function seedLibrary(page, questions) {
    await page.evaluate(async rows => {
        const database = new Dexie('QisiMathVueDB');
        await database.open();
        try {
            await database.table('questions').bulkPut(rows.map(row => ({
                grade: '高一', diff: '中等', createdAt: 1, updatedAt: 1, ...row
            })));
        } finally {
            database.close();
        }
    }, questions);
    await page.reload();
    await openLibrary(page);
}

const openLibrary = page => page.getByRole('navigation', { name: '主导航' })
    .getByRole('button', { name: '题库', exact: true }).click();
const questionCard = (page, stem) => page.locator('.question-card').filter({ hasText: stem });
const button = (card, name) => card.getByRole('button', { name, exact: true });
const editTab = (card, name) => button(card.locator('.library-card-editor'), name).click();
async function openAnswer(card) {
    await button(card, '编辑').click();
    await editTab(card, '答案');
}

test('题库可直接修改答案和解析，保存后仍可补填或取消编辑', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32350);
    const { page } = harness;
    try {
        await page.setViewportSize({ width: 1440, height: 850 });
        const original = {
            id: 'library-answer-edit',
            type: '单选题',
            stem: '题库答案编辑测试题',
            options: ['$1$', '$2$', '$3$', '$4$'],
            answer: 'B',
            solution: '保留原来的长解析和分行。\n'.repeat(50).trim()
        };
        const blank = { id: 'library-answer-blank', type: '填空题', stem: '题库补填答案测试题', answer: '' };
        await seedLibrary(page, [original, blank]);
        const card = questionCard(page, original.stem);
        const edit = button(card, '编辑');
        await edit.waitFor();
        assert.equal(await edit.evaluate(el => getComputedStyle(el.parentElement).opacity), '1');
        assert.equal(await button(card, '编辑答案').count(), 0);
        assert.equal(await button(card, '编辑解析').count(), 0);
        await openAnswer(card);

        const answer = card.getByRole('textbox', { name: '答案源码' });
        await answer.waitFor();
        assert.equal(await answer.inputValue(), 'B');
        assert.equal(await answer.evaluate(el => document.activeElement === el), true);
        await answer.fill('D');
        await button(card, '确认更新').click();
        let snapshot = await waitForDbSnapshot(page, value => value.questions.some(q => q.id === original.id && q.answer === 'D'));
        let stored = snapshot.questions.find(q => q.id === original.id);
        assert.deepEqual(stored.options, original.options);
        assert.equal(stored.stem, original.stem);
        assert.equal(stored.solution, original.solution);

        await openAnswer(card);
        await answer.fill('A');
        await button(card, '取消').click();
        await openAnswer(card);
        assert.equal(await answer.inputValue(), 'D');

        await editTab(card, '解析');
        const solution = card.getByRole('textbox', { name: '解析源码' });
        assert.equal(await solution.inputValue(), original.solution);
        await solution.fill('这里是更新后的解析。');
        await button(card, '确认更新').click();
        snapshot = await waitForDbSnapshot(page, value => value.questions.some(q => q.id === original.id && q.solution === '这里是更新后的解析。'));
        stored = snapshot.questions.find(q => q.id === original.id);
        assert.equal(stored.answer, 'D');

        const blankCard = questionCard(page, blank.stem);
        await openAnswer(blankCard);
        await blankCard.getByRole('textbox', { name: '答案源码' }).fill('$12$');
        await button(blankCard, '确认更新').click();
        await waitForDbSnapshot(page, value => value.questions.some(q => q.id === blank.id && q.answer === '$12$'));

        await page.reload();
        await openLibrary(page);
        await openAnswer(card);
        assert.equal(await answer.inputValue(), 'D');
        await editTab(card, '解析');
        assert.equal(await solution.inputValue(), '这里是更新后的解析。');
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题尾可确认移出单题，取消时保留题目，移出时同步移出试题篮', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32351);
    const { page } = harness;
    try {
        const removed = { id: 'library-remove-one', type: '填空题', stem: '移出题库测试题', answer: '$1$' };
        const kept = { id: 'library-keep-one', type: '填空题', stem: '题库保留对照题', answer: '$2$' };
        await seedLibrary(page, [removed, kept]);
        const card = questionCard(page, removed.stem);
        const other = questionCard(page, kept.stem);
        const remove = button(card, '移出题库');
        await remove.waitFor();
        const followsStem = await remove.evaluate(el => {
            const stem = el.closest('.question-card').querySelector('[data-question-stem]');
            return Boolean(stem.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        });
        assert.equal(followsStem, true);

        let message;
        page.once('dialog', async dialog => {
            message = dialog.message();
            await dialog.dismiss();
        });
        await remove.click();
        assert.equal(message, '确定将这道题移出题库？');
        assert.equal(await card.count(), 1);

        await button(card, '选题').click();
        await button(card, '移出').waitFor();
        page.once('dialog', dialog => dialog.accept());
        await remove.click();
        await card.waitFor({ state: 'detached' });
        await page.waitForFunction(id => !Qisi.Runtime.getRuntimeDependency('AppProxy').cart.includes(id), removed.id);
        const snapshot = await waitForDbSnapshot(page, value => value.questions.some(q => q.id === removed.id && q.deletedAt));
        assert.equal(snapshot.questions.find(q => q.id === removed.id).answer, removed.answer);
        assert.equal(snapshot.questions.find(q => q.id === kept.id).deletedAt, undefined);
        await other.waitFor();

        await page.reload();
        await openLibrary(page);
        await other.waitFor();
        assert.equal(await card.count(), 0);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题库 AI 属性按钮在题卡标签旁，采纳建议和 LaTeX 校准后仍需确认更新', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32354);
    const { page } = harness;
    try {
        page.setDefaultTimeout(6000);
        const original = {
            id: 'library-ai',
            type: '解答题',
            stem: '题库智能编辑测试题。已知 $B=\\left\\{x\\mid x=\\frac{1}{2}且x\\ne0\\right\\}$，讨论集合。',
            answer: '原答案',
            solution: '所以 $A=\\left\\{x\\mid x=1且x\\gt0\\right\\}$。'
        };
        const calibrated = original.stem.replace('且', '\\text{且}');
        let reply = calibrated.replace('{1}{2}', '{2}{2}');
        let systemId = 'unknown-system-id';
        await installBrowserEngineInjection(page, {
            defaultResponse: ({ body }) => {
                const prompt = body.messages[0].content;
                if (prompt.includes('校准下面源码')) return reply;
                assert.match(prompt, /"id":"k1-1-1","path":"集合与常用逻辑用语 \/ 集合 \/ 集合的概念与表示"/);
                return { value: {
                    type: '解答题', diff: '较难', grade: '高二', systemKnowledgeId: systemId,
                    concepts: [{ name: '集合的表示', aliases: [] }]
                } };
            }
        });
        await seedLibrary(page, [original]);
        const card = questionCard(page, '题库智能编辑测试题');
        const badges = card.locator('.library-card-meta');
        const unset = badges.getByText('知识点：未设置', { exact: true });
        const selected = badges.getByText('个人知识点：集合的表示', { exact: true });
        const system = badges.locator('.library-system-knowledge');
        const hasTag = () => page.evaluate(async () => Qisi.PersonalKnowledgeModel
            .flattenPaths((await db.table('personalKnowledge').get('tree'))?.nodes)
            .some(node => node.name === '集合的表示'));
        const metadata = card.getByRole('region', { name: 'AI 属性建议' });
        const applyMetadata = async (usePersonal = true) => {
            await badges.getByRole('button', { name: 'AI 补全属性' }).click();
            await metadata.getByText('较难', { exact: true }).waitFor();
            assert.equal(await metadata.getByRole('checkbox', { name: '采用建议的系统知识点' }).isChecked(), true);
            const personal = metadata.getByRole('checkbox', { name: '采用建议的个人知识点' });
            assert.equal(await personal.isChecked(), false);
            assert.equal(await metadata.getByRole('combobox', { name: '建议个人知识点' }).isDisabled(), true);
            if (usePersonal) await personal.check();
            const suggestedLeaf = metadata.getByText('集合的概念与表示', { exact: true });
            assert.equal(await suggestedLeaf.isVisible(), false);
            await metadata.getByText('建议系统知识点：集合与常用逻辑用语', { exact: true }).click();
            await suggestedLeaf.waitFor();
            await metadata.getByRole('button', { name: '应用建议' }).click();
            if (usePersonal) await selected.waitFor();
        };
        await unset.waitFor();
        await badges.getByRole('button', { name: 'AI 补全属性' }).click();
        await metadata.getByText('较难', { exact: true }).waitFor();
        assert.equal(await metadata.getByRole('checkbox', { name: '采用建议的系统知识点' }).count(), 0);
        await metadata.getByRole('button', { name: '丢弃' }).click();
        systemId = 'k1-1-1';
        const personalInput = card.getByRole('textbox', { name: '手动修改个人知识点' });
        await personalInput.fill('老师自定的知识点');
        await applyMetadata(false);
        await system.getByText('系统知识点：集合与常用逻辑用语', { exact: true }).waitFor();
        assert.equal(await personalInput.inputValue(), '老师自定的知识点');
        assert.equal(await selected.count(), 0);
        assert.equal(await hasTag(), false);
        await button(card, '取消').click();
        await unset.waitFor();

        await applyMetadata();
        await system.getByText('系统知识点：集合与常用逻辑用语', { exact: true }).waitFor();
        await button(card, '取消').click();
        await unset.waitFor();
        assert.equal(await hasTag(), false);
        assert.equal(await system.count(), 0);

        await applyMetadata();
        assert.equal(await card.getByRole('textbox', { name: '手动修改个人知识点' }).inputValue(), '集合的表示');
        assert.equal(await hasTag(), false);
        assert.equal((await getDbSnapshot(page)).questions[0].diff, '中等');
        assert.equal((await getDbSnapshot(page)).questions[0].personalKnowledge, undefined);
        assert.equal((await getDbSnapshot(page)).questions[0].systemKnowledge, undefined);

        const calibrate = button(card, 'AI 校准 LaTeX');
        await calibrate.click();
        const compare = card.getByRole('region', { name: 'LaTeX 校准对比' });
        await compare.getByRole('alert').getByText(/建议改动了原文/).waitFor();
        const input = card.getByRole('textbox', { name: '题干源码' });
        assert.equal(await input.inputValue(), original.stem);

        reply = calibrated;
        await calibrate.click();
        const use = compare.getByRole('button', { name: '采用校准' });
        await use.waitFor();
        await input.fill(original.stem + '（补充）');
        await use.click();
        await compare.getByRole('alert').getByText(/编辑内容已更改/).waitFor();
        await input.fill(original.stem);
        await calibrate.click();
        await use.click();
        assert.equal(await input.inputValue(), calibrated);
        assert.equal((await getDbSnapshot(page)).questions[0].stem, original.stem);

        await editTab(card, '解析');
        reply = original.solution.replace('且', '\\text{且}');
        await calibrate.click();
        await use.click();
        assert.equal(await card.getByRole('textbox', { name: '解析源码' }).inputValue(), reply);

        await button(card, '确认更新').click();
        const stored = (await waitForDbSnapshot(page, snapshot => snapshot.questions.some(q => q.stem === calibrated))).questions[0];
        assert.deepEqual([stored.diff, stored.grade, stored.answer, stored.solution], ['较难', '高二', original.answer, reply]);
        assert.equal(stored.personalKnowledge, '集合的表示');
        assert.equal(stored.systemKnowledge, '集合的概念与表示');
        assert.equal(stored.systemKnowledgeId, 'k1-1-1');
        assert.equal(await hasTag(), true);
        await selected.waitFor();
        await page.reload();
        await openLibrary(page);
        await selected.waitFor();
        const summary = system.locator('summary');
        const leaf = system.getByText('集合的概念与表示', { exact: true });
        assert.equal(await summary.textContent(), '系统知识点：集合与常用逻辑用语');
        assert.equal(await leaf.isVisible(), false);
        assert.equal(await system.evaluate(element => Boolean(element.nextElementSibling?.matches('.library-personal-knowledge'))), true);
        await summary.click();
        await system.getByText('集合', { exact: true }).waitFor();
        await leaf.waitFor();
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题库手动输入的反斜杠分隔知识点分别保存、筛选和修改', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32357);
    const { page } = harness;
    try {
        page.setDefaultTimeout(6000);
        const first = '圆的切点弦方程';
        const second = '轨迹方程';
        const stem = '切点弦与中点轨迹的回归题';
        const name = '手动修改个人知识点';
        await page.evaluate(() => db.personalKnowledge.put({ id: 'tree', nodes: [
            { id: 'circle-polar', name: '圆的切点弦方程', children: [] }
        ] }));
        await seedLibrary(page, [{ id: 'two-knowledge-tags', stem, type: '解答题', systemKnowledge: '圆的方程' }]);
        const card = questionCard(page, stem);
        const tag = card.getByRole('textbox', { name });
        const badge = label => card.locator('.library-card-meta').getByText('个人知识点：' + label, { exact: true });
        const read = () => page.evaluate(async () => ({
            row: await db.questions.get('two-knowledge-tags'),
            nodes: (await db.personalKnowledge.get('tree')).nodes
        }));
        const edit = () => button(card, '编辑').click();
        const save = async () => {
            await button(card, '确认更新').click();
            await button(card, '编辑').waitFor();
        };
        await edit();
        await tag.fill(first + '\\' + second);
        await badge(first + '、' + second).waitFor();
        assert.equal((await read()).nodes.length, 1);
        await save();
        const saved = await read();
        const secondId = saved.nodes.find(node => node.name === second)?.id;
        assert.ok(secondId);
        assert.deepEqual(saved.nodes.map(node => node.name), [first, second]);
        assert.deepEqual(saved.row.personalKnowledgeIds, ['circle-polar', secondId]);
        assert.deepEqual(saved.row.meta.personalKnowledgeIds, saved.row.personalKnowledgeIds);
        assert.equal(saved.row.personalKnowledge, first);
        assert.equal(saved.row.systemKnowledge, '圆的方程');

        await page.reload();
        await openLibrary(page);
        await badge(first + '、' + second).waitFor();
        await button(page, '个人知识点').click();
        const tree = page.locator('.library-knowledge-tree');
        for (const label of [first, second]) {
            await tree.getByText(label, { exact: true }).click();
            await card.waitFor();
        }
        await edit();
        assert.equal(await tag.inputValue(), first + '\\' + second);
        await tag.fill(first + '＼');
        await button(card, '确认更新').click();
        await card.getByRole('alert').filter({ hasText: '每个名称须有 1 至 80 字' }).waitFor();
        assert.deepEqual((await read()).row.personalKnowledgeIds, saved.row.personalKnowledgeIds);
        await tag.fill(first);
        await save();
        await badge(first).waitFor();
        assert.deepEqual((await read()).nodes.map(node => node.name), [first]);
        assert.deepEqual((await read()).row.personalKnowledgeIds, ['circle-polar']);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题卡顶部显示系统知识点、多个个人知识点和旧格式的知识点', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32355);
    const { page } = harness;
    try {
        page.setDefaultTimeout(6000);
        await page.evaluate(() => db.table('personalKnowledge').put({ id: 'tree', nodes: [
            { id: 'plot-node', name: '图像分析', children: [] },
            { id: 'change-node', name: '换元法', children: [] }
        ] }));
        const tagged = {
            id: 'library-knowledge-tagged', type: '解答题', stem: '知识点综合测试题',
            meta: { systemKnowledge: '函数的性质', personalKnowledge: '旧标签' },
            personalKnowledgeIds: ['plot-node', 'change-node']
        };
        const legacy = { id: 'library-knowledge-legacy', type: '填空题', stem: '知识点旧数据测试题', knowledge: '数列求和' };
        await seedLibrary(page, [tagged, legacy]);
        const card = questionCard(page, tagged.stem);
        const badges = card.locator('.library-card-meta');
        const system = badges.locator('.library-system-knowledge');
        await system.getByText('系统知识点：函数的概念与性质', { exact: true }).waitFor();
        await system.locator('summary').click();
        await system.getByText('函数的性质', { exact: true }).waitFor();
        await badges.getByText('个人知识点：图像分析、换元法', { exact: true }).waitFor();
        await questionCard(page, legacy.stem).locator('.library-card-meta')
            .getByText('系统知识点：数列求和', { exact: true }).waitFor();
        await button(card, '编辑').click();
        const level1 = card.getByRole('combobox', { name: '系统知识点', exact: true });
        const level2 = card.getByRole('combobox', { name: '二级系统知识点' });
        const level3 = card.getByRole('combobox', { name: '三级系统知识点' });
        assert.equal(await level1.inputValue(), 'k3');
        assert.equal(await level1.getByRole('option', { name: '幂函数', exact: true }).count(), 0);
        await level1.selectOption('k4');
        assert.equal(await level3.count(), 0);
        await level1.selectOption('k3');
        await level2.selectOption('k3-3');
        await level3.selectOption('k3-3-1');
        await button(card, '确认更新').click();
        await button(card, '编辑').waitFor();
        const saved = (await getDbSnapshot(page)).questions.find(question => question.id === tagged.id);
        assert.equal(saved.systemKnowledge, '幂函数');
        assert.equal(saved.systemKnowledgeId, 'k3-3-1');
        assert.deepEqual(saved.personalKnowledgeIds, tagged.personalKnowledgeIds);
        await page.reload();
        await openLibrary(page);
        await button(card, '编辑').click();
        assert.equal(await level3.inputValue(), 'k3-3-1');
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});

test('题库可以手动修改个人知识点，保存后只清理无其他题目使用的旧标签', { timeout: 60000 }, async () => {
    const harness = await startBrowserApp(32356);
    const { page } = harness;
    try {
        page.setDefaultTimeout(6000);
        await page.evaluate(() => db.personalKnowledge.put({ id: 'tree', nodes: [
            { id: 'old-tag', name: '直角三角形的边角关系', children: [] },
            { id: 'existing-tag', name: '椭圆的几何性质', children: [] }
        ] }));
        const original = {
            id: 'library-manual-tag', type: '单选题', stem: '椭圆离心率手动改知识点测试题',
            knowledge: '直角三角形的边角关系', knowledgeType: 'personal',
            systemKnowledge: '圆锥曲线', options: ['1', '2', '3', '4']
        };
        await seedLibrary(page, [original, { ...original, id: 'library-other-tag', stem: '共用旧知识点的另一道题' }]);
        const card = questionCard(page, original.stem);
        const tag = card.getByRole('textbox', { name: '手动修改个人知识点' });
        const menu = card.getByRole('combobox', { name: '个人知识点', exact: true });
        const getSaved = () => page.evaluate(async id => ({
            question: await db.questions.get(id),
            other: await db.questions.get('library-other-tag'),
            nodes: (await db.personalKnowledge.get('tree')).nodes
        }), original.id);
        const badge = name => card.locator('.library-card-meta').getByText('个人知识点：' + name, { exact: true });
        const open = () => button(card, '编辑').click();
        const save = async () => {
            await button(card, '确认更新').click();
            await button(card, '编辑').waitFor();
        };
        await open();
        assert.equal(await tag.inputValue(), original.knowledge);
        await tag.fill('椭圆的离心率');
        await badge('椭圆的离心率').waitFor();
        await button(card, '取消').click();
        await badge(original.knowledge).waitFor();
        assert.equal((await getSaved()).nodes.length, 2);

        await open();
        await tag.fill('椭圆的离心率');
        await page.evaluate(() => {
            window.refuseQuestionEdit = () => { throw new Error('QUESTION_UPDATE_REFUSED'); };
            db.questions.hook('updating').subscribe(window.refuseQuestionEdit);
        });
        await button(card, '确认更新').click();
        await card.getByRole('alert').filter({ hasText: 'QUESTION_UPDATE_REFUSED' }).waitFor();
        let saved = await getSaved();
        assert.equal(saved.nodes.length, 2);
        assert.equal(saved.question.knowledge, original.knowledge);
        assert.equal(await tag.inputValue(), '椭圆的离心率');
        await page.evaluate(() => db.questions.hook('updating').unsubscribe(window.refuseQuestionEdit));

        await save();
        saved = await getSaved();
        const created = saved.nodes.find(node => node.name === '椭圆的离心率');
        assert.ok(created);
        assert.deepEqual(saved.question.personalKnowledgeIds, [created.id]);
        assert.deepEqual(saved.question.meta.personalKnowledgeIds, [created.id]);
        assert.equal(saved.question.systemKnowledge, '圆锥曲线');
        assert.equal(saved.other.knowledge, original.knowledge);
        assert.ok(saved.nodes.some(node => node.id === 'old-tag'));
        await page.reload();
        await openLibrary(page);
        await badge(created.name).waitFor();

        await open();
        await tag.fill('  椭圆的几何性质  ');
        await save();
        saved = await getSaved();
        assert.deepEqual(saved.question.personalKnowledgeIds, ['existing-tag']);
        assert.deepEqual(saved.nodes.map(node => node.id), ['old-tag', 'existing-tag']);

        await open();
        await menu.selectOption({ label: '直角三角形的边角关系' });
        assert.equal(await tag.inputValue(), original.knowledge);
        await save();
        saved = await getSaved();
        assert.deepEqual(saved.question.personalKnowledgeIds, ['old-tag']);
        assert.deepEqual(saved.nodes.map(node => node.id), ['old-tag']);

        await open();
        await tag.fill('');
        await save();
        saved = await getSaved();
        assert.equal(saved.question.personalKnowledge, '');
        assert.deepEqual(saved.question.personalKnowledgeIds, []);
        assert.equal(saved.question.knowledge, '圆锥曲线');
        assert.deepEqual(saved.nodes.map(node => node.id), ['old-tag']);
        assert.equal(await card.locator('.library-personal-knowledge').count(), 0);

        await button(page, '个人知识点').click();
        const oldTreeItem = page.locator('.library-knowledge-tree').getByText(original.knowledge, { exact: true });
        await oldTreeItem.click();
        const other = questionCard(page, '共用旧知识点的另一道题');
        await button(other, '编辑').click();
        await other.getByRole('textbox', { name: '手动修改个人知识点' }).fill('点差法');
        await button(other, '确认更新').click();
        await button(other, '编辑').waitFor();
        await oldTreeItem.waitFor({ state: 'detached' });
        saved = await getSaved();
        assert.deepEqual(saved.nodes.map(node => node.name), ['点差法']);
        assert.deepEqual(saved.other.personalKnowledgeIds, [saved.nodes[0].id]);
        assertNoRuntimeErrors(harness);
    } finally { await harness.close(); }
});
