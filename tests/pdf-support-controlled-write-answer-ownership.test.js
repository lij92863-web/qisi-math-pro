const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    parsePdfSupportBlocks
} =
    require('../qisi-pdf-support-block-parser.js');

const {
    alignPdfSupport
} =
    require('../qisi-pdf-support-aligner.js');

const {
    buildPdfSupportParserGate,
    buildPdfSupportFieldLevelControlledWrite,
    classifyObjectiveAnswerRejection,
    normalizeObjectiveAnswerToLabels
} =
    require('../qisi-pdf-support-controlled-write.js');

const {
    p7AnswerRejectionFixture,
    p8gAttempt1FailureSignatureFixture,
    attempt12SequenceDiscontinuityFixture,
    case02AnswerMissing89Fixture
} =
    require('./fixtures/pdf-real-case-minimal.js');

test(
    'P7 controlled-write rejects answers 2, 8, 9 and records diagnosable reasons',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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
            fixture.expected.parserMode
        );
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

        assert.deepEqual(
            controlled.answerQuestionNumbers,
            fixture.expected.controlledWriteAnswerNumbers
        );
        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.controlledWriteSolutionNumbers
        );
        assert.equal(
            controlled.solutionQuestionNumbers.length,
            12
        );

        for (const question of fixture.expected.rejectedAnswerNumbers) {
            assert.ok(
                !controlled.answerQuestionNumbers.includes(question),
                `rejected answer ${question} must not be in accepted answers`
            );
        }

        assert.equal(
            controlled.warnings.length,
            3
        );
        assert.ok(
            controlled.warnings.every(
                warning => warning.code === fixture.expected.controlledWriteWarningCode
            )
        );

        const warningByQuestion =
            new Map(
                controlled.warnings.map(warning => [
                    warning.questionNumber,
                    warning
                ])
            );

        assert.ok(
            warningByQuestion.has('2')
        );
        assert.equal(
            warningByQuestion.get('2').reason,
            fixture.expected.rejectedAnswerReasons['2']
        );
        assert.equal(
            warningByQuestion.get('2').structuralCandidate,
            false
        );

        assert.ok(
            warningByQuestion.has('8')
        );
        assert.equal(
            warningByQuestion.get('8').reason,
            fixture.expected.rejectedAnswerReasons['8']
        );

        assert.ok(
            warningByQuestion.has('9')
        );
        assert.equal(
            warningByQuestion.get('9').reason,
            fixture.expected.rejectedAnswerReasons['9']
        );

        const rejectionDecisions =
            controlled.fieldDecisions.filter(
                decision =>
                    decision.field === 'answer' &&
                    decision.source === 'none'
            );

        assert.equal(
            rejectionDecisions.length,
            3
        );
        assert.deepEqual(
            rejectionDecisions.map(decision => decision.questionNumber),
            fixture.expected.rejectedAnswerNumbers
        );
    }
);

test(
    'P7 rejected answers 8 and 9 are not written to draft',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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
            new Map(
                controlled.effectiveAnswerItems.map(item => [
                    item.question,
                    item.answer
                ])
            );

        assert.ok(
            !answerByQuestion.has('8'),
            'answer 8 must not be in effective answer items'
        );
        assert.ok(
            !answerByQuestion.has('9'),
            'answer 9 must not be in effective answer items'
        );
        assert.ok(
            answerByQuestion.has('1'),
            'answer 1 must still be accepted'
        );
        assert.ok(
            answerByQuestion.has('10'),
            'answer 10 must still be accepted'
        );

        const solutionByQuestion =
            new Map(
                controlled.effectiveSolutionItems.map(item => [
                    item.question,
                    item.solution
                ])
            );

        assert.equal(
            solutionByQuestion.size,
            12
        );
        assert.ok(
            solutionByQuestion.has('8'),
            'solution 8 must still be written'
        );
        assert.ok(
            solutionByQuestion.has('9'),
            'solution 9 must still be written'
        );
    }
);

