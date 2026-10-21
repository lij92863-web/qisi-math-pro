const test = require('node:test');
const assert = require('node:assert/strict');
const parts = require('../qisi-exam-paper-parts.js');

test('buildHeaderFields respects the template and the show flag', () => {
    assert.equal(parts.buildHeaderFields({ show: false, template: 'examZh' }), '');
    assert.equal(parts.buildHeaderFields({ show: true, template: 'examZh' }),
        '<div class="student-fields"><span>班级<i></i></span><span>姓名<i></i></span><span>考号<i></i></span></div>');
    assert.match(parts.buildHeaderFields({ show: true, template: 'other' }), /班别.*姓名.*评分/);
});

test('buildAnswerGrid clamps the grid and line counts', () => {
    assert.equal(parts.buildAnswerGrid({ show: false, count: 5 }), '');
    const grid = parts.buildAnswerGrid({ show: true, count: 99, config: { answerLineCount: 99 } });
    assert.equal((grid.match(/<td>\d+<\/td>/g) || []).length, 20);
    assert.equal((grid.match(/<span>\d+\.<i><\/i><\/span>/g) || []).length, 10);
    const one = parts.buildAnswerGrid({ show: true, count: 0, config: {} });
    assert.equal((one.match(/<td>\d+<\/td>/g) || []).length, 1);
    assert.equal((one.match(/<span>\d+\.<i><\/i><\/span>/g) || []).length, 0);
});

test('buildNotice switches the exam notice text', () => {
    assert.equal(parts.buildNotice({ show: false, template: 'examZh' }), '');
    assert.match(parts.buildNotice({ show: true, template: 'examZh' }), /准考证号/);
    assert.match(parts.buildNotice({ show: true, template: 'other' }), /保持卷面整洁/);
    assert.equal(parts.buildNotice({ show: true, template: 'examZh' }), parts.NOTICE_EXAM_ZH);
});

test('buildAnswerContent renders answers and solutions through the page renderer', () => {
    const calls = [];
    const content = parts.buildAnswerContent({
        questions: [
            { answer: 'A', solution: 'S', images: [{ id: 'i1' }] },
            { answer: '', solution: '', images: [] }
        ],
        forceNewPage: true,
        render: (text, images) => { calls.push([text, images.length]); return 'R(' + text + ')'; }
    });
    assert.match(content, /answer-section new-page/);
    assert.match(content, /R\(A\)/);
    assert.match(content, /R\(S\)/);
    assert.match(content, /________/);
    assert.deepEqual(calls, [['A', 1], ['S', 1]]);
});

test('buildAnswerContent respects forceNewPage and empty input', () => {
    const content = parts.buildAnswerContent({ questions: [], forceNewPage: false, render: () => 'x' });
    assert.match(content, /class="answer-section /);
    assert.doesNotMatch(content, /new-page/);
});

test('buildAnswerContent fails closed without a renderer', () => {
    assert.throws(() => parts.buildAnswerContent({ questions: [] }), error => error.code === 'EXAM_PAPER_RENDER_REQUIRED');
});
