# BM-AUTO Full Round 008 REAL_MIGRATION

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Branch: main
Start commit: `6af7057`
End commit: pending
Target helper group: `normalizeDraftPreviewOptions`
Target module: `qisi-review-draft-state.js`
Changed files:

- `app.js`
- `qisi-review-draft-state.js`
- `tests/qisi-review-draft-state-normalize-draft-preview-options.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_008_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_ROUND_008_REAL_MIGRATION.md`

## Purpose

- Move the pure draft preview option shape helper from `app.js` to `qisi-review-draft-state.js`.

## Candidate Audit

- selected candidate: `normalizeDraftPreviewOptions`
- why eligible: deterministic option normalization, no mutation, no DOM, no DB/storage, no async/network, no AI/OCR, no PDF safety, no Route B.
- why rejected nearby candidates were rejected:
  - `normalizeDraftEditorNewlines`: actual helper is only 2 lines, below delta gate.
  - `syncActiveDraftEditorFromQuestion`: mutates active editor refs.
  - `normalizeEditorChoiceLabel`: actual helper is only 4 lines; score range includes adjacent parser logic.
  - `buildDraftEditorProjection`: depends on adjacent parser helper and is larger review transform.

## Migration

- old app.js function names: `normalizeDraftPreviewOptions`
- old app.js approximate locations: `app.js:832-841`
- old behavior summary: returns first four option values as strings; pads missing options; returns four empty strings when all normalized options are blank.
- new module exports: `window.Qisi.ReviewDraftState.normalizeDraftPreviewOptions` and Node export `normalizeDraftPreviewOptions`
- app.js explicit call sites: `window.Qisi.ReviewDraftState.normalizeDraftPreviewOptions(question)`
- before lines: 23037
- after lines: 23026
- delta: -11

## Behavior Equivalence

- preserved cases: four options, empty array, null, undefined, whitespace-only options, malformed non-array options, partial choices, truncating after D, string coercion.
- tests added: `tests/qisi-review-draft-state-normalize-draft-preview-options.test.js`
- edge cases: no mutation and four-string output shape.

## Execution Verification

- exact command: `node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-review-draft-state.js --old-names normalizeDraftPreviewOptions`
- classification: `REAL_MIGRATION`
- old definitions removed: yes
- app calls new module: yes
- module exports moved functions: yes

## Tests

- `node --check app.js`: passed
- `node --check qisi-review-draft-state.js`: passed
- `node --test tests/qisi-review-draft-state-normalize-draft-preview-options.test.js`: passed, 12 tests
- `node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-review-draft-state.js --old-names normalizeDraftPreviewOptions`: passed, `REAL_MIGRATION`
- `node --test tests/base-migration-execution-gate.test.js`: passed, 15 tests
- `node --test tests/pdf-route-b-hold.test.js`: passed, 6 tests
- `npm.cmd run verify:safe`: passed, 421 tests in full `npm test`, no skipped
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

