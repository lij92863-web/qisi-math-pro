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
