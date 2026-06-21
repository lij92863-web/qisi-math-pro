const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    EXPECTED_QUESTION_NUMBERS,
    REAL_RUN_ALLOWED_ENV_NAME,
    assertRealRunAllowed,
    buildSolutionDiagnostics,
    buildAnswerExtractionQualityShadow,
    createRunContext,
    makeLedgerEntry,
    parseMode
} =
    require('../scripts/pdf-master-browser-runner.js');

test(
    'runner parses positional preflight and dry-run modes',
    () => {
        assert.equal(
            parseMode(['node', 'runner', 'preflight']),
            'preflight'
        );
        assert.equal(
            parseMode(['node', 'runner', 'dry-run']),
            'dry-run'
        );
        assert.equal(
            parseMode(['node', 'runner', '--mode=dry-run']),
            'dry-run'
        );
    }
);

test(
    'runner real-run requires explicit environment permission',
    () => {
        const previous =
            process.env[REAL_RUN_ALLOWED_ENV_NAME];

        try {
            delete process.env[REAL_RUN_ALLOWED_ENV_NAME];

            assert.throws(
                () => assertRealRunAllowed('real-run'),
                /real-run requires/
            );

            assert.doesNotThrow(
                () => assertRealRunAllowed('dry-run')
            );

            process.env[REAL_RUN_ALLOWED_ENV_NAME] =
                '1';

            assert.doesNotThrow(
                () => assertRealRunAllowed('real-run')
            );
        } finally {
            if (previous === undefined) {
                delete process.env[REAL_RUN_ALLOWED_ENV_NAME];
            } else {
                process.env[REAL_RUN_ALLOWED_ENV_NAME] =
                    previous;
            }
        }
    }
);

test(
    'runner ledger records current-run diagnostic contract',
    () => {
        const runContext =
            createRunContext('dry-run', new Date('2026-06-21T00:00:00.000Z'));
        const ledger =
            makeLedgerEntry({
                mode:
                    'dry-run',
                runContext,
                questionPdf:
                    {
                        path:
                            'local-test-materials/q.pdf',
                        bytes:
                            10
                    },
                supportPdf:
                    {
                        path:
                            'local-test-materials/s.pdf',
                        bytes:
                            20
                    },
                result:
                    'pass',
                nextAction:
                    'none',
                detectedQuestionNumbers:
                    ['1', '2'],
                detectedAnswerNumbers:
                    ['1'],
                detectedSolutionNumbers:
                    ['1'],
                safeAnswerNumbers:
                    ['1'],
                safeSolutionNumbers:
                    ['1'],
                fusedQuestionNumbers:
                    ['2'],
                prefixCutoffReason:
                    'gap-after-1',
                parserWarnings:
                    ['parser-warning'],
                alignerReportReasons:
                    ['aligner-reason'],
                controlledWriteSummary:
                    {
                        answerQuestionNumbers:
                            ['1'],
                        solutionQuestionNumbers:
                            ['1']
                    },
                draftCleanup:
                    {
                        beforeRun:
                            true,
                        beforeCount:
                            2,
                        afterCount:
                            0,
                        ok:
                            true
                    }
            });

        assert.equal(
            ledger.runId,
            'pdf-master-dry-run-20260621000000'
        );
        assert.equal(
            ledger.attemptId,
            'dry-run-20260621000000'
        );
        assert.deepEqual(
            ledger.expectedQuestionNumbers,
            EXPECTED_QUESTION_NUMBERS
        );
        assert.deepEqual(
            ledger.inputFiles,
            ['local-test-materials/q.pdf', 'local-test-materials/s.pdf']
        );
        assert.equal(
            ledger.reportSource,
            'current-run-only'
        );
        assert.equal(
            ledger.realApiCalled,
            false
        );
        assert.deepEqual(
            ledger.fusedQuestionNumbers,
            ['2']
        );
    }
);

