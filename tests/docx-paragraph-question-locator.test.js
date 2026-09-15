const test = require('node:test');
const assert = require('node:assert/strict');

const pipeline = require('../qisi-docx-pipeline.js');

// The shape that broke the flat-text locator on the real 周二晚测.docx: a mark sheet with the numbers
// on their own lines, an answer table label "9 答案", and the questions themselves further down.
const PARAGRAPHS = [
    '高一数学作业（九）',
    '题号',
    '1',
    '2',
    '3',
    '4',
    '6',
    '一、选择题（本题共6小题）',
    { text: '1. 已知集合，，则（ ）' },
    'A. B. C. D.',
    { text: '2. 已知函数的零点分别为a，b，c，则（ ）' },
    'A. B. C. D.',
    { text: '3. 已知的外接圆圆心为O，则向量在向量上的投影向量为（ ）' },
    'A. B. C. D.',
    '9 答案',
    '9. 如图，在梯形中，则为（ ）',
    'B. 的最小值为9',
    '10. 已知复数z1=m+(4-m2)i(m∈R)，则的取值范围为_____.'
];

test('a question is located by its paragraph marker, not by a bare number line', () => {
    const block = pipeline.locateQuestionBlockFromParagraphs(PARAGRAPHS, 2);

    assert.match(block, /已知函数的零点/, 'must return the real question body');
    assert.doesNotMatch(block, /^2\s*$/m, 'must not return the mark-sheet cell');
    assert.match(block, /A\. B\. C\. D\./);
});

test('an answer-table label is not a question start', () => {
    const block = pipeline.locateQuestionBlockFromParagraphs(PARAGRAPHS, 9);

    assert.match(block, /如图，在梯形中/, 'must skip the "9 答案" label');
    assert.match(block, /的最小值为9/);
    assert.doesNotMatch(block, /^9 答案$/m);
});

test('the block ends at the next later question paragraph', () => {
    const block = pipeline.locateQuestionBlockFromParagraphs(PARAGRAPHS, 9);

    assert.doesNotMatch(block, /复数z1/, 'question 10 must not be inside question 9');
});

test('a two-digit question is matched as a whole number', () => {
    const block = pipeline.locateQuestionBlockFromParagraphs(PARAGRAPHS, 10);

    assert.match(block, /已知复数/);
});

test('paragraphs may be plain strings or objects with a text field', () => {
    const plain = pipeline.locateQuestionBlockFromParagraphs(['1. 甲', '2. 乙'], 1);
    const objects = pipeline.locateQuestionBlockFromParagraphs([{ text: '1. 甲' }, { text: '2. 乙' }], 1);

    assert.equal(plain, objects);
    assert.match(plain, /甲/);
});

test('a question that is absent returns nothing instead of a fragment', () => {
    assert.equal(pipeline.locateQuestionBlockFromParagraphs(PARAGRAPHS, 7), '');
    assert.equal(pipeline.locateQuestionBlockFromParagraphs([], 1), '');
});
