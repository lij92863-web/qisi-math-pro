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

const case02QuestionNumbers =
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];

const case02QuestionItems =
    case02QuestionNumbers.map(number => ({
        question: String(number),
        questionNumber: String(number),
        stem: `CASE02_SANITIZED_STEM_${number}`,
        type:
            number === 1
                ? '鍗曢€夐'
                : 'subjective',
        options:
            number === 1
                ? ['A. CASE02_OPTION_A', 'B. CASE02_OPTION_B']
                : [],
        answer:
            `CASE02_SANITIZED_ANSWER_${number}`
    }));

const case02SolutionDiagnostic =
    {
        id: 'case02-solution-diagnostic-2026-06-18',
        description:
            'Real diagnostic shape: support raw pages exist, parser emits no support blocks, aligner fails closed, and controlled write keeps only legacy solution 1.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            case02QuestionItems,
        parserRawTextPages:
            [1, 2, 3, 4].map(number =>
                `CASE02_SANITIZED_UNPARSED_SUPPORT_PAGE_${number}`
            ),
        legacySafeAnswerItems:
            [
                {
                    question: '1',
                    answer: 'A'
                }
            ],
        legacySafeSolutionItems:
            [
                {
                    question: '1',
                    solution: 'CASE02_SANITIZED_LEGACY_SOLUTION_1'
                }
            ],
        expected: {
            questionCount: 12,
            answerCount: 12,
            solutionCount: 1,
            supportRawPageCount: 4,
            supportBlockCount: 0,
            answerBlockCount: 0,
            solutionBlockCount: 0,
            supportDetectedNumbers: [],
            answerDetectedNumbers: [],
            solutionDetectedNumbers: [],
            outOfRangeNumbers: [],
            rejectedSolutionNumbers: [],
            missingSolutions:
                ['2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            fusedQuestionNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            missingSolutionReason:
                'pdf-support-sequence-unreliable',
            mode:
                'fail-closed',
            failClosed:
                true,
            prefix:
                true,
            writableSolutionNumbers:
                ['1'],
            coverageState:
                'incomplete',
            usableState:
                'usable-only-for-answer-full-and-solution-1',
            targetState:
                'complete'
        }
    };

const objectRawTextPageParserGate =
    {
        id: 'object-raw-text-page-parser-gate',
        description:
            'Parser gate must preserve text/pageIndex/sourceOrder when rawTextPages already contains page objects.',
        expectedQuestionNumbers,
        rawTextPages:
            missingAnswerWithSolution.rawTextPages.map((text, index) => ({
                text,
                pageIndex:
                    index + 1,
                sourceOrder:
                    index + 1
            })),
        expected: {
            parserMode:
                'prefix',
            rawTextPagesCount:
                1,
            supportBlockCount:
                4,
            answerQuestionNumbers:
                ['1'],
            solutionQuestionNumbers:
                ['1'],
            fusedQuestionNumbers:
                ['2', '3', '4']
        }
    };

module.exports =
    {
        expectedQuestionNumbers,
        questionItems,
        missingAnswerWithSolution,
        parserStricterThanLegacy,
        case02SolutionDiagnostic,
        objectRawTextPageParserGate
    };
