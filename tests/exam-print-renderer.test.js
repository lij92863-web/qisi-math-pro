const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
    buildAnswerContent,
    buildAnswerGrid,
    buildAnswerSummaryGrid,
    buildHeaderFields,
    buildNotice,
    buildPrintOptionsHtml,
    buildQuestionContent
} = require('../qisi-exam-print-renderer.js');
const a4Template = require('../qisi-a4-exam-template.js');

const ROOT = path.join(__dirname, '..');

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
};

test('exam print renderer exposes its pure API in Node and a browser global', () => {
    assert.equal(typeof buildAnswerContent, 'function');
    assert.equal(typeof buildAnswerGrid, 'function');
    assert.equal(typeof buildAnswerSummaryGrid, 'function');
    assert.equal(typeof buildHeaderFields, 'function');
    assert.equal(typeof buildNotice, 'function');
    assert.equal(typeof buildPrintOptionsHtml, 'function');
    assert.equal(typeof buildQuestionContent, 'function');

    const source = fs.readFileSync(path.join(ROOT, 'qisi-exam-print-renderer.js'), 'utf8');
    const context = {};
    vm.runInNewContext(source, context);

    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildAnswerContent, 'function');
    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildAnswerGrid, 'function');
    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildAnswerSummaryGrid, 'function');
    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildHeaderFields, 'function');
    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildNotice, 'function');
    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildPrintOptionsHtml, 'function');
    assert.equal(typeof context.Qisi.ExamPrintRenderer.buildQuestionContent, 'function');

    assert.doesNotMatch(source, /\b(?:window|document|Blob|indexedDB|KaTeX)\b/);
    assert.doesNotMatch(source, /\bdb\s*\./);
});

test('header fields and notice preserve exact legacy truthiness and HTML', () => {
    assert.equal(buildHeaderFields({ showHeaderFields: false }), '');
    assert.equal(buildHeaderFields({ showHeaderFields: 0 }), '');
    assert.equal(
        buildHeaderFields({ showHeaderFields: 'yes' }),
        '<div class="student-fields"><span>班别<i></i></span><span>姓名<i></i></span><span>评分<i></i></span></div>'
    );

    assert.equal(buildNotice({ showNotice: null }), '');
    assert.equal(
        buildNotice({ showNotice: true }),
        '<div class="notice">注意事项：请将答案填写在指定位置，保持卷面整洁。</div>'
    );
});

test('legacy answer grid preserves configured numbering and blank lines', () => {
    const result = buildAnswerGrid(9, {
        showAnswerGrid: true,
        answerGridCount: 3,
        answerLineStart: 7,
        answerLineCount: 2
    });

    assert.match(result, /class="answer-grid"/);
    assert.match(result, /<tr><th>题号<\/th><td>1<\/td><td>2<\/td><td>3<\/td><\/tr>/);
    assert.match(result, /<div class="answer-lines"><span>7\.<i><\/i><\/span><span>8\.<i><\/i><\/span><\/div>/);
    assert.equal(buildAnswerGrid(9, { showAnswerGrid: false }), '');
});

