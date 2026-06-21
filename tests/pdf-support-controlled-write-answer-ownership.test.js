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
    normalizeObjectiveAnswerToLabels
} =
    require('../qisi-pdf-support-controlled-write.js');

const {
    p7AnswerRejectionFixture,
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
