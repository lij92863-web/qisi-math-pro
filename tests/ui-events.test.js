const test = require('node:test');
const assert = require('node:assert/strict');
const {
    bindClick,
    buildQuestionNumberGapWarning,
    buildKnowledgeCounts
} = require('../qisi-ui-events.js');

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

test('BMR6: buildKnowledgeCounts counts leaf knowledge and parents', () => {
    const tree = [
        {
            name: 'Function',
            children: [
                {
                    name: 'Derivative',
                    children: [
                        { name: 'Chain Rule' }
                    ]
                }
            ]
        }
    ];
    const questions = [
        { knowledgePoint: 'Chain Rule' },
        { knowledgePoint: 'Derivative' },
        { knowledgePoint: '' }
    ];

    const counts = buildKnowledgeCounts(
        tree,
        'system',
        questions,
        (question, type) => type === 'system' ? question.knowledgePoint : question.personalKnowledgePoint
    );

    assert.deepEqual(counts, {
        'Chain Rule': 1,
        Derivative: 2,
        Function: 2
    });
});

test('BMR6: buildKnowledgeCounts passes type through for personal knowledge', () => {
    const counts = buildKnowledgeCounts(
        [{ name: 'Custom', children: [{ name: 'My Tag' }] }],
        'personal',
        [{ personalKnowledgePoint: 'My Tag' }],
        (question, type) => type === 'personal' ? question.personalKnowledgePoint : question.knowledgePoint
    );

    assert.deepEqual(counts, {
        'My Tag': 1,
        Custom: 1
    });
});

test('BMR6: buildKnowledgeCounts handles empty inputs safely', () => {
    assert.deepEqual(buildKnowledgeCounts(null, 'system', null, () => 'Any'), {});
    assert.deepEqual(buildKnowledgeCounts([], 'system', [{ knowledgePoint: 'Any' }], null), {});
    assert.deepEqual(buildKnowledgeCounts([], 'system', [], () => 'Any'), {});
});
