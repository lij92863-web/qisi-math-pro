const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    EXPECTED_QUESTION_NUMBERS,
    REAL_RUN_ALLOWED_ENV_NAME,
    assertRealRunAllowed,
    buildSolutionDiagnostics,
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
