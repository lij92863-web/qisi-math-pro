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

const markerCoverageQuestionNumbers =
    [1, 2, 3, 4];

const markerCoverageFixture =
    {
        id: 'case02-marker-form-coverage',
        description:
            'Sanitized marker-form fixture for LaTeX/list wrapped support markers without real OCR text.',
        expectedQuestionNumbers:
            markerCoverageQuestionNumbers,
        rawTextPages: [
            {
                pageIndex: 1,
                sourceOrder: 1,
                text: [
                    '\\item[1] 銆愮瓟妗堛€慉1',
                    '\\A{銆愯В鏋愩€慡OLUTION_1}',
                    '\\A{2銆愮瓟妗堛€態2}',
                    '\\A{銆愯В鏋愩€慡OLUTION_2}'
                ].join('\n')
            },
            {
                pageIndex: 2,
                sourceOrder: 2,
                text: [
                    '\\textbf{3 銆愮瓟妗堛€慍3}',
                    '\\A_銆愯В鏋愩€慡OLUTION_3',
                    '[4] 銆愮瓟妗堛€慏4',
                    '\\A{銆愯В鏋愩€慡OLUTION_4}',
                    '\\A{13銆愮瓟妗堛€態AD_OUT_OF_RANGE}',
                    '\\A{銆愯В鏋愩€慡HOULD_NOT_ATTACH}',
                    '(15) 銆愮瓟妗堛€慉LSO_OUT_OF_RANGE'
                ].join('\n')
            }
        ],
        expected: {
            supportBlockCount:
                6,
            safeSupportBlockCount:
                4,
            answerBlockCount:
                4,
            solutionBlockCount:
                4,
            supportDetectedNumbers:
                ['1', '2', '3', '4', '13', '15'],
            answerDetectedNumbers:
                ['1', '2', '3', '4'],
            solutionDetectedNumbers:
                ['1', '2', '3', '4'],
            outOfRangeNumbers:
                ['13', '15']
        }
    };

const realStyleSectionFixture =
    {
        id: 'case02-real-style-section-sequence',
        description:
            'Sanitized real-style support pages with answer/solution labels ordered by expected question numbers.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            case02QuestionItems,
        rawTextPages: [
            {
                pageIndex: 0,
                sourceOrder: 0,
                text: [
                    'UNKNOWN_HEADER_2026_PAGE_1_SCORE_12.5',
                    '\\A_\u3010\u7b54\u6848\u3011A1',
                    '\\A{\u3010\u89e3\u6790\u3011SOLUTION_1_LINE_1}',
                    '\\A_\u3010\u7b54\u6848\u3011A2',
                    '\\A{\u3010\u89e3\u6790\u3011SOLUTION_2}',
                    'formula (1,2) and 2024 should stay continuation',
                    '\\A_\u3010\u7b54\u6848\u3011A3',
                    '\\A{\u3010\u89e3\u6790\u3011SOLUTION_3}',
                    '\\A_\u3010\u7b54\u6848\u3011A4',
                    '\\A{\u3010\u89e3\u6790\u3011SOLUTION_4_LINE_1'
                ].join('\n')
            },
            [
                'SOLUTION_4_LINE_2_CROSS_PAGE',
                '\\A_\u3010\u7b54\u6848\u3011A5',
                '\\A{\u3010\u89e3\u6790\u3011SOLUTION_5}',
                '\\A_\u3010\u7b54\u6848\u3011A6',
                '\\A{\u3010\u89e3\u6790\u3011SOLUTION_6}',
                '\\A{7\u3010\u7b54\u6848\u3011A7}',
                '\\A{\u3010\u89e3\u6790\u3011SOLUTION_7}'
            ].join('\n'),
            {
                pageIndex: 2,
                sourceOrder: 2,
                text: [
                    '\\A_\\A{\u3010\u7b54\u6848\u3011}A8',
                    '\\A_\\A{\u3010\u89e3\u6790\u3011}SOLUTION_8',
                    '\\A_\\A{\u3010\u7b54\u6848\u3011}A9',
                    '\\A_\\A{\u3010\u89e3\u6790\u3011}SOLUTION_9',
                    '\\A_\\A{\u3010\u7b54\u6848\u3011}A10',
                    '\\A_\\A{\u3010\u89e3\u6790\u3011}SOLUTION_10',
                    '\\A_\\A{\u3010\u7b54\u6848\u3011}A13',
                    '\\A_\\A{\u3010\u89e3\u6790\u3011}SOLUTION_13'
                ].join('\n')
            },
            {
                pageIndex: 3,
                sourceOrder: 3,
                text: [
                    '\\A_\\A{\u3010\u7b54\u6848\u3011}A15',
                    '\\A_\\A{\u3010\u89e3\u6790\u3011}SOLUTION_15',
                    '\\A_\\A{\u3010\u7b54\u6848\u3011}OUT_OF_RANGE_19',
                    '\\A_\\A{\u3010\u89e3\u6790\u3011}SHOULD_NOT_ATTACH_19'
                ].join('\n')
            }
        ],
        expected: {
            supportBlockCount:
                12,
            safeSupportBlockCount:
                12,
            answerBlockCount:
                12,
            solutionBlockCount:
                12,
            supportDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            answerDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            solutionDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            outOfRangeNumbers:
                [],
            exhaustedImplicitMarkers:
                2
        }
    };

module.exports =
    {
        expectedQuestionNumbers,
        questionItems,
        missingAnswerWithSolution,
        parserStricterThanLegacy,
        case02SolutionDiagnostic,
        objectRawTextPageParserGate,
        markerCoverageFixture,
        realStyleSectionFixture
    };