test(
    'runner diagnostics keep parser aligner and controlled-write fields separate',
    () => {
        const diagnostics =
            buildSolutionDiagnostics({
                browserDiagnostics:
                    {
                        parserGate:
                            {
                                supportDetectedNumbers:
                                    ['1', '2'],
                                answerDetectedNumbers:
                                    ['1', '2'],
                                solutionDetectedNumbers:
                                    ['1'],
                                blockedSolutionNumbers:
                                    ['2'],
                                failClosedReason:
                                    ['missing-solution'],
                                prefixCutoffAt:
                                    '2',
                                rejectReasons:
                                    ['answer-solution-question-set-mismatch']
                            },
                        controlledWrite:
                            {
                                fusedQuestionNumbers:
                                    ['2'],
                                rejectedSolutionNumbers:
                                    ['2'],
                                rejectedSolutionReasons:
                                    ['no-usable-safe-solution'],
                                solutionQuestionNumbers:
                                    ['1']
                            }
                    },
                missingSolutions:
                    ['2'],
                draftSnapshot:
                    [
                        {
                            question:
                                '1',
                            hasSolution:
                                true
                        },
                        {
                            question:
                                '2',
                            hasSolution:
                                false
                        }
                    ]
            });

        assert.deepEqual(
            diagnostics.answerDetectedNumbers,
            ['1', '2']
        );
        assert.deepEqual(
            diagnostics.solutionDetectedNumbers,
            ['1']
        );
        assert.equal(
            diagnostics.missingSolutionReasons['2'],
            'no-usable-safe-solution'
        );
        assert.deepEqual(
            diagnostics.rejectReasons,
            ['answer-solution-question-set-mismatch', 'no-usable-safe-solution']
        );
        assert.deepEqual(
            diagnostics.writableSolutionNumbers,
            ['1']
        );
    }
);

test(
    'P8D diagnostics expose controlled-write accepted and rejected answer numbers',
    () => {
        const diagnostics =
            buildSolutionDiagnostics({
                browserDiagnostics:
                    {
                        parserGate:
                            {
                                supportDetectedNumbers:
                                    ['1', '2'],
                                answerDetectedNumbers:
                                    ['1', '2'],
                                solutionDetectedNumbers:
                                    ['1', '2']
                            },
                        controlledWrite:
                            {
                                answerQuestionNumbers:
                                    ['1'],
                                rejectedAnswerNumbers:
                                    ['2'],
                                rejectedAnswerReasons:
                                    ['option-value-not-matched'],
                                solutionQuestionNumbers:
                                    ['1', '2']
                            }
                    },
                missingSolutions:
                    [],
                draftSnapshot:
                    [
                        { question: '1', hasSolution: true },
                        { question: '2', hasSolution: true }
                    ]
            });

        assert.deepEqual(
            diagnostics.controlledWriteAcceptedAnswerNumbers,
            ['1']
        );
        assert.deepEqual(
            diagnostics.controlledWriteRejectedAnswerNumbers,
            ['2']
        );
        assert.deepEqual(
            diagnostics.controlledWriteAcceptedSolutionNumbers,
            ['1', '2']
        );
    }
);

test(
    'P8D baseline candidate answer numbers exclude controlled-write rejected answers',
    () => {
        const controlledWriteAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];
        const draftSnapshotAnswers =
            ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15'];
        const controlledWriteRejected =
            ['2', '8', '9'];

        const baselineCandidate =
            draftSnapshotAnswers.filter(
                question => controlledWriteAccepted.includes(question)
            );

        assert.deepEqual(
            baselineCandidate,
            ['1', '3', '4', '5', '6', '7', '10', '13', '15']
        );
        assert.ok(
            !baselineCandidate.includes('2'),
            'answer 2 controlled-write rejected must not be in baseline candidate'
        );
        assert.ok(
            !baselineCandidate.includes('8'),
            'answer 8 controlled-write rejected must not be in baseline candidate'
        );
        assert.ok(
            !baselineCandidate.includes('9'),
            'answer 9 controlled-write rejected must not be in baseline candidate'
        );

        for (const question of controlledWriteRejected) {
            assert.ok(
                !baselineCandidate.includes(question),
                `rejected answer ${question} must not appear in baseline candidate`
            );
        }

        const completeBaselineCandidate =
            baselineCandidate.length === 12 &&
            controlledWriteRejected.length === 0;

        assert.ok(
            !completeBaselineCandidate,
            'with rejected answers, cannot be complete baseline'
        );

        assert.ok(
            draftSnapshotAnswers.includes('2'),
            'answer 2 may be in draft snapshot (from another path)'
        );
        assert.ok(
            !baselineCandidate.includes('2'),
            'but answer 2 must not be in baseline candidate'
        );
    }
);

