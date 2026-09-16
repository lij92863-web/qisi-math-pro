const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../qisi-utils.js');

// The heading of an answer key, in the shapes the real papers use. The six long ones are the papers
// that print their own title before 参考答案; with the old twelve-character limit the cut fell on the
// answer table's header cell "答案" instead, which put the key's 题号 rows into the last question's stem.
const HEADINGS = [
    '答案',
    '参考答案',
    '答案：',
    '参考答案:',
    '高二答案',
    '《2026年7月9日高中数学作业》参考答案',
    '《广东佛山市第一中学2026届高三一模检测数学试题》参考答案',
    '《广东深圳高级中学（集团）2026届高三适应性考试数学试卷》参考答案',
    '《广东省十二所重点中学校2026届高三年级第一次模拟考（十二校一模）数学试题》参考答案',
    '《河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷》参考答案',
    '《湖北省武汉市2025届高三下学期毕业生四月调研考试数学试题》参考答案'
];

test('an answer-key heading is recognised wherever the paper puts its title', () => {
    for (const heading of HEADINGS) {
        assert.equal(
            utils.isAnswerKeyHeadingLine(heading),
            true,
            `${JSON.stringify(heading)} states where the key starts`
        );
        assert.equal(utils.isAnswerKeyHeadingLine(`  ${heading}  `), true, 'surrounding space is ignored');
    }
});

test('question text and section headers are not answer-key headings', () => {
    for (const line of [
        '',
        '   ',
        '1．已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）',
        'A．98 B．104 C．106 D．108',
        '三、解答题（本题共3小题）',
        '《广东佛山市第一中学2026届高三一模检测数学试题》',
        '参考答案与评分标准（每题5分）',
        '【详解】由题意可知'
    ]) {
        assert.equal(
            utils.isAnswerKeyHeadingLine(line),
            false,
            `${JSON.stringify(line)} is not a heading`
        );
    }
});

test('the key reader still finds its key after a long title', () => {
    const text = [
        '1．已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）',
        '《某校2026届高三一模检测数学试题》参考答案',
        '1．C 2．D'
    ].join('\n');

    const { documentPart, keyPart } = utils.splitTextAtAnswerKeyHeading(text);

    assert.equal(
        documentPart,
        '1．已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）',
        'the question text stops at the title, so no key row can reach a stem'
    );
    assert.equal(keyPart, '1．C 2．D', 'the title belongs to the document, not to the key entries');
});

// A heading alone still does not make a key: the safety valve in splitTextAtAnswerKeyHeading keeps a
// labelled 解析 section - or a key written only as table cells - out of the key reader. The question
// text is cut by the ingest's own heading rule, which needs no such valve.
test('a heading with nothing key-shaped after it opens no key section', () => {
    const text = [
        '1．已知集合 $A=\\{1,2\\}$，则 $A$ 的子集个数为（ ）',
        '《某校2026届高三一模检测数学试题》参考答案',
        '题号',
        '1',
        '答案',
        'C',
        '【详解】由题意得'
    ].join('\n');

    const { documentPart, keyPart } = utils.splitTextAtAnswerKeyHeading(text);

    assert.equal(keyPart, '', 'no bare key stream after the heading means no key section');
    assert.equal(documentPart, text);
});
