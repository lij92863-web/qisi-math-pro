const test = require('node:test');
const assert = require('node:assert/strict');

const Model = require('../qisi-handout-model.js');
const Html = require('../qisi-handout-html.js');

// 假渲染器：模拟 app.js 的 renderLatexForPrint —— 普通文字会被转义，
// 公式会被换成 KaTeX 的 HTML。测试用不到真 KaTeX。
function fakeRender(text) {
    return '<span class="math">' + String(text).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]) + '</span>';
}

const bank = () => ([
    { id: 'q1', type: '单选题', stem: '已知 $f(x)=x^2$，则 $f\'(1)=$', options: ['$1$', '$2$', '$3$', '$4$'], answer: 'B', solution: '$f\'(x)=2x$' },
    { id: 'q2', type: '填空题', stem: '计算 $\\int_0^1 x\\,dx$。', answer: '$\\frac{1}{2}$' },
    { id: 'q3', type: '解答题', stem: '证明：函数 $f(x)=x^3$ 在 $\\mathbb{R}$ 上单调递增。', answer: '略', solution: '求导后恒非负。' }
]);

function makeDoc(extra = {}) {
    return Model.createDoc({
        title: '导数的应用',
        subtitle: '高二数学 · 课时学案',
        blocks: [
            { type: 'heading', text: '一、知识梳理' },
            { type: 'note', text: '导数 $f\'(x)$ 的几何意义。' },
            { type: 'question', questionId: 'q1' },
            { type: 'question', questionId: 'q2' },
            { type: 'divider' },
            { type: 'question', questionId: 'q3' }
        ],
        ...extra
    });
}

const build = (doc, questions, options = {}) =>
    Html.buildHtml(doc, questions, { renderLatex: fakeRender, ...options });

const indexes = html => [...html.matchAll(/<span class="q-index">(\d+)\.<\/span>/g)].map(match => match[1]);
const questionChunks = html => html.split('<div class="exam-question"').slice(1);
const codes = result => result.issues.map(item => item.code);

test('正常 3 题讲义：题号 1/2/3 连续，不按题型分组', () => {
    const result = build(makeDoc(), bank(), { answerSpace: false });

    assert.deepEqual(result.issues, []);
    assert.deepEqual(indexes(result.html), ['1', '2', '3']);
    // 单选题、填空题、解答题混在一起，仍然是 1.2.3.，没有「一、单选题」。
    assert.ok(!result.html.includes('group-title'));
    assert.ok(result.html.includes('导数的应用'));
    assert.ok(!result.html.includes('《导数的应用》'), '标题必须原样输出，模块不替老师加书名号');
});

test('每个题目块都带 break-inside: avoid，且结构复用试卷类名', () => {
    const { html } = build(makeDoc(), bank());
    const chunks = questionChunks(html);

    assert.equal(chunks.length, 3);
    chunks.forEach(chunk => {
        assert.ok(chunk.includes('break-inside:avoid'), '题目块内联样式必须禁止跨页切断');
        assert.ok(chunk.includes('page-break-inside:avoid'));
    });
    assert.ok(html.includes('.handout .exam-question'));
    assert.ok(html.includes('.question-row'));
    assert.ok(html.includes('.q-index'));
    assert.ok(html.includes('.question-flow-body'));
});

