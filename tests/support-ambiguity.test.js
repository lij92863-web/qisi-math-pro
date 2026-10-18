const test = require('node:test');
const assert = require('node:assert/strict');

const Utils = require('../qisi-utils.js');
globalThis.Qisi = globalThis.Qisi || {};
globalThis.Qisi.Utils = globalThis.Qisi.Utils || Utils;

const Parser = require('../qisi-support-text-parser.js').createSupportTextParser({
    normalizeQuestionKey: value => String(value),
    stripQuestionSectionNoise: value => value,
    extractGraphicRefs: () => [],
    normalizeMathTextForLatexSafe: value => value
});

const file = { id: 'support-1', filename: '答案.docx' };

test('a legitimate paper with numbered steps inside solutions is not rejected', () => {
    // 监工提供的合法样例：第 1 题解析里有分步「2. 分两种情况讨论」，
    // 真正的第 2 题带【答案】标签。这份文件必须正常解析，不许抛错，
    // 而且第 2 题的解析必须是它自己的「略。」，不能被第 1 题解析里的
    // 分步叙述顶掉。
    const text = '1.【答案】A\n【解析】因为 x=2。\n2. 分两种情况讨论\n综上选 A。\n2.【答案】B\n【解析】略。';
    let result;
    assert.doesNotThrow(() => { result = Parser.parseAnswerAndSolutionItemsFromText(text, file); });
    const answers = Object.fromEntries(result.answers.map(row => [row.question, row.answer]));
    assert.equal(answers['1'], 'A');
    assert.equal(answers['2'], 'B');
    const solutions = Object.fromEntries(result.solutions.map(row => [row.question, String(row.solution)]));
    assert.match(solutions['2'] || '', /略/, '第 2 题的解析被顶掉了：解析串到了第 1 题的分步上');
    assert.doesNotMatch(solutions['2'] || '', /分两种情况/, '第 1 题解析里的分步被当成了第 2 题的解析');
});

test('the numbered step inside a solution stays part of that solution', () => {
    // 「2. 当 x>0 时」是第 1 题解析里的分步叙述，不是第 2 题的解析开头。
    const text = '答案：1.A 2.B\n解析：\n1. 由题意得 x=2。\n2. 当 x>0 时 f(x) 递增。\n3. 综上。';
    const result = Parser.parseAnswerAndSolutionItemsFromText(text, file);
    const solutions = Object.fromEntries(result.solutions.map(row => [row.question, String(row.solution)]));
    assert.match(solutions['1'] || '', /由题意得/);
});

test('two different answers for one question are both refused with a visible conflict', () => {
    // 源文件里同一题号印了两次且答案不同：两个值都不采用，该题留空并标记冲突。
    // 旧实现「保留先出现的一条」是在用位置猜哪条对，题号印错就会静默挂错答案。
    // 也不抛错拒整份 —— 一道题的问题不该让整份文件失败。
    const text = '答案：\n1. A\n2. C\n1. D';
    let result;
    assert.doesNotThrow(() => { result = Parser.parseAnswerAndSolutionItemsFromText(text, file); });
    const first = result.answers.find(row => row.question === '1');
    assert.ok(first);
    assert.equal(first.answer, '');
    assert.equal(result.answers.find(row => row.question === '2').answer, 'C');
    const conflict = result.conflicts.find(row => row.question === '1' && row.field === 'answer');
    assert.ok(conflict, '重复答案必须留下可见的冲突标记，不能悄无声息');
    assert.deepEqual(conflict.values.sort(), ['A', 'D']);
});

test('identical duplicate answers are de-duplicated silently', () => {
    const text = '答案：\n1. A\n2. C\n1. A';
    const result = Parser.parseAnswerAndSolutionItemsFromText(text, file);
    const pairs = result.answers.map(row => [row.question, row.answer]);
    assert.deepEqual(pairs, [['1', 'A'], ['2', 'C']]);
});

test('normal sequential solutions still split by question', () => {
    const text = '解析：\n1. 先求定义域。\n2. 再求导数。\n3. 最后判号。';
    const result = Parser.parseAnswerAndSolutionItemsFromText(text, file);
    const numbers = result.solutions.map(row => row.question);
    assert.deepEqual(numbers, ['1', '2', '3']);
});
