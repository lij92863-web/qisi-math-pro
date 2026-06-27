# BM-AUTO Chain A Batch A2 REAL_MIGRATION

## Header

Stage: BM-AUTO-CHAIN-A-BATCH-A2-MIGRATION
Branch: main
Start commit: f1cf1a7a79f58479fad98c170b578cff77616d0e
End commit: pending
A1 precondition: A1 migration, sync, and documentation audit accepted.
Target module: qisi-utils.js
Classification: REAL_MIGRATION
Before lines: 22844
After lines: 22814
Delta: -30

## Changed Files

- app.js
- qisi-utils.js
- tests/qisi-utils-unconverted-image-placeholders.test.js
- docs/refactor/BM_AUTO_CHAIN_A_BATCH_A2_PLAN.md
- docs/refactor/BM_AUTO_CHAIN_A_BATCH_A2_REAL_MIGRATION.md

## Why Grouped

- hasUnconvertedOptionPlaceholder depends on hasUnconvertedImagePlaceholder.
- itemHasUnconvertedImagePlaceholder depends on hasUnconvertedImagePlaceholder.
- hasUnconvertedImagePlaceholder depends on Batch A1 token protection behavior.
- The grouped delta is >= 10 lines from app.js.
- Batch A2 does not authorize A3 or A4 migration.

## Old Behavior Summary

- hasUnconvertedImagePlaceholder converted input through String(value || ''), protected legal media tokens, and detected unconverted option/image placeholder text plus object/null/undefined literal pollution.
- hasUnconvertedOptionPlaceholder joined stem and options, detected option-image placeholder variants, and delegated to hasUnconvertedImagePlaceholder.
- itemHasUnconvertedImagePlaceholder checked stem, options, answer, and solution through hasUnconvertedImagePlaceholder.
- Old behavior did not treat [IMAGE:...] or [公式图片待识别] as A2 unconverted-placeholder matches.
- Old behavior protected legal [[IMAGE:id]], [[FORMULA_IMAGE:id]], and includegraphics media tokens from false positives.

## Migration

- Added the three A2 helpers to qisi-utils.js.
- Exported hasUnconvertedImagePlaceholder, hasUnconvertedOptionPlaceholder, and itemHasUnconvertedImagePlaceholder.
- Removed old app.js definitions.
- Replaced app.js call sites with explicit window.Qisi.Utils.* calls.
- qisi-utils internal dependencies use local helper calls, not window callbacks.

## Behavior Equivalence

- Focused tests cover [IMAGE:...] old false behavior.
- Focused tests cover [公式图片待识别] and [公式图片识别] old false behavior.
- Focused tests cover [图片选项待转换...] and [公式图片选项待转换...] positive matches.
- Focused tests cover legal media token preservation for [[IMAGE:id]], [[FORMULA_IMAGE:id]], and includegraphics.
- Focused tests cover plain text, empty string, null, undefined, malformed item, no mutation, option-level checks, and item-level checks.
- Focused tests cover app.js explicit calls and no naked calls.

## Execution Verification

Command:

```text
node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names hasUnconvertedImagePlaceholder,hasUnconvertedOptionPlaceholder,itemHasUnconvertedImagePlaceholder
```

Result:

- beforeLines: 22844.
- afterLines: 22814.
- delta: -30.
- oldDefinitionsStillPresent: false.
- appCallsNewModule: true.
- moduleExportsMovedFunctions: true.
- classification: REAL_MIGRATION.

## Tests

- node --test tests/qisi-utils-unconverted-image-placeholders.test.js: 24 passed, 0 failed, 0 skipped.
- node --check app.js: passed.
- node --check qisi-utils.js: passed.
- node --test tests/base-migration-execution-gate.test.js: 15 passed, 0 failed, 0 skipped.
- node --test tests/pdf-route-b-hold.test.js: 6 passed, 0 failed, 0 skipped.
- npm.cmd run verify:safe: passed, 568 passed, 0 failed, 0 skipped.
- npm.cmd run verify:batch-safety: passed.
- npm.cmd run smoke:batch:mock: 20 passed, 0 failed, 0 skipped.
- npm.cmd run verify:pdf-known-bad: 65 passed, 0 failed, 0 skipped.
- node --test tests/pdf-support-controlled-write-answer-ownership.test.js: 21 passed, 0 failed, 0 skipped.
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

- Batch A2 accepted: yes.
- Continue Batch A3 automatically: no.
- Continue Batch A4 automatically: no.
