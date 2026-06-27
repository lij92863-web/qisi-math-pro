# BM-AUTO Chain A A4 Fixture Tests

Stage: BM-AUTO-CHAIN-A-A4-FIXTURE-TESTS
Branch: main
Start commit: 3673290635b0e46a0a0b35d36147d3c4066628f2

## Goal

Lock current A4 helper behavior before moving implementation to qisi-utils.js. The fixture suite extracts the four helper snippets from app.js and executes only those snippets inside a vm sandbox.

## Fixture File

- tests/qisi-app-display-cleaners-fixtures.test.js

## Coverage

- Text cleaner fixtures: 11 tests.
- Options cleaner fixtures: 11 tests.
- Warning mutation fixtures: 10 tests.
- Field mutation fixtures: 13 tests.
- Integration fixtures: 6 tests.
- Total fixture tests: 51.

## Safety

- app.js executed: no.
- app.js required: no.
- DOM touched: no.
- runner touched: no.
- AI/OCR/API called: no.
- qisi-utils.js used as sandbox utility provider only.

## Tests

- node --test tests/qisi-app-display-cleaners-fixtures.test.js: 51 passed, 0 failed, 0 skipped.
- node --test tests/qisi-app-display-cleaners-fixture-coverage.test.js: 4 passed, 0 failed, 0 skipped.

## Behavior Locked

- cleanDisplayTextForBatchSave return values.
- cleanDisplayOptionsForBatchSave return values and no-mutation behavior.
- addWarningOnce mutation and return behavior.
- cleanDisplayFieldsOnly mutation and return-reference behavior.
- Integration behavior for DOCX-style drafts, missing options, PDF-style drafts, no runner, and no AI/OCR.

## Decision

- A4 fixture tests accepted: yes.
- Fixture-first requirement satisfied: yes.
- A4 production behavior changed: no.
