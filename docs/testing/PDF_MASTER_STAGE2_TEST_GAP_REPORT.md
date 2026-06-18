# PDF Master Stage 2 Test Gap Report

## Scope

Stage 2 reviewed the existing mock safety net for the double-PDF import path:

- question PDF + support PDF merge safety
- PDF support block parsing
- PDF support answer/solution alignment
- field-level controlled write behavior
- batch smoke coverage around safe PDF support handling

No production code or business behavior was changed in this stage.

## 1. pdf-support-known-bad coverage

`tests/fixtures/pdf-support-known-bad.js` covers the historical unsafe order:

- expected questions: `1-12`
- support extraction order: `1,3,4,5,6,7,8,9,10,11,2`
- wrong attach pressure around questions `8-11`
- raw support text that matches the same unsafe ordering

Current coverage is useful because it exercises a jump-back sequence where item `2` appears late. This verifies the core fail-safe principle: answers and solutions must not be attached after a sequence jump that could produce wrong ownership.

Remaining gap: the fixture is intentionally synthetic and does not model real OCR page boundaries, fragmented labels, or parser/legacy disagreement from actual PDF text extraction.

## 2. aligner test coverage

`tests/pdf-support-aligner.test.js` currently covers:

- full aligned answer/solution sequences
- safe prefix acceptance when the tail is missing
- jump-back fail-closed behavior using the known-bad fixture
- duplicate answer numbers
- answer/solution number mismatch
- reliable prefix before a later jump
- start mismatch and first mismatch fail-closed
- fullwidth support labels

The aligner coverage already protects the highest-risk rule: never use semantic overlap, keyword similarity, or math-token matching to decide answer ownership.

Remaining gap: there is no real-case-shaped minimal fixture that combines a valid question contract with support OCR artifacts such as missing answer body, parser-only support blocks, and field-level disagreement.

## 3. block parser test coverage

`tests/pdf-support-block-parser.test.js` currently covers:

- normal answer/solution block parsing
- Chinese numbered labels such as `第1题`
- continuation across page breaks
- duplicate question number warnings
- jump-back warnings
- unknown markers being filtered safely
- missing solution handling
- answer-only extraction
- formula-like numbers that must not become question ownership
- no semantic ownership guessing
- exported helper behavior

This is a strong parser-level safety net for sequence extraction and marker handling.

Remaining gap: block parser tests do not yet include a minimal double-PDF real-case surrogate where one support field is blank while the paired solution exists. That shape matters because a real OCR result may produce answer and solution sequences with different effective ownership.

## 4. batch smoke coverage

`tests/batch-smoke-mock.test.js` currently covers:

- PDF known-bad support merge safety
- AI endpoint guard behavior in mock smoke tests
- field-level controlled write decisions
- objective-answer conversion and rejection
- parser-vs-legacy field selection
- fused parser question warnings
- DOCX stability smoke coverage

This protects the batch-level write boundary without calling real APIs.

Remaining gap: there is no dedicated minimal fixture that uses the PDF block parser and aligner together to simulate the support-PDF side of a double-PDF import before the batch write stage.

## 5. real risks not mocked

The current tests do not fully mock these real PDF risks:

- OCR may split answer labels and solution labels across pages or lines.
- OCR may emit an answer marker with an empty or unusable answer body.
- OCR may produce a parser sequence that is safer or stricter than the legacy structured AI result.
- Real PDF rendering may change page order, page count, or raw text availability.
- The browser batch path has IndexedDB, file role, and rendered-page dependencies that are not represented by pure module tests.
- The real support PDF may contain question-like numbers inside formulas, explanations, or layout artifacts.

These risks must still obey the same safety rule: prefer empty fields and warnings over any wrong attachment.

## 6. gaps fixable without real API

The following gaps can be fixed with sanitized local fixtures and no API calls:

- Add a minimal double-PDF surrogate fixture with question numbers, support raw text pages, and expected safe outcomes.
- Add parser+aligner integration tests around support raw text pages.
- Add a missing-answer-present-solution case to prove the safe prefix or fail-closed behavior.
- Add a parser/legacy disagreement case to prove field-level controlled write never expands beyond safe ownership.

These additions are suitable for Stage 3 because they do not need real OCR output or original PDF content.

## 7. minimal fixtures for next stage

Stage 3 should add `tests/fixtures/pdf-real-case-minimal.js` with sanitized placeholders only:

- `questionItems`: question numbers such as `1-4`, with placeholder stems.
- `rawTextPages`: support text pages using placeholders such as `ANSWER_1` and `SOLUTION_1`.
- `expectedQuestionNumbers`: the authoritative question contract.
- a scenario where answer `2` is blank or omitted while solution `2` exists.
- a scenario where parser-derived support is stricter than legacy structured support.

The fixture must not include real PDF text, raw OCR, images, file bytes, API responses, keys, or content from `local-test-materials`.

## 8. whether Stage 3 needed

Stage 3 is needed.

The existing safety net covers the known-bad sequence and many module-level rules, but it does not yet contain a sanitized, real-case-shaped double-PDF fixture. Adding that fixture before any real API attempt reduces the chance that Stage 6 discovers an unsafe shape that could have been caught locally.
