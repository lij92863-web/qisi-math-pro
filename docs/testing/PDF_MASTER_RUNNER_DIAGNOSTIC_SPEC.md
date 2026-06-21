# PDF Master Runner Diagnostic Spec

## Scope

This stage hardens runner/report/draft cleanup diagnostics only. It does not permit a real run, baseline, freeze, or tag.

## Required Current-Run Fields

Every runner report and ledger entry must identify the current run with:

- `runId`
- `attemptId`
- `startedAt`
- `inputFiles`
- `expectedQuestionNumbers`
- `reportSource: current-run-only`

Real-run result reports must also record detected question, answer, and solution numbers, safe answer and solution numbers, fused question numbers, prefix cutoff reason, parser warnings, aligner report reasons, and controlled-write summary.

## Draft Cleanup

Before a real run, the runner must clear the draft workspace and record:

- `beforeRun`
- `beforeCount`
- `afterCount`
- `ok`

If cleanup does not leave zero draft rows, the runner aborts before upload or recognition.

## Safety Gates

- `preflight` and `dry-run` do not call AI/OCR.
- Positional commands such as `node scripts/pdf-master-browser-runner.js dry-run` are supported.
- `real-run` requires `QISI_PDF_MASTER_REAL_RUN_ALLOWED=1`.
- Stale run data must not count as current success; reports are marked `current-run-only`.

## Stage P6 Verification

Use safe verification only:

- `npm.cmd run verify:safe`
- `npm.cmd run verify:batch-safety`
- `npm.cmd run verify:diff-scope`
- `node scripts/pdf-master-browser-runner.js preflight`
- `node scripts/pdf-master-browser-runner.js dry-run`

Do not execute `node scripts/pdf-master-browser-runner.js real-run`.