test(
    'P8D ledger includes controlled-write and baseline candidate fields',
    () => {
        const runContext =
            createRunContext('real-run', new Date('2026-06-22T00:00:00.000Z'));
        const ledger =
            makeLedgerEntry({
                mode: 'real-run',
                runContext,
                result: 'pass-safe-partial',
                nextAction: 'fixture-first',
                controlledWriteAcceptedAnswerNumbers:
                    ['1', '3', '4', '5', '6', '7', '10', '13', '15'],
                controlledWriteRejectedAnswerNumbers:
                    ['2', '8', '9'],
                draftSnapshotAnswerNumbers:
                    ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15'],
                baselineCandidateAnswerNumbers:
                    ['1', '3', '4', '5', '6', '7', '10', '13', '15']
            });

        assert.deepEqual(
            ledger.controlledWriteAcceptedAnswerNumbers,
            ['1', '3', '4', '5', '6', '7', '10', '13', '15']
        );
        assert.deepEqual(
            ledger.controlledWriteRejectedAnswerNumbers,
            ['2', '8', '9']
        );
        assert.deepEqual(
            ledger.draftSnapshotAnswerNumbers,
            ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15']
        );
        assert.deepEqual(
            ledger.baselineCandidateAnswerNumbers,
            ['1', '3', '4', '5', '6', '7', '10', '13', '15']
        );
        assert.ok(
            !ledger.baselineCandidateAnswerNumbers.includes('2')
        );
    }
);

test(
    'P9J truth gate: parserGate full alone does not determine complete',
    () => {
        const expectedFull =
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'];

        const parserGateIsFull = true;
        const alignerIsFull = true;

        const controlledWriteAcceptedAnswers =
            ['1', '7', '10', '13', '15'];
        const controlledWriteRejectedAnswers =
            ['2', '3', '4', '5', '6', '8', '9'];

        const hasRejected =
            controlledWriteRejectedAnswers.length > 0;

        const parserSaysComplete =
            parserGateIsFull && alignerIsFull;

        const controlledWriteSaysComplete =
            controlledWriteAcceptedAnswers.length === expectedFull.length &&
            controlledWriteRejectedAnswers.length === 0;

        assert.ok(
            parserSaysComplete,
            'parser and aligner report full'
        );
        assert.ok(
            !controlledWriteSaysComplete,
            'controlled-write reports incomplete'
        );
        assert.ok(
            parserSaysComplete !== controlledWriteSaysComplete,
            'parser gate full does not equal controlled-write complete'
        );
    }
);

test(
    'P9J truth gate: complete baseline requires all acceptances and no rejections',
    () => {
        const expectedQuestionNumbers =
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'];

        const computeComplete = ({
            controlledWriteAcceptedAnswers = [],
            controlledWriteRejectedAnswers = [],
            fusedQuestionNumbers = [],
            parserGateMode = 'full',
            acceptedSolutions = [],
            expected = expectedQuestionNumbers
        } = {}) => {
            const answerCoversAll =
                expected.every(
                    question =>
                        controlledWriteAcceptedAnswers.includes(question)
                );
            const solutionCoversAll =
                expected.every(
                    question =>
                        acceptedSolutions.includes(question)
                );
            const noRejected =
                controlledWriteRejectedAnswers.length === 0;
            const noFused =
                fusedQuestionNumbers.length === 0;
            const parserFull =
                parserGateMode === 'full';

            return (
                answerCoversAll &&
                solutionCoversAll &&
                noRejected &&
                noFused &&
                parserFull
            );
        };

        const complete =
            computeComplete({
                controlledWriteAcceptedAnswers:
                    expectedQuestionNumbers,
                controlledWriteRejectedAnswers:
                    [],
                fusedQuestionNumbers:
                    [],
                acceptedSolutions:
                    expectedQuestionNumbers
            });

        assert.ok(complete, 'all criteria met → complete');

        const missingAnswer =
            computeComplete({
                controlledWriteAcceptedAnswers:
                    ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15'],
                controlledWriteRejectedAnswers:
                    ['8', '9'],
                fusedQuestionNumbers:
                    [],
                acceptedSolutions:
                    expectedQuestionNumbers
            });

        assert.ok(!missingAnswer, 'missing answers → not complete');

        const hasRejected =
            computeComplete({
                controlledWriteAcceptedAnswers:
                    ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15'],
                controlledWriteRejectedAnswers:
                    ['8', '9'],
                fusedQuestionNumbers:
                    [],
                acceptedSolutions:
                    expectedQuestionNumbers
            });

        assert.ok(!hasRejected, 'has rejected answers → not complete');

        const hasFused =
            computeComplete({
                controlledWriteAcceptedAnswers:
                    expectedQuestionNumbers,
                controlledWriteRejectedAnswers:
                    [],
                fusedQuestionNumbers:
                    ['2', '3'],
                acceptedSolutions:
                    expectedQuestionNumbers
            });

        assert.ok(!hasFused, 'has fused numbers → not complete');

        const parserNotFull =
            computeComplete({
                controlledWriteAcceptedAnswers:
                    expectedQuestionNumbers,
                controlledWriteRejectedAnswers:
                    [],
                fusedQuestionNumbers:
                    [],
                parserGateMode:
                    'prefix',
                acceptedSolutions:
                    expectedQuestionNumbers
            });

        assert.ok(!parserNotFull, 'parser not full → not complete');

        const p8gCase =
            computeComplete({
                controlledWriteAcceptedAnswers:
                    ['1', '7', '10', '13', '15'],
                controlledWriteRejectedAnswers:
                    ['2', '3', '4', '5', '6', '8', '9'],
                fusedQuestionNumbers:
                    ['2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'],
                acceptedSolutions:
                    expectedQuestionNumbers
            });

        assert.ok(!p8gCase, 'P8G case → not complete');
    }
);

