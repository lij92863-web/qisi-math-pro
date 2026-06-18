# PDF Support Answer Missing 8 9 Report

## Scope

- Stage: `PDF-SUPPORT-COMPLETE-BASELINE-AND-CLEANUP`
- Focus: answer-side missing answers 8 and 9 after Attempt 8
- Real API called during Stage A-C: no
- Raw OCR text committed: no
- Real PDF/DOCX committed: no
- Formal question bank write: no

## Attempt 8 Summary

Attempt 8 reached the parser and solution target but did not reach complete baseline:

- Status: `pass-safe-partial`
- Question count: 12
- Draft answer count: 10
- Draft solution count: 12
- Missing answers: 8, 9
- Missing solutions: none
- `supportBlockCount`: 12
- `answerBlockCount`: 12
- `solutionBlockCount`: 12
- `answerItems count`: 12
- `solutionItems count`: 12
- Detected set: `{1,2,3,4,5,6,7,8,9,10,13,15}`
- Aligner output mode: `full`
- Aligner safe answer count: 12
- Aligner safe solution count: 12
- Controlled-write solution count: 12
- Wrong attach risk: not detected by sanitized warnings

## Layer Root Cause

### Parser

The block parser is not the blocking layer for answers 8 and 9. Attempt 8 diagnostics show all expected support blocks and all expected answer items were emitted:

- `supportDetectedNumbers`: `{1,2,3,4,5,6,7,8,9,10,13,15}`
- `answerDetectedNumbers`: `{1,2,3,4,5,6,7,8,9,10,13,15}`
- `solutionDetectedNumbers`: `{1,2,3,4,5,6,7,8,9,10,13,15}`

### Support Parser

The support parser integration received full parser output. No support-parser evidence indicates that answers 8 or 9 were dropped before alignment.

### Aligner

The aligner is not the blocking layer. Attempt 8 aligner input expected, answer, and solution sets all matched `{1,2,3,4,5,6,7,8,9,10,13,15}`, and aligner output was `full`.

The handling of 13 and 15 is correct for this case: they are part of the recognized expected draft set and do not displace 8 or 9.

### Controlled Write

The blocking layer is field-level controlled write for objective answers. Attempt 8 controlled-write diagnostics showed:

- `answerQuestionNumbers`: `{1,3,4,5,6,7,10,13,15}`
- `solutionQuestionNumbers`: `{1,2,3,4,5,6,7,8,9,10,13,15}`
- Warning code: `parser-objective-answer-rejected`
- Reason counts included `multiple-option-value-rejected x2`

The existing rule intentionally rejected option-value conversion for multiple-choice answers. That preserved safety, but it was too coarse for a safer subcase: a multiple-choice parser answer made of clearly separated option-value segments where each segment uniquely maps to one option text.

### Runner / Report

The existing runner summary was enough to localize the issue to controlled-write reason counts, but it did not include per-question rejected answer details. The runner was extended to collect sanitized fields only:

- `rejectedAnswerNumbers`
- `rejectedAnswerReasons`
- `rejectedAnswerWarnings`
- `originalAnswerShape` fingerprints, not raw answer text

These fields are diagnostic only and do not call real API.

### App Glue

`app.js` is not currently justified as a fix target. The qisi-pdf parser, aligner, and controlled-write chain can explain the missing answer layer and provide a focused repair. No app glue modification was made.

## Fixture Design

Added sanitized fixture `case02-answer-missing-8-9-controlled-write`:

- Expected set: `{1,2,3,4,5,6,7,8,9,10,13,15}`
- Parser support blocks: 12
- Parser answer items: 12
- Parser solution items: 12
- Solutions remain 12/12
- Questions 8 and 9 are multiple-choice placeholders
- Answers 8 and 9 use placeholder option-value segments with explicit delimiters
- No real stem, answer, solution, OCR raw text, or PDF content is included

The fixture proves:

- answer missing 8 and 9 can be reproduced at controlled-write level
- parser and aligner remain full
- solution 12/12 does not regress
- 13 and 15 remain expected values and do not pollute 8 or 9
- complete requires answer 12/12 and solution 12/12 together

## Repair

Updated `qisi-pdf-support-controlled-write.js`:

- Single multiple-choice option values are still rejected.
- Ambiguous or unmatched segmented values are still rejected.
- Clearly separated multiple-choice option-value segments are converted only when every segment uniquely matches a different option text.
- Converted labels are returned in option order.

This is sequence-safe and field-local. It does not use semantic similarity, stem overlap, solution keywords, math structure guessing, or nearest-block attachment.

## Verification So Far

Focused tests passed:

- `npm.cmd test -- tests/pdf-support-block-parser.test.js`
- `npm.cmd test -- tests/pdf-real-case.test.js`
- `npm.cmd test -- tests/batch-smoke-mock.test.js`

## Real Verification Attempt 9

- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 9
- New real API attempts used this task so far: 1
- Result: `pass-safe-partial`
- Question count: 12
- Draft answer count: 10
- Draft solution count: 12
- Missing answers: 8, 9
- Missing solutions: none
- Parser support blocks: 12
- Parser answer items: 12
- Parser solution items: 12
- Aligner output mode: `full`
- Controlled-write solution count: 12

Attempt 9 confirmed the first fixture repair was incomplete. The new runner diagnostics showed:

- `rejectedAnswerNumbers`: 2, 3, 4, 5, 6, 8, 9
- Missing draft answers remained only 8 and 9 because other answers were already present from safer draft/question-side evidence.
- Answers 8 and 9 had reason `multiple-option-value-rejected`.
- Answers 8 and 9 had structural answer fingerprints shaped like `}A_\A{A}`.

This means the remaining blocker is not segmented multiple-choice option values. It is short structural wrapper noise around option-label evidence.

## Second Fixture-First Repair

Updated the fixture to model the attempt 9 shape:

- Answer 8 placeholder raw form: `}B_\A{D}`
- Answer 9 placeholder raw form: `}A_\A{C}`
- Expected normalized answers: 8 -> `BD`, 9 -> `AC`

Updated controlled-write normalization:

- Allows short structural wrappers around A-F option labels.
- Allows only single-letter OCR wrapper commands or explicit text/math font wrappers such as `\text`, `\mathrm`, `\mathbf`, `\textbf`.
- Rejects math commands such as `\frac{A}{B}` so formula variables cannot become option labels.
- Keeps all existing sequence, aligner, and solution gates unchanged.

## Disallowed Fixes

Not used:

- semantic guessing
- option inference from solution text
- case02 content hardcoding
- 13/15 remapping
- fail-closed relaxation
- app glue changes
- unknown block forced ownership
