const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../qisi-paper-segmenter.js');

const b = (id, page, type, text) => ({ id, page, type, text });

test('a clean paper splits by printed number and keeps order', () => {
    const blocks = [
        b('p1b0', 1, 'text', '某中学 2026 届考试'),
        b('p1b1', 1, 'text', '1. 第一题'),
        b('p1b2', 1, 'text', 'A. 2 B. 3'),
        b('p1b3', 1, 'image', ''),
        b('p2b0', 2, 'text', '2. 第二题'),
        b('p2b1', 2, 'equation', '$$x^2$$')
    ];
    const result = S.segment(blocks);
    assert.deepEqual(result.order, ['1', '2']);
    assert.deepEqual(result.issues, []);
    assert.equal(result.preamble.length, 1);
    assert.deepEqual(S.figureOf(result.runs[0]).map(x => x.id), ['p1b3']);
    assert.deepEqual(S.figureOf(result.runs[1]), []);
});

test('a missing printed number is reported instead of being filled in', () => {
    const blocks = [b('a', 1, 'text', '1. 一'), b('c', 2, 'text', '3. 三')];
    const result = S.segment(blocks, { numbers: ['1', '2', '3'] });
    assert.deepEqual(result.issues.filter(i => i.code === 'missing-number').map(i => i.no), ['2']);
    assert.deepEqual(result.order, ['1', '3'], 'no synthetic run may be created');
});

test('duplicate and out-of-order numbers fail closed', () => {
    const duplicate = S.segment([b('a', 1, 'text', '1. 一'), b('b', 1, 'text', '1. 又一次')]);
    assert.equal(duplicate.issues.filter(i => i.code === 'duplicate-number').length, 1);
    const backwards = S.segment([b('a', 1, 'text', '2. 二'), b('b', 2, 'text', '1. 一')]);
    assert.equal(backwards.issues.filter(i => i.code === 'number-not-increasing').length, 1);
});

test('a number that is not expected is reported, not silently accepted', () => {
    const result = S.segment([b('a', 1, 'text', '1. 一'), b('b', 1, 'text', '7. 七')], { numbers: ['1', '2'] });
    assert.ok(result.issues.some(i => i.code === 'unexpected-number' && i.no === '7'));
    assert.ok(result.issues.some(i => i.code === 'missing-number' && i.no === '2'));
});

test('the printed answer table always wins over a conflicting solution head', () => {
    const question = S.segment([b('q1', 1, 'text', '1. 题')]);
    const solution = S.segment([b('s1', 9, 'text', '1. C')]);
    const built = S.assemble({ questionSegment: question, solutionSegment: solution, answerTable: { 1: 'D' } });
    assert.equal(built.questions[0].answer, 'D');
    assert.equal(built.questions[0].answerSource, 'answer-table');
    assert.deepEqual(built.issues.map(i => i.code), ['answer-table-conflict']);
});

test('a question without a located solution keeps an empty answer and says so', () => {
    const question = S.segment([b('q1', 1, 'text', '1. 题'), b('q2', 1, 'text', '2. 题')]);
    const solution = S.segment([b('s1', 9, 'text', '1. A')], { numbers: ['1', '2'] });
    const built = S.assemble({ questionSegment: question, solutionSegment: solution, answerTable: null });
    const second = built.questions.find(q => q.questionNo === '2');
    assert.equal(second.answer, '');
    assert.equal(second.solutionBlocks.length, 0);
    assert.ok(built.issues.some(i => i.code === 'solution-missing' && i.no === '2'));
});

test('solution-only mode reads the answer printed on its own head line', () => {
    const solution = S.segment([b('s1', 9, 'text', '3. B'), b('s2', 9, 'text', '【详解】…')]);
    assert.equal(S.answerStatedInSolution(solution.runs[0]), 'B');
});

test('a marker glued onto the previous paragraph still starts its question', () => {
    const blocks = [
        b('a', 1, 'text', '1. 一'),
        b('b', 2, 'text', '故最小值为 8 米.\n2. (1) 1/5 (2) 分布列如下'),
        b('c', 3, 'text', '3. 三')
    ];
    const result = S.segment(blocks, { numbers: ['1', '2', '3'] });
    assert.deepEqual(result.order, ['1', '2', '3']);
    assert.deepEqual(result.issues, []);
    const second = result.runs.find(run => run.no === '2');
    assert.match(result.runs.find(run => run.no === '1').blocks[1].text, /最小值为 8 米/);
    assert.match(second.blocks[0].text, /^2\./);
});

test('a numbered list inside a solution is not mistaken for a new question', () => {
    const blocks = [
        b('a', 9, 'text', '1. A'),
        b('b', 9, 'text', '详解：\n2. 这一步不是新题，因为 2 不在期望题号里')
    ];
    const result = S.segment(blocks, { numbers: ['1', '3'] });
    assert.deepEqual(result.order, ['1'], 'no synthetic run from a numbered list');
    assert.equal(result.issues.filter(i => i.code === 'missing-number').length, 1);
});
