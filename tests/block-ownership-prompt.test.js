const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../qisi-block-ownership-prompt.js');

const blocks = [
    { id: 'p1b0', page: 1, type: 'text', text: '一、单选题' },
    { id: 'p1b1', page: 1, type: 'text', text: '1. 复数…' },
    { id: 'p1b2', page: 1, type: 'image', image: 'images/a.jpg' },
    { id: 'p2b0', page: 2, type: 'equation', text: '$$x^2$$' },
    { id: 'p3b0', page: 3, type: 'table', text: '<table></table>' },
    { id: 'p5b0', page: 5, type: 'page_number', text: '第 5 页' }
];

test('windows are built per page, keep page order and never split a page', () => {
    const windows = P.planWindows(blocks, { pagesPerWindow: 2 });
    assert.deepEqual(windows.map(w => w.pages), [[1, 2], [3, 5]]);
    assert.deepEqual(windows[0].blocks.map(b => b.id), ['p1b0', 'p1b1', 'p1b2', 'p2b0']);
    assert.deepEqual(windows[1].blocks.map(b => b.id), ['p3b0', 'p5b0']);
});

test('every block reaches exactly one window', () => {
    const seen = P.planWindows(blocks, { pagesPerWindow: 1 }).flatMap(w => w.blocks.map(b => b.id));
    assert.deepEqual(seen.sort(), blocks.map(b => b.id).sort());
});

test('payload never ships image bytes to the model and keeps full text', () => {
    const payload = P.buildPayload({ blocks, answerTable: { 1: 'D' }, questionNumbers: ['1'], phase: P.PHASES.QUESTIONS, pages: [1] });
    const image = payload.blocks.find(b => b.id === 'p1b2');
    assert.equal(image.text, undefined);
    assert.equal(image.alt, '图');
    const text = payload.blocks.find(b => b.id === 'p1b1');
    assert.equal(text.text, '1. 复数…');
});

test('prompt forbids rewriting and states the per-phase field limits', () => {
    const questionPrompt = P.buildPrompt({ phase: P.PHASES.QUESTIONS, pages: [1], expected_question_numbers: ['1'], answer_table: null, blocks: [] });
    assert.match(P.SYSTEM, /绝不抄写/);
    assert.match(questionPrompt, /只填 stem \/ options \/ figures/);
    const solutionPrompt = P.buildPrompt({ phase: P.PHASES.SOLUTIONS, pages: [9], expected_question_numbers: ['1'], answer_table: null, blocks: [] });
    assert.match(solutionPrompt, /只填 answer \/ solution/);
});

test('model output parsing rejects prose, wrong protocol and missing questions', () => {
    assert.equal(P.parseOutput('这是一道题').ok, false);
    assert.equal(P.parseOutput('{"protocol":"other","questions":[]}').ok, false);
    assert.equal(P.parseOutput('{"protocol":"block-ownership-v1"}').ok, false);
    const ok = P.parseOutput('```json\n{"protocol":"block-ownership-v1","questions":[]}\n```');
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.value.questions, []);
});
