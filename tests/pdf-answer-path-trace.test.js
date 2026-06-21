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
    buildPdfSupportFieldLevelControlledWrite
} =
    require('../qisi-pdf-support-controlled-write.js');

const {
    p8gAttempt1FailureSignatureFixture,
    p7AnswerRejectionFixture
} =
    require('./fixtures/pdf-real-case-minimal.js');

const buildAnswerPathTrace = (fixture, controlledWrite, parserGate) => {
    const expected =
        fixture.expectedQuestionNumbers.map(String);
    const accepted =
        new Set(controlledWrite.answerQuestionNumbers.map(String));
    const rejectedMap =
        new Map(
            controlledWrite.warnings.map(warning => [
                String(warning.questionNumber),
                {
                    reason: warning.reason,
                    rejectionCode: warning.rejectionCode,
                    rejectionDetail: warning.rejectionDetail,
                    structuralCandidate: warning.structuralCandidate,
                    structuralReason: warning.structuralReason,
                    originalAnswer: warning.originalAnswer
                        ? String(warning.originalAnswer).slice(0, 80)
                        : '',
                    answerEvidence: warning.answerEvidence
                        ? {
                            hasQuestionMarker: warning.answerEvidence.hasQuestionMarker,
                            hasAnswerLabel: warning.answerEvidence.hasAnswerLabel,
                            evidenceLevel: warning.answerEvidence.evidenceLevel,
                            sourceTraceAvailable: warning.answerEvidence.sourceTraceAvailable
                        }
                        : null
                }
            ])
        );
    const parserAnswerNumbers =
        new Set(
            (parserGate?.parserResult?.answerItems || [])
                .map(item => String(item.question || ''))
                .filter(Boolean)
        );
    const draftSnapshotSet =
        new Set((fixture.expected.draftSnapshotAnswerNumbers || []).map(String));
    const baselineCandidateSet =
        new Set((fixture.expected.baselineCandidateAnswerNumbers || []).map(String));

    const traces = {};

    expected.forEach(question => {
        const isAccepted =
            accepted.has(question);
        const isRejected =
            rejectedMap.has(question);
        const isDraft =
            draftSnapshotSet.has(question);
        const isBaselineCandidate =
            baselineCandidateSet.has(question);
        const rejectionInfo =
            rejectedMap.get(question) || null;
        const isParserObserved =
            parserAnswerNumbers.has(question);

        let dropStage =
            'unknown';

        if (isAccepted) {
            dropStage = 'none-accepted';
        } else if (isRejected) {
            if (rejectionInfo && rejectionInfo.structuralCandidate) {
                dropStage = 'controlled-write';
            } else if (rejectionInfo) {
                dropStage = 'controlled-write';
            } else {
                dropStage = 'pre-controlled-write evidence insufficient';
            }
        } else if (!isParserObserved && !isDraft) {
            dropStage = 'parser-or-aligner';
        } else {
            dropStage = 'pre-controlled-write evidence insufficient';
        }

        traces[question] = {
            question,
            expected: true,
            ocrRawObserved: false,
            ocrRawShape: 'unknown',
            parserObserved: isParserObserved,
            alignerObserved: isParserObserved,
            alignerSafe: isParserObserved,
            controlledWriteAccepted: isAccepted,
            controlledWriteRejected: isRejected,
            rejectionCode:
                rejectionInfo ? rejectionInfo.rejectionCode : '',
            rejectionDetail:
                rejectionInfo ? rejectionInfo.rejectionDetail : '',
            structuralCandidate:
                rejectionInfo ? rejectionInfo.structuralCandidate : false,
            structuralReason:
                rejectionInfo ? rejectionInfo.structuralReason : '',
            draftSnapshotPresent: isDraft,
            baselineCandidatePresent: isBaselineCandidate,
            dropStage,
            truthSource: 'controlled-write'
        };
    });

    return {
        expectedQuestionNumbers:
            expected,
        acceptedAnswerCount:
            controlledWrite.answerQuestionNumbers.length,
        rejectedAnswerCount:
            controlledWrite.warnings.length,
        baselineCandidateCount:
            (fixture.expected.baselineCandidateAnswerNumbers || fixture.expected.controlledWriteAnswerNumbers || []).length,
        draftSnapshotCount:
            (fixture.expected.draftSnapshotAnswerNumbers || []).length,
        traces,
        traceSummary: {
            acceptedQuestions:
                expected.filter(question => traces[question].controlledWriteAccepted),
            rejectedQuestions:
                expected.filter(question => traces[question].controlledWriteRejected),
            missingFromDraft:
                expected.filter(question => !traces[question].draftSnapshotPresent),
            needsDiagnosticRealRun:
                true,
            reason:
                'ocrRawObserved is false for all questions; raw OCR answer evidence not captured in existing fixtures'
        }
    };
};

