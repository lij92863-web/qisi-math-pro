# BM-AUTO Chain A Batch A1 REAL_MIGRATION

## Header

Stage: BM-AUTO-CHAIN-A-BATCH-A1-MIGRATION
Branch: main
Audit map commit: 8643fec
Migration commit: 59ea10b
Sync commit: 8736a8d
Target module: qisi-utils.js
Classification: REAL_MIGRATION
Delta: -53

## Changed Files In Migration Commit

- app.js
- qisi-utils.js
- tests/qisi-utils-batch-media-tokens.test.js
- docs/refactor/BM_AUTO_CHAIN_A_BATCH_A1_PLAN.md
- docs/refactor/BM_AUTO_CHAIN_A_BATCH_A1_REAL_MIGRATION.md

Commit 59ea10b changed 5 files with 214 insertions and 61 deletions.
Commit 8736a8d was docs-only sync and changed only this migration document and the sync document.

## Why Grouped

- BATCH_MEDIA_TOKEN_RE and BATCH_BAD_PLACEHOLDER_RE are shared constants for the moved helpers.
- protectBatchMediaTokens and restoreBatchMediaTokens are paired token-preservation helpers.
- hasBatchMediaToken depends on BATCH_MEDIA_TOKEN_RE.
- hasBatchImagePlaceholder depends on BATCH_BAD_PLACEHOLDER_RE and hasBatchMediaToken.
- stripBatchImagePlaceholders depends on protectBatchMediaTokens, restoreBatchMediaTokens, and BATCH_BAD_PLACEHOLDER_RE.
- The grouped migration removed more than 10 lines from app.js and was accepted by the Chain A audit map.

## Old Behavior Summary

- BATCH_MEDIA_TOKEN_RE matched legal batch media tokens and includegraphics references.
- BATCH_BAD_PLACEHOLDER_RE matched unsafe single-bracket image placeholders and image-option placeholder text.
- protectBatchMediaTokens converted legal media tokens into __QISI_MEDIA_TOKEN_n__ placeholders and returned text plus tokens.
- restoreBatchMediaTokens restored __QISI_MEDIA_TOKEN_n__ placeholders from the token array.
- hasBatchMediaToken returned true for legal IMAGE, FORMULA_IMAGE, or includegraphics media tokens.
- hasBatchImagePlaceholder returned true for bad placeholders or legal media tokens, preserving the pre-migration behavior.
- stripBatchImagePlaceholders protected legal media tokens, stripped bad placeholders, normalized spacing, restored legal tokens, and trimmed.

## Regex Behavior And lastIndex Handling

- BATCH_MEDIA_TOKEN_RE uses the global flag.
- BATCH_BAD_PLACEHOLDER_RE uses the global flag.
- hasBatchMediaToken resets BATCH_MEDIA_TOKEN_RE.lastIndex before calling test().
- hasBatchImagePlaceholder resets BATCH_BAD_PLACEHOLDER_RE.lastIndex before calling test(), then calls hasBatchMediaToken.
- protectBatchMediaTokens and stripBatchImagePlaceholders use replace() with the same regex behavior as the old app.js implementation.

## Code Facts

- app.js old BATCH_BAD_PLACEHOLDER_RE constant definition: removed.
- app.js old function definitions: removed.
- app.js explicit protect call count: 2.
- app.js explicit restore call count: 1.
- app.js explicit has-token call count: 3.
- app.js explicit has-placeholder call count: 0 current call sites.
- app.js explicit strip call count: 1.
- app.js direct BATCH_MEDIA_TOKEN_RE use: one explicit window.Qisi.Utils.BATCH_MEDIA_TOKEN_RE access.
- app.js naked regex constants: no naked constant definitions.
- qisi-utils exports BATCH_MEDIA_TOKEN_RE and BATCH_BAD_PLACEHOLDER_RE.
- qisi-utils exports protectBatchMediaTokens, restoreBatchMediaTokens, hasBatchMediaToken, hasBatchImagePlaceholder, and stripBatchImagePlaceholders.
- qisi-utils internal dependencies are local helper calls, not window callbacks.

## Behavior Tests

- protectBatchMediaTokens covers IMAGE tokens, no-token text, empty string, null, undefined, output shape, and no mutation.
- restoreBatchMediaTokens covers one token, multiple tokens, empty tokens array, null tokens, and text without placeholders.
- hasBatchMediaToken covers IMAGE, FORMULA_IMAGE, plain text, empty string, null, and repeated calls for lastIndex behavior.
- hasBatchImagePlaceholder covers bad placeholders, legal media token behavior, and plain text.
- stripBatchImagePlaceholders covers removal of bad placeholders, legal media preservation, empty input, and null input.
- app.js checks cover explicit module calls and absence of naked function calls.

## Verification Commands

- node --check app.js: passed.
- node --check qisi-utils.js: passed.
- node --test tests/qisi-utils-batch-media-tokens.test.js: 26 passed, 0 failed, 0 skipped.
- node --test tests/base-migration-execution-gate.test.js: 15 passed, 0 failed, 0 skipped.
- node --test tests/pdf-route-b-hold.test.js: 6 passed, 0 failed, 0 skipped.
- npm.cmd run verify:batch-safety: passed.
- node scripts/pdf-master-browser-runner.js preflight: ok true, realApiCalled false.
- node scripts/pdf-master-browser-runner.js dry-run: ok true, realApiCalled false.

## Safety

- controlled-write touched: no.
- parser touched: no.
- aligner touched: no.
- block parser touched: no.
- runner touched: no.
- Route B integrated: no.
- real-run called: no.
- AI/OCR called: no.
- package files changed: no.
- main.html changed: no.
- app.css changed: no.
- verifier changed: no.
- scripts changed: no.

## Decision

- Batch A1 accepted: yes.
- Continue Batch A2 automatically: no.
- Continue Batch A3 automatically: no.
- Continue Batch A4 automatically: no.
- Next stage requires separate A2 migration.
