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

const residualMarkerAnswerLabel =
    '\u9286\u600c\u9286\u6149';

const residualMarkerSolutionLabel =
    '\u9286\u600c\u9286\u614d';

const attempt7ResidualMarkerFixture =
    {
        id: 'case02-attempt7-residual-marker-forms',
        description:
            'Sanitized attempt 7 residual marker forms with command-prefixed answer and solution labels.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            case02QuestionItems,
        rawTextPages: [
            {
                pageIndex: 0,
                sourceOrder: 0,
                text: [
                    'NOISE_PAGE_2026_SCORE_12.5',
                    `\\A_${residualMarkerAnswerLabel}A1`,
                    `\\A${residualMarkerSolutionLabel}SOLUTION_1`,
                    '\\A_(6.0,7.5)--(8.0,9.5);',
                    `\\A_${residualMarkerAnswerLabel}A2`,
                    `\\A${residualMarkerSolutionLabel}$FORMULA_2_\\A{1}{2}$`,
                    'step 2.5 is continuation, not a question',
                    `\\A_${residualMarkerAnswerLabel}A3`,
                    `\\A${residualMarkerSolutionLabel}SOLUTION_3`,
                    `\\A_${residualMarkerAnswerLabel}A4`,
                    `\\A${residualMarkerSolutionLabel}SOLUTION_4_LINE_1`
                ].join('\n')
            },
            [
                'SOLUTION_4_LINE_2_CROSS_PAGE',
                `\\A_${residualMarkerAnswerLabel}A5`,
                `\\A${residualMarkerSolutionLabel}SOLUTION_5`,
                `\\A_${residualMarkerAnswerLabel}A6`,
                `\\A${residualMarkerSolutionLabel}SOLUTION_6`,
                `\\A{7${residualMarkerAnswerLabel}A7}`,
                `${residualMarkerSolutionLabel}SOLUTION_7`
            ].join('\n'),
            {
                pageIndex: 2,
                sourceOrder: 2,
                text: [
                    `\\A_\\A{${residualMarkerAnswerLabel}A8}`,
                    `\\A_\\A{${residualMarkerSolutionLabel}SOLUTION_8}`,
                    `\\A_\\A{${residualMarkerAnswerLabel}A9}`,
                    `\\A_\\A{${residualMarkerSolutionLabel}SOLUTION_9}`,
                    `\\A_\\A{${residualMarkerAnswerLabel}A10}`,
                    `\\A_\\A{${residualMarkerSolutionLabel}SOLUTION_10}`,
                    `\\A_\\A{${residualMarkerAnswerLabel}A13}`,
                    `\\A_\\A{${residualMarkerSolutionLabel}SOLUTION_13}`
                ].join('\n')
            },
            {
                pageIndex: 3,
                sourceOrder: 3,
                text: [
                    `\\A_\\A{${residualMarkerAnswerLabel}A15}`,
                    `\\A_\\A{${residualMarkerSolutionLabel}SOLUTION_15}`,
                    `\\A_\\A{${residualMarkerAnswerLabel}EXTRA_19}`,
                    `\\A_\\A{${residualMarkerSolutionLabel}SHOULD_NOT_ATTACH_19}`,
                    '\\A[A](6.0,7.5)--(8.0,9.5)--NOISE;'
                ].join('\n')
            }
        ],
        expected: {
            supportBlockCount:
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
            exhaustedImplicitMarkers:
                2
        }
    };

const case02AnswerMissing89QuestionItems =
    case02QuestionNumbers.map(number => {
        if (number === 8) {
            return {
                question: '8',
                questionNumber: '8',
                stem: 'CASE02_SANITIZED_STEM_8',
                type: 'multiple',
                options: [
                    'A. VALUE_8_A',
                    'B. VALUE_8_B',
                    'C. VALUE_8_C',
                    'D. VALUE_8_D'
                ]
            };
        }

        if (number === 9) {
            return {
                question: '9',
                questionNumber: '9',
                stem: 'CASE02_SANITIZED_STEM_9',
                type: 'multiple',
                options: [
                    'A. VALUE_9_A',
                    'B. VALUE_9_B',
                    'C. VALUE_9_C',
                    'D. VALUE_9_D'
                ]
            };
        }

        return {
            ...case02QuestionItems.find(item =>
                String(item.question) === String(number)
            ),
            answer:
                ''
        };
    });

const case02AnswerMissing89Fixture =
    {
        id: 'case02-answer-missing-8-9-controlled-write',
        description:
            'Sanitized answer-side fixture: parser and aligner are full, solutions stay full, but multiple-choice answer values for 8 and 9 require safe segmented option-value conversion.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            case02AnswerMissing89QuestionItems,
        rawTextPages:
            attempt7ResidualMarkerFixture.rawTextPages.map(page => {
                const text =
                    typeof page === 'string'
                        ? page
                        : page.text;
                const nextText =
                    String(text)
                        .replace('A8', '}B_\\A{D}')
                        .replace('A9', '}A_\\A{C}');

                return typeof page === 'string'
                    ? nextText
                    : {
                        ...page,
                        text:
                            nextText
                    };
            }),
        expected: {
            supportBlockCount:
                12,
            answerBlockCount:
                12,
            solutionBlockCount:
                12,
            answerDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            solutionDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            effectiveAnswerNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            effectiveSolutionNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            normalizedAnswers: {
                8:
                    'BD',
                9:
                    'AC'
            },
            missingAnswers:
                [],
            missingSolutions:
                [],
            convertedReason:
                'structural-option-label-normalized'
        }
    };

