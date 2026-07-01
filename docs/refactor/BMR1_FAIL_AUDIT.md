# BMR1 Fail Audit

## Stage

BMR1-FAIL-AUDIT

## Dirty State

- changed files:
  - `app.js`
  - `qisi-support-repair.js`
  - `tests/support-repair.test.js`
- untracked temp files:
  - `.bm_auto_inventory_round_1.json`
  - `.bm_auto_round_1_app_before.js`
  - `.bm_auto_score_round_1.json`
- commit status: no commit made for the failed migration
- push status: no push made for the failed migration

The dirty diff is limited to the BMR1 migration files plus local BM-AUTO temp files. No forbidden production gate files are modified in the dirty diff.

## Failed Gate

- failed command: `npm.cmd run verify:safe`
- failed test file: `tests/qisi-app-display-cleaners-r3-ownership-audit.test.js`
- failed tests:
  - `PDF support context blocked`
  - `support attachment context blocked`
- expected: `result.decision.startsWith('BLOCKED') === true`
- actual: `false`

Re-running `node --test tests/qisi-app-display-cleaners-r3-ownership-audit.test.js` reproduced exactly those two failures. The file reported 6 passed and 2 failed.

## Ownership Test Analysis

- what the test protects: it protects display-cleaner replacement ownership boundaries by blocking replacements near controlled-write, PDF ownership, support attachment, and answer/solution ownership contexts.
- exact failed assertion condition: both failed tests call `auditCallsite(site, appLines)` and assert `result.decision.startsWith('BLOCKED') === true`.
- whether test is app.js-text-based: yes. It reads `app.js` into `appLines` and audits a fixed line-number context window.
- whether test is module-aware: no. It does not inspect extracted modules for migrated helper ownership.
- whether qisi-support-repair.js is considered: no. The audit code only reads `app.js`.

The two failed fixtures use hard-coded line numbers:

- `R3-TEST-02`: line `5275`, helper `cleanDisplayTextForBatchSave`
- `R3-TEST-03`: line `18952`, helper `addWarningOnce`

After the BMR1 migration, `app.js` has a `-63` line delta. Those fixed line numbers no longer point at the original audited contexts:

- current `app.js:5275` is `const marks = [];` inside `parseInlineAnswerSolutionBlocks`; its audit result is `FIXTURE_REQUIRED`, not blocked.
- current `app.js:18952` is a comment before `extractOptionsFromCurrentBlockOnly`; its audit result is `FIXTURE_REQUIRED`, not blocked.

At `HEAD`, before the migration, those same fixed line numbers pointed at the intended contexts:

- `HEAD app.js:5275` was `solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)),`.
- `HEAD app.js:18952` was `addWarningOnce(draft, warning);` inside `pdfSupportFusedWarnings`.

The test failure therefore comes from stale fixed line-number callsite fixtures after a valid `app.js` line delta.

## Migration Analysis

- selected candidate: `repairChoiceOptions, tryRepairedCandidate`
- target module: `qisi-support-repair.js`
- old functions:
  - `repairChoiceOptions`
  - `tryRepairedCandidate`
- app.js call locations:
  - `app.js:4706` calls `window.Qisi.SupportRepair.repairChoiceOptions(...)`
  - `app.js:6140` calls `window.Qisi.SupportRepair.tryRepairedCandidate(...)`
  - `app.js:6430` calls `window.Qisi.SupportRepair.repairChoiceOptions(...)`
  - `app.js:13050` calls `window.Qisi.SupportRepair.repairChoiceOptions(...)`
  - `app.js:14479` calls `window.Qisi.SupportRepair.repairChoiceOptions(...)`
- whether old definitions removed: yes. No `const repairChoiceOptions =` or `const tryRepairedCandidate =` definitions remain in `app.js`.
- whether new calls are inside PDF support context: `tryRepairedCandidate` and one `repairChoiceOptions` call are near support JSON parsing/postprocessing paths. The static audit for the exact migrated call at `app.js:6430` returns `FIXTURE_REQUIRED`; it does not classify it as a direct blocked PDF support context.
- whether new calls are inside support attachment context: one `repairChoiceOptions` call at `app.js:14479` is in merge/final draft construction near answer/solution cleanup; static audit classifies that window as `BLOCKED_ANSWER_SOLUTION_OWNERSHIP`, not support attachment.
- whether behavior appears changed: the corresponding migration test `node --test tests/support-repair.test.js` passed, and the BM-AUTO execution verifier classified the change as `REAL_MIGRATION`. The failed gate does not show a runtime behavior regression; it shows a static line-number audit mismatch.

The migration did move choice repair and JSON repair helpers into `qisi-support-repair.js`. That module already owns support repair planning and fill-only repair helpers, so this creates a broader support repair module surface but does not itself prove a controlled-write, Route B, parser, aligner, or runner boundary violation.

## Root Cause Classification

B. TEST_STATIC_RULE_NEEDS_MODULE_AWARE_UPDATE

## Evidence

- `tests/qisi-app-display-cleaners-r3-ownership-audit.test.js` reads `app.js` text and calls `auditCallsite` with fixed line numbers.
- `scripts/bm-a4-r3-ownership-audit.js` uses `getContextWindow(appLines, callsite.line)` and regexes over that text window only.
- The audit code does not inspect `qisi-support-repair.js`.
- The BMR1 migration removed 63 lines from `app.js`, shifting fixed line-number fixtures.
- `HEAD app.js:5275` and current `app.js:5275` point to different statements.
- `HEAD app.js:18952` and current `app.js:18952` point to different statements.
- Static audit of nearby shifted callsites still finds blocked risky contexts, for example current `app.js:5259` and `app.js:18889`.

## Recommended Next Step

Create a dedicated `BMR1-TEST-AWARE-FIX` task. That task should update the ownership audit fixture strategy so it is robust to module extraction and app.js line deltas, for example by locating stable callsite text or using generated callsite maps instead of fixed stale line numbers.

Before accepting such a test-aware fix, prove again that:

- runtime behavior is unchanged for the migrated helpers,
- Route B remains research-only,
- controlled-write is untouched,
- parser, aligner, and runner are untouched.

Do not enter Round 2 until BMR1/BMG1 is green.

## Safety

- app.js modified in dirty tree: yes
- qisi-support-repair modified in dirty tree: yes
- tests/support-repair modified in dirty tree: yes
- controlled-write touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no

## Decision

STOP