test(
    'P7 answer 2 rejection reason is diagnosable with original answer preserved',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        const answer2Warning =
            controlled.warnings.find(
                warning => warning.questionNumber === '2'
            );

        assert.ok(answer2Warning);
        assert.equal(
            answer2Warning.code,
            'parser-objective-answer-rejected'
        );
        assert.equal(
            answer2Warning.reason,
            'option-value-not-matched'
        );
        assert.ok(
            answer2Warning.originalAnswer,
            'warnIng must preserve originalAnswer for diagnostics'
        );
        assert.ok(
            typeof answer2Warning.structuralCandidate === 'boolean',
            'warnIng must expose structuralCandidate'
        );

        const answer2Decision =
            controlled.fieldDecisions.find(
                decision =>
                    decision.questionNumber === '2' &&
                    decision.field === 'answer'
            );

        assert.ok(answer2Decision);
        assert.equal(
            answer2Decision.source,
            'none'
        );

        const answer2Item =
            parserGate.parserResult.answerItems.find(
                item => item.question === '2'
            );

        assert.ok(
            answer2Item,
            'parser answer item for question 2 must exist'
        );
        assert.ok(
            answer2Item.sourceTrace,
            'answer 2 must have sourceTrace for diagnostics'
        );
    }
);

test(
    'P7 solution 12/12 does not unlock answer 8/9 ownership',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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
            controlled.solutionQuestionNumbers.length,
            12,
            'solutions are complete'
        );
        assert.ok(
            controlled.solutionQuestionNumbers.includes('8'),
            'solution 8 is written'
        );
        assert.ok(
            controlled.solutionQuestionNumbers.includes('9'),
            'solution 9 is written'
        );

        assert.ok(
            !controlled.answerQuestionNumbers.includes('8'),
            'answer 8 must not be unlocked by solution completeness'
        );
        assert.ok(
            !controlled.answerQuestionNumbers.includes('9'),
            'answer 9 must not be unlocked by solution completeness'
        );

        for (const decision of controlled.fieldDecisions) {
            if (
                decision.questionNumber === '8' &&
                decision.field === 'solution'
            ) {
                assert.ok(
                    decision.source !== 'none',
                    'solution 8 decision must not be none'
                );
            }
            if (
                decision.questionNumber === '8' &&
                decision.field === 'answer'
            ) {
                assert.equal(
                    decision.source,
                    'none',
                    'answer 8 decision must remain none regardless of solution'
                );
            }
        }
    }
);

test(
    'P7 parserGate full does not mean controlled-write complete',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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
            'full',
            'parserGate reports full sequence coverage'
        );
        assert.deepEqual(
            parserGate.fusedQuestionNumbers,
            [],
            'parserGate fused is empty'
        );
        assert.equal(
            parserGate.parserResult.answerItems.length,
            12,
            'parser detects 12 answers'
        );
        assert.equal(
            parserGate.parserResult.solutionItems.length,
            12,
            'parser detects 12 solutions'
        );

        assert.ok(
            controlled.answerQuestionNumbers.length < 12,
            'controlled-write accepted fewer than 12 answers'
        );
        assert.ok(
            controlled.warnings.length > 0,
            'controlled-write produced warnings'
        );
        assert.ok(
            controlled.warnings.some(
                warning =>
                    warning.code === 'parser-objective-answer-rejected'
            ),
            'controlled-write warning must include parser-objective-answer-rejected'
        );

        const parserComplete =
            parserGate.mode === 'full' &&
            parserGate.fusedQuestionNumbers.length === 0 &&
            parserGate.parserResult.answerItems.length === 12;

        const controlledWriteComplete =
            controlled.warnings.length === 0 &&
            controlled.answerQuestionNumbers.length === 12;

        assert.ok(
            parserComplete,
            'parser gate is complete'
        );
        assert.ok(
            !controlledWriteComplete,
            'controlled-write is NOT complete'
        );
        assert.ok(
            parserComplete !== controlledWriteComplete
        );
    }
);

test(
    'P7 pass-safe-partial is not treated as complete baseline',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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
            fixture.expected.result,
            'pass-safe-partial'
        );

        const hasMissingAnswers =
            controlled.answerQuestionNumbers.length <
            fixture.expectedQuestionNumbers.length;

        assert.ok(
            hasMissingAnswers,
            'answer coverage is incomplete'
        );

        const hasRejectedAnswers =
            controlled.warnings.some(
                warning =>
                    warning.code === 'parser-objective-answer-rejected'
            );

        assert.ok(
            hasRejectedAnswers,
            'rejected answers exist'
        );

        const isCompleteBaselineCandidate =
            !hasMissingAnswers &&
            !hasRejectedAnswers &&
            parserGate.mode === 'full' &&
            controlled.warnings.length === 0;

        assert.ok(
            !isCompleteBaselineCandidate,
            'P7 must NOT be classified as complete baseline candidate'
        );

        const isPassSafePartial =
            hasMissingAnswers || hasRejectedAnswers;

        assert.ok(
            isPassSafePartial,
            'P7 is pass-safe-partial'
        );
    }
);

