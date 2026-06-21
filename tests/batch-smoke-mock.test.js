const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    alignPdfSupport,
    normalizeSupportQuestionNumber
} =
    require('../qisi-pdf-support-aligner.js');

const {
    parsePdfSupportBlocks
} =
    require('../qisi-pdf-support-block-parser.js');

const {
    buildPdfSupportParserGate,
    buildPdfSupportFieldLevelControlledWrite,
    normalizeObjectiveAnswerToLabels
} =
    require('../qisi-pdf-support-controlled-write.js');

const pdfKnownBad =
    require('./fixtures/pdf-support-known-bad.js');

const docxStable =
    require('./fixtures/docx-docx-stable.js');

const {
    case02SolutionDiagnostic,
    markerCoverageFixture,
    realStyleSectionFixture,
    attempt7ResidualMarkerFixture,
    case02AnswerMissing89Fixture,
    attempt12SequenceDiscontinuityFixture
} =
    require('./fixtures/pdf-real-case-minimal.js');

const AI_ENDPOINTS =
    ['/api/ai/ocr', '/api/ai/chat'];

const assertNoAiEndpoint = value => {
    const text =
        String(value ?? '');

    for (const endpoint of AI_ENDPOINTS) {
        if (text.includes(endpoint)) {
            throw new Error(
                `mock smoke must not access ${endpoint}`
            );
        }
    }
};

const installAiEndpointGuards = () => {
    globalThis.fetch =
        async input => {
            assertNoAiEndpoint(
                typeof input === 'string'
                    ? input
                    : input?.url
            );
            throw new Error(
                'mock smoke does not allow real network calls'
            );
        };

    const http =
        require('node:http');
    const https =
        require('node:https');
    const originalHttpRequest =
        http.request;
    const originalHttpsRequest =
        https.request;

    const guardedRequest = original => function (...args) {
        assertNoAiEndpoint(args[0]);
        assertNoAiEndpoint(args[1]);

        return original.apply(this, args);
    };

    http.request =
        guardedRequest(originalHttpRequest);
    https.request =
        guardedRequest(originalHttpsRequest);

    return () => {
        http.request =
            originalHttpRequest;
        https.request =
            originalHttpsRequest;
        delete globalThis.fetch;
    };
};

const indexSupportItems = items => {
    const map =
        new Map();

    for (const item of items || []) {
        const number =
            normalizeSupportQuestionNumber(item.question);

        if (number) {
            map.set(number, item);
        }
    }

    return map;
};

const supportQuestionSequence = items =>
    (items || [])
        .map(item => normalizeSupportQuestionNumber(item.question))
        .filter(Boolean);

const gateFromAlignment = alignment => ({
    answers:
        alignment.mode === 'fail-closed'
            ? []
            : alignment.safeAnswerItems,
    solutions:
        alignment.mode === 'fail-closed'
            ? []
            : alignment.safeSolutionItems,
    fusedQuestionNumbers:
        alignment.fusedQuestionNumbers || [],
    failClosed:
        alignment.mode === 'fail-closed'
});

const mergePdfSupportMock = fixture => {
    const parsedSupport =
        parsePdfSupportBlocks({
            rawTextPages:
                fixture.rawTextPages,
            expectedQuestionNumbers:
                fixture.expectedQuestionNumbers,
            sourceFileId:
                'mock-pdf-support',
            mode:
                'support'
        });
    const alignment =
        alignPdfSupport({
            questionItems:
                fixture.questionItems,
            answerItems:
                parsedSupport.answerItems,
            solutionItems:
                parsedSupport.solutionItems,
            expectedQuestionNumbers:
                fixture.expectedQuestionNumbers
        });
    const answers =
        indexSupportItems(alignment.safeAnswerItems);
    const solutions =
        indexSupportItems(alignment.safeSolutionItems);
    const fused =
        new Set(alignment.fusedQuestionNumbers);

    return {
        parsedSupport,
        alignment,
        draftItems:
            fixture.questionItems.map(questionItem => {
                const number =
                    normalizeSupportQuestionNumber(
                        questionItem.question
                    );
                const answer =
                    answers.get(number);
                const solution =
                    solutions.get(number);

                return {
                    ...questionItem,
                    answer:
                        answer?.answer || '',
                    solution:
                        solution?.solution || '',
                    warnings:
                        fused.has(number)
                            ? [...alignment.fusedWarnings]
                            : []
                };
            })
    };
};

