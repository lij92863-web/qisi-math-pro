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

test('a mixed answer row keeps numeric fill-in answers instead of voiding the table', () => {
    // 「题号 1 2 3 4 / 答案 A 2 C 4」是真实排版：1、3 是选择题，2、4 是填空题。
    // 旧逻辑只认 A-F 并按键位拆分，整张表会作废，一次丢掉四题答案。
    const parsed = Parser.parseAnswerAndSolutionItemsFromText('题号：1 2 3 4\n答案：A 2 C 4', file);
    const pairs = parsed.answers.map(row => [row.question, row.answer]);
    assert.deepEqual(pairs, [['1', 'A'], ['2', '2'], ['3', 'C'], ['4', '4']]);
});

test('a multi-label cell stays one answer instead of being split into two columns', () => {
    // 「答案：AB C」对应两道多选题：第 1 题 AB、第 2 题 C。
    // 按键位拆会变成 A / B / C 三格，列数与题号数对不上，整表作废。
    const parsed = Parser.parseAnswerAndSolutionItemsFromText('题号：1 2\n答案：AB C', file);
    const pairs = parsed.answers.map(row => [row.question, row.answer]);
    assert.deepEqual(pairs, [['1', 'AB'], ['2', 'C']]);
});

test('a compact single-letter row is still accepted', () => {
    // 「答案 ABCDAB」不带分隔符时仍按单字符拆，保持原有兼容。
    const parsed = Parser.parseAnswerAndSolutionItemsFromText(
        '题号 1 2 3 4 5 6\n答案 ABCDAB', file
    );
    const pairs = parsed.answers.map(row => [row.question, row.answer]);
    assert.deepEqual(pairs, [['1', 'A'], ['2', 'B'], ['3', 'C'], ['4', 'D'], ['5', 'A'], ['6', 'B']]);
});

test('a summary table row is not parsed a second time by the positional matcher', () => {
    // 「答案：A 2 C 4」里的「2 C」形态会被 pairRegex 读成「2 的答案是 C」，
    // 把表格里正确的「2 的答案是 2」冲掉。
    const parsed = Parser.parseAnswerAndSolutionItemsFromText('题号：1 2 3 4\n答案：A 2 C 4', file);
    const second = parsed.answers.find(row => row.question === '2');
    assert.equal(second.answer, '2');
});
