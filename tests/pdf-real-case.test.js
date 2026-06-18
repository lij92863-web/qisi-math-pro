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
    parserStricterThanLegacy
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