const mergePdfSupportFieldLevelMock = fixture => {
    const parserAlignment =
        alignPdfSupport({
            answerItems:
                fixture.parserAnswerItems || [],
            solutionItems:
                fixture.parserSolutionItems || [],
            expectedQuestionNumbers:
                fixture.expectedQuestionNumbers
        });
    const legacyAlignment =
        alignPdfSupport({
            answerItems:
                fixture.legacyAnswerItems || [],
            solutionItems:
                fixture.legacySolutionItems || [],
            expectedQuestionNumbers:
                fixture.expectedQuestionNumbers
        });
    const parserGate =
        gateFromAlignment(parserAlignment);
    const legacyGate =
        gateFromAlignment(legacyAlignment);
    const field =
        buildPdfSupportFieldLevelControlledWrite({
            drafts:
                fixture.questionItems,
            legacySafeAnswerItems:
                legacyGate.answers,
            legacySafeSolutionItems:
                legacyGate.solutions,
            parserSafeAnswerItems:
                parserGate.answers,
            parserSafeSolutionItems:
                parserGate.solutions,
            legacyFusedQuestionNumbers:
                legacyGate.fusedQuestionNumbers,
            parserFusedQuestionNumbers:
                parserGate.fusedQuestionNumbers
        });
    const answers =
        indexSupportItems(field.effectiveAnswerItems);
    const solutions =
        indexSupportItems(field.effectiveSolutionItems);
    const fused =
        new Set(field.fusedQuestionNumbers);

    return {
        field,
        parserAlignment,
        legacyAlignment,
        draftItems:
            fixture.questionItems.map(questionItem => {
                const number =
                    normalizeSupportQuestionNumber(questionItem.question);
                return {
                    ...questionItem,
                    answer:
                        answers.get(number)?.answer || '',
                    solution:
                        solutions.get(number)?.solution || '',
                    warnings:
                        fused.has(number)
                            ? ['pdf-support-sequence-unreliable']
                            : []
                };
            })
    };
};

const mergeDocxSupportMock = fixture => {
    const answers =
        indexSupportItems(fixture.answerItems);
    const solutions =
        indexSupportItems(fixture.solutionItems);

    return {
        warnings:
            [...(fixture.warnings || [])],
        draftItems:
            fixture.questionItems.map(questionItem => {
                const number =
                    normalizeSupportQuestionNumber(
                        questionItem.question
                    );

                return {
                    ...questionItem,
                    answer:
                        answers.get(number)?.answer || '',
                    solution:
                        solutions.get(number)?.solution || '',
                    warnings: []
                };
            })
    };
};

