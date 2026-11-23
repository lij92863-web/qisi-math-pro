const test=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const H=require('./browser-harness');

test('single entry renders the focus subscripts in both prose and the angle', { timeout: 30000 }, async () => {
 const h = await H.startBrowserApp(3376);
 const { page } = h;
 try {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '单题录入', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '单题 LaTeX 源码' });
  const source = '1.[2025湖南长沙模拟]已知F_1, F_2为椭圆 $\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$ 的左、右焦点，求 $\\angle F_1MF_2$ 的最大值';
  await editor.fill(source);
  const preview = page.locator('.v-single-entry .v-entry-preview');
  await preview.locator('math').first().waitFor({ state: 'attached' });
  const subscripts = await preview.locator('msub').allTextContents();
  assert.deepEqual(subscripts, ['F1', 'F2', 'F1', 'F2']);
  assert.equal(await preview.locator('.latex-render-error').count(), 0);
  assert.equal(await editor.inputValue(), source);
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('单题录入能复制答案和解析源码，并把跨页 OCR 追加到解析末尾', { timeout: 30000 }, async () => {
 const h = await H.startBrowserApp(3378);
 const { page, context } = h;
 try {
  await page.setDefaultTimeout(6500);
  await page.setViewportSize({ width: 1600, height: 980 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.origin });
  const answer = '答案为 $\\sqrt{2}$。';
  const first = '(1) 设 $x=\\frac{1}{2}$，代入原式。\n$$\\begin{aligned}y&=2x+1\\\\&=2\\end{aligned}$$';
  const second = '(2) 由上一页得到 $y=2$，所以 $z=\\sqrt{y}$。';
  const uploaded = '(3) 因此结果为 $z=\\sqrt{2}$。';
  const sections = [answer, first, second];
  await H.installBrowserEngineInjection(page, { defaultResponse: ({ body }) => body.model === 'qwen-vl-ocr-latest'
   ? uploaded : { value: { text: sections.shift(), figures: [] } } });
  const openEntry = () => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '单题录入', exact: true }).click();
  await openEntry();
  const entry = page.locator('.v-single-entry');
  const tab = label => entry.getByRole('button', { name: label, exact: true }).click();
  const editor = entry.getByRole('textbox', { name: '单题 LaTeX 源码' });
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const copy = async (target, label, expected) => {
   await target.getByRole('button', { name: label, exact: true }).click();
   await target.getByRole('status').getByText('已复制 LaTeX', { exact: true }).waitFor();
   assert.equal((await clipboard()).replace(/\r\n/g, '\n'), expected);
  };
  const image = await page.evaluate(() => {
   const canvas = document.createElement('canvas');
   canvas.width = 600;
   canvas.height = 420;
   const ctx = canvas.getContext('2d');
   ctx.fillStyle = '#fff';
   ctx.fillRect(0, 0, canvas.width, canvas.height);
   ctx.fillStyle = '#222';
   ctx.fillText('Answer and solution', 40, 50);
   return canvas.toDataURL('image/png').split(',')[1];
  });
  const file = name => ({ name, mimeType: 'image/png', buffer: Buffer.from(image, 'base64') });
  const source = entry.locator('.v-source');
  await source.locator('input[type=file]').setInputFiles([file('第1页.png'), file('第2页.png')]);
  const crop = async pageName => {
   await source.getByRole('button', { name: pageName, exact: true }).click();
   const canvas = source.locator('.cropper-drag-box');
   await canvas.waitFor();
   const box = await canvas.boundingBox();
   await page.mouse.move(box.x + box.width * .05, box.y + box.height * .05);
   await page.mouse.down();
   await page.mouse.move(box.x + box.width * .8, box.y + box.height * .7, { steps:8 });
   await page.mouse.up();
   await source.getByRole('button', { name:'确认识别', exact:true }).click();
  };

  await tab('答案内容');
  await crop('第1页.png');
  await entry.getByRole('status').getByText('已回填答案', { exact: true }).waitFor();
  await copy(entry, '复制答案 LaTeX', answer);

  await tab('解析内容');
  await crop('第1页.png');
  await entry.getByRole('status').getByText('已回填解析', { exact: true }).waitFor();
  assert.equal(await editor.inputValue(), first);

  await crop('第2页.png');
  const result = page.locator('.v-selection-result');
  await result.getByText('查看选区 / 修改识别 LaTeX 源码', { exact: true }).click();
  const recognized = result.getByRole('textbox', { name: '截图识别结果' });
  await recognized.waitFor();
  assert.equal(await recognized.inputValue(), second);
  assert.equal(await editor.inputValue(), first);
  await copy(result, '复制本次识别 LaTeX', second);
  await result.getByRole('button', { name: /追加到解析末尾/ }).click();
  await entry.getByRole('status').getByText('已追加到解析末尾', { exact: true }).waitFor();
  await copy(entry, '复制解析 LaTeX', first + '\n' + second);

  await entry.locator('.v-entry-meta > summary').click();
  await entry.locator('.entry-side-panel input').setInputFiles(file('补充解析.png'));
  await entry.getByText('查看图片识别 LaTeX 源码', { exact: true }).click();
  const imageOcr = entry.getByRole('textbox', { name:'图片识别 LaTeX 源码' });
  assert.equal(await imageOcr.inputValue(), uploaded);
  await copy(entry, '复制图片识别 LaTeX', uploaded);
  await entry.getByRole('button', { name:'追加到解析末尾', exact:true }).click();
  const whole = first + '\n' + second + '\n\n' + uploaded;
  assert.equal(await editor.inputValue(), whole);
  await page.reload();
  await openEntry();
  await tab('解析内容');
  assert.equal(await editor.inputValue(), whole);
  await tab('答案内容');
  assert.equal(await editor.inputValue(), answer);
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('single entry cleans repeated crop OCR before insertion and can repair pasted text', { timeout: 30000 }, async () => {
 const h = await H.startBrowserApp(3375);
 const { page } = h;
 try {
  const raw = readFileSync(join(__dirname, '../fixtures/crop-ocr-echo.txt'), 'utf8');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '单题录入', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '单题 LaTeX 源码' });
  await editor.fill(raw);
  await page.getByRole('button', { name: '整理识别文本', exact: true }).click();
  const clean = await editor.inputValue();
  assert.equal((clean.match(/九江检测/g) || []).length, 1);
  assert.equal((clean.match(/^[A-D]\. /gm) || []).length, 4);
  assert.doesNotMatch(clean, /\\checkmark|\$\$/);
  await editor.fill('');

  await page.evaluate(text => {
   const app = Qisi.Runtime.getRuntimeDependency('AppProxy');
   app.videoRecognizeCrop = async () => text;
   app.videoRegion({ url: 'data:image/png;base64,', page: { number: 1 } });
  }, raw);
  await page.waitForFunction(expected => Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm.stem === expected, clean);
  assert.equal(await editor.inputValue(), clean);
  const preview = page.locator('.v-single-entry .v-entry-preview');
  const stemFormulas = await preview.locator('.math-content').first().locator('.katex annotation').allTextContents();
  assert.ok(stemFormulas.some(formula => formula.replace(/\s/g, '') === 'A(0,b)'), JSON.stringify(stemFormulas));
  assert.equal(await preview.locator('.gaokao-options > div:visible').count(), 4);
  assert.equal(await preview.locator('.latex-render-error, .katex-display').count(), 0);
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('单题录入一次回填题干及独立裁图，支持替换原图、编辑配图和补全属性', { timeout: 45000 }, async () => {
 const h = await H.startBrowserApp(3377);
 const { page } = h;
 try {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '单题录入', exact: true }).click();
  await H.installBrowserEngineInjection(page, { defaultResponse: ({body}) => {
   const prompt = body.messages[0].content;
   if (Array.isArray(prompt)) {
    assert.match(prompt.find(item => item.type === 'text').text, /同时定位/);
    return {value: {text: '14. 如图，在三棱锥 $P-ABC$ 中，$AB=BC=2\\sqrt{2}$，角的正弦值为 _。', figures: [[640, 130, 960, 890]]}};
   }
   assert.match(prompt, /"path":"空间向量与立体几何/);
   return {value: {type:'填空题', grade:'高二', diff:'较难', systemKnowledgeId:'k10-2-2', concepts:[{name:'线面角',aliases:[]}]}};
  } });
  const image = await page.evaluate(() => {
   const c = document.createElement('canvas');
   c.width = 800; c.height = 350;
   const ctx = c.getContext('2d');
   ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 800, 350);
   ctx.fillStyle = '#b00000'; ctx.fillRect(25, 40, 300, 32);
   ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
   ctx.beginPath(); ctx.moveTo(595, 67); ctx.lineTo(541, 265); ctx.lineTo(735, 264); ctx.closePath(); ctx.stroke();
   return c.toDataURL('image/png').split(',')[1];
  });
  const source = page.locator('.v-single-entry .v-source');
  const add = name => source.locator('input[type=file]').setInputFiles({name, mimeType:'image/png', buffer:Buffer.from(image,'base64')});
  await add('带图原题.png');
  const canvas = source.locator('.cropper-canvas');
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * .02, box.y + box.height * .02);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .98, box.y + box.height * .98, {steps:10});
  await page.mouse.up();
  await source.getByRole('button', {name:'确认识别', exact:true}).click();
  const editor = page.getByRole('textbox', {name:'单题 LaTeX 源码'});
  const preview = page.locator('.v-entry-preview');
  const figure = preview.locator('[data-image-id] img');
  await figure.waitFor();
  assert.match(await editor.inputValue(), /underline.*IMAGE:/s);
  assert.equal(await preview.locator('.latex-render-error').count(), 0);
  assert.equal(await page.locator('.v-selection-result').count(), 0);
  await page.getByRole('status').getByText('已回填题目和 1 张配图', {exact:true}).waitFor();
  const dimensions = await figure.evaluate(img => [img.naturalWidth, img.naturalHeight]);
  assert.ok(dimensions[0] > 220 && dimensions[0] < 350 && dimensions[1] > 200, JSON.stringify(dimensions));
  const blobSize = await page.evaluate(async () => (await db.images.toArray())[0].blob.size);
  assert.ok(blobSize > 100);

  await source.locator('.cropper-drag-box').click({position:{x:20,y:20}});
  await page.keyboard.press('Backspace');
  await source.getByRole('button', {name:'带图原题.png'}).waitFor({state:'detached'});
  assert.match(await editor.inputValue(), /三棱锥/);
  await figure.waitFor();
  await add('替换原图.png');
  await source.getByRole('button', {name:'替换原图.png'}).waitFor();

  await figure.click();
  await page.keyboard.press('Backspace');
  await figure.waitFor({state:'detached'});
  assert.doesNotMatch(await editor.inputValue(), /IMAGE:/);
  assert.match(await editor.inputValue(), /三棱锥/);

  await page.locator('.v-entry-meta summary').click();
  await page.getByRole('button', {name:'AI 补全属性', exact:true}).click();
  const suggestion = page.getByRole('region', {name:'单题属性建议'});
  await suggestion.getByText('填空题', {exact:true}).waitFor();
  await suggestion.getByRole('button', {name:'应用建议'}).click();
  await suggestion.waitFor({state:'detached'});
  const saved = await page.evaluate(() => {
   const q = Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm;
   return {grade:q.grade,type:q.type,diff:q.diff,system:q.systemKnowledgeId,personal:q.personalKnowledge,tags:q.tags};
  });
  assert.deepEqual(saved,{grade:'高二',type:'填空题',diff:'较难',system:'k10-2-2',personal:'线面角',tags:'线面角'});
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('review classifies attributes, reuses concepts and files independent knowledge IDs', { timeout: 30000 }, async () => {
 const h = await H.startBrowserApp(3373);
 const { page } = h;
 try {
  page.setDefaultTimeout(7000);
  const batchId = await H.seedReviewBatch(page, { batchId: 'review_multi_knowledge' });
  await page.evaluate(() => db.table('personalKnowledge').put({ id: 'tree', nodes: [
   { id: 'method-existing', name: '不联立', children: [] },
   { id: 'tangent-existing', name: '切点弦', children: [] }
  ] }));
  await page.reload();
  const nav = name => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true });
  await nav('批量录题').click();
  await H.callProxy(page, 'openBatchReview', batchId);
  await page.getByRole('button', { name: '知识点未设置' }).click();
  const knowledgeMenu = page.getByRole('group', { name: '个人知识点' });
  await knowledgeMenu.getByRole('searchbox', { name: '搜索个人知识点' }).fill('切点');
  assert.equal(await knowledgeMenu.getByRole('button', { name: '切点弦', exact: true }).count(), 1);
  assert.equal(await knowledgeMenu.getByRole('button', { name: '不联立', exact: true }).count(), 0);
  await page.getByRole('button', { name: '知识点未设置' }).click();
  const tags = page.getByRole('textbox', { name: '输入新标签' });
  const add = page.getByRole('button', { name: '添加标签', exact: true });
  await tags.fill('圆锥曲线\\点差法\\不联立解法');
  await tags.press('Enter');
  await page.getByRole('button', { name: /圆锥曲线 · 点差法 · 不联立/ }).waitFor();
  assert.equal(await tags.inputValue(), '');
  let calls = 0;
  await page.route('**/api/ai/chat', route => {
   const req = route.request();
   const prompt = req.postDataJSON().messages[0].content;
   assert.equal(req.url().startsWith(h.origin), true);
   calls++;
   const answer = calls === 1
    ? { type: '单选题', diff: '较难', grade: '高二', concepts: [
      { name: '不联立解法', aliases: [] },
      { name: '切点连线', aliases: ['切点弦'] },
      { name: '弦中点', aliases: [] }
     ] }
    : { matches: [{ index: 1, id: 'tangent-existing', equivalent: true }] };
   if (calls === 2) {
    assert.match(prompt, /tangent-existing/);
    assert.doesNotMatch(prompt, /method-existing/);
   }
   return route.fulfill({ json: { choices: [{ message: { content: JSON.stringify(answer) } }] } });
  });
  await page.getByRole('button', { name: 'AI 补全属性' }).click();
  const proposal = page.getByRole('complementary', { name: 'AI 属性建议' });
  await proposal.getByText('弦中点', { exact: true }).waitFor();
  assert.equal(await tags.inputValue(), '');
  await proposal.getByRole('button', { name: '应用建议' }).click();
  assert.equal(calls, 2);
  assert.equal(await tags.inputValue(), '弦中点');
  const names = () => page.evaluate(async () =>
   (await db.table('personalKnowledge').get('tree')).nodes.map(node => node.name));
  assert.deepEqual(await names(), ['不联立', '切点弦', '圆锥曲线', '点差法']);
  await add.click();
  await page.getByRole('button', { name: /点差法 · 不联立 · 切点弦 · 弦中点/ }).waitFor();
  await page.getByRole('button', { name: '确认审核', exact: true }).click();
  await page.getByRole('button', { name: '入库并下一题', exact: true }).click();
  const saved = await H.waitForDbSnapshot(page, state =>
   state.questions.some(row => row.admission?.draftId === batchId + '_q1'));
  const question = saved.questions.find(row => row.admission?.draftId === batchId + '_q1');
  assert.deepEqual([question.type, question.diff, question.grade], ['单选题', '较难', '高二']);
  assert.equal(new Set(question.personalKnowledgeIds).size, 5);
  assert.ok(question.personalKnowledgeIds.includes('method-existing'));
  assert.ok(question.personalKnowledgeIds.includes('tangent-existing'));
  await page.reload();
  const indexed = await page.evaluate(async id => {
   const question = await db.questions.get(id);
   const tree = (await db.table('personalKnowledge').get('tree')).nodes;
   tree.find(node => node.id === 'method-existing').name = '保留不联立法';
   const service = Qisi.LibraryService.createLibraryService({
    matchesFilters: Qisi.Utils.questionMatchesLibraryFilters, findKnowledgeNode: (nodes, name) => nodes.find(node => node.name === name)
   });
   return {
    selected: service.filterAndSort([question], { knowledgeType: 'personal', knowledgeTree: tree, knowledge: '保留不联立法' }).length,
    keyword: service.filterAndSort([question], { personalKnowledgeTree: tree, keyword: '保留不联立法' }).length,
    counts: Qisi.UiEvents.buildKnowledgeCounts(tree, 'personal', [question], q => q.personalKnowledge)
   };
  }, question.id);
  assert.equal(indexed.selected, 1);
  assert.equal(indexed.keyword, 1);
  assert.equal(indexed.counts['保留不联立法'], 1);
  assert.equal(indexed.counts['点差法'], 1);
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('review LaTeX calibration renders a guarded candidate and keeps draft changes explicit', {timeout:30000}, async () => {
 const h = await H.startBrowserApp(3371);
 const { page } = h;
 try {
  page.setDefaultTimeout(7000);
  const id = await H.seedReviewBatch(page, { batchId: 'review_latex_calibration' });
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '批量录题', exact: true }).click();
  await H.callProxy(page, 'openBatchReview', id);
  await page.getByRole('button', { name: /分屏编辑/ }).click();
  const editor = page.getByRole('textbox', { name: '题目 LaTeX 源码' });
  const body = 'B=\\left\\{x\\left|x\\in A且\\frac{1}{x}\\in A\\right.\\right\\}';
  const source = '已知集合 $A=\\{x\\mid x=m+\\sqrt{3}n\\}$，集合满足 $' + body + '$。\nA. Alpha\nB. Beta\nC. Gamma\nD. Delta';
  const revised = source.replace(body, body.replace('且', '\\text{且}'));
  await editor.fill(source);
  let response = revised.replace('frac{1}', 'frac{2}');
  await page.route('**/api/ai/chat', route => {
   const request = route.request();
   assert.ok(request.url().startsWith(h.origin));
   assert.match(request.postDataJSON().model, /^qwen/);
   assert.match(request.postDataJSON().messages[0].content, /校准下面源码的 LaTeX 排版/);
   return route.fulfill({ json: { choices: [{ message: { content: response } }] } });
  });
  const calibrate = page.getByRole('button', { name: 'AI 校准 LaTeX', exact: true });
  const candidate = page.getByRole('region', { name: 'LaTeX 校准对比' });
  const renderedSetB = scope => scope.locator('.katex annotation').filter({ hasText: /\\text\{且\}\\frac\{1\}\{x\}/ });
  const review = page.locator('.v-review-body .v-question-render');
  await calibrate.click();
  const status = page.locator('.v-review-ai [role="alert"]');
  await status.waitFor();
  assert.equal(await status.innerText(), '建议改动了原文、数学符号、选项或图片，已保留现有源码。');
  assert.equal(await candidate.count(), 0);
  assert.equal(await editor.inputValue(), source);

  response = revised;
  await calibrate.click();
  await renderedSetB(candidate).waitFor({ state: 'attached', timeout: 3000 });
  assert.equal(await editor.inputValue(), source);
  await editor.fill(source + ' ');
  await candidate.getByRole('button', { name: '采用校准' }).click();
  await page.getByText('编辑内容已更改，请按当前源码重新运行。', { exact: true }).waitFor();
  assert.equal(await editor.inputValue(), source + ' ');
  await editor.fill(source);
  await calibrate.click();
  await renderedSetB(candidate).waitFor({ state: 'attached' });
  await candidate.getByRole('button', { name: '采用校准' }).click();
  assert.equal(await editor.inputValue(), revised);
  await renderedSetB(review).waitFor({ state: 'attached' });
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  const snapshot = await H.waitForDbSnapshot(page, state => state.drafts.some(q => q.id === id + '_q1' && q.stem.includes('\\text{且}')));
  const saved = snapshot.drafts.find(q => q.id === id + '_q1');
  assert.deepEqual(saved.options, ['Alpha', 'Beta', 'Gamma', 'Delta']);
  assert.equal(saved.answer, 'A');
  await page.reload();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '批量录题', exact: true }).click();
  await H.callProxy(page, 'openBatchReview', id);
  await renderedSetB(review).waitFor({ state: 'attached' });
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('review support source stays editable and only adopts a rendered AI candidate on request', {timeout:30000}, async()=>{
 const h=await H.startBrowserApp(3359),{page}=h;
 try {
  page.setDefaultTimeout(7000);
  const id=await H.seedReviewBatch(page,{batchId:'review_support_editor'});
  await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'批量录题',exact:true}).click();
  await H.callProxy(page,'openBatchReview',id);
  await page.getByRole('button',{name:'解析内容',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'解析源码',exact:true});
  const preview=page.getByRole('region',{name:'渲染预览',exact:true});
  const manual=String.raw`手工推导：$\frac{1}{2}$。`;
  await editor.fill(manual);
  await preview.locator('.katex').waitFor();
  assert.equal(await editor.inputValue(),manual);
  const editorBox=await editor.boundingBox(),previewBox=await preview.boundingBox();
  assert.ok(previewBox.y>=editorBox.y+editorBox.height,'rendered preview is below the editor');
  let requests=0;
  const generated='由题意可得\n\n$$\\begin{aligned}x+1&=2\\\\x&=1\\end{aligned}$$\n\n故结果为 $x=1$。';
  await page.route('**/api/ai/chat',route=>{
   requests++;
   const body=route.request().postDataJSON();
   assert.match(body.model,/^qwen/);
   assert.match(body.messages[0].content,/当前高中数学题生成解析/);
   assert.equal(route.request().url().startsWith(h.origin),true);
   if (requests === 3) return route.fulfill({json:{choices:[{message:{content:[{type:'text',text:'### 推导\n由题意可得 r=1。'}]}}]}});
   const value=requests===1?'错误 $\\frac{1}{2':generated;
   return route.fulfill({json:{choices:[{message:{content:JSON.stringify({solution:value})}}]}});
  });
  await page.getByRole('button',{name:'AI 补全',exact:true}).click();
  const candidate=page.getByRole('region',{name:'AI 候选',exact:true});
  await candidate.locator('.katex-display').waitFor();
  assert.equal(requests,2);
  assert.equal(await editor.inputValue(),manual);
  await page.getByRole('button',{name:'采用候选',exact:true}).click();
  assert.equal(await editor.inputValue(),generated);
  await preview.locator('.katex-display').waitFor();
  await page.getByRole('button',{name:'保存修改',exact:true}).click();
  await H.waitForDbSnapshot(page,s=>s.drafts.some(q=>q.id===id+'_q1'&&q.solution===generated));
  await page.getByRole('button',{name:'AI 补全',exact:true}).click();
  await candidate.locator('.katex').waitFor();
  assert.equal(requests,3,'valid prose was repaired locally without a second model request');
  assert.equal(await editor.inputValue(),generated);
  await page.getByRole('button',{name:'采用候选',exact:true}).click();
  assert.match(await editor.inputValue(),/\$r=1\$/);
  H.assertNoRuntimeErrors(h);
 } finally { await h.close(); }
});

