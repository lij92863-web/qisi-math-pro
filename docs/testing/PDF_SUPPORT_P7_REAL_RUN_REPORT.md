# PDF Support P7 Real Run Report

## Stage

P7 controlled real double-PDF run.

## Run Identity

- Runner command: `node scripts/pdf-master-browser-runner.js real-run`
- Run authorization: `QISI_PDF_MASTER_REAL_RUN_ALLOWED=1`
- Run count in this stage: 1
- Run ID: `pdf-master-real-run-20260621154801`
- Attempt ID: `real-run-20260621154801`
- Started at: `2026-06-21T15:48:01.867Z`
- Report source: `current-run-only`
- Input files:
  - `local-test-materials/case02-pdf-pdf-real/01-question.pdf`
  - `local-test-materials/case02-pdf-pdf-real/02-support-answer-solution.pdf`

## Pre-Run Gates

- `npm.cmd run verify:safe`: passed, 114 tests
- `npm.cmd run verify:batch-safety`: passed
- `npm.cmd run verify:diff-scope`: passed with no changed files
- `node scripts/pdf-master-browser-runner.js preflight`: passed
- `node scripts/pdf-master-browser-runner.js dry-run`: passed

## Real-Run Result

Result: `pass-safe-partial`

The run is safe enough to record, but it is not a complete baseline candidate.

Reasons:

- Answer coverage is incomplete: 10/12.
- Missing answers: `8`, `9`.
- Solution coverage is complete: 12/12.
- Controlled-write `fusedQuestionNumbers` is non-empty.
- Controlled-write rejected parser objective answers for `2`, `8`, and `9`.
- Runner ledger classified the result as `pass-safe-partial`.

## Coverage

- Expected question numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Detected question numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Detected answer numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Detected solution numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Safe answer numbers from runner draft snapshot: `1,2,3,4,5,6,7,10,13,15`
- Controlled-write answer numbers: `1,3,4,5,6,7,10,13,15`
- Safe solution numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Fused question numbers: `2,3,4,5,6,7,8,9,10,13,15`

## Parser And Aligner Diagnostics

- Parser raw page count: 4
- Support block count: 12
- Answer block count: 12
- Solution block count: 12
- Parser warnings: none in the flattened runner field
- Aligner report reasons: none in the flattened runner field
- Parser gate align output mode: `full`
- Parser gate safe answer count: 12
- Parser gate safe solution count: 12

The final runner ledger `alignMode` is `fail-closed` because review warnings included `pdf-support-sequence-unreliable`, missing-field warnings, and controlled-write fused numbers.

## Controlled Write Summary

- Answer question numbers: `1,3,4,5,6,7,10,13,15`
- Solution question numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Fused question numbers: `2,3,4,5,6,7,8,9,10,13,15`
- Warning codes: `parser-objective-answer-rejected`
- Rejected answer numbers: `2,8,9`
- Rejected answer reasons:
  - `option-value-not-matched`
  - `multiple-option-value-rejected`
- Rejected solution numbers: none
- Rejected solution reasons: none

## Draft Cleanup

- Draft cleanup before run: yes
- Draft count before: 0
- Draft count after: 0
- Cleanup result: ok

## Safety Notes

- Real AI/OCR called: yes
- Underlying AI/OCR request count reported by runner: 10
- Runner real-run called: yes, exactly once
- Additional real-run attempts: none
- Business code modified after real-run: no
- Baseline generated: no
- Freeze/tag generated: no

## Classification

This is not a complete baseline because answers `8` and `9` remain missing and fused question numbers are non-empty.

Do not generate a complete baseline, freeze note, release audit, or tag from this run.

## Next Step

Investigate answer ownership for `8` and `9` in a separate fixture-first stage. Do not rerun real PDF recognition until a new task explicitly authorizes another controlled run.
