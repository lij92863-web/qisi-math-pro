const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../qisi-paper-pairing.js');

const b = (id, page, type, text) => ({ id, page, type, text });

test('out-of-order support is matched by number but cannot be bound', () => {
    const questions = [
        b('q1', 1, 'text', '1. 第一题'),
        b('q2', 1, 'text', '2. 第二题'),
        b('q3', 2, 'text', '3. 第三题')
    ];
    const answers = [
        b('a2', 1, 'text', '2. B'),
        b('a3', 1, 'text', '3. C'),
        b('a1', 1, 'text', '1. A')
    ];
    // Answer file out of order: the segmenter will report it rather than silently
    // binding C to question 2.
    const paired = P.pairPapers({ questionBlocks: questions, answerBlocks: answers, answerTable: { 1: 'A', 2: 'B', 3: 'C' } });
    assert.equal(paired.coverage.questions, 3);
    assert.equal(paired.coverage.answers, 3);
    assert.equal(paired.coverage.matched, 3);
    assert.equal(paired.coverage.paired, 0);
    assert.equal(paired.valid, false);
    assert.deepEqual(paired.questions.map(q => q.answer), ['', '', '']);
    assert.ok(paired.questions.every(q => q.solutionBlocks.length === 0));
});

test('a question with no answer in the answer file is reported, never filled in', () => {
    const questions = [b('q1', 1, 'text', '1. 一'), b('q2', 1, 'text', '2. 二'), b('q3', 1, 'text', '3. 三')];
    const answers = [b('a1', 2, 'text', '1. A'), b('a3', 2, 'text', '3. C')];
    const paired = P.pairPapers({ questionBlocks: questions, answerBlocks: answers });
    const second = paired.questions.find(q => q.questionNo === '2');
    assert.equal(second.answer, '');
    assert.equal(second.solutionBlocks.length, 0);
    assert.ok(paired.issues.some(i => i.code === 'answer-file-missing-number' && i.no === '2'));
    assert.equal(paired.coverage.matched, 2);
    assert.equal(paired.coverage.paired, 0);
    assert.ok(paired.questions.every(q => q.answer === '' && q.solutionBlocks.length === 0));
});

test('an answer for a question that does not exist is reported', () => {
    const questions = [b('q1', 1, 'text', '1. 一')];
    const answers = [b('a1', 2, 'text', '1. A'), b('a4', 2, 'text', '4. D')];
    const paired = P.pairPapers({ questionBlocks: questions, answerBlocks: answers });
    assert.ok(paired.issues.some(i => i.code === 'question-file-missing-number' && i.no === '4'));
    assert.deepEqual(paired.questions.map(q => q.questionNo), ['1']);
});