const p7AnswerRejectionQuestionItems =
    case02QuestionNumbers.map(number => {
        if (number === 2) {
            return {
                question: '2',
                questionNumber: '2',
                stem: 'P7_SANITIZED_STEM_2',
                type: '单选题',
                options: [
                    'A. P7_OPTION_2_A',
                    'B. P7_OPTION_2_B',
                    'C. P7_OPTION_2_C',
                    'D. P7_OPTION_2_D'
                ]
            };
        }

        if (number === 8) {
            return {
                question: '8',
                questionNumber: '8',
                stem: 'P7_SANITIZED_STEM_8',
                type: 'multiple',
                options: [
                    'A. P7_OPTION_8_A',
                    'B. P7_OPTION_8_B',
                    'C. P7_OPTION_8_C',
                    'D. P7_OPTION_8_D'
                ]
            };
        }

        if (number === 9) {
            return {
                question: '9',
                questionNumber: '9',
                stem: 'P7_SANITIZED_STEM_9',
                type: 'multiple',
                options: [
                    'A. P7_OPTION_9_A',
                    'B. P7_OPTION_9_B',
                    'C. P7_OPTION_9_C',
                    'D. P7_OPTION_9_D'
                ]
            };
        }

        return {
            question: String(number),
            questionNumber: String(number),
            stem: `P7_SANITIZED_STEM_${number}`,
            type: 'subjective',
            options: []
        };
    });

const p7AnswerRejectionFixture =
    {
        id: 'p7-answer-rejection-2-8-9',
        description:
            'P7 shape: parser/aligner full (12/12), controlled-write rejects answers 2 (option-value-not-matched, single-choice) and 8/9 (multiple-option-value-rejected, non-label-payload structural shell). Solution 12/12 does not unlock answer ownership. pass-safe-partial, not complete.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            p7AnswerRejectionQuestionItems,
        rawTextPages:
            attempt7ResidualMarkerFixture.rawTextPages.map(page => {
                const text =
                    typeof page === 'string'
                        ? page
                        : page.text;
                const nextText =
                    String(text)
                        .replace(/A2(?=\\n|$)/, 'P7_MISMATCHED_ANSWER_2')
                        .replace(/A8(?=\})/, '}X_\\A{Y}')
                        .replace(/A9(?=\})/, '}P_\\A{Q}');

                return typeof page === 'string'
                    ? nextText
                    : {
                        ...page,
                        text:
                            nextText
                    };
            }),
        expected: {
            parserMode:
                'full',
            supportBlockCount:
                12,
            answerBlockCount:
                12,
            solutionBlockCount:
                12,
            answerDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            solutionDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            controlledWriteAnswerNumbers:
                ['1', '3', '4', '5', '6', '7', '10', '13', '15'],
            controlledWriteSolutionNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            rejectedAnswerNumbers:
                ['2', '8', '9'],
            rejectedAnswerReasons: {
                '2':
                    'option-value-not-matched',
                '8':
                    'multiple-option-value-rejected',
                '9':
                    'multiple-option-value-rejected'
            },
            missingAnswersFromControlledWrite:
                ['2', '8', '9'],
            result:
                'pass-safe-partial',
            solutionCompleteDoesNotUnlockAnswer:
                true,
            controlledWriteWarningCode:
                'parser-objective-answer-rejected'
        }
    };