test('verified option updates persist and AI placement requires a unique current anchor and explicit acceptance', {timeout:30000}, async()=>{
 const h=await H.startBrowserApp(3349);
 try {
  const id=await H.seedReviewBatch(h.page,{batchId:'verified_crop'});
  await H.callProxy(h.page,'openBatchReview',id);
  await h.page.evaluate(()=>{const p=Qisi.Runtime.getRuntimeDependency('AppProxy');p.view='batchImport';p.video.split=true;});
  const stage=async text=>h.page.evaluate(text=>{
   const p=Qisi.Runtime.getRuntimeDependency('AppProxy');
   p.videoRecognizeCrop=async()=>text;
   p.videoRegion({url:'data:image/png;base64,',page:{number:1}});
  },text);
  await stage('<ol start="2"><li>$$$B . k_n=3^{n+1}$$$</li></ol>');
  await h.page.getByRole('button',{name:'按字母回填选项',exact:true}).click();
  await H.callProxy(h.page,'saveActiveDraftQuestion',{silent:true});
  const q=await h.page.evaluate(id=>db.draftQuestions.get(id+'_q1'),id);
  assert.deepEqual(q.options,['Alpha','$k_n=3^{n+1}$','Gamma','Delta']);
  assert.doesNotMatch(q.stem,/html|<li>|Gamma/);
  let anchor='missing';
  await h.page.route('**/api/ai/chat',route=>route.fulfill({json:{choices:[{message:{content:JSON.stringify({field:'stem',operation:'replace',anchor})}}]}}));
  await stage('修正后的题干');
  const locate=h.page.getByRole('button',{name:'千问定位回填',exact:true});
  await locate.click();
  await h.page.getByText(/未找到可以唯一核对的位置/).waitFor();
  const editor=h.page.getByRole('textbox',{name:'题目 LaTeX 源码',exact:true}), old=await editor.inputValue();
  anchor=q.stem;
  await locate.click();
  const apply=h.page.getByRole('button',{name:'确认按建议回填',exact:true});
  await apply.waitFor();assert.equal(await editor.inputValue(),old);
  await editor.fill(old+' ');
  assert.equal(await apply.count(),0);
  await locate.click();await apply.click();
  assert.ok((await editor.inputValue()).includes('修正后的题干'));
  await H.callProxy(h.page,'saveActiveDraftQuestion',{silent:true});
  const saved=await h.page.evaluate(id=>db.draftQuestions.get(id+'_q1'),id);
  assert.equal(saved.stem,'修正后的题干');assert.deepEqual(saved.options,q.options);
  const clean=await editor.inputValue();
  await editor.fill(clean+'\nhtml\n<ol><li>C. Gamma</li><li>D. Delta</li></ol>');
  await h.page.getByRole('button',{name:'移除末尾重复识别块',exact:true}).click();
  assert.equal((await editor.inputValue()).trimEnd(),clean.trimEnd());
  await stage('求 $\\unknownmathcommand{2}$');
  await h.page.getByText(/识别结果仍含排版标记或公式错误/).waitFor();
  await H.callProxy(h.page,'videoAssign','stem');
  assert.equal((await editor.inputValue()).trimEnd(),clean.trimEnd());
  await stage('另一段题干');
  await editor.evaluate(el=>{
    const start=el.value.indexOf('修正后的题干');
    el.focus();el.setSelectionRange(start,start+'修正后的题干'.length);
    el.dispatchEvent(new Event('select',{bubbles:true}));
  });
  await h.page.getByRole('button',{name:'替换选中文字',exact:true}).click();
  assert.equal(await editor.inputValue(),clean.trimEnd().replace('修正后的题干','另一段题干'));
  assert.equal(await h.page.evaluate(()=>db.questions.count()),0);
  H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});
test('single entry resizes and moves the crop before confirming OCR, then clears the frame and keeps the result', {timeout:45000}, async()=>{
 const h=await H.startBrowserApp(3335);
 try{
  await h.page.setViewportSize({width:1600,height:1000});
  const external=[];h.page.on('request',r=>{if(!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(r.url())&&!/^(data|blob):/.test(r.url()))external.push(r.url());});
  const options = String.raw`<ol><li>A. $32\pi$$</li><li>B. $$26\pi$$</li><li>C. 16\pi$$</li><li>D. $8\pi$</li></ol>`;
  const normalizedOptions = String.raw`A. $32\pi$
B. $26\pi$
C. $16\pi$
D. $8\pi$`;
  let calls=0;
  await h.page.route('**/api/ai/chat',async route=>{
   const body=route.request().postDataJSON();
   assert.equal(body.max_tokens,4096);
   if (body.model === 'qwen-vl-ocr') return route.fulfill({status:404,json:{error:{code:'model_not_found'}}});
   calls++;
   assert.match(body.model, /qwen.*vl/);
   const content = calls === 1 ? '{}' : JSON.stringify({
    text: calls === 2 ? options : '(2) 若 $c=\\sqrt{7}$，面积为 $\\frac{3\\sqrt{3}}{2}$，求 $a+b$。',
    figures: []
   });
   await route.fulfill({json:{choices:[{message:{content}}]}});
  });
  await h.page.evaluate(()=>{const p=Qisi.Runtime.getRuntimeDependency('AppProxy');p.view='entry';p.entryForm.stem='已有题干';p.entryTab='stem';});
  const image=await h.page.evaluate(()=>{const c=document.createElement('canvas');c.width=700;c.height=950;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,700,950);x.fillStyle='black';x.font='22px serif';x.fillText('Question 1.  x^2 + y^2 = 1',50,100);x.fillText('(2) Find a + b.',50,180);return c.toDataURL('image/png').split(',')[1];});
  const source = h.page.locator('.v-single-entry .v-source');
  await source.locator('input[type=file]').setInputFiles({name:'试卷.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  const canvas = source.locator('.cropper-canvas');
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  const drag = async (x, y, dx, dy) => {
   await h.page.mouse.move(x, y);
   await h.page.mouse.down();
   await h.page.mouse.move(x + dx, y + dy, {steps:8});
   await h.page.mouse.up();
  };
  const confirm = source.getByRole('button', {name:'确认识别', exact:true});
  const frame = source.locator('.cropper-crop-box');
  await drag(box.x + box.width * .08, box.y + box.height * .08, box.width * .6, box.height * .15);
  await confirm.waitFor();
  assert.equal(calls, 0);
  assert.equal(await frame.locator('.cropper-point:visible').count(), 4);

  const before = await frame.boundingBox();
  const handle = await frame.locator('.point-se').boundingBox();
  await drag(handle.x + handle.width / 2, handle.y + handle.height / 2, 30, 35);
  const resized = await frame.boundingBox();
  assert.ok(resized.width > before.width + 20 && resized.height > before.height + 20);
  await drag(resized.x + resized.width / 2, resized.y + resized.height / 2, 20, 25);
  const moved = await frame.boundingBox();
  assert.ok(moved.x > resized.x + 15 && moved.y > resized.y + 20);
  assert.ok(Math.abs(moved.width - resized.width) < 1 && Math.abs(moved.height - resized.height) < 1);
  assert.equal(calls, 0);
  assert.equal(await h.page.locator('.v-selection-result').count(), 0);
  await confirm.click();
  await h.page.getByText(/千问服务找不到当前 OCR 模型或接口/).waitFor();
  assert.equal(calls, 1);
  await frame.waitFor({state:'hidden'});
  const crop = await h.page.evaluate(() => Qisi.Runtime.getRuntimeDependency('AppProxy').video.region.bbox);
  const expected = [(moved.x - box.x) / box.width, (moved.y - box.y) / box.height,
   (moved.x + moved.width - box.x) / box.width, (moved.y + moved.height - box.y) / box.height];
  expected.forEach((value, i) => assert.ok(Math.abs(crop[i] - value) < .01, JSON.stringify({crop, expected})));
  assert.equal(await h.page.getByRole('button',{name:'添加到题目 ⏎ 1',exact:true}).isDisabled(),true);
  assert.equal(await h.page.getByRole('button',{name:'作为插图 I',exact:true}).isEnabled(),true);
  await h.page.getByRole('button',{name:'重新识别选区',exact:true}).click();
  await h.page.waitForFunction(expected=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.result===expected, normalizedOptions);
  assert.equal(calls,2);
  assert.equal(await h.page.locator('.v-result-preview .katex').count(),4);
  assert.equal(await h.page.locator('.v-result-preview .latex-render-error').count(),0);
  assert.doesNotMatch(await h.page.locator('.v-result-preview').innerText(),/<\/?(?:ol|li)>/);
  await h.page.getByRole('button',{name:'重新识别选区',exact:true}).click();
  await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.result.includes('sqrt'));
  assert.equal(calls,3);
  const cdp=await h.context.newCDPSession(h.page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');
  for(const [selector,family] of [['.v-entry-preview [data-question-stem]','SimSun'],['.v-result-preview .katex .mathnormal','KaTeX_Math'],['.v-entry-toolbar button','Microsoft YaHei']]){
   const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});assert.ok(fonts.some(f=>f.familyName===family),JSON.stringify(fonts));
  }
  await h.page.getByRole('button',{name:'追加到题末',exact:true}).click();
  const stem=await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm.stem);
  assert.match(stem,/^已有题干/);assert.match(stem,/sqrt/);assert.equal(await source.locator('.v-source-mark').count(),0);
  assert.equal(await h.page.locator('.v-selection-result').count(),0);
  assert.deepEqual(external,[]);
  const expected404=h.consoleErrors.findIndex(message=>message.includes('a status of 404'));
  assert.ok(expected404>=0,'the intentional OCR HTTP 404 was observed');
  h.consoleErrors.splice(expected404,1);
  await drag(box.x + box.width * .08, box.y + box.height * .08, box.width * .6, box.height * .15);
  await confirm.waitFor();
  await h.page.keyboard.press('Escape');
  await frame.waitFor({state:'hidden'});
  await confirm.waitFor({state:'hidden'});
  assert.equal(calls,3);
  H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});
