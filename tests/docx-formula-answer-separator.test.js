const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../qisi-utils');
globalThis.Qisi = { ...(globalThis.Qisi || {}), Utils };
const parser = require('../qisi-support-text-parser').createSupportTextParser({
    normalizeQuestionKey: String, stripQuestionSectionNoise: value => value,
    extractGraphicRefs: () => [], normalizeMathTextForLatexSafe: value => value
});
const printed = '$\\frac{2}{5}$ $\\frac{9}{4}$ / $2.25$';
const block = (answer = printed, overrides = {}) => ({
    questionNumber: '7', boundaryStatus: 'accepted', expectedQuestion: true,
    blockId: 'support-p7', text: '7. ' + answer + '\n【详解】OWN_SOLUTION', ...overrides
});
const parse = (blocks = [block()], roles = ['full']) => parser.parseAnswerAndSolutionItemsFromText('', {
    id: 'explicit-support', filename: 'synthetic.docx', roles, supportBlocks: blocks
});

test('a verified formula answer preserves every printed expression and separator without interpreting them', () => {
    const result = parse(), answer = result.answers[0];
    assert.equal(answer.question, '7');
    assert.equal(answer.answer, printed);
    assert.equal(answer.sourceFileId, 'explicit-support');
    assert.equal(answer.evidence.state, 'unique');
    assert.equal(answer.evidence.declarations[0].value, printed);
    const raw = block().text.slice(...answer.evidence.declarations[0].range);
    assert.equal(raw.trim(), printed);
    assert.equal(result.solutions[0].solution, 'OWN_SOLUTION');
});

test('the same literal format can come from an explicit answer source and can contain multiple separators', () => {
    const text = '$2$ / $3$ / $4$';
    assert.equal(parse([block(text)], ['answer']).answers[0].answer, text);
});

test('unverified metadata, mismatching question headings and non-answer roles cannot authorize this format', () => {
    for (const overrides of [
        { boundaryStatus: undefined }, { boundaryStatus: 'rejected' },
        { expectedQuestion: undefined }, { expectedQuestion: false },
        { questionNumber: '8' }
    ]) assert.equal(parse([block(printed, overrides)]).answers.length, 0);
    for (const roles of [[], ['question'], ['solution']]) assert.equal(parse([block()], roles).answers.length, 0);
});

test('text, malformed formulas, empty separators and multiline fragments stay unbound', () => {
    for (const value of [
        '$2$ /', '/ $2$', '$2$ // $3$', '$2$ / / $3$',
        '$2 / $3$', '$2$ / $3', '$2$ / prose $3$',
        '$2$\n/ $3$', '$2$ ; $3$', '$2$ / $3$ trailing text'
    ]) assert.equal(parse([block(value)]).answers.length, 0, value);
});

test('different declarations of one formula answer remain a conflict rather than first-value acceptance', () => {
    const result = parse([block(), block('$2$ / $9$', { blockId: 'support-p8' })]);
    assert.equal(result.answers.length, 1);
    assert.equal(result.answers[0].answer, '');
    assert.equal(result.answers[0].evidence.state, 'conflict');
    assert.equal(result.conflicts[0].field, 'answer');
});

test('a rejected duplicate with a different literal still blocks the earlier value and preserves raw evidence', () => {
    const result = parse([block(), block('$2$ / $9$', {
        blockId: 'rejected-p8', boundaryStatus: 'rejected', boundaryReason: 'duplicate'
    })]);
    assert.equal(result.answers[0].answer, '');
    assert.equal(result.answers[0].evidence.state, 'conflict');
    assert.ok(result.unmatched.some(row => row.blockId === 'rejected-p8' && row.rawText.includes('$2$ / $9$')));
});

test('an identical rejected duplicate remains one unique literal value under the existing conflict policy', () => {
    const result = parse([block(), block(printed, { boundaryStatus: 'rejected', boundaryReason: 'duplicate' })]);
    assert.equal(result.answers.length, 1);
    assert.equal(result.answers[0].answer, printed);
    assert.equal(result.answers[0].evidence.state, 'unique');
    assert.equal(result.conflicts.length, 0);
});
