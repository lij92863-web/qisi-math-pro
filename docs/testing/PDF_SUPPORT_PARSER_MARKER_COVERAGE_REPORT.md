# PDF Support Parser Marker Coverage Report

## P1 Current Evidence

- Current real diagnostics show support raw pages exist: yes, `supportRawPageCount = 4`.
- Parser evidence before this task: `supportBlockCount = 0`, `answerBlockCount = 0`, `solutionBlockCount = 0`.
- Final draft evidence before this task: 12 questions, 12 answers, 1 solution.
- Aligner behavior before this task: fail-closed with `support-question-set-not-equal-expected`.
- Controlled write behavior before this task: only legacy solution 1 was writable.

## Sanitized Marker-Form Summary

Attempt 4 collected marker-form fingerprints only, not OCR raw text. Relevant structural shapes include:

- LaTeX/list prefix before bracketed answer labels, e.g. `\A_...`.
- LaTeX command wrapper around bracketed labels, e.g. `\A{...}`.
- Number plus bracketed label inside a command wrapper, e.g. `\A{#...}`.
- Bracketed answer or solution labels followed by short answer/solution payloads.

These fingerprints explain why the old block parser emitted zero blocks: the parser recognized simple plain-number and plain-label lines, but did not normalize LaTeX/list wrappers before marker classification.

## Required Fixture

Added a sanitized fixture that contains:

- `{ text, pageIndex, sourceOrder }` raw page objects.
- Number markers wrapped by LaTeX/list syntax.
- Answer marker forms.
- Solution marker forms.
- Out-of-range markers `13` and `15` that must become warnings only.
- No real OCR text and no real case02 answer or solution content.

## Parser Rule Gap

The functions checked for this task are:

- `normalizeSupportRawTextPages`
- `parseSupportBlockMarkers`
- `splitPdfSupportBlocks`
- `buildPdfSupportItemsFromBlocks`
- `parsePdfSupportBlocks`

The gap is in marker normalization/classification before `splitPdfSupportBlocks` starts blocks.

## Repair Direction

- Normalize full-width digits and common structural wrappers before matching.
- Support explicit numeric markers in `\item`, `\item[n]`, `\textbf{n ...}`, `\A{n ...}`, `[n]`, `(n)`, `n.`, and `n、` forms.
- Support answer and solution labels inside the same wrapper.
- Preserve page/source order and fail closed on unknown, duplicate, jump-back, or out-of-range numbers.

## P2/P3 Fixture-First Result

Added `case02-marker-form-coverage` as a sanitized marker-form fixture:

- Raw pages are `{ text, pageIndex, sourceOrder }` objects.
- Text uses structural wrappers and placeholder payloads only.
- Expected question set is `1, 2, 3, 4`.
- Out-of-range markers `13` and `15` are present but not added to expected question numbers.

Parser result after repair:

- `supportBlockCount`: 6
- `safeSupportBlockCount`: 4
- `answerBlockCount`: 4
- `solutionBlockCount`: 4
- `answerItems count`: 4
- `solutionItems count`: 4
- `outOfRangeNumbers`: 13, 15
- `missingAnswers`: none
- `missingSolutions`: none

Mock gate result:

- Parser gate mode: `full`
- Controlled write receives and preserves 4 parser solutions.
- Fixture solution coverage is below the ideal 10 because the sanitized marker-form evidence in this task is intentionally minimal; it is sufficient to prove marker coverage is no longer zero and solution item construction is independent.

## Functions Modified

- `parseSupportBlockMarkers`: now routes through the enhanced marker classifier.
- `splitPdfSupportBlocks`: now uses the unified marker classifier for question, answer, and solution markers.
- `appendQuestionRest`: now uses the same classifier for question lines that contain an inline answer marker.

`qisi-support-parser.js` was inspected but not modified because the failure reproduced and repaired in the block parser layer.

## P6 Real-Run Outcome

After commit `f8096dd`, one authorized real-run was executed:

- Attempt: 5
- Result: `pass-safe-partial`
- Question count: 12
- Answer count: 12
- Draft solution count: 1
- `supportRawPageCount`: 4
- `supportBlockCount`: 1
- `answerBlockCount`: 1
- `solutionBlockCount`: 1
- `supportDetectedNumbers`: 7
- Align mode: `fail-closed`
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15

This proves the parser marker coverage fix moved the real chain from zero support blocks to one support block, but it did not complete case02. Per P6, the task stops here and must return to fixture-first parser coverage rather than continuing real runs.

## Full-Chain Stage A Diagnosis

The latest available real evidence is still incomplete for fixture-first repair:

- Real `supportRawPageCount`: 4.
- Real `supportBlockCount`: 1.
- Real detected set: `{7}`.
- Real `answerBlockCount`: 1.
- Real `solutionBlockCount`: 1.
- Fixture `case02-marker-form-coverage` reaches `supportBlockCount = 6`, but the real run still reaches only 1.