test(
    'P10B answer path trace for P8G attempt 1: per-question controlled-write is truth source',
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

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        assert.equal(
            trace.acceptedAnswerCount,
            5
        );
        assert.equal(
            trace.rejectedAnswerCount,
            7
        );
        assert.equal(
            trace.baselineCandidateCount,
            5
        );
        assert.equal(
            trace.draftSnapshotCount,
            10
        );

        assert.ok(
            trace.traceSummary.needsDiagnosticRealRun,
            'ocrRawObserved is false — diagnostic real-run needed'
        );
        assert.equal(
            trace.traceSummary.acceptedQuestions.length,
            5
        );
        assert.equal(
            trace.traceSummary.rejectedQuestions.length,
            7
        );
        assert.deepEqual(
            trace.traceSummary.missingFromDraft,
            ['8', '9']
        );
    }
);

test(
    'P10B trace: questions 8 and 9 are rejected by controlled-write with structural non-label-payload',
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

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        for (const question of ['8', '9']) {
            const t =
                trace.traces[question];

            assert.ok(t, `trace must exist for question ${question}`);
            assert.equal(t.expected, true);
            assert.equal(t.ocrRawObserved, false, 'ocr raw not captured in fixture');
            assert.equal(t.ocrRawShape, 'unknown', 'ocr raw shape unknown');
            assert.equal(
                t.parserObserved,
                true,
                'parser observed answer block'
            );
            assert.equal(
                t.alignerObserved,
                true,
                'aligner observed answer item'
            );
            assert.equal(
                t.controlledWriteAccepted,
                false,
                'controlled-write rejected'
            );
            assert.equal(
                t.controlledWriteRejected,
                true,
                'controlled-write rejected'
            );
            assert.equal(
                t.rejectionCode,
                'rejection-multi-option-value-rejected'
            );
            assert.ok(
                t.rejectionDetail.length > 0,
                'rejectionDetail must be present'
            );
            assert.equal(
                t.structuralCandidate,
                true,
                'structural shell detected'
            );
            assert.equal(
                t.structuralReason,
                'non-label-payload',
                'compaction yielded non-A-F content'
            );
            assert.equal(
                t.draftSnapshotPresent,
                false,
                'not in draft snapshot'
            );
            assert.equal(
                t.baselineCandidatePresent,
                false,
                'not in baseline candidate'
            );
            assert.ok(
                t.dropStage === 'controlled-write' ||
                t.dropStage === 'pre-controlled-write evidence insufficient',
                `dropStage must be controlled-write or pre-controlled-write evidence insufficient, got: ${t.dropStage}`
            );
            assert.equal(
                t.truthSource,
                'controlled-write'
            );
        }
    }
);

