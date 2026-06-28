# BM-AUTO Chain A A4 Safe Test Alignment

Stage: BM-AUTO-CHAIN-A-A4-SAFE-TEST-ALIGNMENT
Branch: main
Start commit: ebc367a

## Problem

- `verify:safe` failed because `tests/qisi-utils-batch-media-tokens.test.js` still required `app.js` to directly call `window.Qisi.Utils.stripBatchImagePlaceholders`.
- A4 wrapper adapter moved display cleaning into `qisi-utils.js`, so `app.js` no longer needs that direct strip call.

## Changed files

- tests/qisi-utils-batch-media-tokens.test.js
- docs/refactor/BM_AUTO_CHAIN_A_A4_SAFE_TEST_ALIGNMENT.md

## What changed

- Updated stale architecture assertion.
- Preserved A1 media token behavior tests.
- Added behavior assertion that bad placeholders are stripped and legal media tokens are preserved through the current `qisi-utils` display-cleaning path.

## What did not change

- app.js changed: no
- qisi-utils.js changed: no
- production behavior changed: no
- A4 R2/R3 continued: no
- wrapper removal: no

## Validation

- node --test tests/qisi-utils-batch-media-tokens.test.js: passed, 27 passed, 0 failed, 0 skipped
- node --test tests/qisi-app-display-cleaners-fixtures.test.js: passed, 55 passed, 0 failed, 0 skipped
- node --test tests/qisi-app-display-cleaners-staged-migration.test.js: passed, 7 passed, 0 failed, 0 skipped
- node --check app.js: passed
- node --check qisi-utils.js: passed
- base-migration-execution-gate: passed, 15 passed
- pdf-route-b-hold: passed, 6 passed
- verify:batch-safety: passed
- preflight: passed, ok true, realApiCalled false
- dry-run: passed, ok true, realApiCalled false
- verify:safe: passed

## Safety

- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no
- verifier changed: no
- scripts changed: no

## Decision

- safe-test alignment accepted: yes
- verify:safe restored: yes
- A4 R2/R3 allowed now: no
- next recommended stage: A4 R2 callsite-specific fixtures, not direct replacement

