# BM-AUTO Full Round 007 Plan

Stage: Historical BM-AUTO documentation
Historical-Status: retained for audit trail

## Round

007

## Start Commit

`ca51b17`

## Selected Candidate

`validatePageRange`

## Old Function Names

- `validatePageRange`

## Target Module

`qisi-utils.js`

## Why Eligible

- Pure string validation helper.
- No DOM, DB/storage, async/network, AI/OCR, controlled-write, PDF safety, or Route B markers.
- Deterministic boolean result.
- Existing target module exists and already exports pure utility helpers.
- App call site is single and can be replaced explicitly.
- Estimated app.js delta is 14 removed lines.

## Why Low-Risk

- Does not mutate inputs.
- Does not read app refs or external state.
- Keeps existing stricter comma behavior unchanged.
- Behavior can be covered with focused Node tests.

## Rejected Nearby Candidates

- `openBatchCreate`: mutates batch UI refs.
- `openBatchFilePicker`: triggers UI file input.
- `togglePurposeRole`: mutates `not-completedPurposeRoles.value`.
- `confirmBatchFilePurpose`: mutates batch file state.

## Expected app.js Delta

- Before: remove 14-line local `validatePageRange` definition.
- After: replace only the call site with `window.Qisi.Utils.validatePageRange(...)`.
- Expected delta: `-14`.

## Expected Tests

- Add `tests/qisi-utils-validate-page-range.test.js`.
- Cover normal input, empty input, null, undefined, whitespace/punctuation, malformed input, representative project case, boundary ranges, no mutation, output shape consistency, and explicit app.js module call.

## Allowed Files

- `app.js`
- `qisi-utils.js`
- `tests/qisi-utils-validate-page-range.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_007_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_ROUND_007_REAL_MIGRATION.md`

## Forbidden Files

- PDF controlled-write, aligner, parser, block parser, answer-only extraction, extraction-quality modules.
- Runner, verifier, inventory, score, diff-scope scripts.
- `main.html`, `app.css`, `package.json`, `package-lock.json`.
- `AGENTS.md`, `ai/`, `skills/`.
- Any data, backup, `.env`, or `tmp/` file.

## Stop Conditions

- Working tree becomes dirty outside allowed files.
- `validatePageRange` behavior equivalence is uncertain.
- Execution verifier is not `REAL_MIGRATION`.
- Any required test fails, times out, or is skipped.
- Diff-scope includes forbidden files.
- Real AI/OCR/API call appears necessary.
