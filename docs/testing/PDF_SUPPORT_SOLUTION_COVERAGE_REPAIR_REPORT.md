# PDF Support Solution Coverage Repair Report

## Scope

- Task: `PDF-SUPPORT-SOLUTION-DIAGNOSTIC-TO-REPAIR`
- Repair path: fixture-first
- Business code changed: no
- DOCX stable chain changed: no
- `app.js` changed: no
- Raw OCR text committed: no
- Real PDF/DOCX committed: no

## Fixture Conversion

Added sanitized fixture coverage in `tests/fixtures/pdf-real-case-minimal.js`:

- Question numbers: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Question count: 12
- Answer count expectation: 12
- Real diagnostic solution count: 1
- Support raw page count: 4
- Parser support block count: 0
- Parser answer block count: 0
- Parser solution block count: 0
- `solutionDetectedNumbers`: none
- `outOfRangeNumbers`: none in the real diagnostic
- `rejectedSolutionNumbers`: none
- Missing solution reasons: `pdf-support-sequence-unreliable`
- Coverage state: incomplete
- Usable state: answers complete, only solution 1 usable
- Target state: complete

## Root Cause

R3 localized the real failure to the parser-gate side of the PDF support chain:

- The real run had 4 support raw pages.
- The parser emitted 0 support blocks.
- The aligner then correctly failed closed with `support-question-set-not-equal-expected`.
- Controlled write correctly wrote only the safe legacy solution for question 1.

During fixture-first repair, an adjacent controlled-write parser-gate bug was reproduced:

- `buildPdfSupportParserGate` accepted `rawTextPages`.
- If a caller supplied raw pages as `{ text, pageIndex, sourceOrder }` objects, the gate cleaned the whole object as text.
- That converted usable page text into `[object Object]`, producing the same class of symptom: raw page count present but parser block count 0.

## Repair

Updated `qisi-pdf-support-controlled-write.js`:

- Preserve text from object raw page fields: `text`, `rawText`, `content`, `markdown`, `pageMarkdown`.
- Preserve page ordering from `sourceOrder`, `pageIndex`, `sourcePage`, or `pageNo`.
- Keep fail-closed behavior unchanged when parser output is empty or unreliable.

## Tests Added

- `tests/pdf-real-case.test.js`
  - Object raw text pages are preserved before parser alignment.
  - Case02 diagnostic fixture remains answer-full and solution-partial fail-closed.
- `tests/pdf-support-block-parser.test.js`
  - Raw support pages with no markers remain incomplete and safe.
- `tests/pdf-support-aligner.test.js`
  - Empty parser output for case02 expected numbers fails closed and fuses all expected numbers.
- `tests/batch-smoke-mock.test.js`
  - Mock batch keeps 12 answers but writes only safe solution 1 for the diagnostic fixture.

## Focused Verification

- `node --test tests/pdf-real-case.test.js`: pass
- `node --test tests/pdf-support-block-parser.test.js`: pass
- `node --test tests/pdf-support-aligner.test.js`: pass
- `node --test tests/batch-smoke-mock.test.js`: pass

## Remaining Check

Full safe regression passed before the post-repair real checks.

Post-repair real checks:

- Attempt 3 remained `pass-safe-partial`: 12 questions, 12 answers, 1 solution, 0 parser support blocks.
- Attempt 4 remained `pass-safe-partial`: 12 questions, 12 answers, 1 solution, 0 parser support blocks.
- Attempt 4 added sanitized marker-form fingerprints, but no OCR raw text.

Conclusion:

- The object raw-page repair is valid and covered, but it did not complete case02.
- The remaining case02 failure is still parser coverage: raw support pages are present, but parser block detection emits 0 blocks.
- Fail-closed behavior is preserved; no semantic guessing or unsafe answer/solution attachment was introduced.
- The task must stop here because the real attempt cap has been reached. The next task should build a fixture from the sanitized marker-form fingerprints and repair marker parsing fixture-first.

## Full-Chain Repair Addendum

The next task executed one additional diagnostic real-run after runner diagnostics were expanded:

- Attempt: 6
- Real API called: yes
- Result: not-complete, safe partial
- Question count: 12
- Answer count: 12
- Solution count: 1
- Parser support blocks: 1
- Detected parser set: `{7}`

The new sanitized diagnostics showed:

- 24 marker candidates in support raw pages.
- 12 answer label candidates.
- 12 solution label candidates.
- 0 question marker candidates.
- Only the explicit question 7 marker was emitted as a parser block.

Repairs completed fixture-first:

- Added a real-style sanitized fixture with 12 expected source-order labels.
- Expanded parser marker grammar for proper Chinese answer/solution labels and wrapped OCR command forms.
- Added expected-sequence label block creation guarded by `expectedQuestionNumbers`.
- Preserved warnings when label markers exceed the expected sequence.
- Preserved zero-based page/source order in parser gate raw page handling.
- Updated aligner continuity to honor the provided expected sequence, including source gaps such as `13` and `15`, without weakening duplicate, jump-back, mismatch, or fail-closed rules.

Mock verification result:

- Parser fixture: 12 answer items and 12 solution items.
- Parser gate: `full`.
- Controlled write: 12 parser-approved solutions.
- No app glue changes.
- No DOCX stable-chain changes.
