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

## Real Verification Attempt 10

- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 10
- New real API attempts used this task so far: 2
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

Attempt 10 confirmed the second repair was still too narrow:

- `rejectedAnswerNumbers`: 2, 8, 9
- Missing draft answers remained 8 and 9.
- Answers 8 and 9 still had reason `multiple-option-value-rejected`.
- Answers 8 and 9 still had structural answer fingerprints shaped like `}A_\A{A}`.

The remaining gap is that real OCR wrappers can use command names outside the first whitelist while still producing a short structural option-label shell.

## Third Fixture-First Repair

Updated structural option-label normalization:

- It now only runs when the raw answer has a leading residual brace or underscore wrapper.
- It rejects known math commands such as `\frac`, `\sqrt`, trigonometric commands, vector/angle wrappers, and operator-like math commands.
- It allows other OCR/text wrapper commands only if the remaining compact payload is made exclusively of valid A-F labels.
- Added a regression assertion that `A_\frac{B}` is rejected and cannot become `AB`.

This keeps the repair focused on OCR structural shells and avoids converting ordinary formula variables into answers.

## Real Verification Attempt 11

- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 11
- New real API attempts used this task so far: 3
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

Attempt 11 confirmed the third repair did not change the real draft outcome:

- `rejectedAnswerNumbers`: 2, 8, 9
- Missing draft answers remained 8 and 9.
- Answers 8 and 9 still had reason `multiple-option-value-rejected`.
- Answers 8 and 9 still had structural answer fingerprints shaped like `}A_\A{A}`.
- Browser-side direct evaluation of the updated module accepts the sanitized sample `}A_\A{A}`, so the real raw answer has additional structure not represented by the existing fingerprint.

## Fourth Fixture-First Diagnostic Repair

Do not broaden answer writing yet. Instead, add a sanitized structural diagnostic to rejected objective-answer warnings:

- `structuralCandidate`
- `structuralReason`

This is intentionally diagnostic-only. It should explain why the real answer 8 and 9 values do not enter structural label normalization before any broader write rule is considered.

## Real Verification Attempt 12

- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 12
- New real API attempts used this task so far: 4
- Result: `pass-safe-partial`
- Question count: 12
- Draft answer count: 12
- Draft solution count: 2
- Missing answers: none
- Missing solutions: 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Parser support blocks: 8
- Parser answer items: 8
- Parser solution items: 8
- Aligner output mode: `prefix`
- Controlled-write solution count: 2

Attempt 12 is not complete. The answer side reached 12/12, but the support parse was discontinuous and safely cut to prefix 1, 2:

- `rejectReasons`: `support-question-set-not-equal-expected`, `answer-question-not-continuous`, `solution-question-not-continuous`
- `safeQuestionNumbers`: 1, 2
- Missing solutions were caused by `pdf-support-sequence-unreliable`.

Per the stop conditions, no complete baseline, freeze note, or release audit should be produced from this run.

## Disallowed Fixes

Not used:

- semantic guessing
- option inference from solution text
- case02 content hardcoding
- 13/15 remapping
- fail-closed relaxation
- app glue changes
- unknown block forced ownership
