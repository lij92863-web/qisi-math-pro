const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    buildSupportRepairPlan,
    applySupportRepairsFillOnly
} =
    require(
        '../qisi-support-repair.js'
    );

test(
    'builds an answer-only repair request when solution already exists',
    () => {
        const plan =
            buildSupportRepairPlan({
                blocks: [{
                    questionNumber:
                        '12',

                    rawBlock:
                        '12 answer empty\nsolution max is $2$',

                    hasSolutionLabel:
                        true,

                    sourcePage:
                        5,

                    questionEvidence:
                        'explicit-support-marker'
                }],

                answers: [],

                solutions: [{
                    question:
                        '12',

                    solution:
                        'max is $2$'
                }],

                requireAnswers:
                    true,

                requireSolutions:
                    true
            });

        assert.equal(
            plan.length,
            1
        );

        assert.equal(
            plan[0]
                .questionNumber,
            '12'
        );

        assert.deepEqual(
            plan[0]
                .missingFields,
            ['answer']
        );

        assert.equal(
            plan[0]
                .existingSolution,
            'max is $2$'
        );
    }
);

test(
    'does not build a repair request when all required fields exist',
    () => {
        const plan =
            buildSupportRepairPlan({
                blocks: [{
                    questionNumber:
                        '1',

                    rawBlock:
                        '1 answer A\nsolution detail',

                    hasSolutionLabel:
                        true
                }],

                answers: [{
                    question:
                        '1',

                    answer:
                        'A'
                }],

                solutions: [{
                    question:
                        '1',

                    solution:
                        'detail'
                }],

                requireAnswers:
                    true,

                requireSolutions:
                    true
            });

        assert.deepEqual(
            plan,
            []
        );
    }
);

test(
    'fills a missing answer without replacing an existing solution',
    () => {
        const originalSolution = {
            question:
                '12',

            solution:
                'OCR original complete solution',

            source:
                'ocr'
        };

        const result =
            applySupportRepairsFillOnly({
                answers: [],

                solutions: [
                    originalSolution
                ],

                repairedAnswers: [{
                    question:
                        '12',

                    answer:
                        '$\\frac{1+\\sqrt{2}}{2}$'
                }],

                repairedSolutions: [{
                    question:
                        '12',

                    solution:
                        'AI generated longer solution should not overwrite'
                }],

                allowedQuestionNumbers:
                    ['12']
            });

        assert.equal(
            result.answers.length,
            1
        );

        assert.equal(
            result.answers[0]
                .answer,
            '$\\frac{1+\\sqrt{2}}{2}$'
        );

        assert.equal(
            result.solutions.length,
            1
        );

        assert.strictEqual(
            result.solutions[0],
            originalSolution
        );

        assert.deepEqual(
            result.diagnostics
                .skippedExisting,
            [{
                kind:
                    'solution',

                questionNumber:
                    '12'
            }]
        );
    }
);

test(
    'never overwrites an existing answer',
    () => {
        const existingAnswer = {
            question:
                '1',

            answer:
                'A'
        };

        const result =
            applySupportRepairsFillOnly({
                answers: [
                    existingAnswer
                ],

                solutions: [],

                repairedAnswers: [{
                    question:
                        '1',

                    answer:
                        'B'
                }],

                allowedQuestionNumbers:
                    ['1']
            });

        assert.equal(
            result.answers.length,
            1
        );

        assert.strictEqual(
            result.answers[0],
            existingAnswer
        );

        assert.equal(
            result.answers[0]
                .answer,
            'A'
        );
    }
);

test(
    'rejects a repaired field for an unrequested question number',
    () => {
        const result =
            applySupportRepairsFillOnly({
                answers: [],
                solutions: [],

                repairedAnswers: [{
                    question:
                        '99',

                    answer:
                        'A'
                }],

                allowedQuestionNumbers:
                    ['12']
            });

        assert.deepEqual(
            result.answers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .skippedUnknown,
            [{
                kind:
                    'answer',

                questionNumber:
                    '99'
            }]
        );
    }
);
