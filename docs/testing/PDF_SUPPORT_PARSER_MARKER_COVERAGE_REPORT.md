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

## Forbidden Fixes

- No semantic guessing.
- No nearest-block attachment.
- No hard-coded case02 content.
- No expansion of `expectedQuestionNumbers` with out-of-range `13` or `15`.
- No fail-closed relaxation.
- No app glue changes.