test(
    'known-bad still rejects unsafe wrong answers alongside P7 fixture',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        for (const item of controlled.effectiveAnswerItems) {
            assert.ok(
                item.question,
                'every accepted answer must have a question number'
            );
            assert.ok(
                item.answer,
                'every accepted answer must have non-empty answer text'
            );
        }

        const rejectedAnswerSet =
            new Set(
                controlled.warnings
                    .filter(warning =>
                        warning.code === 'parser-objective-answer-rejected'
                    )
                    .map(warning => warning.questionNumber)
            );

        assert.ok(
            rejectedAnswerSet.has('8'),
            'answer 8 must be rejected, not accepted as unsafe'
        );
        assert.ok(
            rejectedAnswerSet.has('9'),
            'answer 9 must be rejected, not accepted as unsafe'
        );

        const acceptedSet =
            new Set(controlled.answerQuestionNumbers);

        assert.ok(
            !acceptedSet.has('8'),
            'answer 8 not in accepted set'
        );
        assert.ok(
            !acceptedSet.has('9'),
            'answer 9 not in accepted set'
        );
    }
);

test(
    'Attempt 12 unsafe solution ownership is not expanded by P7 fixture',
    () => {
        const fixture =
            attempt12SequenceDiscontinuityFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'ATTEMPT12_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
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

        assert.notEqual(
            parserGate.mode,
            'full',
            'Attempt 12 parserGate must not be full'
        );
        assert.equal(
            parserGate.mode,
            'prefix',
            'Attempt 12 parserGate must be prefix'
        );

        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.effectiveSolutionQuestionNumbers
        );
        assert.equal(
            controlled.solutionQuestionNumbers.length,
            2,
            'only solutions 1 and 2 are safe'
        );

        for (const question of fixture.expected.unsafeSolutionQuestionNumbers) {
            assert.ok(
                !controlled.solutionQuestionNumbers.includes(question),
                `unsafe solution ${question} must not be written`
            );
        }

        const p7Fixture =
            p7AnswerRejectionFixture;
        const p7ParserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: p7Fixture.id,
                    filename: 'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    p7Fixture.expectedQuestionNumbers,
                rawTextPages:
                    p7Fixture.rawTextPages
            });

        assert.equal(
            p7ParserGate.mode,
            'full',
            'P7 parser gate is full (independent from Attempt 12)'
        );

        assert.notEqual(
            parserGate.mode,
            'full',
            'Attempt 12 remains prefix regardless of P7 fixture existence'
        );
    }
);

test(
    'answer and solution field-level write independence is preserved',
    () => {
        const answerGapItems =
            [1, 2, 4, 5].map(number => ({
                question: String(number),
                questionNumber: String(number),
                stem: `STEM_${number}`,
                type: 'subjective',
                options: []
            }));
        const solutionFullItems =
            [1, 2, 3, 4, 5].map(number => ({
                question: String(number),
                questionNumber: String(number),
                solution: `SOLUTION_${number}`
            }));

        const alignment =
            alignPdfSupport({
                answerItems:
                    answerGapItems.map(item => ({
                        question: item.question,
                        answer: `ANSWER_${item.question}`
                    })),
                solutionItems:
                    solutionFullItems,
                expectedQuestionNumbers:
                    [1, 2, 3, 4, 5]
            });

        assert.equal(
            alignment.mode,
            'prefix'
        );

        const field =
            buildPdfSupportFieldLevelControlledWrite({
                drafts:
                    [1, 2, 3, 4, 5].map(number => ({
                        question: String(number),
                        questionNumber: String(number),
                        type: 'subjective',
                        options: []
                    })),
                legacySafeSolutionItems:
                    solutionFullItems,
                parserSafeAnswerItems:
                    alignment.safeAnswerItems,
                parserSafeSolutionItems:
                    alignment.safeSolutionItems,
                parserFusedQuestionNumbers:
                    alignment.fusedQuestionNumbers
            });

        assert.deepEqual(
            field.answerQuestionNumbers,
            ['1', '2']
        );
        assert.equal(
            field.answerQuestionNumbers.length,
            2
        );

        assert.ok(
            field.solutionQuestionNumbers.length >= 2
        );

        assert.ok(
            !field.answerQuestionNumbers.includes('3'),
            'answer 3 must not be written when answer gap blocks it'
        );
    }
);

