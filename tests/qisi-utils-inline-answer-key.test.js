const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../qisi-utils.js');

// An answer key is a stream of entries: several per line, wrapped at arbitrary places, and a line may
// begin with the tail of the previous entry. These are the shapes of the real files, not one paper's
// text.
const REAL_SHAPE = [
    '高二数学练习',
    '1. 设集合 $A$，则（ ）',
    '高二答案',
    '1．2 2．3 3．2 4．56 5．$\\frac{1}{2}$',
    '$x$ 7．1 8．ABD 9．3 10．$\\sqrt{2}$',
    '11．甲 12．乙'
].join('\n');

test('a key with several entries per line and wrapped lines is read as one stream', () => {
    const entries = utils.extractInlineAnswerKey(REAL_SHAPE);

    assert.deepEqual(entries, [
        { questionNumber: '1', answer: '2' },
        { questionNumber: '2', answer: '3' },
        { questionNumber: '3', answer: '2' },
        { questionNumber: '4', answer: '56' },
        // Question 5's value runs onto the next line, so its own key entry is incomplete: it is
        // dropped rather than swallowing the orphan fragment, which belongs to the question whose
        // marker the file lost.
        { questionNumber: '7', answer: '1' },
        { questionNumber: '8', answer: 'ABD' },
        { questionNumber: '9', answer: '3' },
        { questionNumber: '10', answer: '$\\sqrt{2}$' },
        { questionNumber: '11', answer: '甲' },
        { questionNumber: '12', answer: '乙' }
    ]);
    assert.equal(entries.some(entry => entry.questionNumber === '6'), false, 'the wrapped tail starts no entry');
});

test('the heading decides where the key starts, so question text is never read as a key', () => {
    assert.deepEqual(
        utils.extractInlineAnswerKey(['一、选择题', '1．甲 2．乙'].join('\n')),
        [],
        'without an answer heading nothing is read as a key'
    );

    assert.deepEqual(
        utils.extractInlineAnswerKey(['参考答案', '1．甲 2．乙'].join('\n')),
        [
            { questionNumber: '1', answer: '甲' },
            { questionNumber: '2', answer: '乙' }
        ]
    );

    assert.deepEqual(
        utils.extractInlineAnswerKey(['答案', '１．甲 ２．乙'].join('\n')),
        [
            { questionNumber: '1', answer: '甲' },
            { questionNumber: '2', answer: '乙' }
        ],
        'fullwidth digits normalise'
    );
});

test('an unusable entry is skipped, and its neighbours keep their own value', () => {
    assert.deepEqual(
        utils.extractInlineAnswerKey(['答案', '3． 4．丁 0．甲'].join('\n')),
        [{ questionNumber: '4', answer: '丁' }]
    );

    assert.deepEqual(
        utils.extractInlineAnswerKey(['答案', `5．${'甲'.repeat(90)} 6．乙`].join('\n')),
        [{ questionNumber: '6', answer: '乙' }],
        'an implausibly long value is skipped, not trusted'
    );
});