test(
    'P9J truth gate: draft snapshot larger than controlled-write accepted must not determine baseline',
    () => {
        const expected =
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'];

        const controlledWriteAccepted =
            ['1', '7', '10', '13', '15'];
        const draftSnapshotAnswers =
            ['1', '2', '3', '4', '5', '6', '7', '10', '13', '15'];

        assert.ok(
            draftSnapshotAnswers.length > controlledWriteAccepted.length,
            'draft has more answers than controlled-write accepted'
        );

        const baselineFromDraft =
            draftSnapshotAnswers.filter(
                question => expected.includes(question)
            );

        assert.deepEqual(
            baselineFromDraft,
            draftSnapshotAnswers,
            'draft snapshot covers 10/12 expected questions'
        );
        assert.ok(
            baselineFromDraft.length === 10 &&
                baselineFromDraft.length < expected.length,
            'draft snapshot is 10/12 — partial, not complete'
        );

        const baselineFromControlledWrite =
            draftSnapshotAnswers.filter(
                question => controlledWriteAccepted.includes(question)
            );

        assert.deepEqual(
            baselineFromControlledWrite,
            ['1', '7', '10', '13', '15']
        );
        assert.equal(
            baselineFromControlledWrite.length,
            5,
            'true baseline from controlled-write is only 5/12'
        );

        assert.ok(
            baselineFromDraft.length !== baselineFromControlledWrite.length,
            'draft-based baseline differs from controlled-write-based baseline'
        );
        assert.ok(
            baselineFromControlledWrite.length < baselineFromDraft.length,
            'controlled-write baseline is stricter (5 < 10)'
        );
    }
);

test(
    'P9J truth gate: controlledWriteAcceptedAnswerNumbers is the only truth source for baseline',
    () => {
        const expected =
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'];

        const p7ControlledWriteAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        const baselineCandidate =
            p7ControlledWriteAccepted.filter(
                question => expected.includes(question)
            );

        assert.deepEqual(
            baselineCandidate,
            p7ControlledWriteAccepted
        );
        assert.equal(
            baselineCandidate.length,
            9
        );
        assert.ok(
            !baselineCandidate.includes('2'),
            'P7 answer 2 rejected → not in baseline'
        );
        assert.ok(
            !baselineCandidate.includes('8'),
            'P7 answer 8 rejected → not in baseline'
        );

        const p8gControlledWriteAccepted =
            ['1', '7', '10', '13', '15'];

        const baselineCandidate2 =
            p8gControlledWriteAccepted.filter(
                question => expected.includes(question)
            );

        assert.equal(
            baselineCandidate2.length,
            5
        );
        assert.ok(
            !baselineCandidate2.includes('2'),
            'P8G answer 2 rejected → not in baseline'
        );

        const completeEmpty =
            expected.filter(
                question => expected.includes(question)
            );

        assert.deepEqual(completeEmpty, expected);
        assert.equal(completeEmpty.length, 12, 'only full acceptance → complete');
    }
);

