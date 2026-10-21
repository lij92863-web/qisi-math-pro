const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../qisi-paper-segmenter.js');

const b = (id, text, extra = {}) => ({ id, type: 'text', text, ...extra });

test('a paper whose answer section has a gap still proves its boundary and binds the rest', () => {
    const questions = [1, 2, 3, 4, 5].map(n => b('q' + n, n + '. 棰樼洰'));
    // Answer 3 is missing from the support file (a blank answer / unreadable page).
    const answers = [1, 2, 4, 5].map(n => b('s' + n, n + '. A'));

    const paper = S.segmentPaper([...questions, ...answers]);

    assert.equal(paper.combined, true);
    assert.deepEqual(paper.questionSegment.order, ['1', '2', '3', '4', '5']);

    const built = S.assemblePartial({
        questionSegment: paper.questionSegment,
        solutionSegment: paper.solutionSegment
    });
    const byNo = new Map(built.questions.map(q => [q.questionNo, q]));
    assert.equal(byNo.get('1').answer, 'A');
    assert.equal(byNo.get('2').answer, 'A');
    assert.equal(byNo.get('3').answer, '', 'the missing one stays empty');
    assert.equal(byNo.get('4').answer, 'A');
    assert.equal(byNo.get('5').answer, 'A');
});

test('a single trailing answer does not prove a restart', () => {
    const questions = [1, 2, 3, 4, 5].map(n => b('q' + n, n + '. 棰樼洰'));
    const paper = S.segmentPaper([...questions, b('s1', '1. A')]);
    assert.equal(paper.combined, false);
});