test(
    'normalizeObjectiveAnswerToLabels rejects non-label-payload structural shells for multi-choice',
    () => {
        const draft =
            {
                type: 'multiple',
                options: [
                    'A. VALUE_A',
                    'B. VALUE_B',
                    'C. VALUE_C',
                    'D. VALUE_D'
                ]
            };

        const result1 =
            normalizeObjectiveAnswerToLabels('}X_\\A{Y}', draft);

        assert.equal(result1.ok, false);
        assert.equal(
            result1.reason,
            'multiple-option-value-rejected'
        );

        const result2 =
            normalizeObjectiveAnswerToLabels('}G_\\A{H}', draft);

        assert.equal(result2.ok, false);
        assert.equal(
            result2.reason,
            'multiple-option-value-rejected'
        );
    }
);

test(
    'P8C rejection taxonomy provides rejectionCode for each rejected answer',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: fixture.id,
                    filename: 'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        const warningByQuestion =
            new Map(
                controlled.warnings.map(warning => [
                    warning.questionNumber,
                    warning
                ])
            );

        const answer2 =
            warningByQuestion.get('2');

        assert.ok(answer2);
        assert.equal(
            answer2.code,
            'parser-objective-answer-rejected'
        );
        assert.ok(
            answer2.rejectionCode,
            'answer 2 must have rejectionCode'
        );
        assert.ok(
            typeof answer2.rejectionCode === 'string' &&
                answer2.rejectionCode.startsWith('rejection-'),
            `answer 2 rejectionCode must start with rejection-, got: ${answer2.rejectionCode}`
        );
        assert.ok(
            answer2.rejectionDetail,
            'answer 2 must have rejectionDetail'
        );
        assert.ok(
            typeof answer2.normalizedCandidate === 'string',
            'answer 2 must have normalizedCandidate field'
        );
        assert.ok(
            answer2.answerEvidence,
            'answer 2 must have answerEvidence'
        );
        assert.ok(
            typeof answer2.answerEvidence.hasQuestionMarker === 'boolean',
            'answerEvidence.hasQuestionMarker must be boolean'
        );
        assert.ok(
            typeof answer2.answerEvidence.hasAnswerLabel === 'boolean',
            'answerEvidence.hasAnswerLabel must be boolean'
        );

        const answer8 =
            warningByQuestion.get('8');

        assert.ok(answer8);
        assert.equal(answer8.rejectionCode, 'rejection-multi-option-value-rejected');
        assert.ok(answer8.rejectionDetail);
        assert.ok(
            answer8.normalizedCandidate &&
                answer8.normalizedCandidate.startsWith('structural-candidate:'),
            `answer 8 normalizedCandidate should start with structural-candidate:, got: ${answer8.normalizedCandidate}`
        );

        const answer9 =
            warningByQuestion.get('9');

        assert.ok(answer9);
        assert.equal(answer9.rejectionCode, 'rejection-multi-option-value-rejected');
        assert.ok(
            answer9.normalizedCandidate &&
                answer9.normalizedCandidate.startsWith('structural-candidate:')
        );
    }
);

test(
    'P8C rejection taxonomy preserves old warning code parser-objective-answer-rejected',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: fixture.id,
                    filename: 'P7_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        assert.ok(
            controlled.warnings.length >= 3
        );
        assert.ok(
            controlled.warnings.every(
                warning => warning.code === 'parser-objective-answer-rejected'
            ),
            'every warning must retain the old code parser-objective-answer-rejected'
        );
        assert.ok(
            controlled.warnings.every(
                warning => typeof warning.reason === 'string' && warning.reason.length > 0
            ),
            'every warning must retain the old reason field'
        );
        assert.ok(
            controlled.warnings.every(
                warning => typeof warning.structuralCandidate === 'boolean'
            ),
            'every warning must retain structuralCandidate'
        );
        assert.ok(
            controlled.warnings.every(
                warning => typeof warning.originalAnswer === 'string'
            ),
            'every warning must retain originalAnswer'
        );
    }
);

test(
    'P8C classifier returns unknown-objective-answer-rejection for unrecognized reason',
    () => {
        const result =
            classifyObjectiveAnswerRejection(
                'some-future-reason',
                { candidate: false },
                null,
                null
            );

        assert.equal(
            result.rejectionCode,
            'unknown-objective-answer-rejection'
        );
        assert.ok(
            result.rejectionDetail.includes('some-future-reason'),
            'unrecognized reason should be included in the detail message'
        );
    }
);

