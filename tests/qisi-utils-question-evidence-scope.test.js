const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../qisi-utils.js');

// Shaped like the teacher's real 周二晚测.docx: a mark sheet whose numbering row lands in the text
// layer ("3. 4." where question 3 is also a real question), a question whose marker sits behind an
// inline image token, and options with and without the "A." label.
const MARK_SHEET_AND_QUESTIONS = [
    '高一数学作业（九）',
    '班别________________姓名_______________评分_________________',
    '题号',
    '1',
    '2',
    '3',
    '答案',
    '3. 4.',
    '一、选择题（本题共3小题，每小题5分，共30分）',
    '1. 已知集合 $A=\\{1,2\\}$，则（ ）',
    'A. 甲 B. 乙 C. 丙 D. 丁',
    '2. 已知函数 $f(x)=x$ 的零点为（ ）',
    'A. 一 B. 二 C. 三 D. 四',
    '[[IMAGE:docx_img_9]] 3. 如图，在梯形 ABCD 中，则（ ）',
    'A. 戊 B. 己 C. 庚 D. 辛'
].join('\n');

test('a mark-sheet numbering row is not a question', () => {
    const markers = utils.collectQuestionEvidenceMarkers(MARK_SHEET_AND_QUESTIONS);

    assert.deepEqual(markers, ['1', '2', '3']);
    assert.equal(markers.includes('4'), false, 'the numbering row must not invent question 4');
});

test('the flat splitter keeps every question the paper really has', () => {
    const blocks = utils.splitFlatTextIntoQuestionBlocks(MARK_SHEET_AND_QUESTIONS);

    assert.deepEqual(blocks.map(block => block.question), ['1', '2', '3']);
    assert.match(blocks[0].block, /^已知集合/, 'question 1 is not lost to the numbering row');
    assert.match(blocks[2].block, /如图，在梯形/, 'an image token in front of a marker still starts a question');
    assert.match(blocks[2].block, /A\. 戊/, 'the image-prefixed block keeps its own options');
    assert.match(blocks[2].block, /\[\[IMAGE:docx_img_9\]\]/, 'the marker must not consume its preceding image');
});

test('a previous question picture on its own line is not attached to the next question', () => {
    const blocks = utils.splitFlatTextIntoQuestionBlocks('1. First question\n[[IMAGE:previous]]\n2. Next question');
    assert.match(blocks[0].block, /\[\[IMAGE:previous\]\]/);
    assert.doesNotMatch(blocks[1].block, /IMAGE/);
});

test('a whole-page text is not evidence for one question', () => {
    assert.equal(utils.isQuestionScopedEvidenceText(MARK_SHEET_AND_QUESTIONS, '1'), false);
    assert.equal(utils.isQuestionScopedEvidenceText(MARK_SHEET_AND_QUESTIONS, '3'), false);
});

test('a question block without another question marker is scoped evidence', () => {
    assert.equal(
        utils.isQuestionScopedEvidenceText('已知集合 ，则（ ）\nA. 甲 B. 乙 C. 丙 D. 丁', '1'),
        true
    );
    assert.equal(
        utils.isQuestionScopedEvidenceText('1. 已知集合 ，则（ ）\nA. 甲 B. 乙', '1'),
        true
    );
    assert.equal(
        utils.isQuestionScopedEvidenceText('3. 已知函数 的零点为（ ）\nA. 一 B. 二', '2'),
        false,
        'another question\'s block is never this question\'s evidence'
    );
});

test('the file-wide table text does not invent a question', () => {
    const withTableFallback = [
        MARK_SHEET_AND_QUESTIONS,
        '',
        '【DOCX表格文本兜底】',
        '',
        '题号 1 2 3',
        '答案'
    ].join('\n');

    const blocks = utils.splitFlatTextIntoQuestionBlocks(withTableFallback);

    assert.deepEqual(blocks.map(block => block.question), ['1', '2', '3']);
});

test('a letter inside a formula is not an option label', () => {
    const split = utils.splitQuestionForStorage(
        '已知 $\\triangle ABC$ 的外接圆圆心为O，则（ ）\nA. 甲 B. 乙 C. 丙 D. 丁',
        '解答题',
        ['', '', '', '']
    );

    assert.match(split.stem, /\\triangle ABC\$/);
    assert.match(split.stem, /的外接圆圆心为O/);
    assert.deepEqual(split.options, ['甲', '乙', '丙', '丁']);
});

test('an unlabelled run of formulas is still not guessed into options', () => {
    const split = utils.splitQuestionForStorage(
        '已知函数 的零点分别为 a，b，c，则大小顺序为（ ）\n$a>b>c$ $b>c>a$ $c>a>b$ $b>a>c$',
        '解答题',
        ['', '', '', '']
    );

    assert.deepEqual(split.options, ['', '', '', '']);
    assert.match(split.stem, /a>b>c/);
});