test(
    'PDF+PDF known bad support keeps misaligned answers out of draft',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const { parsedSupport, alignment, draftItems } =
                mergePdfSupportMock(pdfKnownBad);
            const draftByQuestion =
                new Map(
                    draftItems.map(item => [item.question, item])
                );
            const legacyAnswerQuestions =
                supportQuestionSequence(pdfKnownBad.answerItems);
            const legacySolutionQuestions =
                supportQuestionSequence(pdfKnownBad.solutionItems);
            const parserBlockQuestions =
                parsedSupport.blocks.map(block => block.question);
            const parserAnswerQuestions =
                supportQuestionSequence(parsedSupport.answerItems);
            const parserSolutionQuestions =
                supportQuestionSequence(parsedSupport.solutionItems);

            assert.deepEqual(
                legacyAnswerQuestions,
                ['1', '3', '4', '5', '6', '7', '8', '9', '10', '11', '2']
            );
            assert.deepEqual(
                legacySolutionQuestions,
                legacyAnswerQuestions
            );
            assert.deepEqual(
                parserBlockQuestions,
                legacyAnswerQuestions
            );
            assert.deepEqual(
                parserAnswerQuestions,
                ['1', '3', '4', '5', '6', '7', '8', '9', '10', '11']
            );
            assert.deepEqual(
                parserSolutionQuestions,
                parserAnswerQuestions
            );
            assert.deepEqual(
                parsedSupport.sequenceReport.questionNumbers,
                legacyAnswerQuestions
            );
            assert.equal(
                parsedSupport.sequenceReport.strictlyIncreasing,
                false
            );
            assert.deepEqual(
                parsedSupport.sequenceReport.jumpBacks,
                [
                    {
                        question: '2',
                        previousQuestion: '11'
                    }
                ]
            );
            assert.ok(
                parsedSupport.warnings.some(
                    warning => warning.code === 'jump-back-question-marker'
                )
            );
            assert.notEqual(alignment.mode, 'full');
            assert.ok(
                alignment.safeQuestionNumbers.length <= 1
            );
            assert.deepEqual(
                alignment.fusedQuestionNumbers,
                ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
            );

            for (const [question, wrongAnswer] of Object.entries(
                pdfKnownBad.wrongAnswers
            )) {
                const draft =
                    draftByQuestion.get(question);
                const combined =
                    `${draft.answer} ${draft.solution}`;

                assert.ok(
                    draft.warnings.includes(
                        'pdf-support-sequence-unreliable'
                    )
                );
                assert.ok(!combined.includes(wrongAnswer));
            }

            assert.ok(
                !draftByQuestion.get('11').answer.includes(
                    'sqrt2+1/2'
                )
            );
        } finally {
            restore();
        }
    }
);

test(
    'field-level controlled write converts objective option values to labels',
    () => {
        assert.deepEqual(
            normalizeObjectiveAnswerToLabels(
                '5',
                {
                    type: '单选题',
                    options: ['A. 3', 'B. 4', 'C. 5', 'D. 6']
                }
            ),
            {
                ok: true,
                answer: 'C',
                reason: 'option-value-converted',
                originalAnswer: '5'
            }
        );
        assert.equal(
            normalizeObjectiveAnswerToLabels(
                '-1',
                {
                    type: '单选题',
                    options: ['A. 0', 'B. 1', 'C. 2', 'D. -1']
                }
            ).answer,
            'D'
        );
    }
);

test(
    'field-level controlled write keeps legacy objective answer before parser',
    () => {
        const result =
            mergePdfSupportFieldLevelMock({
                questionItems: [
                    {
                        question: '1',
                        type: '单选题',
                        options: ['A. 3', 'B. 4', 'C. 5', 'D. 6']
                    }
                ],
                expectedQuestionNumbers: [1],
                legacyAnswerItems: [{ question: '1', answer: 'C' }],
                legacySolutionItems: [{ question: '1', solution: 'legacy solution' }],
                parserAnswerItems: [{ question: '1', answer: '5' }],
                parserSolutionItems: [{ question: '1', solution: 'parser solution' }]
            });

        assert.equal(result.draftItems[0].answer, 'C');
        assert.equal(result.draftItems[0].solution, 'parser solution');
        assert.ok(
            result.field.fieldDecisions.some(decision =>
                decision.reason === 'objective-legacy-preserved'
            )
        );
    }
);

test(
    'field-level controlled write rejects unsafe objective answer but keeps parser solution',
    () => {
        const result =
            mergePdfSupportFieldLevelMock({
                questionItems: [
                    {
                        question: '1',
                        type: '单选题',
                        options: ['A. 5', 'B. 5', 'C. 7', 'D. 8']
                    }
                ],
                expectedQuestionNumbers: [1],
                legacyAnswerItems: [],
                legacySolutionItems: [],
                parserAnswerItems: [{ question: '1', answer: '5' }],
                parserSolutionItems: [{ question: '1', solution: 'safe parser solution' }]
            });

        assert.equal(result.draftItems[0].answer, '');
        assert.equal(result.draftItems[0].solution, 'safe parser solution');
        assert.equal(result.field.warnings[0].code, 'parser-objective-answer-rejected');
        assert.equal(result.field.warnings[0].reason, 'ambiguous-option-value');
        assert.equal(result.field.warnings[0].structuralCandidate, false);
        assert.equal(
            result.field.warnings[0].structuralReason,
            'not-structural-label-shell'
        );
    }
);