test('选择题选项复用 gaokao-options / gaokao-option / option-label / option-content', () => {
    const { html } = build(makeDoc(), bank());

    assert.ok(html.includes('class="gaokao-options qisi-flow-options"'));
    assert.match(html, /<div class="gaokao-option"><span class="option-label">A\.<\/span><span class="option-content">/);
    assert.ok(html.includes('>D.</span>'));
    // 填空题、解答题没有选项区。
    assert.equal((html.match(/class="gaokao-options/g) || []).length, 1);
});

test('答案和解析由 showAnswer / showSolution 控制', () => {
    const onlyAnswer = build(makeDoc({ showAnswer: true }), bank(), { answerSpace: false }).html;
    assert.ok(onlyAnswer.includes('class="print-answer"'));
    assert.ok(!onlyAnswer.includes('class="print-solution"'));

    const both = build(makeDoc({ showAnswer: true, showSolution: true }), bank(), { answerSpace: false }).html;
    assert.ok(both.includes('class="print-answer"'));
    assert.ok(both.includes('class="print-solution"'));

    const neither = build(makeDoc(), bank()).html;
    assert.ok(!neither.includes('class="print-answer"'));
    assert.ok(!neither.includes('class="print-solution"'));
});

test('留白：正常高度按 mm 输出，且留白块禁止跨页', () => {
    const { html } = build(makeDoc(), bank(), { answerSpace: { show: true, heightMm: 24 } });
    const blanks = [...html.matchAll(/<div class="handout-answer-space" style="height:([\d.]+)mm;break-inside:avoid;page-break-inside:avoid"><\/div>/g)];

    assert.equal(blanks.length, 3);
    assert.deepEqual(blanks.map(match => match[1]), ['24', '24', '24']);
});

test('留白：0 不生成空白块', () => {
    const { html, issues } = build(makeDoc(), bank(), { answerSpace: { show: true, heightMm: 0 } });
    assert.equal((html.match(/<div class="handout-answer-space"/g) || []).length, 0);
    assert.deepEqual(issues, []);
});

test('留白：负数被夹到 0，不生成负 margin，并记 issue', () => {
    const { html, issues } = build(makeDoc(), bank(), { answerSpace: { show: true, heightMm: -20 } });

    assert.equal((html.match(/<div class="handout-answer-space"/g) || []).length, 0);
    assert.ok(!/height:-/.test(html));
    assert.ok(codes({ issues }).includes('answer-space-invalid'));
});

test('留白：过大被夹到 120mm 并记 issue', () => {
    const { html, issues } = build(makeDoc(), bank(), { answerSpace: 500 });
    const heights = [...html.matchAll(/height:([\d.]+)mm/g)].map(match => Number(match[1]));

    assert.deepEqual(heights, [120, 120, 120]);
    assert.ok(codes({ issues }).includes('answer-space-clamped'));
});

test('留白：非法数字不崩，按无留白处理', () => {
    const { html, issues } = build(makeDoc(), bank(), { answerSpace: { show: true, heightMm: '两行' } });
    assert.equal((html.match(/<div class="handout-answer-space"/g) || []).length, 0);
    assert.ok(codes({ issues }).includes('answer-space-invalid'));
});

test('留白：单题可以用 answerSpaceMm 覆盖全局设置', () => {
    const doc = makeDoc();
    doc.blocks = doc.blocks.map(block =>
        block.type === 'question' && block.questionId === 'q2' ? { ...block, answerSpaceMm: 8 } : block
    );

    const heights = [...build(doc, bank(), { answerSpace: 24 }).html.matchAll(/height:([\d.]+)mm/g)]
        .map(match => Number(match[1]));

    assert.deepEqual(heights, [24, 8, 24]);
});

test('题干为空：记 issue，仍然生成题目块，不崩', () => {
    const questions = bank();
    questions[1] = { ...questions[1], stem: '' };

    const result = build(makeDoc(), questions, { answerSpace: false });
    assert.ok(codes(result).includes('empty-stem'));
    assert.equal(questionChunks(result.html).length, 3);
    assert.deepEqual(indexes(result.html), ['1', '2', '3']);
});

test('renderLatex 返回空字符串：记 issue，其余题目照常输出', () => {
    const result = Html.buildHtml(makeDoc(), bank(), {
        renderLatex: (text) => String(text).includes('\\int_0^1') ? '' : fakeRender(text),
        answerSpace: false
    });

    assert.ok(codes(result).includes('empty-render'));
    assert.deepEqual(indexes(result.html), ['1', '2', '3']);
});

test('renderLatex 抛错：不向外抛，降级为转义原文', () => {
    const result = Html.buildHtml(makeDoc(), bank(), {
        renderLatex: () => { throw new Error('KaTeX 尚未加载'); },
        answerSpace: false
    });

    assert.ok(codes(result).includes('render-error'));
    assert.equal(questionChunks(result.html).length, 3);
    assert.ok(result.html.includes('handout-render-fallback'));
});

test('HTML 转义：标题、区块标题里的 <script> 必须被转义', () => {
    const doc = Model.createDoc({
        title: '<script>alert(1)</script>',
        className: '高二(3)班',
        blocks: [
            { type: 'heading', text: '<img src=x onerror=alert(1)>' },
            { type: 'question', questionId: 'q1' }
        ]
    });

    const { html } = build(doc, bank());
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('HTML 转义：题干经过 renderLatex 后的普通文字被转义（渲染器负责转义）', () => {
    const questions = bank();
    questions[0] = { ...questions[0], stem: '<script>alert(1)</script>' };

    const { html } = build(makeDoc(), questions, { answerSpace: false });
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('renderLatex 返回的 HTML 不能再被转义，否则公式变成源码', () => {
    const katexHtml = '<span class="katex"><span class="katex-mathml">x</span></span>';
    const { html } = Html.buildHtml(makeDoc(), bank(), {
        renderLatex: () => katexHtml,
        answerSpace: false
    });

    assert.ok(html.includes(katexHtml));
    assert.ok(!html.includes('&lt;span class="katex"'));
});

test('题号与出现顺序不一致：记 number-mismatch，仍按锁定题号输出', () => {
    const doc = makeDoc();
    doc.blocks = doc.blocks.map(block =>
        block.type === 'question' && block.questionId === 'q2' ? { ...block, questionNo: 9 } : block
    );

    const result = build(doc, bank(), { answerSpace: false });
    assert.ok(codes(result).includes('number-mismatch'));
    assert.deepEqual(indexes(result.html), ['1', '9', '3']);
});

test('引用的题不在 questions 里：记 missing-question 并跳过，不崩', () => {
    const doc = Model.createDoc({
        blocks: [{ type: 'question', questionId: 'q1' }, { type: 'question', questionId: 'gone' }]
    });

    const result = build(doc, bank(), { answerSpace: false });
    assert.ok(codes(result).includes('missing-question'));
    assert.equal(questionChunks(result.html).length, 1);
    assert.ok(result.html.includes('class="handout"'));
});

test('空讲义：记 empty-doc，仍产出可打开的页面骨架', () => {
    const result = build(Model.createDoc({ title: '教案草稿' }), bank());
    assert.deepEqual(codes(result), ['empty-doc']);
    assert.ok(result.html.includes('<style>'));
    assert.ok(result.html.includes('class="handout"'));
});

test('@page 可被覆盖，非法值回落到 A4 / 18mm 16mm', () => {
    const custom = build(makeDoc(), bank(), { page: { size: 'B5', margin: '15mm 12mm' } }).html;
    assert.ok(custom.includes('@page { size: B5; margin: 15mm 12mm; }'));

    const injected = build(makeDoc(), bank(), {
        page: { size: 'A4; } body { display: none', margin: '18mm; } body { color: red' }
    }).html;
    assert.ok(injected.includes('@page { size: A4; margin: 18mm 16mm; }'));
});

test('分隔线支持分页写法', () => {
    const doc = Model.createDoc({
        blocks: [
            { type: 'question', questionId: 'q1' },
            { type: 'divider' },
            { type: 'divider', pageBreak: true }
        ]
    });

    const { html } = build(doc, bank());
    assert.ok(html.includes('class="handout-divider"'));
    assert.ok(html.includes('class="handout-page-break"'));
    assert.ok(html.includes('.handout-page-break'));
});

test('留白：answerSpace: true 使用默认 24mm', () => {
    const heights = [...build(makeDoc(), bank(), { answerSpace: true }).html.matchAll(/height:([\d.]+)mm/g)]
        .map(match => Number(match[1]));
    assert.deepEqual(heights, [24, 24, 24]);
});

test('老师写的文字段落原样交给 renderLatex，公式不被模块自己处理', () => {
    const seen = [];
    const result = Html.buildHtml(makeDoc(), bank(), {
        renderLatex: (text, images) => {
            seen.push({ text, imageCount: Array.isArray(images) ? images.length : -1 });
            return fakeRender(text);
        },
        answerSpace: false
    });

    const note = seen.find(item => item.text.includes('几何意义'));
    assert.ok(note, 'note 必须经过 renderLatex');
    assert.equal(note.imageCount, 0);
    assert.ok(result.html.includes('class="handout-note"'));
    assert.ok(result.html.includes('$f\'(x)$'), 'note 里的 $...$ 必须原样传给渲染器');
});

test('留白：非法高度只提示一次，不按题重复', () => {
    const { issues } = build(makeDoc(), bank(), { answerSpace: -20 });
    assert.equal(issues.filter(item => item.code === 'answer-space-invalid').length, 1);
});

test('渲染为空时，文字段落的提示不说「第 0 题」', () => {
    const result = Html.buildHtml(makeDoc(), bank(), {
        renderLatex: (text) => String(text).includes('几何意义') ? '' : fakeRender(text),
        answerSpace: false
    });
    const hit = result.issues.find(item => item.code === 'empty-render' && item.field === 'note');
    assert.ok(hit);
    assert.ok(!hit.detail.includes('第 0 题'));
    assert.match(hit.detail, /文字段落/);
});

test('没有 renderLatex 直接抛 TypeError，避免调用方以为已经渲染好了', () => {
    assert.throws(() => Html.buildHtml(makeDoc(), bank(), {}), /renderLatex/);
});

test('自定义 escapeHtml 会被采用', () => {
    const { html } = Html.buildHtml(
        Model.createDoc({ title: 'A&B', blocks: [{ type: 'question', questionId: 'q1' }] }),
        bank(),
        { renderLatex: fakeRender, escapeHtml: (text) => String(text).replace(/&/g, '[and]') }
    );
    assert.ok(html.includes('A[and]B'));
});

test('未知区块类型记 unknown-block 并跳过，不影响题目输出', () => {
    const doc = {
        ...Model.createDoc({ blocks: [{ type: 'question', questionId: 'q1' }] }),
        blocks: [{ type: 'image', text: 'fig' }, ...Model.createDoc({ blocks: [{ type: 'question', questionId: 'q1' }] }).blocks]
    };

    const result = build(doc, bank());
    assert.ok(codes(result).includes('unknown-block'));
    assert.deepEqual(indexes(result.html), ['1']);
});
