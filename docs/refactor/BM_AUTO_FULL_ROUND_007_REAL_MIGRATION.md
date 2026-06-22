# BM-AUTO Full Round 007 REAL_MIGRATION

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Branch: main
Start commit: `ca51b17`
End commit: pending
Target helper group: `validatePageRange`
Target module: `qisi-utils.js`
Changed files:

- `app.js`
- `qisi-utils.js`
- `tests/qisi-utils-validate-page-range.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_007_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_ROUND_007_REAL_MIGRATION.md`

## Purpose

- Move the pure batch PDF page-range validation helper from `app.js` to `qisi-utils.js`.

## Candidate Audit

- selected candidate: `validatePageRange`
- why eligible: deterministic boolean string validator, no mutation, no DOM, no DB/storage, no async/network, no AI/OCR, no PDF safety, no Route B.
- why rejected nearby candidates were rejected:
  - `openBatchCreate`: mutates batch UI refs.
  - `openBatchFilePicker`: triggers UI file input.
  - `togglePurposeRole`: mutates `pendingPurposeRoles.value`.
  - `confirmBatchFilePurpose`: mutates batch create state.

## Migration

- old app.js function names: `validatePageRange`
- old app.js approximate locations: `app.js:327-340`
- old behavior summary: empty values are valid; whitespace or Chinese separators are rejected; positive page numbers and ascending `start-end` ranges separated by English commas are accepted.
- new module exports: `window.Qisi.Utils.validatePageRange` and Node export `validatePageRange`
- app.js explicit call sites: `window.Qisi.Utils.validatePageRange(file.pageRange)`
- before lines: 23052
- after lines: 23037
- delta: -15

## Behavior Equivalence

- preserved cases: normal comma-separated pages, empty/null/undefined, Chinese separators, whitespace rejection, malformed ranges, zero, descending ranges, single positive pages.
- tests added: `tests/qisi-utils-validate-page-range.test.js`
- edge cases: no mutation and boolean output shape.

## Execution Verification

- exact command: `node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names validatePageRange`
- classification: `REAL_MIGRATION`
- old definitions removed: yes
- app calls new module: yes
- module exports moved functions: yes

## Tests

- `node --check app.js`: passed
- `node --check qisi-utils.js`: passed
- `node --test tests/qisi-utils-validate-page-range.test.js`: passed, 12 tests
- `node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names validatePageRange`: passed, `REAL_MIGRATION`
- `node --test tests/base-migration-execution-gate.test.js`: passed, 15 tests
- `node --test tests/pdf-route-b-hold.test.js`: passed, 6 tests
- `npm.cmd run verify:safe`: passed, 409 tests in full `npm test`, no skipped
- `npm.cmd run verify:batch-safety`: passed
- `npm.cmd run smoke:batch:mock`: passed, 20 tests
- `npm.cmd run verify:pdf-known-bad`: passed, 65 tests
- `node --test tests/pdf-support-controlled-write-answer-ownership.test.js`: passed, 21 tests
- `node scripts/pdf-master-browser-runner.js preflight`: passed, `ok:true`, `realApiCalled:false`
- `node scripts/pdf-master-browser-runner.js dry-run`: passed, `ok:true`, `realApiCalled:false`

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

## Decision

- classification: `REAL_MIGRATION`
- accepted/rejected: accepted
- continue next round: yes