test('late OCR response cannot append to another review question', {timeout:30000},async()=>{
 const h=await H.startBrowserApp(3336);
 try{
  const id=await H.seedReviewBatch(h.page,{batchId:'video_late'});await H.callProxy(h.page,'openBatchReview',id);
  await h.page.evaluate(()=>{const p=Qisi.Runtime.getRuntimeDependency('AppProxy');p.view='batchImport';p.videoRecognizeCrop=()=>new Promise(ok=>window.finishVideoOcr=ok);p.videoRegion({url:'data:image/png;base64,',page:{number:1}});});
  const next=await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').batchDraftQuestions[1].id);
  await H.callProxy(h.page,'videoSelect',next);
  await h.page.evaluate(()=>window.finishVideoOcr('stale OCR text'));
  assert.equal(await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.result),'');
  assert.equal(await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.region),null);
  await h.page.evaluate(()=>{const p=Qisi.Runtime.getRuntimeDependency('AppProxy');p.videoRegion({url:'data:image/png;base64,',page:{number:1}});p.videoCancel();window.finishVideoOcr('cancelled text');});
  assert.equal(await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.busy),false);
  assert.equal(await h.page.locator('.v-selection-result').count(),0);
  H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});

test('review crop preserves draft ownership and uses the existing guarded figure command', {timeout:30000},async()=>{
 const h=await H.startBrowserApp(3337);
 try{
  const id=await H.seedReviewBatch(h.page,{batchId:'video_review_crop'});
  await h.page.evaluate(async id=>{
   const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,600,800);x.fillStyle='black';x.strokeRect(90,90,200,200);
   const q=await db.draftQuestions.get(id+'_q1');q.sourceFileId=id+'_docx';q.sourcePage=1;q.sourcePageImage=c.toDataURL('image/png');await db.draftQuestions.put(q);
  },id);
  await H.callProxy(h.page,'openBatchReview',id);await h.page.evaluate(()=>{const p=Qisi.Runtime.getRuntimeDependency('AppProxy');p.view='batchImport';p.videoRecognizeCrop=async()=>'$x^2$';});
  assert.equal(await h.page.locator('.v-review-grid').getByRole('button',{name:/^(暂停|开启)截图识别 X$/}).getAttribute('aria-pressed'),'true');
  await h.page.locator('.v-review-grid .cropper-container').waitFor();
  const box=await h.page.locator('.v-review-grid .cropper-container').boundingBox();
  await h.page.mouse.move(box.x+box.width*.1,box.y+box.height*.1);await h.page.mouse.down();await h.page.mouse.move(box.x+box.width*.6,box.y+box.height*.4,{steps:5});await h.page.mouse.up();
  await h.page.waitForFunction(()=>!Qisi.Runtime.getRuntimeDependency('AppProxy').video.busy);
  await h.page.getByRole('button',{name:'作为插图 I',exact:true}).click();
  await h.page.waitForFunction(async id=>(await db.draftImages.toArray()).some(i=>i.questionId===id+'_q1'&&i.source==='manual-crop'),id);
  await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.region===null);
  const result=await h.page.evaluate(async id=>{const q=await db.draftQuestions.get(id+'_q1');return {q,formal:await db.questions.count(),images:await db.draftImages.toArray()};},id);
  assert.equal(result.formal,0);assert.equal(result.q.options.length,4);assert.equal(result.q.images[0].source,'manual-crop');
  assert.equal(result.q.images[0].questionId,id+'_q1');assert.ok(result.q.images[0].url.startsWith('data:image/png'));
  H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});


