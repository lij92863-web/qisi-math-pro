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
