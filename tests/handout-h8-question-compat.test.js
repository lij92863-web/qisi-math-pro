'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const questionInstance = require(
    '../qisi-handout-question-instance.js'
);

const makeQuestion = timestamp => ({
    id: 'question-from-main-entry',
    createdAt: timestamp,
    questionNumber: '1',
    stem: '已知 $f(x)=x^2+1$，求 $f(2)$。',
    options: ['$3$', '$4$', '$5$', '$6$'],
    answer: 'C',
    analysis: '代入计算。',
    solution: '$f(2)=5$。',
    images: []
});

test('H8 handout snapshot accepts main-entry millisecond timestamps', () => {
    const snapshot = questionInstance.createQuestionSnapshot(
        makeQuestion(1785332534799),
        {
            capturedAt: '2026-07-29T13:30:00.000Z'
        }
    );

    assert.equal(
        snapshot.sourceUpdatedAt,
        '2026-07-29T13:42:14.799Z'
    );
    assert.equal(
        snapshot.capturedAt,
        '2026-07-29T13:30:00.000Z'
    );
});

test('H8 handout snapshot accepts portable second timestamps', () => {
    const snapshot = questionInstance.createQuestionSnapshot(
        makeQuestion('1785332534'),
        {
            capturedAt: new Date('2026-07-29T13:30:00.000Z')
        }
    );

    assert.equal(
        snapshot.sourceUpdatedAt,
        '2026-07-29T13:42:14.000Z'
    );
});

test('H8 handout snapshot still rejects malformed timestamps', () => {
    assert.throws(
        () => questionInstance.createQuestionSnapshot(
            makeQuestion('not-a-time'),
            {
                capturedAt: '2026-07-29T13:30:00.000Z'
            }
        ),
        /source timestamp is invalid/
    );
});