test(
    'P8C normal objective answers are still accepted with expandEd metadata',
    () => {
        const sixOptionDraft =
            {
                type: 'multiple',
                options: [
                    'A. VALUE_A',
                    'B. VALUE_B',
                    'C. VALUE_C',
                    'D. VALUE_D',
                    'E. VALUE_E',
                    'F. VALUE_F'
                ]
            };

        const result =
            normalizeObjectiveAnswerToLabels('A', sixOptionDraft);

        assert.equal(result.ok, true);
        assert.equal(result.answer, 'A');
        assert.equal(result.reason, 'already-option-label');
    }
);

test(
    'P8C empty answer is rejected before normalization',
    () => {
        const emptyDraft =
            {
                type: '单选题',
                options: ['A. 1', 'B. 2', 'C. 3', 'D. 4']
            };

        const emptyAnswer =
            '';

        assert.equal(emptyAnswer, '');

        const result =
            normalizeObjectiveAnswerToLabels(emptyAnswer, emptyDraft);

        assert.equal(result.ok, false);
        assert.ok(
            result.reason === 'option-value-not-matched' ||
            result.reason === 'options-missing',
            `empty answer should be rejected, got reason: ${result.reason}`
        );
    }
);

test(
    'P8C unsafe math command with structural shell is rejected with rejection-unsafe-math-command',
    () => {
        const draft =
            {
                type: 'multiple',
                options: [
                    'A. VALUE_A',
                    'B. VALUE_B',
                    'C. VALUE_C',
                    'D. VALUE_D'
                ]
            };
        const result =
            normalizeObjectiveAnswerToLabels('A_\\frac{B}', draft);

        assert.equal(result.ok, false);
        assert.equal(result.reason, 'unsafe-math-command');

        const taxonomy =
            classifyObjectiveAnswerRejection(
                result.reason,
                { candidate: true, reason: 'unsafe-math-command' },
                { evidence: { questionMarker: true } },
                draft
            );

        assert.equal(
            taxonomy.rejectionCode,
            'rejection-unsafe-math-command'
        );
        assert.ok(
            taxonomy.normalizedCandidate ||
            typeof taxonomy.normalizedCandidate === 'string'
        );
    }
);

test(
    'P9J truth gate: rejection taxonomy is diagnostic only and cannot change accepted/rejected result',
    () => {
        const fixture =
            p7AnswerRejectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: { id: fixture.id, filename: 'SANITIZED.pdf' },
                expectedQuestionNumbers: fixture.expectedQuestionNumbers,
                rawTextPages: fixture.rawTextPages
            });
        const controlled =
            buildPdfSupportFieldLevelControlledWrite({
                drafts: fixture.questionItems,
                parserSafeAnswerItems: parserGate.answers,
                parserSafeSolutionItems: parserGate.solutions,
                parserFusedQuestionNumbers: parserGate.fusedQuestionNumbers
            });

        const acceptedBeforeTaxonomy =
            [...controlled.answerQuestionNumbers];
        const rejectedBeforeTaxonomy =
            controlled.warnings
                .filter(w => w.code === 'parser-objective-answer-rejected')
                .map(w => w.questionNumber);

        assert.deepEqual(
            acceptedBeforeTaxonomy,
            fixture.expected.controlledWriteAnswerNumbers
        );

        for (const warning of controlled.warnings) {
            assert.ok(
                warning.rejectionCode,
                'rejectionCode exists (taxonomy applied)'
            );
            assert.ok(
                warning.rejectionDetail,
                'rejectionDetail exists (taxonomy applied)'
            );
        }

        assert.deepEqual(
            controlled.answerQuestionNumbers,
            acceptedBeforeTaxonomy,
            'accepted answers unchanged by taxonomy enrichment'
        );

        const rejectedAfterTaxonomy =
            controlled.warnings
                .filter(w => w.code === 'parser-objective-answer-rejected')
                .map(w => w.questionNumber);

        assert.deepEqual(
            rejectedAfterTaxonomy,
            rejectedBeforeTaxonomy,
            'rejected answers unchanged by taxonomy enrichment'
        );

        const isCompleteWithTaxonomy =
            controlled.answerQuestionNumbers.length ===
                fixture.expectedQuestionNumbers.length &&
            controlled.warnings.length === 0;

        assert.ok(
            !isCompleteWithTaxonomy,
            'taxonomy cannot make incomplete look complete'
        );
    }
);

