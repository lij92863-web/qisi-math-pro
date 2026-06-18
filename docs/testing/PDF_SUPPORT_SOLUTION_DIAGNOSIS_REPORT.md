# PDF Support Solution Diagnosis Report

## Scope

Stage: PDF-SUPPORT-SOLUTION-COMPLETE-V2-STRICT / Stage A

This diagnosis uses only existing committed reports, existing code, tests, and sanitized local run ledger entries. No real-run was executed in this stage, no real PDF contents were copied, and no full OCR raw text was saved.

## Current Real Result

- Source baseline: `docs/testing/PDF_MASTER_STAGE6_REAL_VALIDATION_REPORT.md`
- Real API attempts before this task: 1
- Result classification: pass-safe-partial
- Question count: 12
- Answer count: 12
- Solution count: 1
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Align mode reported by runner: fail-closed
- Fail-closed / prefix signals: yes
- Wrong attach risk in existing sanitized runner report: not detected by sanitized warnings

## Layered Findings

### Parser Layer

The module `qisi-pdf-support-block-parser.js` can emit structured diagnostics:

- `blocks`
- `answerItems`
- `solutionItems`
- `coverageReport`
- `sequenceReport`
- warning codes such as `unknown-question-marker`, `duplicate-question-marker`, and `jump-back-question-marker`

However, the Stage 6 runner did not persist parser diagnostics. The existing report does not include support block count, parser answer count, parser solution count, detected solution question numbers, duplicate numbers, jump-back numbers, or out-of-range numbers.

Current parser-layer conclusion: insufficient evidence. The low solution count may mean parser did not split solution blocks, or it may mean parser split them but later gates rejected them.

### Aligner Layer

The module `qisi-pdf-support-aligner.js` can report:

- `answerSequence`
- `solutionSequence`
- `expectedValues`
- reject reasons such as `answer-question-not-continuous`, `solution-question-not-continuous`, `answer-solution-question-set-mismatch`, `support-question-set-not-equal-expected`, duplicate, invalid, and non-increasing reasons
- `safeQuestionNumbers`
- `fusedQuestionNumbers`

The Stage 6 report only persisted the final mode-like summary and generic warnings. It does not show the actual answer sequence, solution sequence, prefix cutoff, or precise aligner reasons.

Current aligner-layer conclusion: the final draft warnings show a sequence safety gate fired, but the exact aligner cause cannot be proven from the current report alone.

### Controlled-Write Layer

The module `qisi-pdf-support-controlled-write.js` can emit:

- parser gate mode
- parser result
- safe parser answers and solutions
- field decisions
- objective answer rejection warnings
- final effective answer and solution item numbers

In `app.js`, `buildPdfSupportFieldLevelControlledWrite` is called and a `fieldDecisionSummary` is logged to the browser console, but those diagnostics are not persisted into the runner artifact or Stage 6 report.

Current controlled-write conclusion: the final draft has 12 answers and 1 solution, but the current report cannot prove whether solutions 2-10, 13, and 15 were rejected by controlled-write or were never passed to controlled-write as safe items.

### Runner Collection

The current runner reads only final draft rows from IndexedDB and records:

- question count
- answer count
- solution count
- missing answer numbers
- missing solution numbers
- draft warnings

It does not collect parser, aligner, parser gate, field-level write, or review-page-vs-draft solution counts.

Current runner conclusion: runner collection is not sufficient for root-cause diagnosis.

## Direct Answers To Stage A Questions

1. Whether OCR recognized multiple solution blocks: cannot be determined from current sanitized artifacts.
2. If multiple solution blocks existed, whether parser failed or aligner rejected them: cannot be determined from current sanitized artifacts.
3. If aligner rejected them, exact reasons: cannot be determined; current evidence only shows sequence safety warnings.
4. If controlled-write rejected them, exact reasons: cannot be determined; field decisions were logged but not persisted.
5. Why missing solutions include 13 and 15: cannot be safely determined. Existing data suggests out-of-expected-range or OCR numbering pollution is possible, but this must not be assumed without sanitized detected-number diagnostics.
6. Real support PDF solution marker forms: cannot be determined without saving only sanitized marker forms in a future run.
7. Whether answers are normal while solution numbers are abnormal: likely possible because answers reached 12/12 while solutions reached 1/12, but exact answer and solution detected sequences are not persisted.
8. Whether mixed answer/solution layout, cross-page solution, missing solution numbers, or OCR-misread numbers exist: cannot be determined without runner diagnostics.
9. Existing fixtures do not cover the exact current failure shape. They cover safe prefix, missing answer with solution, known-bad jump-back, duplicate, mismatch, and controlled-write safety, but not real-run diagnostics showing answer full plus solution near-empty with explicit rejected solution reasons.
10. Responsible repair module cannot be selected yet. The next safe step is runner diagnostics, not parser/aligner/controlled-write repair.
11. The current 1/12 is proven at final draft/report level only. It may be "not split", "split then rejected", "rejected at write", or "report collection insufficient".
12. To reach 12/12 safely, the project must first know parser solution count, solution detected numbers, aligner reject reasons, controlled-write decisions, and missing solution reasons.

