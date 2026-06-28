# BM-AUTO Full Round 008 Plan

Stage: Historical BM-AUTO documentation
Historical-Status: retained for audit trail

## Round

008

## Start Commit

`6af7057`

## Selected Candidate

`normalizeDraftPreviewOptions`

## Old Function Names

- `normalizeDraftPreviewOptions`

## Target Module

`qisi-review-draft-state.js`

## Why Eligible

- Pure draft option-shape helper.
- No DOM, DB/storage, async/network, AI/OCR, controlled-write, PDF safety, or Route B markers.
- Deterministic return value.
- Existing target module exists and owns draft state helpers.
- App call site is single and can be replaced explicitly.
- Estimated app.js delta is 10 removed lines.

## Why Low-Risk

- Does not mutate the question or options array.
- Preserves existing fallback shape of four empty strings.
- Does not touch submission, DB writes, or review UI lifecycle.
- Behavior can be covered with focused Node tests.

## Rejected Nearby Candidates

- `normalizeDraftEditorNewlines`: actual helper is only 2 lines, below delta gate.
- `syncActiveDraftEditorFromQuestion`: mutates active editor refs.
- `normalizeEditorChoiceLabel`: actual helper is only 4 lines; score range includes adjacent parser logic.
- `buildDraftEditorProjection`: depends on adjacent parser helper and is larger review transform.

## Expected app.js Delta

- Before: remove 10-line local `normalizeDraftPreviewOptions` definition.
- After: replace only the call site with `window.Qisi.ReviewDraftState.normalizeDraftPreviewOptions(...)`.
- Expected delta: `-10`.

## Expected Tests

- Add `tests/qisi-review-draft-state-normalize-draft-preview-options.test.js`.
- Cover normal input, empty input, null, undefined, whitespace/punctuation, malformed input, representative project case, boundary length, no mutation, output shape consistency, and explicit app.js module call.

## Allowed Files

- `app.js`
- `qisi-review-draft-state.js`
- `tests/qisi-review-draft-state-normalize-draft-preview-options.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_008_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_ROUND_008_REAL_MIGRATION.md`

## Forbidden Files

- PDF controlled-write, aligner, parser, block parser, answer-only extraction, extraction-quality modules.
- Runner, verifier, inventory, score, diff-scope scripts.
- `main.html`, `app.css`, `package.json`, `package-lock.json`.
- `AGENTS.md`, `ai/`, `skills/`.
- Any data, backup, `.env`, or `tmp/` file.

## Stop Conditions

- Working tree becomes dirty outside allowed files.
- `normalizeDraftPreviewOptions` behavior equivalence is uncertain.
- Execution verifier is not `REAL_MIGRATION`.
- Any required test fails, times out, or is skipped.
- Diff-scope includes forbidden files.
- Real AI/OCR/API call appears necessary.
