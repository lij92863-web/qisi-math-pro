# BM-AUTO Chain A A4 qisi-utils implementation

Stage: qisi-utils implementation
Branch: main
Commit: 7e69f48 (historical — recorded during deep campaign final audit)
Classification: QISI_UTILS_IMPL

## Changed files

- qisi-utils.js
- tests/qisi-app-display-cleaners-fixtures.test.js
- docs/refactor/BM_AUTO_CHAIN_A_A4_QISI_UTILS_IMPL.md

## Old behavior

The A4 display-cleaning helpers were extracted from app.js and fixture-locked before migration. The fixture suite executes only the extracted helper snippets in a sandbox and does not execute app.js.

## Implementation

The four A4 helpers are now exported from qisi-utils.js:

- cleanDisplayTextForBatchSave
- cleanDisplayOptionsForBatchSave
- addWarningOnce
- cleanDisplayFieldsOnly

The implementation mirrors the extracted app.js helper behavior and delegates to existing qisi-utils text and media-token cleanup primitives.

## Tests

The fixture suite now includes implementation parity checks:

- [A4:impl-compare:text]
- [A4:impl-compare:options]
- [A4:impl-compare:warning]
- [A4:impl-compare:fields]

These compare the qisi-utils implementation against the extracted app.js helpers for text cleanup, option cleanup, warning mutation, and field-only cleanup.

## Safety

This stage does not modify app.js. Existing app.js callsites still use the legacy local helpers until the wrapper-adapter stage.

No PDF support files, production data, package metadata, verifier scripts, or UI files were changed.

## Decision

Proceed to wrapper-adapter stage only if this stage classifies as QISI_UTILS_IMPL and the required safety checks pass.