test(
    'field-level controlled write reports structural objective reject diagnostics',
    () => {
        const result =
            mergePdfSupportFieldLevelMock({
                questionItems: [
                    {
                        question: '1',
                        type: 'multiple',
                        options: ['A. VALUE_A', 'B. VALUE_B', 'C. VALUE_C', 'D. VALUE_D']
                    }
                ],
                expectedQuestionNumbers: [1],
                legacyAnswerItems: [],
                legacySolutionItems: [],
                parserAnswerItems: [{ question: '1', answer: 'A_\\frac{B}' }],
                parserSolutionItems: [{ question: '1', solution: 'safe parser solution' }]
            });

        assert.equal(result.draftItems[0].answer, '');
        assert.equal(result.draftItems[0].solution, 'safe parser solution');
        assert.equal(result.field.warnings[0].code, 'parser-objective-answer-rejected');
        assert.equal(result.field.warnings[0].reason, 'unsafe-math-command');
        assert.equal(result.field.warnings[0].structuralCandidate, true);
        assert.equal(result.field.warnings[0].structuralReason, 'unsafe-math-command');
    }
);

test(
    'field-level controlled write accepts multiple-choice labels but rejects option values',
    () => {
        const accepted =
            mergePdfSupportFieldLevelMock({
                questionItems: [
                    {
                        question: '1',
                        type: '多选题',
                        options: ['A. a', 'B. b', 'C. c', 'D. d']
                    }
                ],
                expectedQuestionNumbers: [1],
                parserAnswerItems: [{ question: '1', answer: 'ACD' }],
                parserSolutionItems: [{ question: '1', solution: 'multi solution' }]
            });
        const rejected =
            mergePdfSupportFieldLevelMock({
                questionItems: [
                    {
                        question: '1',
                        type: '多选题',
                        options: ['A. 1', 'B. 2', 'C. 3', 'D. 4']
                    }
                ],
                expectedQuestionNumbers: [1],
                parserAnswerItems: [{ question: '1', answer: '3' }],
                parserSolutionItems: [{ question: '1', solution: 'multi solution' }]
            });

        assert.equal(accepted.draftItems[0].answer, 'ACD');
        assert.equal(rejected.draftItems[0].answer, '');
        assert.equal(rejected.draftItems[0].solution, 'multi solution');
        assert.equal(rejected.field.warnings[0].reason, 'multiple-option-value-rejected');
    }
);

test(
    'field-level controlled write converts clearly segmented multiple-choice option values',
    () => {
        const result =
            mergePdfSupportFieldLevelMock({
                questionItems: [
                    {
                        question: '1',
                        type: 'multiple',
                        options: [
                            'A. VALUE_A',
                            'B. VALUE_B',
                            'C. VALUE_C',
                            'D. VALUE_D'
                        ]
                    }
                ],
                expectedQuestionNumbers: [1],
                parserAnswerItems: [
                    {
                        question: '1',
                        answer: 'VALUE_A、VALUE_C'
                    }
                ],
                parserSolutionItems: [
                    {
                        question: '1',
                        solution: 'safe parser solution'
                    }
                ]
            });

        assert.equal(result.draftItems[0].answer, 'AC');
        assert.equal(result.draftItems[0].solution, 'safe parser solution');
        assert.deepEqual(result.field.warnings, []);
        assert.ok(
            result.field.fieldDecisions.some(decision =>
                decision.reason === 'multiple-option-values-converted'
            )
        );
    }
);

test(
    'field-level controlled write normalizes short structural option-label shells only',
    () => {
        const normalized =
            normalizeObjectiveAnswerToLabels(
                '}B_\\A{D}',
                {
                    type: 'multiple',
                    options: [
                        'A. VALUE_A',
                        'B. VALUE_B',
                        'C. VALUE_C',
                        'D. VALUE_D'
                    ]
                }
            );
        const rejectedFormula =
            normalizeObjectiveAnswerToLabels(
                'A_\\frac{B}',
                {
                    type: 'multiple',
                    options: [
                        'A. VALUE_A',
                        'B. VALUE_B',
                        'C. VALUE_C',
                        'D. VALUE_D'
                    ]
                }
            );

        assert.equal(normalized.ok, true);
        assert.equal(normalized.answer, 'BD');
        assert.equal(
            normalized.reason,
            'structural-option-label-normalized'
        );
        assert.equal(rejectedFormula.ok, false);
        assert.equal(
            rejectedFormula.reason,
            'unsafe-math-command'
        );
    }
);

