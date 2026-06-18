const questionItems =
    [1, 2, 3, 4].map(number => ({
        question: String(number),
        questionNumber: String(number),
        stem: `SANITIZED_STEM_${number}`,
        type:
            number === 1
                ? '单选题'
                : '解答题',
        options:
            number === 1
                ? ['A. SANITIZED_OPTION_A', 'B. SANITIZED_OPTION_B']
                : []
    }));

const expectedQuestionNumbers =
    [1, 2, 3, 4];

const missingAnswerWithSolution =
    {
        id: 'missing-answer-with-solution',
        description:
            'Support text has a safe first item, an empty second answer, and later items that must not be attached.',
        expectedQuestionNumbers,
        questionItems,
        rawTextPages: [
            [
                '1. 【答案】A',
                '【解析】SANITIZED_SOLUTION_1',
                '2. 【答案】',
                '【解析】SANITIZED_SOLUTION_2',
                '3. 【答案】SANITIZED_ANSWER_3',
                '【解析】SANITIZED_SOLUTION_3',
                '4. 【答案】SANITIZED_ANSWER_4',
                '【解析】SANITIZED_SOLUTION_4'
            ].join('\n')
        ],
        expected: {
            mode: 'prefix',
            safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: ['2', '3', '4']
        }
    };

const parserStricterThanLegacy =
    {
        id: 'parser-stricter-than-legacy',
        description:
            'Legacy structured support looks complete, but parser raw text only proves a safe prefix.',
        expectedQuestionNumbers,
        questionItems,
        legacySafeAnswerItems:
            [1, 2, 3, 4].map(number => ({
                question: String(number),
                answer:
                    number === 1
                        ? 'A'
                        : `LEGACY_ANSWER_${number}`
            })),
        legacySafeSolutionItems:
            [1, 2, 3, 4].map(number => ({
                question: String(number),
                solution: `LEGACY_SOLUTION_${number}`
            })),
        parserRawTextPages:
            missingAnswerWithSolution.rawTextPages,
        expected: {
            parserMode: 'prefix',
            effectiveAnswerQuestionNumbers: ['1', '2', '3', '4'],
            effectiveSolutionQuestionNumbers: ['1', '2', '3', '4'],
            fusedQuestionNumbers: ['2', '3', '4']
        }
    };

module.exports =
    {
        expectedQuestionNumbers,
        questionItems,
        missingAnswerWithSolution,
        parserStricterThanLegacy
    };
