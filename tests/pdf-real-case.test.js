const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    alignPdfSupport
} =
    require('../qisi-pdf-support-aligner.js');

const {
    parsePdfSupportBlocks
} =
    require('../qisi-pdf-support-block-parser.js');

const {
    buildPdfSupportFieldLevelControlledWrite,
    buildPdfSupportParserGate
} =
    require('../qisi-pdf-support-controlled-write.js');

const {
    missingAnswerWithSolution,
    parserStricterThanLegacy,
    case02SolutionDiagnostic,
    objectRawTextPageParserGate,
    markerCoverageFixture,
    realStyleSectionFixture,
    attempt7ResidualMarkerFixture,
    case02AnswerMissing89Fixture,
    attempt12SequenceDiscontinuityFixture
} =
    require('./fixtures/pdf-real-case-minimal.js');

test(
    'sanitized PDF support raw text with a missing answer keeps only safe prefix',
    () => {
        const fixture =
            missingAnswerWithSolution;
        const parsed =
            parsePdfSupportBlocks({
                rawTextPages:
                    fixture.rawTextPages,
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                sourceFileId:
                    fixture.id,
                mode:
                    'support'
            });
        const aligned =
            alignPdfSupport({
                questionItems:
                    fixture.questionItems,
                answerItems:
                    parsed.answerItems,
                solutionItems:
                    parsed.solutionItems,
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers
            });

        assert.equal(
            aligned.mode,
            fixture.expected.mode
        );
        assert.deepEqual(
            aligned.safeQuestionNumbers,
            fixture.expected.safeQuestionNumbers
        );
        assert.deepEqual(
            aligned.safeAnswerItems.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            aligned.safeSolutionItems.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            aligned.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );
        assert.ok(
            aligned.report.reasons.includes(
                'answer-question-not-continuous'
            ) ||
            aligned.report.reasons.includes(
                'answer-solution-question-set-mismatch'
            )
        );
    }
);

test(
    'parser gate records stricter support prefix without expanding unsafe parser ownership',
    () => {
        const fixture =
            parserStricterThanLegacy;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.parserRawTextPages
            });

        assert.equal(
            parserGate.mode,
            fixture.expected.parserMode
        );
        assert.deepEqual(
            parserGate.safeQuestionNumbers,
            ['1']
        );
        assert.deepEqual(
            parserGate.answers.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            parserGate.solutions.map(item => item.question),
            ['1']
        );
        assert.deepEqual(
            parserGate.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );

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

        assert.deepEqual(
            controlled.answerQuestionNumbers,
            fixture.expected.effectiveAnswerQuestionNumbers
        );
        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.effectiveSolutionQuestionNumbers
        );
        assert.deepEqual(
            controlled.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );
        assert.ok(
            controlled.fieldDecisions.some(decision =>
                decision.questionNumber === '1' &&
                decision.field === 'answer' &&
                decision.source === 'legacy'
            )
        );
        assert.ok(
            controlled.fieldDecisions.some(decision =>
                decision.questionNumber === '2' &&
                decision.field === 'answer' &&
                decision.source === 'legacy'
            )
        );
    }
);

test(
    'parser gate preserves object raw text pages before support alignment',
    () => {
        const fixture =
            objectRawTextPageParserGate;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });

        assert.equal(
            parserGate.rawTextPagesCount,
            fixture.expected.rawTextPagesCount
        );
        assert.equal(
            parserGate.parserResult.blocks.length,
            fixture.expected.supportBlockCount
        );
        assert.equal(
            parserGate.mode,
            fixture.expected.parserMode
        );
        assert.deepEqual(
            parserGate.answers.map(item => item.question),
            fixture.expected.answerQuestionNumbers
        );
        assert.deepEqual(
            parserGate.solutions.map(item => item.question),
            fixture.expected.solutionQuestionNumbers
        );
        assert.deepEqual(
            parserGate.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );
    }
);

test(
    'case02 diagnostic fixture keeps answer-full solution-partial state fail-closed',
    () => {
        const fixture =
            case02SolutionDiagnostic;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.parserRawTextPages
            });

        assert.equal(
            fixture.questionItems.length,
            fixture.expected.questionCount
        );
        assert.equal(
            fixture.questionItems.filter(item => item.answer).length,
            fixture.expected.answerCount
        );
        assert.equal(
            parserGate.rawTextPagesCount,
            fixture.expected.supportRawPageCount
        );
        assert.equal(
            parserGate.parserResult.blocks.length,
            fixture.expected.supportBlockCount
        );
        assert.deepEqual(
            parserGate.parserResult.answerItems.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            parserGate.parserResult.solutionItems.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
        assert.equal(
            parserGate.mode,
            fixture.expected.mode
        );
        assert.equal(
            parserGate.failClosed,
            fixture.expected.failClosed
        );
        assert.ok(
            parserGate.report.reasons.includes(
                'support-question-set-not-equal-expected'
            )
        );
        assert.deepEqual(
            parserGate.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );

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

        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.writableSolutionNumbers
        );
        assert.equal(
            controlled.solutionQuestionNumbers.length,
            fixture.expected.solutionCount
        );
        assert.deepEqual(
            fixture.expected.rejectedSolutionNumbers,
            []
        );
        assert.deepEqual(
            fixture.expected.outOfRangeNumbers,
            []
        );
        assert.equal(
            fixture.expected.coverageState,
            'incomplete'
        );
        assert.equal(
            fixture.expected.targetState,
            'complete'
        );
    }
);

