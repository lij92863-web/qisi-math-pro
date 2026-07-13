const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const Projection = require('../qisi-pdf-candidate-projection.js');

const draft = {
    id: 'conflict-draft-1', questionNumber: '1', type: 'choice',
    stem: 'Choose the conflict answer.',
    options: [
        { label: 'A', text: 'alpha' },
        { label: 'B', text: 'beta' }
    ],
    images: []
};

function decision({
    answer,
    accepted = true,
    sourceId = 'support-a',
    page = 2,
    blockId = 'answer-block-1',
    evidenceId = 'answer-evidence-1',
    decisionId = 'cw:conflict'
} = {}) {
    return {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [draft],
            parserSafeAnswerItems: [{
                questionNumber: '1',
                answer: accepted ? answer : 'not-an-option',
                evidenceId,
                sourceTrace: {
                    sourceFileId: sourceId,
                    sourcePage: page,
                    blockIds: [blockId]
                }
            }]
        }),
        decisionId
    };
}

test('identical duplicate accepted decisions deduplicate idempotently', () => {
    const first = decision({ answer: 'A' });
    const second = decision({ answer: 'A' });
    const merged = Projection.mergeControlledWriteDecisions(
        [first, second],
        'cw:identical-combined'
    );
    assert.equal(merged.effectiveAnswerItems.length, 1);
    assert.equal(merged.fieldDecisions.filter(item =>
        item.questionNumber === '1' && item.field === 'answer'
    ).length, 1);
    assert.equal(merged.answerQuestionNumbers.length, 1);
});

test('duplicate accepted decisions with different values fail closed', () => {
    assert.throws(
        () => Projection.mergeControlledWriteDecisions([
            decision({ answer: 'A' }),
            decision({ answer: 'B' })
        ]),
        error => error.code === 'controlled-write-conflict'
    );
});

test('equal values with different evidence ownership fail closed', () => {
    assert.throws(
        () => Projection.mergeControlledWriteDecisions([
            decision({ answer: 'A', sourceId: 'support-a' }),
            decision({
                answer: 'A', sourceId: 'support-b',
                blockId: 'answer-block-2', evidenceId: 'answer-evidence-2'
            })
        ]),
        error => error.code === 'controlled-write-conflict'
    );
});

test('one rejected and one accepted decision preserves the accepted policy', () => {
    const merged = Projection.mergeControlledWriteDecisions([
        decision({ accepted: false }),
        decision({ answer: 'A', accepted: true })
    ]);
    assert.deepEqual(merged.answerQuestionNumbers, ['1']);
    assert.equal(merged.effectiveAnswerItems[0].answer, 'A');
    assert.equal(merged.fieldDecisions.find(item =>
        item.questionNumber === '1' && item.field === 'answer'
    ).source, 'parser');
});

test('two rejected decisions retain rejection and never upgrade', () => {
    const merged = Projection.mergeControlledWriteDecisions([
        decision({ accepted: false, decisionId: 'cw:rejected-a' }),
        decision({ accepted: false, decisionId: 'cw:rejected-b' })
    ]);
    assert.deepEqual(merged.answerQuestionNumbers, []);
    assert.deepEqual(merged.effectiveAnswerItems, []);
    assert.equal(merged.fieldDecisions.find(item =>
        item.questionNumber === '1' && item.field === 'answer'
    ).source, 'none');
});