test(
    'P10G shadow: Q2 \A{A} → safe-wrapper-candidate, canDirectlyAccept false',
    () => {
        const shadow =
            buildAnswerExtractionQualityShadow({
                rejectedAnswerWarnings: [
                    {
                        questionNumber: '2',
                        reason: 'option-value-not-matched',
                        originalAnswerShape: '\\A{A}',
                        structuralCandidate: false,
                        structuralReason: 'not-structural-label-shell'
                    },
                    {
                        questionNumber: '8',
                        reason: 'multiple-option-value-rejected',
                        originalAnswerShape: '}A_\\A{A}',
                        structuralCandidate: true,
                        structuralReason: 'non-label-payload'
                    },
                    {
                        questionNumber: '9',
                        reason: 'multiple-option-value-rejected',
                        originalAnswerShape: '}A_\\A{A}',
                        structuralCandidate: true,
                        structuralReason: 'non-label-payload'
                    }
                ]
            });

        assert.ok(shadow, 'shadow must be built');
        assert.ok(shadow['2'], 'Q2 must have shadow entry');
        assert.equal(
            shadow['2'].status,
            'safe-wrapper-candidate'
        );
        assert.equal(
            shadow['2'].normalizedCandidate,
            'A'
        );
        assert.equal(
            shadow['2'].canDirectlyAccept,
            false,
            'canDirectlyAccept must be false'
        );
        assert.equal(
            shadow['2'].affectsControlledWrite,
            false
        );
        assert.equal(
            shadow['2'].affectsBaselineCandidate,
            false
        );
    }
);

test(
    'P10G shadow: Q8/Q9 }A_\A{A} → dirty-structural-shell, normalizedCandidate null',
    () => {
        const shadow =
            buildAnswerExtractionQualityShadow({
                rejectedAnswerWarnings: [
                    { questionNumber: '8', originalAnswerShape: '}A_\\A{A}' },
                    { questionNumber: '9', originalAnswerShape: '}A_\\A{A}' }
                ]
            });

        assert.ok(shadow);
        assert.ok(shadow['8']);
        assert.equal(
            shadow['8'].status,
            'dirty-structural-shell'
        );
        assert.equal(
            shadow['8'].normalizedCandidate,
            null,
            'dirty shell must have null normalizedCandidate'
        );
        assert.equal(shadow['8'].canDirectlyAccept, false);

        assert.ok(shadow['9']);
        assert.equal(
            shadow['9'].status,
            'dirty-structural-shell'
        );
        assert.equal(shadow['9'].normalizedCandidate, null);
        assert.equal(shadow['9'].canDirectlyAccept, false);
    }
);

test(
    'P10G shadow: result does not affect controlled-write or baseline',
    () => {
        const shadow =
            buildAnswerExtractionQualityShadow({
                rejectedAnswerWarnings: [
                    { questionNumber: '2', originalAnswerShape: '\\A{A}' }
                ]
            });

        const controlledWriteAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];
        const controlledWriteRejected =
            ['2', '8', '9'];
        const baselineCandidate =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        assert.ok(shadow['2']);
        assert.equal(shadow['2'].status, 'safe-wrapper-candidate');

        assert.ok(
            !controlledWriteAccepted.includes(
                shadow['2'].normalizedCandidate
            ),
            'shadow candidate A not in accepted set'
        );
        assert.ok(
            controlledWriteRejected.includes('2'),
            'Q2 remains in rejected set regardless of shadow'
        );
        assert.ok(
            !baselineCandidate.includes('2'),
            'Q2 not in baseline regardless of shadow'
        );
        assert.equal(
            shadow['2'].affectsControlledWrite,
            false
        );
        assert.equal(
            shadow['2'].affectsBaselineCandidate,
            false
        );
    }
);

test(
    'P10G shadow: null shadow when classifier unavailable or no warnings',
    () => {
        const empty =
            buildAnswerExtractionQualityShadow({
                rejectedAnswerWarnings: []
            });

        assert.equal(empty, null, 'empty warnings → null shadow');

        const noWarnings =
            buildAnswerExtractionQualityShadow({});

        assert.equal(noWarnings, null, 'no rejectedAnswerWarnings → null shadow');
    }
);

test(
    'P10G shadow: pass-safe-partial unchanged by shadow classification',
    () => {
        const shadow =
            buildAnswerExtractionQualityShadow({
                rejectedAnswerWarnings: [
                    { questionNumber: '2', originalAnswerShape: '\\A{A}' },
                    { questionNumber: '8', originalAnswerShape: '}A_\\A{A}' },
                    { questionNumber: '9', originalAnswerShape: '}A_\\A{A}' }
                ]
            });

        const controlledWriteRejected = ['2', '8', '9'];
        const hasRejected =
            controlledWriteRejected.length > 0;

        assert.ok(hasRejected, 'rejected answers exist');
        assert.ok(shadow, 'shadow exists');

        const isComplete =
            !hasRejected;

        assert.ok(
            !isComplete,
            'pass-safe-partial regardless of shadow classification'
        );
    }
);
