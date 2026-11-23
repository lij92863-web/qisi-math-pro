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

test('conflicting printed answer sources withhold binding and preserve both values', () => {
    const question = S.segment([b('q1', 1, 'text', '1. 题')]);
    const solution = S.segment([b('s1', 9, 'text', '1. C')]);
    const built = S.assemble({ questionSegment: question, solutionSegment: solution, answerTable: { 1: 'D' } });
    assert.equal(built.questions[0].answer, '');
    assert.equal(built.questions[0].answerSource, 'none');
    assert.deepEqual(built.questions[0].solutionBlocks, []);
    assert.equal(built.valid, false);
    assert.equal(built.issues[0].table, 'D');
    assert.equal(built.issues[0].solution, 'C');
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

test('a glued multipart marker remains a candidate until its hierarchy is confirmed', () => {
    const blocks = [
        b('a', 1, 'text', '1. 一'),
        b('b', 2, 'text', '故最小值为 8 米.\n2. (1) 1/5 (2) 分布列如下'),
        b('c', 3, 'text', '3. 三')
    ];
    const result = S.segment(blocks, { numbers: ['1', '2', '3'] });
    assert.deepEqual(result.order, ['1', '2', '3']);
    assert.ok(result.issues.some(i => i.code === 'ambiguous-boundary'));
    const second = result.runs.find(run => run.no === '2');
    assert.match(result.runs.find(run => run.no === '1').blocks[1].text, /最小值为 8 米/);
    assert.match(second.blocks[0].text, /^2\./);
});

test('a numbered list inside a solution is not mistaken for a new question', () => {
    const blocks = [
        b('a', 9, 'text', '1. A'),
        b('b', 9, 'text', '详解：\n2. 这一步不是新题，因为 2 不在期望题号里')
    ];
    const result = S.segment(blocks, { numbers: ['1', '3'], role: 'support' });
    assert.deepEqual(result.order, ['1'], 'no synthetic run from a numbered list');
    assert.equal(result.issues.filter(i => i.code === 'missing-number').length, 1);
});

test('the answer section is found by the numbering restart, not only by a heading', () => {
    const blocks = [
        b('a', 1, 'text', '1. 第一题'), b('b', 1, 'text', '2. 第二题'), b('c', 2, 'text', '3. 第三题'),
        b('d', 3, 'text', '1. D'), b('e', 3, 'text', '2. A'), b('f', 3, 'text', '3. B')
    ];
    const boundary = S.findAnswerBoundary(blocks);
    assert.equal(boundary.reason, 'numbering-restart');
    assert.equal(boundary.index, 3);
    const paper = S.segmentPaper(blocks);
    assert.deepEqual(paper.questionSegment.order, ['1', '2', '3']);
    assert.deepEqual(paper.solutionSegment.order, ['1', '2', '3']);
    assert.deepEqual(paper.questionSegment.issues, []);
    assert.deepEqual(paper.solutionSegment.issues, []);
});

test('a heading still splits a paper whose answer side has no numbers', () => {
    const blocks = [b('a', 1, 'text', '1. 第一题'), b('b', 2, 'text', '参考答案'), b('c', 2, 'text', '略')];
    const paper = S.segmentPaper(blocks);
    assert.equal(paper.boundary.reason, 'heading');
    assert.deepEqual(paper.questionSegment.order, ['1']);
    assert.equal(paper.combined, true);
});

test('an explicitly bracketed commentary list retains its numbers inside the owning solution', () => {
    const questions = [
        b('title', 1, 'text', '高二综合训练（1）'),
        b('q1', 1, 'text', '1. 第一题'), b('q2', 1, 'text', '2. 第二题'), b('q3', 2, 'text', '3. 第三题')
    ];
    const support = [
        b('answer-title', 3, 'text', '高二综合训练(1)答案'),
        b('s1', 3, 'text', '1. 【答案】A【解析】第一题解析'),
        b('s2', 3, 'text', '2. 【答案】B【解析】第二题解析'),
        b('s3', 3, 'text', '3. 【答案】C【解析】第三题解析'),
        b('method', 4, 'text', '综上所述，$x=1$。【点睛】方法点睛：1. 第一种方法'),
        b('steps', 4, 'text', '（1）写出算式；（2）合并同类项。'),
        b('nested', 4, 'text', '2. 第二种方法是先分类，再分别计算。')
    ];
    const paper = S.segmentPaper([...questions, ...support]);
    assert.deepEqual(paper.questionSegment.runs.at(-1).blocks.map(block => block.id), ['q3']);
    assert.deepEqual(paper.solutionSegment.preamble.map(block => block.id), ['answer-title']);
    assert.deepEqual(paper.solutionSegment.order, ['1', '2', '3']);
    const result = S.assemblePartial(paper);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.questions.map(question => question.answer), ['A', 'B', 'C']);
    assert.deepEqual(result.questions[2].solutionBlocks, ['s3', 'method', 'steps', 'nested']);
    assert.deepEqual(paper.solutionSegment.runs[2].commentaryHeadings, [{ blockId: 'nested', listStartBlockId: 'method', ordinal: 2 }]);

    for (const [name, invalid] of [
        ['duplicate answer label', support.map(block => block.id === 'nested' ? { ...block, text: '2. 【答案】D【解析】另一份解析' } : block)],
        ['labelled choice without brackets', support.map(block => block.id === 'nested' ? { ...block, text: '2. D\n【详解】另一份解析' } : block)],
        ['out of order', [support[0], support[2], support[1], ...support.slice(3)]],
        ['missing anchor', support.filter(block => block.id !== 's2')],
        ['other page', support.map(block => block.id === 'nested' ? { ...block, page: 5 } : block)],
        ['skipped ordinal', support.map(block => block.id === 'nested' ? { ...block, text: '1. 独立编号并未延续。' } : block)],
        ['annotation without an explicitly started list', support.map(block => block.id === 'method' ? { ...block, text: '【点睛】方法应用。' } : block)]
    ]) {
        const supportSegment = S.segment(invalid, { numbers: ['1', '2', '3'], role: 'support' });
        assert.ok(supportSegment.order.length !== 3 || !supportSegment.valid, name);
        assert.ok(supportSegment.runs.every(run => !run.commentaryHeadings), name);
        const built = S.assemblePartial({ questionSegment: S.segment(questions), solutionSegment: supportSegment });
        assert.ok(built.questions.every(q => q.questionNo !== '2' || !q.answer), name);
    }
});

test('a question-only file reports itself as not combined', () => {
    const paper = S.segmentPaper([b('a', 1, 'text', '1. 一'), b('b', 1, 'text', '2. 二')]);
    assert.equal(paper.combined, false);
    assert.equal(paper.solutionSegment, null);
    assert.deepEqual(paper.questionSegment.order, ['1', '2']);
});