test(
    'sanitized marker-form fixture raises parser gate solution coverage',
    () => {
        const fixture =
            markerCoverageFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
            });

        assert.equal(
            parserGate.rawTextPagesCount,
            fixture.rawTextPages.length
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
            parserGate.parserResult.answerItems.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            parserGate.parserResult.solutionItems.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
        assert.equal(
            parserGate.mode,
            'full'
        );
        assert.deepEqual(
            parserGate.answers.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            parserGate.solutions.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
    }
);

test(
    'real-style section fixture reaches full parser gate coverage',
    () => {
        const fixture =
            realStyleSectionFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
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
        assert.equal(
            parserGate.mode,
            'full'
        );
        assert.deepEqual(
            parserGate.answers.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            parserGate.solutions.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
        assert.deepEqual(
            parserGate.fusedQuestionNumbers,
            []
        );
    }
);

test(
    'attempt 7 residual marker fixture reaches full parser gate coverage',
    () => {
        const fixture =
            attempt7ResidualMarkerFixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
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
        assert.equal(
            parserGate.mode,
            'full'
        );
        assert.deepEqual(
            parserGate.answers.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            parserGate.solutions.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
    }
);

test(
    'case02 answer 8 and 9 fixture keeps full solutions and writes segmented multiple-choice answers',
    () => {
        const fixture =
            case02AnswerMissing89Fixture;
        const parserGate =
            buildPdfSupportParserGate({
                parsePdfSupportBlocks,
                alignPdfSupport,
                file: {
                    id:
                        fixture.id,
                    filename:
                        'SANITIZED_SUPPORT.pdf'
                },
                expectedQuestionNumbers:
                    fixture.expectedQuestionNumbers,
                rawTextPages:
                    fixture.rawTextPages
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
        assert.equal(
            parserGate.mode,
            'full'
        );

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

        assert.deepEqual(
            controlled.answerQuestionNumbers,
            fixture.expected.effectiveAnswerNumbers
        );
        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.effectiveSolutionNumbers
        );
        assert.equal(
            answerByQuestion.get('8'),
            fixture.expected.normalizedAnswers[8]
        );
        assert.equal(
            answerByQuestion.get('9'),
            fixture.expected.normalizedAnswers[9]
        );
        assert.deepEqual(
            controlled.warnings,
            []
        );
        assert.ok(
            controlled.fieldDecisions.some(decision =>
                decision.questionNumber === '8' &&
                decision.reason === fixture.expected.convertedReason
            )
        );
    }
);

test(
    'attempt 12 sequence discontinuity keeps only safe solution prefix',
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

        assert.equal(
            fixture.questionItems.length,
            fixture.expected.questionCount
        );
        assert.notEqual(
            parserGate.mode,
            'full'
        );
        assert.equal(
            parserGate.mode,
            fixture.expected.parserMode
        );
        assert.deepEqual(
            parserGate.parserResult.answerItems.map(item => item.question),
            fixture.expected.answerDetectedNumbers
        );
        assert.deepEqual(
            parserGate.parserResult.solutionItems.map(item => item.question),
            fixture.expected.solutionDetectedNumbers
        );
        assert.deepEqual(
            parserGate.parserResult.coverageReport.missingSolutions,
            fixture.expected.missingSolutions
        );
        assert.deepEqual(
            parserGate.solutions.map(item => item.question),
            fixture.expected.safeSolutionQuestionNumbers
        );
        assert.deepEqual(
            parserGate.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );

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

        assert.deepEqual(
            controlled.answerQuestionNumbers,
            fixture.expected.effectiveAnswerQuestionNumbers
        );
        assert.deepEqual(
            controlled.solutionQuestionNumbers,
            fixture.expected.effectiveSolutionQuestionNumbers
        );
        assert.deepEqual(
            controlled.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );
        assert.deepEqual(
            controlled.controlledWriteSummary.solutionQuestionNumbers,
            fixture.expected.effectiveSolutionQuestionNumbers
        );
        assert.deepEqual(
            controlled.controlledWriteSummary.fusedQuestionNumbers,
            fixture.expected.fusedQuestionNumbers
        );

        for (const question of fixture.expected.unsafeSolutionQuestionNumbers) {
            assert.ok(
                !controlled.solutionQuestionNumbers.includes(question),
                `unsafe solution ${question} must not be written`
            );
        }

        const safeSolution =
            controlled.effectiveSolutionItems.find(item => item.question === '1');

        assert.ok(
            safeSolution.sourceTrace.rawBlockExcerpt.includes(
                'ATTEMPT12_SOLUTION_1'
            )
        );
        assert.deepEqual(
            safeSolution.warnings,
            []
        );
    }
);