const attempt12SequenceDiscontinuityFixture =
    {
        id: 'attempt12-sequence-discontinuity',
        description:
            'Sanitized Attempt 12 shape: answer coverage is 12/12, but solution ownership is only safe for prefix 1,2 because solution 3 is missing while later solution markers continue.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            case02QuestionItems,
        rawTextPages: [
            [
                '1. 【答案】ATTEMPT12_ANSWER_1',
                '【解析】ATTEMPT12_SOLUTION_1',
                '2. 【答案】ATTEMPT12_ANSWER_2',
                '【解析】ATTEMPT12_SOLUTION_2',
                '3. 【答案】ATTEMPT12_ANSWER_3',
                '4. 【答案】ATTEMPT12_ANSWER_4',
                '【解析】ATTEMPT12_SOLUTION_4',
                '5. 【答案】ATTEMPT12_ANSWER_5',
                '【解析】ATTEMPT12_SOLUTION_5',
                '6. 【答案】ATTEMPT12_ANSWER_6',
                '【解析】ATTEMPT12_SOLUTION_6'
            ].join('\n'),
            [
                '7. 【答案】ATTEMPT12_ANSWER_7',
                '【解析】ATTEMPT12_SOLUTION_7',
                '8. 【答案】ATTEMPT12_ANSWER_8',
                '【解析】ATTEMPT12_SOLUTION_8',
                '9. 【答案】ATTEMPT12_ANSWER_9',
                '【解析】ATTEMPT12_SOLUTION_9',
                '10. 【答案】ATTEMPT12_ANSWER_10',
                '【解析】ATTEMPT12_SOLUTION_10',
                '13. 【答案】ATTEMPT12_ANSWER_13',
                '【解析】ATTEMPT12_SOLUTION_13',
                '15. 【答案】ATTEMPT12_ANSWER_15',
                '【解析】ATTEMPT12_SOLUTION_15'
            ].join('\n')
        ],
        legacySafeAnswerItems:
            case02QuestionNumbers.map(number => ({
                question:
                    String(number),
                answer:
                    `ATTEMPT12_LEGACY_ANSWER_${number}`
            })),
        legacySafeSolutionItems:
            [],
        expected: {
            questionCount:
                12,
            answerDetectedNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            solutionDetectedNumbers:
                ['1', '2', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            safeSolutionQuestionNumbers:
                ['1', '2'],
            effectiveAnswerQuestionNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            effectiveSolutionQuestionNumbers:
                ['1', '2'],
            unsafeSolutionQuestionNumbers:
                ['3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            missingSolutions:
                ['3'],
            fusedQuestionNumbers:
                ['3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            parserMode:
                'prefix',
            runnerStatus:
                'pass-safe-partial'
        }
    };

const p8gAttempt1QuestionItems =
    case02QuestionNumbers.map(number => {
        if (number >= 2 && number <= 6) {
            return {
                question: String(number),
                questionNumber: String(number),
                stem: `P8G_SANITIZED_STEM_${number}`,
                type: '单选题',
                options: [
                    `A. P8G_OPTION_${number}_A`,
                    `B. P8G_OPTION_${number}_B`,
                    `C. P8G_OPTION_${number}_C`,
                    `D. P8G_OPTION_${number}_D`
                ]
            };
        }

        if (number === 8 || number === 9) {
            return {
                question: String(number),
                questionNumber: String(number),
                stem: `P8G_SANITIZED_STEM_${number}`,
                type: 'multiple',
                options: [
                    `A. P8G_OPTION_${number}_A`,
                    `B. P8G_OPTION_${number}_B`,
                    `C. P8G_OPTION_${number}_C`,
                    `D. P8G_OPTION_${number}_D`
                ]
            };
        }

        return {
            question: String(number),
            questionNumber: String(number),
            stem: `P8G_SANITIZED_STEM_${number}`,
            type: 'subjective',
            options: []
        };
    });

const p8gAttempt1FailureSignatureFixture =
    {
        id: 'p8g-attempt1-failure-signature',
        description:
            'Sanitized P8G attempt 1 failure shape: controlled-write accepts only 5/12 answers (1,7,10,13,15), rejects 7/12 (2-6 as option-value-not-matched, 8-9 as multiple-option-value-rejected). Solutions 12/12. Draft snapshot has 10/12 from repair path. Baseline candidate is 5/12. pass-safe-partial, not complete.',
        expectedQuestionNumbers:
            case02QuestionNumbers,
        questionItems:
            p8gAttempt1QuestionItems,
        rawTextPages:
            attempt7ResidualMarkerFixture.rawTextPages.map(page => {
                const text =
                    typeof page === 'string'
                        ? page
                        : page.text;
                const nextText =
                    String(text)
                        .replace(/A2(?=\n|$)/, 'P8G_UNMATCHED_VALUE')
                        .replace(/A3(?=\n|$)/, 'P8G_UNMATCHED_VALUE')
                        .replace(/A4(?=\n|$)/, 'P8G_UNMATCHED_VALUE')
                        .replace(/A5(?=\n|$)/, 'P8G_UNMATCHED_VALUE')
                        .replace(/A6(?=\n|$)/, 'P8G_UNMATCHED_VALUE')
                        .replace(/A8(?=\})/, '}X_\\A{Y}')
                        .replace(/A9(?=\})/, '}P_\\A{Q}');

                return typeof page === 'string'
                    ? nextText
                    : {
                        ...page,
                        text: nextText
                    };
            }),
        expected: {
            parserMode:
                'full',
            supportBlockCount:
                12,
            answerBlockCount:
                12,
            solutionBlockCount:
                12,
            controlledWriteAcceptedAnswerNumbers:
                ['1', '7', '10', '13', '15'],
            controlledWriteRejectedAnswerNumbers:
                ['2', '3', '4', '5', '6', '8', '9'],
            controlledWriteSolutionNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
            draftSnapshotAnswerNumbers:
                ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15'],
            missingAnswersFromDraft:
                ['8', '9'],
            baselineCandidateAnswerNumbers:
                ['1', '7', '10', '13', '15'],
            result:
                'pass-safe-partial',
            solutionCompleteDoesNotDetermineBaseline:
                true,
            baselineCandidateCount:
                5
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
        realStyleSectionFixture,
        attempt7ResidualMarkerFixture,
        case02AnswerMissing89Fixture,
        p7AnswerRejectionFixture,
        p8gAttempt1FailureSignatureFixture,
        attempt12SequenceDiscontinuityFixture
    };
