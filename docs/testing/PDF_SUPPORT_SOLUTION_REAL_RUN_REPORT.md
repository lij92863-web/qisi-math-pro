# PDF Support Solution Real Run Report

## Scope

- Stage: `PDF-SUPPORT-PARSER-MARKER-COVERAGE-FIX` / P6
- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 5
- New real API attempts used this task: 1
- Raw OCR text committed: no
- API key printed: no
- Real PDF/DOCX committed: no

## Result

- Status: `pass-safe-partial`
- Quality level: not-complete
- Question count: 12
- Answer count: 12
- Solution count: 1
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Align mode: `fail-closed`
- Fail-closed: yes
- Prefix: yes
- Wrong attach risk: not detected by sanitized warnings

## Parser Coverage

- `supportRawPageCount`: 4
- `supportBlockCount`: 1
- `answerBlockCount`: 1
- `solutionBlockCount`: 1
- `answerItems count`: 1
- `solutionItems count`: 1
- `supportDetectedNumbers`: 7
- `answerDetectedNumbers`: 7
- `solutionDetectedNumbers`: 7
- `outOfRangeNumbers`: none
- `duplicateNumbers`: none
- `jumpBackNumbers`: none
- `unknownBlockCount`: 0

## Layer Diagnosis

- `parserLayerDiagnosis`: improved from zero blocks to one block, but still not enough coverage for complete import.
- `supportParserLayerDiagnosis`: remaining marker coverage or block construction is still incomplete; only question 7 was detected from support raw pages.
- `alignerLayerDiagnosis`: correctly failed closed because detected support set `{7}` does not equal expected set `{1,2,3,4,5,6,7,8,9,10,13,15}`.
- `controlledWriteLayerDiagnosis`: followed the fail-closed parser gate and only preserved legacy-safe solution 1.
- `runnerCollectionDiagnosis`: captured parser, aligner, controlled-write, draft, review, and sanitized marker-form fingerprints.

## Stop Decision

P6 rule applies: support block count is now greater than zero, but `solutionItems count` is still 1 and draft solution count is still 1. Do not continue real-run attempts. The next repair must return to fixture-first parser coverage, using the sanitized marker-form fingerprints that still did not become blocks.

## Full-Chain Diagnostic Attempt 6

- Stage: `PDF-SUPPORT-SOLUTION-COMPLETE-FULL-CHAIN` / Stage B diagnostic real-run
- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 6
- New real API attempts used this task: 1
- Raw OCR text committed: no
- API key printed: no
- Real PDF/DOCX committed: no

Result:

- Status: `pass-safe-partial`
- Quality level: not-complete
- Question count: 12
- Answer count: 12
- Draft solution count: 1
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Align mode: `fail-closed`
- Fail-closed: yes
- Prefix: yes
- Wrong attach risk: not detected by sanitized warnings

Parser coverage:

- `supportRawPageCount`: 4
- `supportBlockCount`: 1
- `answerBlockCount`: 1
- `solutionBlockCount`: 1
- `answerItems count`: 1
- `solutionItems count`: 1
- Detected set: `{7}`
- `rawPageCount`: 4
- `nonEmptyPageCount`: 4
- `markerCandidateCount`: 24
- `questionMarkerCandidateCount`: 0
- `answerMarkerCandidateCount`: 12
- `solutionMarkerCandidateCount`: 12
- `matchedMarkerForms`: only the explicit-number answer form for 7
- `supportBlockBoundaryRejectReasons`: 13 candidate markers not emitted by parser, 10 candidate markers without number

Layer diagnosis:

- `block-parser`: still only opens blocks from explicit question markers; most real support evidence is section-label driven.
- `support-parser`: not yet the limiting layer in attempt 6; parser output is still too small before support parsing can be trusted.
- `aligner`: correctly failed closed because detected set `{7}` did not match expected set `{1,2,3,4,5,6,7,8,9,10,13,15}`.
- `controlled-write`: correctly preserved only legacy-safe solution 1 because parser gate failed closed.
- `runner/report`: now provides enough sanitized candidate diagnostics for fixture-first repair.

Stop decision:

- Stage I1 applies: `supportBlockCount <= 1`, detected set remains `{7}`, and `solutionItems count <= 1`.
- Stop real-run attempts.
- Do not modify aligner or controlled-write based only on this real result.
- Return to fixture-first parser repair using section-label marker forms.

## Full-Chain Repair Verification Attempt 7

- Stage: `PDF-SUPPORT-SOLUTION-COMPLETE-FULL-CHAIN` / Stage H repair verification
- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 7
- New real API attempts used this task: 2
- Raw OCR text committed: no
- API key printed: no
- Real PDF/DOCX committed: no

