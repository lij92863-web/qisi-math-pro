const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    normalizeSupportQuestionNumber,
    buildSupportSequenceReport,
    alignPdfSupport
} =
    require('../qisi-pdf-support-aligner.js');

const makeItems = values =>
    values.map(value => ({
        question: String(value),
        answer: `A${value}`,
        solution: `S${value}`
    }));

test(
    'normal sequence 1-6 is reliable full',
    () => {
        const answerItems =
            makeItems([1, 2, 3, 4, 5, 6]);
        const solutionItems =
            makeItems([1, 2, 3, 4, 5, 6]);

        const result =
            alignPdfSupport({
                answerItems,
                solutionItems
            });

        assert.equal(result.reliable, true);
        assert.equal(result.mode, 'full');
        assert.deepEqual(
            result.safeQuestionNumbers,
            ['1', '2', '3', '4', '5', '6']
        );
        assert.deepEqual(result.fusedQuestionNumbers, []);
        assert.equal(result.safeAnswerItems.length, 6);
        assert.equal(result.safeSolutionItems.length, 6);
    }
);

test(
    'prefix 1 then missing 2 only returns question 1',
    () => {
        const result =
            alignPdfSupport({
                answerItems: makeItems([1, 3, 4, 5, 6]),
                solutionItems: makeItems([1, 3, 4, 5, 6]),
                expectedQuestionNumbers: [1, 2, 3, 4, 5, 6]
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeAnswerItems.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            result.safeSolutionItems.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            result.fusedQuestionNumbers,
            ['2', '3', '4', '5', '6']
        );
        assert.ok(
            result.report.reasons.includes(
                'answer-question-not-continuous'
            )
        );
    }
);

test(
    'known bad jump-back sequence returns at most prefix 1',
    () => {
        const values =
            [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 2];
        const result =
            alignPdfSupport({
                answerItems: makeItems(values),
                solutionItems: makeItems(values),
                expectedQuestionNumbers:
                    Array.from(
                        { length: 12 },
                        (_, index) => index + 1
                    )
            });

        assert.notEqual(result.mode, 'full');
        assert.ok(
            ['prefix', 'fail-closed'].includes(result.mode)
        );
        assert.ok(result.safeAnswerItems.length <= 1);
        assert.ok(
            result.safeAnswerItems.every(
                item => item.question === '1'
            )
        );
        assert.ok(
            result.report.reasons.includes(
                'answer-question-not-increasing'
            )
        );
    }
);

test(
    'duplicate sequence stops prefix before duplicate',
    () => {
        const result =
            alignPdfSupport({
                answerItems: makeItems([1, 2, 2, 3]),
                solutionItems: makeItems([1, 2, 2, 3]),
                expectedQuestionNumbers: [1, 2, 3, 4]
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeQuestionNumbers,
            ['1', '2']
        );
        assert.ok(
            result.report.reasons.includes(
                'answer-question-duplicate'
            )
        );
    }
);

test(
    'answer and solution question set mismatch stops prefix',
    () => {
        const result =
            alignPdfSupport({
                answerItems: makeItems([1, 2, 3]),
                solutionItems: makeItems([1, 2, 4]),
                expectedQuestionNumbers: [1, 2, 3, 4]
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeQuestionNumbers,
            ['1', '2']
        );
        assert.ok(
            result.report.reasons.includes(
                'answer-solution-question-set-mismatch'
            )
        );
    }
);

test(
    'reliable prefix 1-4 returns prefix mode',
    () => {
        const answerItems =
            makeItems([1, 2, 3, 4, 9, 2]);
        const solutionItems =
            makeItems([1, 2, 3, 4, 9, 2]);
        const result =
            alignPdfSupport({
                answerItems,
                solutionItems
            });

        assert.equal(result.mode, 'prefix');
        assert.equal(result.reliable, false);
        assert.deepEqual(
            result.safeQuestionNumbers,
            ['1', '2', '3', '4']
        );
        assert.deepEqual(
            result.fusedQuestionNumbers,
            ['9', '2']
        );
        assert.deepEqual(
            result.safeAnswerItems.map(item => item.question),
            ['1', '2', '3', '4']
        );
        assert.deepEqual(
            result.safeSolutionItems.map(item => item.question),
            ['1', '2', '3', '4']
        );
    }
);

test(
    'start not matching expected first question fails closed',
    () => {
        const result =
            alignPdfSupport({
                answerItems: makeItems([1, 2, 3]),
                solutionItems: makeItems([1, 2, 3]),
                expectedQuestionNumbers: [2, 3, 4]
            });

        assert.equal(result.mode, 'fail-closed');
        assert.deepEqual(result.safeAnswerItems, []);
        assert.deepEqual(
            result.fusedQuestionNumbers,
            ['2', '3', '4']
        );
    }
);

test(
    'first answer and solution question mismatch fails closed',
    () => {
        const result =
            alignPdfSupport({
                answerItems: makeItems([1, 2, 3]),
                solutionItems: makeItems([2, 3, 4]),
                expectedQuestionNumbers: [1, 2, 3, 4]
            });

        assert.equal(result.mode, 'fail-closed');
        assert.deepEqual(result.safeSolutionItems, []);
        assert.ok(
            result.report.reasons.includes(
                'answer-solution-question-set-mismatch'
            )
        );
    }
);

test(
    'expected 1-12 but support has eleven out-of-order items cannot be full',
    () => {
        const values =
            [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 2];
        const result =
            alignPdfSupport({
                answerItems: makeItems(values),
                solutionItems: makeItems(values),
                expectedQuestionNumbers:
                    Array.from(
                        { length: 12 },
                        (_, index) => index + 1
                    )
            });

        assert.notEqual(result.mode, 'full');
        assert.ok(result.safeAnswerItems.length <= 1);
        assert.ok(
            result.report.reasons.includes(
                'support-question-set-not-equal-expected'
            )
        );
    }
);

test(
    'case02 empty parser output fails closed with expected draft numbers fused',
    () => {
        const expectedQuestionNumbers =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];
        const result =
            alignPdfSupport({
                answerItems: [],
                solutionItems: [],
                expectedQuestionNumbers
            });

        assert.equal(result.mode, 'fail-closed');
        assert.equal(result.reliable, false);
        assert.deepEqual(result.safeAnswerItems, []);
        assert.deepEqual(result.safeSolutionItems, []);
        assert.deepEqual(
            result.fusedQuestionNumbers,
            expectedQuestionNumbers.map(String)
        );
        assert.ok(
            result.report.reasons.includes(
                'support-question-set-not-equal-expected'
            )
        );
    }
);

test(
    'normalizes fullwidth and labelled question numbers',
    () => {
        assert.equal(
            normalizeSupportQuestionNumber('第０５题'),
            '5'
        );

        const report =
            buildSupportSequenceReport({
                answerItems: [{ question: '第１题' }],
                solutionItems: [{ questionNumber: '1' }]
            });

        assert.equal(report.ok, true);
    }
);
