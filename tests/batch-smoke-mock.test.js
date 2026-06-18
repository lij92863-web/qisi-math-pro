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
    buildPdfSupportFieldLevelControlledWrite,
    normalizeObjectiveAnswerToLabels
} =
    require('../qisi-pdf-support-controlled-write.js');

const pdfKnownBad =
    require('./fixtures/pdf-support-known-bad.js');

const docxStable =
    require('./fixtures/docx-docx-stable.js');

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