test(
    'field-level controlled write does not write fused parser questions',
    () => {
        const result =
            mergePdfSupportFieldLevelMock({
                questionItems:
                    Array.from({ length: 8 }, (_, index) => ({
                        question: String(index + 1),
                        type: '单选题',
                        options: ['A. 1', 'B. 2', 'C. 3', 'D. 4']
                    })),
                expectedQuestionNumbers:
                    Array.from({ length: 8 }, (_, index) => index + 1),
                parserAnswerItems: [
                    { question: '1', answer: 'A' },
                    { question: '2', answer: 'B' },
                    { question: '8', answer: 'D' }
                ],
                parserSolutionItems: [
                    { question: '1', solution: 'solution 1' },
                    { question: '2', solution: 'solution 2' },
                    { question: '8', solution: 'wrong fused solution' }
                ]
            });
        const byQuestion =
            new Map(result.draftItems.map(item => [item.question, item]));

        assert.equal(byQuestion.get('1').answer, 'A');
        assert.equal(byQuestion.get('2').solution, 'solution 2');
        assert.equal(byQuestion.get('8').answer, '');
        assert.equal(byQuestion.get('8').solution, '');
        assert.ok(byQuestion.get('8').warnings.includes('pdf-support-sequence-unreliable'));
    }
);

test(
    'case02 diagnostic mock keeps full answers but only safe solution 1',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const fixture =
                case02SolutionDiagnostic;
            const parserGate =
                buildPdfSupportParserGate({
                    parsePdfSupportBlocks,
                    alignPdfSupport,
                    expectedQuestionNumbers:
                        fixture.expectedQuestionNumbers,
                    rawTextPages:
                        fixture.parserRawTextPages
                });
            const controlled =
                buildPdfSupportFieldLevelControlledWrite({
                    drafts:
                        fixture.questionItems,
                    legacySafeAnswerItems:
                        fixture.legacySafeAnswerItems,
                    legacySafeSolutionItems:
                        fixture.legacySafeSolutionItems,
                    parserSafeAnswerItems:
                        parserGate.answers,
                    parserSafeSolutionItems:
                        parserGate.solutions,
                    parserFusedQuestionNumbers:
                        parserGate.fusedQuestionNumbers
                });
            const solutionByQuestion =
                indexSupportItems(controlled.effectiveSolutionItems);
            const fused =
                new Set(parserGate.fusedQuestionNumbers);
            const draftItems =
                fixture.questionItems.map(item => {
                    const question =
                        normalizeSupportQuestionNumber(item.question);

                    return {
                        ...item,
                        solution:
                            solutionByQuestion.get(question)?.solution || '',
                        warnings:
                            fused.has(question)
                                ? ['pdf-support-sequence-unreliable']
                                : []
                    };
                });
            const missingSolutions =
                draftItems
                    .filter(item => !item.solution)
                    .map(item => item.question);

            assert.equal(draftItems.length, fixture.expected.questionCount);
            assert.equal(
                draftItems.filter(item => item.answer).length,
                fixture.expected.answerCount
            );
            assert.equal(
                draftItems.filter(item => item.solution).length,
                fixture.expected.solutionCount
            );
            assert.deepEqual(
                missingSolutions,
                fixture.expected.missingSolutions
            );
            assert.equal(parserGate.mode, fixture.expected.mode);
            assert.equal(parserGate.failClosed, true);
            assert.equal(
                parserGate.parserResult.blocks.length,
                fixture.expected.supportBlockCount
            );
            assert.deepEqual(
                controlled.solutionQuestionNumbers,
                fixture.expected.writableSolutionNumbers
            );
            assert.equal(fixture.expected.coverageState, 'incomplete');
            assert.equal(fixture.expected.targetState, 'complete');
        } finally {
            restore();
        }
    }
);