test('boxed question grid derives choice boxes and fill-in lines from actual types with at most three lines per row', () => {
    const questions = [
        ...Array.from({ length: 9 }, () => ({ type: '单选题' })),
        ...Array.from({ length: 5 }, () => ({ type: '填空题' })),
        { type: '解答题' }
    ];
    const result = buildAnswerGrid(questions, {
        showAnswerGrid: true,
        answerGridMode: 'adaptive-by-type'
    });

    const boxed = (result.match(/<tr><th>题号<\/th>(.*?)<\/tr>/) || [])[1];
    assert.deepEqual([...boxed.matchAll(/<td>(\d+)<\/td>/g)].map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual([...result.matchAll(/<span>(\d+)\.<i><\/i><\/span>/g)].map(match => Number(match[1])), [10, 11, 12, 13, 14]);
    assert.doesNotMatch(result, /<span>15\./);
});

test('adaptive answer frame wraps choices after nine columns and never truncates real question numbers', () => {
    const questions = [
        ...Array.from({ length: 12 }, () => ({ type: '单选题' })),
        ...Array.from({ length: 35 }, () => ({ type: '填空题' }))
    ];
    const result = buildAnswerGrid(questions, {
        showAnswerGrid: true,
        answerGridMode: 'adaptive-by-type'
    });

    assert.equal((result.match(/class="answer-grid"/g) || []).length, 2);
    assert.deepEqual(
        [...result.matchAll(/<tr><th>题号<\/th>(.*?)<\/tr>/g)]
            .flatMap(match => [...match[1].matchAll(/<td>(\d+)<\/td>/g)].map(cell => Number(cell[1]))),
        Array.from({ length: 12 }, (_, index) => index + 1)
    );
    assert.deepEqual(
        [...result.matchAll(/<span>(\d+)\.<i><\/i><\/span>/g)].map(match => Number(match[1])),
        Array.from({ length: 35 }, (_, index) => index + 13)
    );
});

test('answer grid retains fallback, clamp, decimal, and NaN quirks', () => {
    const fallback = buildAnswerGrid(2, {
        showAnswerGrid: true,
        answerGridCount: 0,
        answerLineStart: 0,
        answerLineCount: 12
    });
    assert.equal((fallback.match(/<tr><th>题号<\/th>(.*?)<\/tr>/) || [])[1], '<td>1</td><td>2</td>');
    assert.match(fallback, /<span>3\.<i><\/i><\/span>/);
    assert.match(fallback, /<span>12\.<i><\/i><\/span>/);
    assert.doesNotMatch(fallback, /<span>13\.<i><\/i><\/span>/);

    const clamped = buildAnswerGrid(50, {
        showAnswerGrid: true,
        answerGridCount: Infinity,
        answerLineCount: -2
    });
    assert.equal((clamped.match(/<tr><th>题号<\/th>(.*?)<\/tr>/) || [])[1].match(/<td>/g).length, 20);
    assert.equal(clamped.includes('<span>'), false);

    const decimal = buildAnswerGrid(1, {
        showAnswerGrid: true,
        answerGridCount: 2.9,
        answerLineStart: 4.5,
        answerLineCount: 1.9
    });
    assert.equal((decimal.match(/<tr><th>题号<\/th>(.*?)<\/tr>/) || [])[1], '<td>1</td><td>2</td>');
    assert.match(decimal, /<span>4\.5\.<i><\/i><\/span>/);

    const notANumber = buildAnswerGrid(4, {
        showAnswerGrid: true,
        answerGridCount: 'not-a-number',
        answerLineCount: 0
    });
    assert.match(notANumber, /<tr><th>题号<\/th><\/tr>/);
    assert.match(notANumber, /<tr><th>答案<\/th><\/tr>/);
});

test('boxed answer content renders one 10-column summary, detail rows, and each LaTeX field only once', () => {
    const image = { id: 'img-1' };
    const calls = [];
    const renderLatex = (value, images) => {
        calls.push({ value, images });
        return `<render>${value}</render>`;
    };
    const questions = [
        { answer: 'A', solution: '解一', images: [image] },
        { answer: '', solution: '解二' },
        { answer: '   ', solution: 0, images: null }
    ];

    const result = buildAnswerContent(questions, false, { renderLatex });

    assert.match(result, /^<div class="answer-section "><h2>《高中数学作业》参考答案<\/h2>/);
    assert.match(result, /class="answer-summary-grid"/);
    assert.equal((result.match(/answer-summary-cell/g) || []).length, 10);
    assert.match(result, /<div class="answer-item-heading">1．<render>A<\/render><\/div>/);
    assert.match(result, /<div class="answer-solution">【详解】<render>解一<\/render><\/div>/);
    assert.match(result, /<div class="answer-item-heading">2．________<\/div>/);
    assert.deepEqual(calls.map(call => call.value), ['A', '解一', '解二', '   ']);
    assert.strictEqual(calls[0].images, questions[0].images);
    assert.strictEqual(calls[1].images, questions[0].images);
    assert.deepEqual(calls[2].images, []);
    assert.deepEqual(calls[3].images, []);
    assert.equal(
        buildAnswerContent([], undefined, { renderLatex }),
        '<div class="answer-section new-page"><h2>《高中数学作业》参考答案</h2></div>'
    );
});

test('answer content is non-mutating and keeps its required dependency-object failure', () => {
    const questions = deepFreeze([{ answer: 'A', solution: 'S', images: [{ id: 'x' }] }]);
    const snapshot = structuredClone(questions);

    buildAnswerContent(questions, true, { renderLatex: value => String(value) });

    assert.deepEqual(questions, snapshot);
    assert.throws(() => buildAnswerContent([], true), TypeError);
    assert.throws(() => buildAnswerContent(null, true, { renderLatex: value => value }), TypeError);
});

test('print options preserve type guards, sparse labels, explicit columns, and exact HTML', () => {
    const calls = [];
    const question = {
        type: '单选题',
        options: ['甲', ' ', 0, '丁', '戊'],
        images: [{ id: 'image' }],
        layout: { optionColumns: '2' }
    };
    const result = buildPrintOptionsHtml(question, {
        renderLatex: (value, images) => {
            calls.push(['render', value, images]);
            return `[${value}]`;
        },
        resolveOptionColumns: () => {
            calls.push(['resolve']);
            return 4;
        }
    });

    assert.equal(result, '<div class="gaokao-options qisi-flow-options" style="--qisi-option-columns:2">' +
        '<div class="gaokao-option"><span class="option-label">A.</span><span class="option-content">[甲]</span></div>' +
        '<div class="gaokao-option"><span class="option-label">D.</span><span class="option-content">[丁]</span></div>' +
        '<div class="gaokao-option"><span class="option-label">E.</span><span class="option-content">[戊]</span></div>' +
        '</div>');
    assert.deepEqual(calls.map(call => call.slice(0, 2)), [
        ['render', '甲'],
        ['render', '丁'],
        ['render', '戊']
    ]);
    assert.strictEqual(calls[0][2], question.images);

    let guardCalls = 0;
    const dependencies = {
        renderLatex: () => { guardCalls += 1; },
        resolveOptionColumns: () => { guardCalls += 1; }
    };
    assert.equal(buildPrintOptionsHtml({ type: '解答题', options: ['A'] }, dependencies), '');
    assert.equal(buildPrintOptionsHtml({ type: '多选题', options: [' ', 0, null] }, dependencies), '');
    assert.equal(guardCalls, 0);
});

test('print options render before resolving fallback columns and trust only injected renderer output', () => {
    const options = ['<raw-option>', 'B'];
    const events = [];
    const result = buildPrintOptionsHtml({
        type: '多选题',
        options,
        layout: { optionColumns: 'invalid' }
    }, {
        renderLatex: value => {
            events.push(`render:${value}`);
            return `<trusted-render>${value}</trusted-render>`;
        },
        resolveOptionColumns: payload => {
            events.push('resolve');
            assert.strictEqual(payload.options, options);
            return 0;
        }
    });

    assert.deepEqual(events, ['render:<raw-option>', 'render:B', 'resolve']);
    assert.match(result, /--qisi-option-columns:0/);
    assert.match(result, /<trusted-render><raw-option><\/trusted-render>/);

    assert.match(buildPrintOptionsHtml({
        type: '单选题',
        options: ['A']
    }, {
        renderLatex: value => value
    }), /--qisi-option-columns:4/);

    assert.throws(() => buildPrintOptionsHtml({
        type: '单选题',
        options: ['A'],
        layout: { optionColumns: 0 }
    }, {
        renderLatex: value => value,
        resolveOptionColumns: 'truthy non-function'
    }), TypeError);
});

test('question content preserves exact HTML, global numbering, dependency order, and metadata escaping', () => {
    const imageOne = [{ id: 'one' }];
    const imageTwo = [{ id: 'two' }];
    const q1 = {
        id: 'q1',
        type: '单选题',
        stem: '<题干一>',
        options: ['甲', '乙'],
        answer: '<答案一>',
        solution: '<解析一>',
        images: imageOne,
        layout: { optionColumns: 0 }
    };
    const q2 = {
        id: 'q2',
        type: '解答题',
        stem: '<题干二>',
        answer: '答案二',
        solution: '',
        images: imageTwo
    };
    const groups = deepFreeze([
        { id: 'g1', items: [q2] },
        { id: 'g2', items: [q1] }
    ]);
    const events = [];
    const config = deepFreeze({
        title: '<标题&"\'>',
        subtitle: '<副标题>',
        organizer: 'O\'Reilly & 同事',
        showHeaderFields: false,
        showAnswerGrid: false,
        showNotice: false,
        showAnswer: true,
        showSolution: true
    });
    const questionMeta = deepFreeze({
        q1: { note: '<img src=x onerror=1>' },
        q2: { note: 0 }
    });

    const result = buildQuestionContent([q1, q2], {
        config,
        fallbackTitle: '<备用标题>',
        questionMeta,
        sectionNumbers: ['壹', ''],
        getGroups: questions => {
            events.push('groups');
            assert.deepEqual(questions, [q1, q2]);
            return groups;
        },
        formatGroupSummary: group => {
            events.push(`summary:${group.id}`);
            return `<${group.id}&>`;
        },
        renderLatex: (value, images) => {
            events.push(`render:${value}`);
            assert.ok(images === imageOne || images === imageTwo);
            return `<math>${value}</math>`;
        },
        resolveOptionColumns: payload => {
            events.push('columns');
            assert.strictEqual(payload.options, q1.options);
            return 2;
        }
    });

    assert.equal(result, `<main class="question-template-unboxed-question"><div class="header">
                        <div class="title">&lt;标题&amp;&quot;&#39;&gt;</div>
                        <div class="subtitle">&lt;副标题&gt;</div>
                        <div class="organizer">组卷人：O&#39;Reilly &amp; 同事</div>
                        
                        
                        
                    </div><div class="group-title">壹、&lt;g1&amp;&gt;</div><div class="exam-question">
                                <div class="question-row"><span class="q-index">1.</span><div class="question-flow-body"><math><题干二></math></div></div><div class="print-answer"><b>答案：</b><math>答案二</math></div></div><div class="group-title">2、&lt;g2&amp;&gt;</div><div class="exam-question">
                                <div class="question-row"><span class="q-index">2.</span><div class="question-flow-body"><math><题干一></math><div class="gaokao-options qisi-flow-options" style="--qisi-option-columns:2"><div class="gaokao-option"><span class="option-label">A.</span><span class="option-content"><math>甲</math></span></div><div class="gaokao-option"><span class="option-label">B.</span><span class="option-content"><math>乙</math></span></div></div></div></div><div class="q-note">&lt;img src=x onerror=1&gt;</div><div class="print-answer"><b>答案：</b><math><答案一></math></div><div class="print-solution"><b>解析：</b><math><解析一></math></div></div></main>`);
    assert.deepEqual(events, [
        'groups',
        'summary:g1',
        'render:<题干二>',
        'render:答案二',
        'summary:g2',
        'render:<题干一>',
        'render:甲',
        'render:乙',
        'columns',
        'render:<答案一>',
        'render:<解析一>'
    ]);
});

test('question content uses fallback title, legacy falsy metadata, and empty groups without mutation', () => {
    const questions = deepFreeze([]);
    const config = deepFreeze({
        title: 0,
        subtitle: 0,
        organizer: false,
        showHeaderFields: false,
        showAnswerGrid: false,
        showNotice: false
    });
    const dependencies = deepFreeze({
        config,
        fallbackTitle: '<备用&标题>',
        questionMeta: {},
        sectionNumbers: [],
        getGroups: () => [],
        formatGroupSummary: () => assert.fail('no group summary for an empty group list'),
        renderLatex: () => assert.fail('no question renderer for an empty group list'),
        resolveOptionColumns: () => assert.fail('no option resolver for an empty group list')
    });

    const result = buildQuestionContent(questions, dependencies);

    assert.equal(result, `<main class="question-template-unboxed-question"><div class="header">
                        <div class="title">&lt;备用&amp;标题&gt;</div>
                        
                        
                        
                        
                        
                    </div></main>`);
    assert.deepEqual(questions, []);
    assert.equal(config.title, 0);
    assert.throws(() => buildQuestionContent([], undefined), TypeError);
});

test('generated question and answer HTML remains compatible with the strict A4 document', () => {
    const questions = deepFreeze([
        {
            id: 'q1',
            type: '单选题',
            stem: '已知 $x=1$',
            options: ['1', '2', '3', '4'],
            answer: 'A',
            solution: '代入可得',
            images: []
        }
    ]);
    const config = deepFreeze({
        title: 'A4 几何验收',
        subtitle: '',
        organizer: '',
        showHeaderFields: true,
        showAnswerGrid: true,
        answerGridCount: 1,
        answerLineCount: 0,
        showNotice: true,
        showAnswer: false,
        showSolution: false,
        themeColor: '#111827'
    });
    const common = {
        renderLatex: value => `<span class="katex">${value}</span>`,
        resolveOptionColumns: () => 4
    };
    const questionHtml = buildQuestionContent(questions, {
        config,
        fallbackTitle: '备用',
        questionMeta: {},
        sectionNumbers: ['一'],
        getGroups: qs => [{ items: qs, text: '单项选择题' }],
        formatGroupSummary: group => group.text,
        ...common
    });
    const answerHtml = buildAnswerContent(questions, true, common);
    const content = questionHtml + answerHtml;
    const documentHtml = a4Template.buildPrintDocument({
        content,
        title: '打印验收',
        config,
        katexCssHref: ''
    });

    assert.ok(documentHtml.includes(content));
    assert.match(documentHtml, /@page\s*\{[\s\S]*size:\s*210mm 297mm/);
    assert.match(documentHtml, /margin:\s*25\.4mm 31\.75mm 25\.4mm 31\.75mm/);
    assert.match(documentHtml, /--qisi-content-width:\s*146\.5mm/);
    assert.match(documentHtml, /--qisi-content-height:\s*246\.2mm/);
    assert.match(documentHtml, /id="qisiPrintSource" class="qisi-print-source"><main class="question-template-unboxed-question">/);
    assert.match(documentHtml, /class="answer-section new-page"/);
    assert.match(documentHtml, /class="exam-question"/);
    assert.match(documentHtml, /--qisi-option-columns:4/);
    assert.equal(a4Template.PAGE.widthMm, 210);
    assert.equal(a4Template.PAGE.heightMm, 297);
});
