# BM-AUTO Full Round 011 PLAN

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Branch: main
Start commit: `3ddb622`

---

## Selected candidate

- **Name:** expandPageRange
- **Target module:** qisi-utils.js
- **Estimated app.js delta:** -14 lines
- **Risk markers:** none (pure array/number helper)
- **Call sites:** 3 in app.js (lines 4413, 4470, 7677)

## Why eligible

- Pure helper: takes range string + maxPage, returns sorted array of page numbers
- No DOM, no DB, no AI, no OCR, no async, no controlled-write, no Route B
- No dependencies on other app.js functions
- 17 lines function body, behavior testable

## Rejected candidates

1. **decodeXmlEntitiesSafe** — Rejected: delta too small (-7, < 10 minimum)
2. **toLineEvidence** — score 56, borderline
3. **normalizeDraftEditorNewlines** — score 69, next round candidate

## Expected tests

- tests/qisi-utils-expand-page-range.test.js (new, ≥8 tests)

## Allowed files

- app.js
- qisi-utils.js
- tests/qisi-utils-expand-page-range.test.js
- docs/refactor/BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_010.md
- docs/refactor/BM_AUTO_FULL_ROUND_011_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_011_REAL_MIGRATION.md

## Stop conditions

- If tests fail
- If classification != REAL_MIGRATION
- If delta > -10
- If any safety test fails


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