test(
    'sanitized marker-form mock improves parser solution coverage safely',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const fixture =
                markerCoverageFixture;
            const parserGate =
                buildPdfSupportParserGate({
                    parsePdfSupportBlocks,
                    alignPdfSupport,
                    expectedQuestionNumbers:
                        fixture.expectedQuestionNumbers,
                    rawTextPages:
                        fixture.rawTextPages
                });
            const field =
                buildPdfSupportFieldLevelControlledWrite({
                    drafts:
                        fixture.expectedQuestionNumbers.map(number => ({
                            question:
                                String(number),
                            type:
                                'subjective'
                        })),
                    parserSafeAnswerItems:
                        parserGate.answers,
                    parserSafeSolutionItems:
                        parserGate.solutions,
                    parserFusedQuestionNumbers:
                        parserGate.fusedQuestionNumbers
                });

            assert.equal(
                parserGate.parserResult.blocks.length,
                fixture.expected.supportBlockCount
            );
            assert.equal(
                parserGate.parserResult.answerItems.length,
                fixture.expected.answerBlockCount
            );
            assert.equal(
                parserGate.parserResult.solutionItems.length,
                fixture.expected.solutionBlockCount
            );
            assert.ok(
                field.solutionQuestionNumbers.length > 1
            );
            assert.deepEqual(
                field.solutionQuestionNumbers,
                fixture.expected.solutionDetectedNumbers
            );
            assert.deepEqual(
                field.fusedQuestionNumbers,
                []
            );
        } finally {
            restore();
        }
    }
);

test(
    'real-style section mock writes twelve parser-approved solutions',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const fixture =
                realStyleSectionFixture;
            const parserGate =
                buildPdfSupportParserGate({
                    parsePdfSupportBlocks,
                    alignPdfSupport,
                    expectedQuestionNumbers:
                        fixture.expectedQuestionNumbers,
                    rawTextPages:
                        fixture.rawTextPages
                });
            const field =
                buildPdfSupportFieldLevelControlledWrite({
                    drafts:
                        fixture.questionItems,
                    parserSafeAnswerItems:
                        parserGate.answers,
                    parserSafeSolutionItems:
                        parserGate.solutions,
                    parserFusedQuestionNumbers:
                        parserGate.fusedQuestionNumbers
                });

            assert.equal(
                parserGate.mode,
                'full'
            );
            assert.equal(
                field.solutionQuestionNumbers.length,
                12
            );
            assert.deepEqual(
                field.solutionQuestionNumbers,
                fixture.expected.solutionDetectedNumbers
            );
            assert.deepEqual(
                field.fusedQuestionNumbers,
                []
            );
        } finally {
            restore();
        }
    }
);

test(
    'attempt 7 residual marker mock writes twelve parser-approved solutions',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const fixture =
                attempt7ResidualMarkerFixture;
            const parserGate =
                buildPdfSupportParserGate({
                    parsePdfSupportBlocks,
                    alignPdfSupport,
                    expectedQuestionNumbers:
                        fixture.expectedQuestionNumbers,
                    rawTextPages:
                        fixture.rawTextPages
                });
            const field =
                buildPdfSupportFieldLevelControlledWrite({
                    drafts:
                        fixture.questionItems,
                    parserSafeAnswerItems:
                        parserGate.answers,
                    parserSafeSolutionItems:
                        parserGate.solutions,
                    parserFusedQuestionNumbers:
                        parserGate.fusedQuestionNumbers
                });

            assert.equal(
                parserGate.mode,
                'full'
            );
            assert.equal(
                field.solutionQuestionNumbers.length,
                12
            );
            assert.deepEqual(
                field.solutionQuestionNumbers,
                fixture.expected.solutionDetectedNumbers
            );
            assert.deepEqual(
                field.fusedQuestionNumbers,
                []
            );
        } finally {
            restore();
        }
    }
);

