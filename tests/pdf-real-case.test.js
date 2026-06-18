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
    objectRawTextPageParserGate
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
