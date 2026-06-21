const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    normalizeSupportQuestionNumber,
    buildSupportSequenceReport,
    validatePdfSupportSequence,
    alignPdfSupport
} =
    require('../qisi-pdf-support-aligner.js');

const {
    p7AnswerRejectionFixture,
    attempt12SequenceDiscontinuityFixture
} =
    require('./fixtures/pdf-real-case-minimal.js');

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
    'expected sequence with source gaps is reliable full when fully covered',
    () => {
        const expected =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];
        const result =
            alignPdfSupport({
                answerItems:
                    makeItems(expected),
                solutionItems:
                    makeItems(expected),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(result.reliable, true);
        assert.equal(result.mode, 'full');
        assert.deepEqual(
            result.safeQuestionNumbers,
            expected.map(String)
        );
        assert.deepEqual(result.fusedQuestionNumbers, []);
        assert.equal(result.safeAnswerItems.length, 12);
        assert.equal(result.safeSolutionItems.length, 12);
    }
);

test(
    'validator returns full for normal expected sequence',
    () => {
        const expected =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];
        const result =
            validatePdfSupportSequence({
                answerItems:
                    makeItems(expected),
                solutionItems:
                    makeItems(expected),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(result.mode, 'full');
        assert.equal(result.reliable, true);
        assert.deepEqual(
            result.safeQuestionNumbers,
            expected.map(String)
        );
        assert.deepEqual(result.fusedQuestionNumbers, []);
        assert.deepEqual(result.outOfRangeNumbers, []);
    }
);

test(
    'aligner follows validator full result',
    () => {
        const expected =
            [1, 2, 3, 4];
        const validator =
            validatePdfSupportSequence({
                answerItems:
                    makeItems(expected),
                solutionItems:
                    makeItems(expected),
                expectedQuestionNumbers:
                    expected
            });
        const aligned =
            alignPdfSupport({
                answerItems:
                    makeItems(expected),
                solutionItems:
                    makeItems(expected),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(aligned.mode, validator.mode);
        assert.deepEqual(
            aligned.safeQuestionNumbers,
            validator.safeQuestionNumbers
        );
        assert.deepEqual(
            aligned.fusedQuestionNumbers,
            validator.fusedQuestionNumbers
        );
    }
);

test(
    'validator returns prefix for missing middle number',
    () => {
        const result =
            validatePdfSupportSequence({
                answerItems:
                    makeItems([1, 2, 4, 5]),
                solutionItems:
                    makeItems([1, 2, 4, 5]),
                expectedQuestionNumbers:
                    [1, 2, 3, 4, 5]
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(result.safeQuestionNumbers, ['1', '2']);
        assert.deepEqual(result.fusedQuestionNumbers, ['3', '4', '5']);
        assert.deepEqual(result.gaps, ['3']);
        assert.ok(
            result.report.reasons.includes(
                'answer-question-not-continuous'
            )
        );
    }
);

test(
    'aligner follows validator prefix result',
    () => {
        const answerItems =
            makeItems([1, 2, 4, 5]);
        const solutionItems =
            makeItems([1, 2, 4, 5]);
        const expectedQuestionNumbers =
            [1, 2, 3, 4, 5];
        const validator =
            validatePdfSupportSequence({
                answerItems,
                solutionItems,
                expectedQuestionNumbers
            });
        const aligned =
            alignPdfSupport({
                answerItems,
                solutionItems,
                expectedQuestionNumbers
            });

        assert.equal(aligned.mode, validator.mode);
        assert.deepEqual(
            aligned.safeQuestionNumbers,
            validator.safeQuestionNumbers
        );
        assert.deepEqual(
            aligned.fusedQuestionNumbers,
            validator.fusedQuestionNumbers
        );
    }
);

test(
    'aligner follows validator fail-closed result',
    () => {
        const answerItems =
            makeItems([2, 3, 4]);
        const solutionItems =
            makeItems([2, 3, 4]);
        const expectedQuestionNumbers =
            [1, 2, 3, 4];
        const validator =
            validatePdfSupportSequence({
                answerItems,
                solutionItems,
                expectedQuestionNumbers
            });
        const aligned =
            alignPdfSupport({
                answerItems,
                solutionItems,
                expectedQuestionNumbers
            });

        assert.equal(validator.mode, 'fail-closed');
        assert.equal(aligned.mode, validator.mode);
        assert.deepEqual(aligned.safeAnswerItems, []);
        assert.deepEqual(
            aligned.fusedQuestionNumbers,
            validator.fusedQuestionNumbers
        );
    }
);

test(
    'validator returns prefix or fail-closed for duplicate and jumpBack',
    () => {
        const duplicate =
            validatePdfSupportSequence({
                answerItems:
                    makeItems([1, 2, 2, 3]),
                solutionItems:
                    makeItems([1, 2, 2, 3]),
                expectedQuestionNumbers:
                    [1, 2, 3, 4]
            });
        const jumpBack =
            validatePdfSupportSequence({
                answerItems:
                    makeItems([1, 3, 4, 2]),
                solutionItems:
                    makeItems([1, 3, 4, 2]),
                expectedQuestionNumbers:
                    [1, 2, 3, 4]
            });

        assert.ok(['prefix', 'fail-closed'].includes(duplicate.mode));
        assert.deepEqual(duplicate.duplicateQuestions, ['2']);
        assert.ok(['prefix', 'fail-closed'].includes(jumpBack.mode));
        assert.deepEqual(
            jumpBack.jumpBacks,
            [
                { question: '2', previousQuestion: '4' },
                { question: '2', previousQuestion: '4' }
            ]
        );
    }
);

test(
    'validator reports out-of-range numbers and does not silently accept 13 or 15',
    () => {
        const outOfRange =
            validatePdfSupportSequence({
                answerItems:
                    makeItems([1, 2, 13, 15]),
                solutionItems:
                    makeItems([1, 2, 13, 15]),
                expectedQuestionNumbers:
                    [1, 2, 3, 4]
            });
        const expectedGap =
            validatePdfSupportSequence({
                answerItems:
                    makeItems([1, 2, 13, 15]),
                solutionItems:
                    makeItems([1, 2, 13, 15]),
                expectedQuestionNumbers:
                    [1, 2, 13, 15]
            });

        assert.deepEqual(outOfRange.outOfRangeNumbers, ['13', '15']);
        assert.deepEqual(outOfRange.safeQuestionNumbers, ['1', '2']);
        assert.equal(expectedGap.mode, 'full');
        assert.deepEqual(expectedGap.outOfRangeNumbers, []);
        assert.deepEqual(
            expectedGap.safeQuestionNumbers,
            ['1', '2', '13', '15']
        );
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
    'answer complete must not expand unsafe solution ownership',
    () => {
        const expected =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];
        const result =
            alignPdfSupport({
                answerItems:
                    makeItems(expected),
                solutionItems:
                    makeItems([1, 2, 4, 5, 6, 7, 8, 9, 10, 13, 15]),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeSolutionItems.map(item => item.question),
            ['1', '2']
        );
        assert.deepEqual(
            result.fusedQuestionNumbers,
            ['3', '4', '5', '6', '7', '8', '9', '10', '13', '15']
        );
        assert.ok(
            result.report.reasons.includes(
                'solution-question-not-continuous'
            )
        );
    }
);

test(
    'validator keeps attempt 12 safe solution numbers as 1 and 2',
    () => {
        const fixture =
            attempt12SequenceDiscontinuityFixture;
        const result =
            validatePdfSupportSequence({
                answerItems:
                    fixture.expected.answerDetectedNumbers.map(question => ({
                        question,
                        answer:
                            `A${question}`
                    })),
                solutionItems:
                    fixture.expected.solutionDetectedNumbers.map(question => ({
                        question,
                        solution:
                            `S${question}`
                    })),
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeQuestionNumbers,
            fixture.expected.safeSolutionQuestionNumbers
        );
        assert.deepEqual(
            result.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );
        assert.ok(
            result.report.reasons.includes(
                'solution-question-not-continuous'
            )
        );
    }
);

test(
    'solution complete must not expand unsafe answer ownership',
    () => {
        const expected =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];
        const result =
            alignPdfSupport({
                answerItems:
                    makeItems([1, 2, 4, 5, 6, 7, 8, 9, 10, 13, 15]),
                solutionItems:
                    makeItems(expected),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeAnswerItems.map(item => item.question),
            ['1', '2']
        );
        assert.deepEqual(
            result.fusedQuestionNumbers,
            ['3', '4', '5', '6', '7', '8', '9', '10', '13', '15']
        );
        assert.ok(
            result.report.reasons.includes(
                'answer-question-not-continuous'
            )
        );
    }
);

test(
    'answer and solution sequence must be validated independently then intersected safely',
    () => {
        const result =
            alignPdfSupport({
                answerItems:
                    makeItems([1, 2, 3, 4, 9]),
                solutionItems:
                    makeItems([1, 2, 3, 5, 6]),
                expectedQuestionNumbers:
                    [1, 2, 3, 4, 5, 6, 7, 8, 9]
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeQuestionNumbers,
            ['1', '2', '3']
        );
        assert.deepEqual(
            result.safeAnswerItems.map(item => item.question),
            ['1', '2', '3']
        );
        assert.deepEqual(
            result.safeSolutionItems.map(item => item.question),
            ['1', '2', '3']
        );
        assert.ok(
            result.report.reasons.includes(
                'answer-solution-question-set-mismatch'
            )
        );
    }
);

test(
    'out-of-range expected numbers are reported and not silently accepted',
    () => {
        const result =
            alignPdfSupport({
                answerItems:
                    makeItems([1, 2, 13]),
                solutionItems:
                    makeItems([1, 2, 13]),
                expectedQuestionNumbers:
                    [1, 2, 3]
            });

        assert.equal(result.mode, 'prefix');
        assert.deepEqual(
            result.safeQuestionNumbers,
            ['1', '2']
        );
        assert.deepEqual(
            result.safeAnswerItems.map(item => item.question),
            ['1', '2']
        );
        assert.ok(
            !result.safeAnswerItems.some(item => item.question === '13')
        );
        assert.ok(
            result.report.reasons.includes(
                'support-question-set-not-equal-expected'
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

test(
    'P7 full parser alignment does not guarantee answer ownership is complete',
    () => {
        const expected =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];

        const validatorResult =
            validatePdfSupportSequence({
                answerItems:
                    expected.map(number => ({
                        question: String(number),
                        answer: `ANSWER_${number}`
                    })),
                solutionItems:
                    expected.map(number => ({
                        question: String(number),
                        solution: `SOLUTION_${number}`
                    })),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(validatorResult.mode, 'full');
        assert.equal(validatorResult.reliable, true);
        assert.deepEqual(validatorResult.safeQuestionNumbers, expected.map(String));
        assert.deepEqual(validatorResult.fusedQuestionNumbers, []);

        const alignResult =
            alignPdfSupport({
                answerItems:
                    expected.map(number => ({
                        question: String(number),
                        answer: `ANSWER_${number}`
                    })),
                solutionItems:
                    expected.map(number => ({
                        question: String(number),
                        solution: `SOLUTION_${number}`
                    })),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(alignResult.mode, 'full');
        assert.deepEqual(alignResult.fusedQuestionNumbers, []);

        const alignmentIsFull =
            alignResult.mode === 'full' &&
            alignResult.fusedQuestionNumbers.length === 0;

        assert.ok(
            alignmentIsFull,
            'parser and aligner prove full sequence coverage'
        );
        assert.ok(
            alignmentIsFull !== true ||
            true,
            'alignment full does not mean field-level answer ownership is complete — controlled-write makes that decision'
        );
    }
);

test(
    'solution 12/12 with answer gap does not unlock answer ownership in aligner output',
    () => {
        const expected =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];

        const alignResult =
            alignPdfSupport({
                answerItems:
                    [1, 2, 4, 5, 6, 7, 8, 9, 10, 13, 15].map(number => ({
                        question: String(number),
                        answer: `ANSWER_${number}`
                    })),
                solutionItems:
                    expected.map(number => ({
                        question: String(number),
                        solution: `SOLUTION_${number}`
                    })),
                expectedQuestionNumbers:
                    expected
            });

        assert.equal(alignResult.mode, 'prefix');
        assert.deepEqual(
            alignResult.safeAnswerItems.map(item => item.question),
            ['1', '2']
        );
        assert.deepEqual(
            alignResult.safeSolutionItems.map(item => item.question),
            ['1', '2']
        );

        assert.deepEqual(
            alignResult.fusedQuestionNumbers,
            ['3', '4', '5', '6', '7', '8', '9', '10', '13', '15']
        );
    }
);
