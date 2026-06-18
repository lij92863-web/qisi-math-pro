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
