# BM-AUTO Full Round 006 Plan

Stage: Historical BM-AUTO documentation
Historical-Status: retained for audit trail

## Round

006

## Start Commit

`a03f57d`

## Selected Candidate

`findNode`

## Old Function Names

- `findNode`

## Target Module

`qisi-utils.js`

## Why Eligible

- Pure recursive tree search helper.
- No DOM, DB/storage, async/network, AI/OCR, controlled-write, PDF safety, or Route B markers.
- Deterministic return value: first matching node object or `null`.
- Existing target module exists and already exports pure utility helpers.
- App call site is single and easy to replace explicitly.
- Estimated app.js delta is exactly 10 removed lines.

## Why Low-Risk

- No mutation of input tree.
- No side effects.
- No business policy change.
- No stable DOCX/PDF ownership logic touched.
- Behavior can be covered with focused Node tests.

## Rejected Nearby Candidates

- `questionMatchesLibraryFilters`: captures `librarySearchKeyword`, `libraryFilters`, and `hasText`.
- `buildKnowledgeCounts`: captures `questions.value` and `getQuestionKnowledge`.
- `getAllChildrenNames`: below 10 removed app.js lines.
- `flattenKnowledgeTree`: below 10 removed app.js lines.

## Expected app.js Delta

- Before: remove 10-line local `findNode` definition.
- After: replace only the call site with `window.Qisi.Utils.findNode(...)`.
- Expected delta: `-10`.

## Expected Tests

- Add `tests/qisi-utils-find-node.test.js`.
- Cover normal input, empty input, null, undefined, malformed input, nested match, no match, no mutation, output shape consistency, and explicit app.js module call.

## Allowed Files

- `app.js`
- `qisi-utils.js`
- `tests/qisi-utils-find-node.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_006_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_ROUND_006_REAL_MIGRATION.md`

## Forbidden Files

- PDF controlled-write, aligner, parser, block parser, answer-only extraction, extraction-quality modules.
- Runner, verifier, inventory, score, diff-scope scripts.
- `main.html`, `app.css`, `package.json`, `package-lock.json`.
- `AGENTS.md`, `ai/`, `skills/`.
- Any data, backup, `.env`, or `tmp/` file.

## Stop Conditions

- Working tree becomes dirty outside allowed files.
- `findNode` behavior equivalence is uncertain.
- Execution verifier is not `REAL_MIGRATION`.
- Any required test fails, times out, or is skipped.
- Diff-scope includes forbidden files.
- Real AI/OCR/API call appears necessary.