## Existing Test Gaps

- No fixture models real-run outcome `answer count = 12` and `solution count = 1` with detached diagnostics.
- No fixture asserts missing solution reasons are emitted per question.
- No test asserts runner persists parser/aligner/controlled-write diagnostic counts.
- No test asserts out-of-range support numbers such as 13 or 15 are reported but isolated.
- No test asserts complete/usable/incomplete quality classification from solution coverage.

## Required New Fixture Scenarios

Future fixture work should be minimal and sanitized:

- full answer sequence with solution sequence prefix only
- solution detected numbers containing out-of-range numbers
- answer and solution detected sets disagreeing
- parser detects blocks but aligner rejects after prefix
- controlled-write receives safe answers and partial safe solutions
- quality classification: complete, usable, incomplete

## Recommended Repair Order

1. Stage B: enhance `scripts/pdf-master-browser-runner.js` to persist sanitized diagnostics on the next real-run.
2. Stage C: convert the new diagnostics into minimal fixtures.
3. Stage D/E/F/G: repair only the module proven responsible by fixture evidence.
4. Stage I: run one controlled real-run after fixture-first repair and full safe verification.

## Forbidden Repair Approaches

- Do not relax fail-closed behavior.
- Do not attach after missing, duplicate, jump-back, or out-of-range numbers.
- Do not use semantic similarity, keywords, overlap, math tokens, or topic hints.
- Do not trust AI `question` fields without sequence validation.
- Do not hard-code case02 content.
- Do not write unknown blocks to the nearest question.
- Do not let controlled-write expand beyond aligner-approved items.

## Barrier List For 12/12

The following barriers must be resolved with structured evidence:

- support raw page count
- support block count
- parser answer block count
- parser solution block count
- detected answer numbers
- detected solution numbers
- out-of-range numbers
- duplicate numbers
- jump-back numbers
- prefix cutoff position
- aligner reject reasons
- controlled-write field decisions
- per-question missing solution reasons
- review draft solution count

## Stage A Conclusion

The current evidence is insufficient to safely repair parser, aligner, controlled-write, or app glue. The proven issue is that final draft/report coverage is 1/12, but the layer where the other solution evidence is lost is not yet proven.

Therefore Stage B is required before any fixture or code repair.

## Stage B Runner Diagnostics Added

`scripts/pdf-master-browser-runner.js` now installs a browser-side diagnostic wrapper during real-run before the batch is created. The wrapper does not change business output. It only records sanitized structural summaries from existing module return values.

The next real-run report can include:

- `supportRawPageCount`
- `supportBlockCount`
- `answerBlockCount`
- `solutionBlockCount`
- `supportDetectedNumbers`
- `answerDetectedNumbers`
- `solutionDetectedNumbers`
- `rejectedSolutionNumbers`
- `rejectReasons`
- `alignInputSummary`
- `alignOutputSummary`
- `controlledWriteSummary`
- `missingSolutionReasons`
- `unsafeSequenceReason`
- `prefixCutoffAt`
- `failClosedReason`
- `solutionMarkerForms`
- `outOfRangeNumbers`
- `duplicateNumbers`
- `jumpBackNumbers`
- `unknownBlockCount`
- `writableSolutionNumbers`
- `blockedSolutionNumbers`
- `draftSolutionCount`
- `reviewPageSolutionCount`

Fields are counts, question-number lists, reason codes, and decision summaries only. They do not include full OCR raw text, PDF contents, answer text, solution text, or API keys.

Stage B was implemented without executing `real-run`.
