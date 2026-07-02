const test = require('node:test');
const assert = require('node:assert/strict');
const { bindClick, buildQuestionNumberGapWarning } = require('../qisi-ui-events.js');

test('BM15: bindClick returns false for null element', () => {
    assert.equal(bindClick(null, () => {}), false);
});

test('BMR5: buildQuestionNumberGapWarning reports missing question numbers', () => {
    const warning = buildQuestionNumberGapWarning([
        { questionNumber: '1' },
        { questionNumber: '3' },
        { questionNumber: '6' }
    ]);

    assert.equal(
        warning,
        '原文件题号不连续，未识别到题号：2、4、5。系统未自动补题，请核对原文件。'
    );
});

test('BMR5: buildQuestionNumberGapWarning ignores duplicates and blank values', () => {
    assert.equal(buildQuestionNumberGapWarning([
        { questionNumber: '第1题' },
        { questionNumber: '1' },
        { questionNumber: '2' },
        { questionNumber: '' }
    ]), '');
});

test('BMR5: buildQuestionNumberGapWarning handles empty and short inputs', () => {
    assert.equal(buildQuestionNumberGapWarning(), '');
    assert.equal(buildQuestionNumberGapWarning(null), '');
    assert.equal(buildQuestionNumberGapWarning([{ questionNumber: '7' }]), '');
});