The gap is diagnostic, not a reason to relax safety. The fixture covered wrapper and label forms already known from the previous sanitized marker list. The real run only exposed top marker-form fingerprints, not page-level candidate counts, first matched marker per page, or candidate reject reasons. Therefore it cannot yet explain whether the missing real blocks are:

- marker candidates that were never classified,
- candidates classified as noise,
- candidates found but not emitted as block boundaries,
- page/source-order shape mismatch,
- or parser output summarization loss.

The only safe next step is Stage B runner diagnostics, followed by one diagnostic real-run. No aligner, controlled-write, or app glue change is justified while parser output remains one detected question.

## Full-Chain Stage B Runner Diagnostic Expansion

Updated `scripts/pdf-master-browser-runner.js` to collect additional sanitized structure only:

- `rawPageCount`
- `nonEmptyPageCount`
- `pageTextLengthStats`
- `markerCandidateCount`
- `questionMarkerCandidateCount`
- `answerMarkerCandidateCount`
- `solutionMarkerCandidateCount`
- `matchedMarkerForms`
- `unmatchedMarkerForms`
- `firstMatchedMarkerPerPage`
- `supportBlockBoundaryCandidates`
- `supportBlockBoundaryRejectReasons`
- `lineShapeStats`
- `pageOrderSummary`
- `sourceOrderSummary`
- `parserInputPageShape`
- `parserOutputBlockSummary`
- `parserOutputItemSummary`

These fields use numeric structure, counts, source/page order, marker kind, and marker-form fingerprints. They do not write OCR raw text, API keys, real PDF contents, or case02 semantic content into Git.

Next fixture design must be based on the diagnostic real-run output from these fields, especially unmatched marker forms and block-boundary reject reasons.

## Full-Chain Stage C/D/J Repair Result

Attempt 6 showed the missing real structure without exposing OCR raw text:

- Candidate markers: 24.
- Question marker candidates: 0.
- Answer label candidates: 12.
- Solution label candidates: 12.
- Parser output: only question 7.
- Main unhit shapes: answer/solution section labels without inline question numbers, including wrapped forms such as `\A_...` and `\A_\A{...}`.

Fixture-first repair added `case02-real-style-section-sequence`:

- Mixed raw page inputs: string pages and `{ text, pageIndex, sourceOrder }` object pages.
- Multi-page support raw text.
- Answer and solution label sections without semantic ownership.
- Compact explicit number+answer marker for question 7.
- Cross-page solution continuation.
- Noise numbers for page/year/score/decimal/coordinate-like forms.
- Expected source sequence with gaps: `1,2,3,4,5,6,7,8,9,10,13,15`.
- Extra label markers after expected sequence exhaustion must warn and must not attach.

Parser repair:

- Added proper Chinese `【答案】`, `【解析】`, `答案：`, `解析：` marker rules to the centralized label rule tables.
- Added fullwidth digit normalization.
- Extended structural command unwrapping for command-prefix and open-command OCR shapes.
- Added expected-sequence label block creation only when explicit answer/solution labels are present and `expectedQuestionNumbers` is available.
- Preserved fail-closed warnings for exhausted implicit sequence labels instead of forcing ownership.

Integration repair:

- `qisi-pdf-support-controlled-write.js` now preserves zero-based `pageIndex/sourceOrder` for provided raw text pages, preventing mixed string/object page collisions.
- `qisi-pdf-support-aligner.js` now treats the supplied `expectedQuestionNumbers` order as the continuity contract. For case02-style expected gaps, full coverage of `1..10,13,15` is reliable; missing, duplicate, jump-back, mismatch, or wrong start still fail closed or prefix.

Mock result after repair:

- Fixture `supportBlockCount`: 12.
- Fixture `answerItems count`: 12.
- Fixture `solutionItems count`: 12.
- Parser gate mode: `full`.
- Controlled write solution count: 12.
- Known-bad and semantic-guessing protections remain covered by tests.

## Full-Chain Stage H Attempt 7 Result

Repair verification against the real PDFs improved parser coverage but did not complete the chain:

- `supportBlockCount`: 2.
- Detected set: `{1,7}`.
- `answerBlockCount`: 1.
- `solutionBlockCount`: 2.
- Draft solution count: 1.
- Aligner mode: `fail-closed`.

This confirms the previous fixture covered a real class of marker form but not all real marker boundaries. Remaining real diagnostics show:

- `markerCandidateCount`: 35.
- `answerMarkerCandidateCount`: 12.
- `solutionMarkerCandidateCount`: 13.
- Unresolved reject classes include `candidate-not-emitted-by-parser`, `candidate-without-number`, and `candidate-noise-shape`.

The next parser fixture must target the remaining un-emitted section-label forms. It must still avoid semantic guessing, unknown block forced ownership, and fail-closed relaxation.

## Forbidden Fixes

- No semantic guessing.
- No nearest-block attachment.
- No hard-coded case02 content.
- No expansion of `expectedQuestionNumbers` with out-of-range `13` or `15`.
- No fail-closed relaxation.
- No app glue changes.