test(
    'P10B trace: questions 2-6 are rejected option-value-not-matched, draft has them from repair',
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

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        for (const question of ['2', '3', '4', '5', '6']) {
            const t =
                trace.traces[question];

            assert.ok(t, `trace must exist for question ${question}`);
            assert.equal(t.controlledWriteAccepted, false);
            assert.equal(t.controlledWriteRejected, true);
            assert.equal(
                t.rejectionCode,
                'rejection-option-value-not-matched'
            );
            assert.equal(
                t.structuralCandidate,
                false
            );
            assert.equal(
                t.draftSnapshotPresent,
                true,
                `question ${question} present in draft snapshot (from repair path)`
            );
            assert.equal(
                t.baselineCandidatePresent,
                false,
                `question ${question} must NOT be in baseline (rejected by truth gate)`
            );
            assert.equal(
                t.dropStage,
                'controlled-write'
            );
            assert.equal(
                t.truthSource,
                'controlled-write'
            );
        }
    }
);

test(
    'P10B trace: accepted questions 1,7,10,13,15 have dropStage none-accepted',
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

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        for (const question of fixture.expected.controlledWriteAcceptedAnswerNumbers) {
            const t =
                trace.traces[question];

            assert.ok(t, `trace must exist for question ${question}`);
            assert.equal(
                t.controlledWriteAccepted,
                true
            );
            assert.equal(
                t.controlledWriteRejected,
                false
            );
            assert.equal(
                t.baselineCandidatePresent,
                true,
                `accepted question ${question} must be in baseline`
            );
            assert.equal(
                t.dropStage,
                'none-accepted'
            );
            assert.equal(
                t.truthSource,
                'controlled-write'
            );
        }
    }
);

test(
    'P10B trace: solution 12/12 does not unlock answer 8/9 in trace',
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

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        const solutionComplete =
            controlled.solutionQuestionNumbers.length ===
            fixture.expectedQuestionNumbers.length;

        assert.ok(
            solutionComplete,
            'solutions are complete 12/12'
        );

        for (const question of ['8', '9']) {
            assert.ok(
                controlled.solutionQuestionNumbers.includes(question),
                `solution ${question} exists`
            );
            assert.ok(
                !controlled.answerQuestionNumbers.includes(question),
                `answer ${question} NOT accepted despite solution existing`
            );
            assert.equal(
                trace.traces[question].baselineCandidatePresent,
                false,
                `baseline candidate must be false for ${question}`
            );
        }

        const isComplete =
            controlled.answerQuestionNumbers.length ===
                fixture.expectedQuestionNumbers.length &&
            controlled.warnings.length === 0;

        assert.ok(!isComplete, 'not complete despite 12/12 solutions');
    }
);

test(
    'P10B trace: P8G failure signature is pass-safe-partial, not complete',
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
            parserGate.mode,
            'full',
            'parser gate is full'
        );

        const hasRejectedAnswers =
            controlled.warnings.length > 0;

        assert.ok(hasRejectedAnswers, 'has rejected answers');

        const acceptedCoversAll =
            controlled.answerQuestionNumbers.length ===
            fixture.expectedQuestionNumbers.length;

        assert.ok(!acceptedCoversAll, 'accepted does not cover all expected');

        assert.equal(
            fixture.expected.result,
            'pass-safe-partial'
        );

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        assert.ok(
            trace.traceSummary.needsDiagnosticRealRun,
            'ocrRaw evidence missing → needs diagnostic real-run'
        );
    }
);

test(
    'P10B trace: P7 answer rejection fixture also traces correctly',
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

        const trace =
            buildAnswerPathTrace(fixture, controlled, parserGate);

        assert.equal(
            trace.acceptedAnswerCount,
            9
        );
        assert.equal(
            trace.rejectedAnswerCount,
            3
        );

        for (const question of ['2', '8', '9']) {
            const t =
                trace.traces[question];

            assert.ok(t);
            assert.equal(t.controlledWriteAccepted, false);
            assert.equal(t.controlledWriteRejected, true);
            assert.equal(t.baselineCandidatePresent, false);

            if (question === '2') {
                assert.equal(
                    t.rejectionCode,
                    'rejection-option-value-not-matched'
                );
                assert.equal(t.structuralCandidate, false);
            } else {
                assert.equal(
                    t.rejectionCode,
                    'rejection-multi-option-value-rejected'
                );
                assert.equal(t.structuralCandidate, true);
            }
        }
    }
);