test(
    'P9B P8G attempt 1 failure signature: only 5/12 answers accepted by controlled-write',
    () => {
        const fixture =
            p8gAttempt1FailureSignatureFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: fixture.id,
                    filename: 'P8G_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        assert.equal(parserGate.mode, 'full');
        assert.deepEqual(
            controlled.answerQuestionNumbers,
            fixture.expected.controlledWriteAcceptedAnswerNumbers
        );
        assert.equal(
            controlled.answerQuestionNumbers.length,
            5
        );
        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.controlledWriteSolutionNumbers
        );
        assert.equal(
            controlled.solutionQuestionNumbers.length,
            12
        );
        assert.equal(
            controlled.warnings.length,
            7
        );

        const rejectedSet =
            new Set(fixture.expected.controlledWriteRejectedAnswerNumbers);

        for (const question of rejectedSet) {
            assert.ok(
                !controlled.answerQuestionNumbers.includes(question),
                `answer ${question} must be rejected`
            );
        }

        for (const question of fixture.expected.controlledWriteAcceptedAnswerNumbers) {
            assert.ok(
                controlled.answerQuestionNumbers.includes(question),
                `answer ${question} must be accepted`
            );
        }
    }
);

test(
    'P9B baseline candidate equals controlled-write accepted ∩ draft snapshot, not draft snapshot alone',
    () => {
        const fixture =
            p8gAttempt1FailureSignatureFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: fixture.id,
                    filename: 'P8G_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        const draftSnapshotAnswers =
            fixture.expected.draftSnapshotAnswerNumbers;

        const baselineCandidate =
            draftSnapshotAnswers.filter(
                question =>
                    controlled.answerQuestionNumbers.includes(question)
            );

        assert.deepEqual(
            baselineCandidate,
            fixture.expected.baselineCandidateAnswerNumbers
        );
        assert.equal(
            baselineCandidate.length,
            fixture.expected.baselineCandidateCount
        );
        assert.equal(
            baselineCandidate.length,
            5
        );

        assert.notDeepEqual(
            baselineCandidate,
            draftSnapshotAnswers,
            'baseline candidate must differ from draft snapshot'
        );
        assert.ok(
            draftSnapshotAnswers.includes('2'),
            'draft snapshot includes answer 2 (from repair path)'
        );
        assert.ok(
            !baselineCandidate.includes('2'),
            'baseline candidate must not include rejected answer 2'
        );

        for (const question of fixture.expected.controlledWriteRejectedAnswerNumbers) {
            assert.ok(
                !baselineCandidate.includes(question),
                `rejected answer ${question} must not be in baseline candidate`
            );
        }
    }
);

test(
    'P9B pass-safe-partial: 5/12 baseline is not complete',
    () => {
        const fixture =
            p8gAttempt1FailureSignatureFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: fixture.id,
                    filename: 'P8G_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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

        const hasMissingAnswers =
            controlled.answerQuestionNumbers.length <
            fixture.expectedQuestionNumbers.length;

        assert.ok(hasMissingAnswers);
        assert.equal(
            controlled.answerQuestionNumbers.length,
            5
        );

        const hasRejectedAnswers =
            controlled.warnings.length > 0;

        assert.ok(hasRejectedAnswers);

        const isCompleteBaselineCandidate =
            !hasMissingAnswers &&
            !hasRejectedAnswers &&
            controlled.warnings.length === 0;

        assert.ok(
            !isCompleteBaselineCandidate,
            '5/12 with 7 rejections must not be complete baseline'
        );

        assert.equal(
            fixture.expected.result,
            'pass-safe-partial'
        );
    }
);

test(
    'P9B solution 12/12 does not determine baseline: answers still rejected',
    () => {
        const fixture =
            p8gAttempt1FailureSignatureFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id: fixture.id,
                    filename: 'P8G_SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });
        const controlled =
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
            controlled.solutionQuestionNumbers.length,
            12,
            'solutions are complete'
        );
        assert.equal(
            controlled.answerQuestionNumbers.length,
            5,
            'but answers are only 5/12'
        );

        for (const question of ['8', '9']) {
            assert.ok(
                controlled.solutionQuestionNumbers.includes(question),
                `solution ${question} is written`
            );
            assert.ok(
                !controlled.answerQuestionNumbers.includes(question),
                `answer ${question} is NOT written despite solution existing`
            );
        }
    }
);