Result:

- Status: `pass-safe-partial`
- Quality level: not-complete
- Question count: 12
- Answer count: 12
- Draft solution count: 1
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Align mode: `fail-closed`
- Fail-closed: yes
- Prefix: yes
- Wrong attach risk: not detected by sanitized warnings

Parser coverage after repair:

- `supportRawPageCount`: 4
- `supportBlockCount`: 2
- `answerBlockCount`: 1
- `solutionBlockCount`: 2
- `answerItems count`: 1
- `solutionItems count`: 2
- Detected set: `{1,7}`
- `markerCandidateCount`: 35
- `questionMarkerCandidateCount`: 0
- `answerMarkerCandidateCount`: 12
- `solutionMarkerCandidateCount`: 13

Layer diagnosis:

- `block-parser`: improved, but still incomplete. It now creates an expected-sequence block for 1 and explicit marker block for 7, but most answer/solution label forms still do not become emitted blocks.
- `support-parser`: not the limiting layer yet; parser output remains too incomplete.
- `aligner`: correctly failed closed because answer set `{7}` and solution set `{1,7}` do not match each other or expected set `{1,2,3,4,5,6,7,8,9,10,13,15}`.
- `controlled-write`: correctly preserved only legacy-safe solution 1 because aligner failed closed.
- `runner/report`: collected enough sanitized evidence for the next fixture-first cycle.

Stop decision:

- Do not continue real-run attempts.
- Do not write a complete baseline.
- The next cycle must return to fixture-first parser repair for the remaining un-emitted answer/solution label forms, especially forms counted as `candidate-not-emitted-by-parser` and `candidate-without-number`.

## FIX-3 Marker Coverage Verification Attempt 8

- Stage: `PDF-SUPPORT-PARSER-MARKER-COVERAGE-FIX-3` / Stage G real-run verification
- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 8
- New real API attempts used this task: 1
- Raw OCR text committed: no
- API key printed: no
- Real PDF/DOCX committed: no

Preflight:

- `git status --short`: clean before real-run.
- `git branch --show-current`: `master`.
- `DASHSCOPE_API_KEY`: exists, value not printed.
- Runner preflight: pass.
- Runner dry-run: pass.

Result:

- Status: `pass-safe-partial`
- Quality level: solution-complete, answer-incomplete
- Question count: 12
- Draft answer count: 10
- Draft solution count: 12
- Missing answers: 8, 9
- Missing solutions: none
- Top-level fail-closed flag: yes
- Prefix flag: yes
- Wrong attach risk: not detected by sanitized warnings
- Underlying real API call count: 9

Parser coverage after FIX-3:

- `supportRawPageCount`: 4
- `supportBlockCount`: 12
- `answerBlockCount`: 12
- `solutionBlockCount`: 12
- `answerItems count`: 12
- `solutionItems count`: 12
- Detected set: `{1,2,3,4,5,6,7,8,9,10,13,15}`
- `markerCandidateCount`: 35
- `questionMarkerCandidateCount`: 0
- `answerMarkerCandidateCount`: 12
- `solutionMarkerCandidateCount`: 13
- Remaining boundary rejects: `candidate-without-number x11`, `candidate-not-emitted-by-parser x3`, `candidate-noise-shape x1`

Alignment and controlled-write:

- Aligner input expected, answer, and solution sets all matched `{1,2,3,4,5,6,7,8,9,10,13,15}`.
- Aligner output mode: `full`.
- Aligner output fail-closed: false.
- Safe answer count: 12.
- Safe solution count: 12.
- Controlled-write writable solution numbers: `{1,2,3,4,5,6,7,8,9,10,13,15}`.
- Controlled-write solution count: 12.
- Controlled-write rejected objective answer values for answers 8 and 9; this is answer-side safety, not a solution parser blocker.

Layer diagnosis:

- `block-parser`: no longer the blocking layer for the case02 solution chain; it emits all expected support blocks and all expected solution items.
- `support-parser`: integration received full answer and solution item sets from the block parser.
- `aligner`: allowed full solution coverage after parser sets matched the expected draft set.
- `controlled-write`: wrote all parser-safe solutions and continued to reject unsafe objective answers.
- `runner/report`: captured parser, aligner, controlled-write, draft, review, and sanitized marker diagnostics.

Stop decision:

- Stage H1 no longer applies: parser output is sufficient and solution item count is 12.
- Stage H2 no longer applies: draft solution count is 12.
- Stage H4 complete does not apply because missing answers remain 8 and 9.
- Do not enter Stage L/M and do not write a complete baseline.
- Stop this task after recording the real-run result, because the current parser/solution objective is complete and answer repair is a separate task.