test('single-entry crop image failure retains the selection for explicit retry and successful retry persists bytes', {timeout:30000},async()=>{
 const h=await H.startBrowserApp(3338);
 try{
  const image = await h.page.evaluate(() => {
   const p=Qisi.Runtime.getRuntimeDependency('AppProxy');p.view='entry';p.entryTab='stem';
   const c=document.createElement('canvas');c.width=50;c.height=50;const ctx=c.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,50,50);
   window.entryCropOcrCalls = 0;
   p.videoRecognizeCrop = async () => { window.entryCropOcrCalls++; return 'cropped figure'; };
   window.originalVideoUpload=p.videoUploadCrop;p.videoUploadCrop=async()=>false;
   return c.toDataURL('image/png').split(',')[1];
  });
  const source = h.page.locator('.v-single-entry .v-source');
  await source.locator('input[type=file]').setInputFiles({name:'插图.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  const canvas = source.locator('.cropper-canvas');
  await canvas.waitFor();
  const box = await canvas.boundingBox();
  await h.page.mouse.move(box.x + box.width * .1, box.y + box.height * .1);
  await h.page.mouse.down();
  await h.page.mouse.move(box.x + box.width * .6, box.y + box.height * .4, {steps:5});
  await h.page.mouse.up();
  await source.getByRole('button',{name:'作为插图',exact:true}).click();
  await h.page.locator('.v-selection-result .v-error').waitFor();
  assert.equal(await h.page.locator('.v-selection-result').count(),1);
  assert.match(await h.page.locator('.v-selection-result .v-error').innerText(),/选区已保留/);
  assert.equal(await h.page.evaluate(()=>db.images.count()),0);
  await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').videoUploadCrop=window.originalVideoUpload;});
  await h.page.getByRole('button',{name:'作为插图 I',exact:true}).click();
  await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.region===null);
  assert.equal(await h.page.evaluate(()=>db.images.count()),1);
  assert.ok(await h.page.evaluate(async()=>(await db.images.toArray())[0].blob.size>0));
  assert.match(await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').entryForm.stem),/IMAGE:/);
  assert.equal(await h.page.evaluate(() => window.entryCropOcrCalls), 0);
  await source.locator('.cropper-crop-box').waitFor({state:'hidden'});
  H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});


test('review separates question frames, free OCR selections and persistent manual frame corrections', {timeout:45000},async()=>{
 const h=await H.startBrowserApp(3339);
 try{
  const path=require('node:path'),{installMineruReplay}=require('../harness/mineru-replay');
  const pdf=path.resolve(__dirname,'../fixtures/true-import/pdf-question.pdf');
  const replay=await installMineruReplay(h.page,[{file:pdf,items:[
   {page_idx:0,type:'text',text:'1. 第一题',bbox:[100,100,900,250]},
   {page_idx:0,type:'text',text:'2. 第二题',bbox:[100,300,900,450]}
  ]}]);
  const imported=await H.createImportThroughUi(h.page,{files:[{file:pdf,roles:['full']}]});
  await h.page.setViewportSize({width:2240,height:1000});
  await h.page.getByRole('button',{name:'← 返回列表',exact:true}).click();
  const createButton = await h.page.locator('.v-title-row .batch-home-upload').boundingBox();
  assert.ok(createButton.height >= 44 && createButton.height <= 56);
  const taskSearch = h.page.getByRole('searchbox', { name: '搜索文件名' });
  await taskSearch.fill('没有这个文件');
  await h.page.getByText('没有匹配的识别任务', { exact: true }).waitFor();
  await h.page.getByRole('button', { name: '清除筛选' }).click();
  assert.equal(await taskSearch.inputValue(), '');
  const fileFont = await h.page.locator('.v-task-table .v-file-label').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  assert.ok(fileFont >= 16);
  const columns=await h.page.locator('.v-task-table .batch-job-row').first().evaluate(row=>{
   const headers=[...row.closest('table').tHead.rows[0].cells];
   return [...row.cells].map((cell,index)=>Math.abs(cell.getBoundingClientRect().left-headers[index].getBoundingClientRect().left));
  });
  assert.equal(columns.length,7);
  assert.ok(columns.every(delta=>delta<1),'every cell aligns with its header');
  await h.page.locator('.v-task-table').getByRole('button',{name:'详情',exact:true}).click();
  await h.page.locator('.v-overview').waitFor();
  await h.page.getByPlaceholder('搜索题目内容').fill('第二题');
  await h.page.getByRole('button',{name:'选择当前结果',exact:true}).click();
  assert.equal(await h.page.locator('.v-overview input[type=checkbox]:checked').count(),1);
  assert.match(await h.page.locator('.v-bulk-bar').innerText(),/已选 1 题/);
  await h.page.getByRole('button',{name:'← 返回列表',exact:true}).click();
  await h.page.locator('.v-task-table').getByRole('button',{name:'审核',exact:true}).click();
  await H.callProxy(h.page,'openBatchReview',imported.batchId);
  await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').view='batchImport';});
  const source=h.page.locator('.v-review-grid .v-source');
  const second=source.getByRole('button',{name:'题 2',exact:true});
  await second.waitFor();
  const before=await H.getDbSnapshot(h.page);
  assert.equal(await source.locator('.v-question-frame').count(),2);
  assert.equal(await source.locator('.v-question-frame.current').count(),1);
  assert.equal(await source.locator('.v-source-mark').count(),0,'no manual regions before dragging');
  const pageImage=source.locator('.cropper-drag-box').first();
  await pageImage.waitFor();
  const bounds=await pageImage.boundingBox();
  const first=source.getByRole('button',{name:'题 1',exact:true});
  await pageImage.click({position:{x:bounds.width*.5,y:bounds.height*.27}});
  assert.equal(await first.getAttribute('aria-current'),'true','space between evidence blocks does not switch questions');
  await pageImage.click({position:{x:bounds.width*.5,y:bounds.height*.35}});
  await h.page.waitForFunction(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftQuestion.questionNumber==='2');
  assert.equal(await second.getAttribute('aria-current'),'true');
  assert.match(await h.page.locator('.v-question-render').innerText(),/第二题/);
  await first.click();
  await second.click();
  assert.equal(await second.getAttribute('aria-current'),'true');
  const crop=source.getByRole('button',{name:/^(暂停|开启)截图识别 X$/});
  await crop.click();
  assert.equal(await source.locator('.cropper-container').count(),0);
  await crop.click();
  await pageImage.waitFor();
  await h.page.evaluate(()=>{window.freeOcr=[];Qisi.Runtime.getRuntimeDependency('AppProxy').videoRecognizeCrop=async url=>{
    const image=new Image();image.src=url;await image.decode();window.freeOcr.push([image.width,image.height]);return '选区 '+window.freeOcr.length+'，$x^2$';
  };});
  const drag = async (x1,y1,x2,y2) => {
    const b=await source.locator('.cropper-container').first().boundingBox();
    await h.page.mouse.move(b.x+b.width*x1,b.y+b.height*y1);await h.page.mouse.down();
    await h.page.mouse.move(b.x+b.width*x2,b.y+b.height*y2,{steps:9});await h.page.mouse.up();
  };
  await drag(.70,.39,.40,.35);
  await h.page.locator('.v-result-preview .katex').last().waitFor();
  assert.deepEqual(await h.page.locator('.v-result-preview .katex').last().evaluate(el=>{
    const math=getComputedStyle(el),body=getComputedStyle(el.closest('.math-content'));
    return [math.fontSize===body.fontSize,math.fontWeight];
  }),[true,'400']);
  const dimensions=await h.page.evaluate(()=>window.freeOcr[0]);
  const natural=await source.getByAltText('原卷页面').first().evaluate(el=>[el.naturalWidth,el.naturalHeight]);
  assert.ok(Math.abs(dimensions[0]-natural[0]*.30)<=3 && Math.abs(dimensions[1]-natural[1]*.04)<=3,JSON.stringify({dimensions,natural,bounds}));
  await drag(.04,.065,.20,.09);
  await h.page.waitForFunction(()=>window.freeOcr.length===2);
  await h.page.getByRole('button',{name:'保留并继续框选'}).click();
  assert.equal(await source.locator('.v-source-mark button').count(),2,'both independent selections remain available');
  await source.getByRole('button',{name:'选区 1',exact:true}).click();
  assert.match(await h.page.locator('.v-result-preview').innerText(),/选区/);
  assert.match(await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').video.result),/^选区 1/);
  await h.page.getByRole('button',{name:'添加到答案 2',exact:true}).click();
  assert.match(await h.page.evaluate(()=>Qisi.Runtime.getRuntimeDependency('AppProxy').activeDraftQuestion.answer),/选区 1/);
  assert.equal(await h.page.evaluate(()=>window.freeOcr.length),2,'reopening a ready result does not call Qwen again');
  await source.getByRole('button',{name:'校正题框'}).click();
  await drag(.09,.31,.83,.44);
  const frame=await source.locator('.v-question-frame.current').boundingBox();
  assert.ok(Math.abs(frame.width-bounds.width*.74)<3);
  assert.equal(await h.page.evaluate(()=>window.freeOcr.length),2,'correcting the outer frame sends no OCR');
  const editor=h.page.locator('.v-review-body');
  const layout=()=>editor.evaluate(el=>{
   const pane=el.closest('.v-review-right');
   return { top:el.offsetTop-pane.offsetTop, height:el.offsetHeight, width:el.offsetWidth };
  });
  const beforeMenu=await layout();
  const caret=await h.page.locator('.v-question-render .math-content').first().evaluate(el=>getComputedStyle(el).caretColor);
  assert.equal(caret,'rgba(0, 0, 0, 0)');
  for(const [label,option] of [['题型','解答题'],['难度','中等'],['年级','高二']]){
   const tag=h.page.locator('.v-attributes').getByRole('button',{name:new RegExp('^'+label)});
   await tag.click();
   const dropdown=h.page.getByRole('group',{name:label,exact:true});
   assert.deepEqual(await layout(),beforeMenu,'opening the dropdown leaves the editor in place');
   await dropdown.getByRole('button',{name:option,exact:true}).click();
   assert.match(await tag.innerText(),new RegExp(option));
   assert.deepEqual(await layout(),beforeMenu,'metadata editing does not move or resize the editor');
  }
  assert.deepEqual(await H.getDbSnapshot(h.page),before);
  await h.page.reload();
  await h.page.locator('.v-topnav nav').getByRole('button',{name:'批量录题',exact:true}).click();
  await h.page.locator('.v-task-table').getByRole('button',{name:'审核',exact:true}).click();
  await source.getByRole('button',{name:'题 2',exact:true}).click();
  assert.ok(Math.abs((await source.locator('.v-question-frame.current').boundingBox()).width-frame.width)<3,'manual frame survives reopening');
  assert.equal(replay.calls.filter(p=>p.endsWith('/parse')).length,1);
  assert.equal(before.questions.length,0);H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});


test('a repeated confirmation message keeps the full lifetime of its latest operation', {timeout:30000},async()=>{
 const h=await H.startBrowserApp(3340);
 try{
  const id=await H.seedReviewBatch(h.page,{batchId:'video_toast'});await H.callProxy(h.page,'openBatchReview',id);
  await h.page.evaluate(()=>{Qisi.Runtime.getRuntimeDependency('AppProxy').view='batchImport';});
  await h.page.clock.install();
  await H.callProxy(h.page,'markDraftReviewed');
  await h.page.clock.fastForward(1400);
  await H.callProxy(h.page,'markDraftReviewed');
  await h.page.clock.fastForward(500);
  assert.match(await h.page.locator('.batch-toast').innerText(),/已标记为确认/);
  await h.page.clock.fastForward(1400);
  assert.equal(await h.page.locator('.batch-toast').count(),0);
  assert.equal((await H.getDbSnapshot(h.page)).questions.length,0);
  H.assertNoRuntimeErrors(h);
 }finally{await h.close();}
});