test(
    'case02 answer 8 and 9 mock writes full answers and preserves twelve solutions',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const fixture =
                case02AnswerMissing89Fixture;
            const parserGate =
                buildPdfSupportParserGate({
                    parsePdfSupportBlocks,
                    alignPdfSupport,
                    expectedQuestionNumbers:
                        fixture.expectedQuestionNumbers,
                    rawTextPages:
                        fixture.rawTextPages
                });
            const field =
                buildPdfSupportFieldLevelControlledWrite({
                    drafts:
                        fixture.questionItems,
                    parserSafeAnswerItems:
                        parserGate.answers,
                    parserSafeSolutionItems:
                        parserGate.solutions,
                    parserFusedQuestionNumbers:
                        parserGate.fusedQuestionNumbers
                });
            const answerByQuestion =
                indexSupportItems(field.effectiveAnswerItems);

            assert.equal(
                parserGate.mode,
                'full'
            );
            assert.deepEqual(
                field.answerQuestionNumbers,
                fixture.expected.effectiveAnswerNumbers
            );
            assert.deepEqual(
                field.solutionQuestionNumbers,
                fixture.expected.effectiveSolutionNumbers
            );
            assert.equal(
                answerByQuestion.get('8').answer,
                fixture.expected.normalizedAnswers[8]
            );
            assert.equal(
                answerByQuestion.get('9').answer,
                fixture.expected.normalizedAnswers[9]
            );
            assert.deepEqual(
                field.fusedQuestionNumbers,
                []
            );
        } finally {
            restore();
        }
    }
);

test(
    'attempt 12 mock keeps answer complete but does not expand unsafe solution ownership',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const fixture =
                attempt12SequenceDiscontinuityFixture;
            const parserGate =
                buildPdfSupportParserGate({
                    parsePdfSupportBlocks,
                    alignPdfSupport,
                    expectedQuestionNumbers:
                        fixture.expectedQuestionNumbers,
                    rawTextPages:
                        fixture.rawTextPages
                });
            const field =
                buildPdfSupportFieldLevelControlledWrite({
                    drafts:
                        fixture.questionItems,
                    legacySafeAnswerItems:
                        fixture.legacySafeAnswerItems,
                    legacySafeSolutionItems:
                        fixture.legacySafeSolutionItems,
                    parserSafeAnswerItems:
                        parserGate.answers,
                    parserSafeSolutionItems:
                        parserGate.solutions,
                    parserFusedQuestionNumbers:
                        parserGate.fusedQuestionNumbers
                });
            const solutionByQuestion =
                indexSupportItems(field.effectiveSolutionItems);
            const draftItems =
                fixture.questionItems.map(item => {
                    const question =
                        normalizeSupportQuestionNumber(item.question);

                    return {
                        ...item,
                        solution:
                            solutionByQuestion.get(question)?.solution || ''
                    };
                });
            const missingSolutions =
                draftItems
                    .filter(item => !item.solution)
                    .map(item => item.question);

            assert.notEqual(
                parserGate.mode,
                'full'
            );
            assert.deepEqual(
                parserGate.solutions.map(item => item.question),
                fixture.expected.safeSolutionQuestionNumbers
            );
            assert.deepEqual(
                field.answerQuestionNumbers,
                fixture.expected.effectiveAnswerQuestionNumbers
            );
            assert.deepEqual(
                field.solutionQuestionNumbers,
                fixture.expected.effectiveSolutionQuestionNumbers
            );
            assert.deepEqual(
                missingSolutions,
                fixture.expected.unsafeSolutionQuestionNumbers
            );
            assert.deepEqual(
                field.fusedQuestionNumbers,
                fixture.expected.fusedQuestionNumbers
            );
        } finally {
            restore();
        }
    }
);

test(
    'DOCX+DOCX stable mock keeps the normal support chain intact',
    () => {
        const restore =
            installAiEndpointGuards();

        try {
            const result =
                mergeDocxSupportMock(docxStable);

            assert.equal(result.draftItems.length, 3);
            assert.ok(
                !result.warnings.includes(
                    'pdf-support-sequence-unreliable'
                )
            );

            for (const item of result.draftItems) {
                assert.ok(item.stem);
                assert.ok(item.options.length >= 2);
                assert.ok(item.answer);
                assert.ok(item.solution);
                assert.ok(
                    !item.warnings.includes(
                        'pdf-support-sequence-unreliable'
                    )
                );
            }
        } finally {
            restore();
        }
    }
);
