# BM-AUTO Full Round 012 PLAN

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Branch: main
Start commit: `96108f5`

---

## Selected candidate

- **Name:** normalizeFigureBbox
- **Target module:** qisi-utils.js
- **Estimated app.js delta:** -17 lines
- **Risk markers:** none (pure array/number helper)
- **Call sites:** 5 in app.js (definition + 3 calls, 1 used by bboxIntersectionArea)

## Why eligible

- Pure helper: normalizes arbitrary bbox corner order into [x1,y1,x2,y2]
- No DOM, no DB, no AI, no OCR, no async, no controlled-write, no Route B
- No dependencies on other app.js functions
- 16 lines function body, deterministic, behavior testable

## Rejected nearby candidates

1. **bboxAreaForQuestionFigure** — depends on normalizeFigureBbox, must migrate after
2. **isLikelyRealQuestionFigure** — score 90 but complex dependency chain
3. **normalizeRecognizedFigureDescriptor** — borderline, not yet audited

## Expected tests

- tests/qisi-utils-normalize-figure-bbox.test.js (new, ≥8 tests)

## Allowed files

- app.js
- qisi-utils.js
- tests/qisi-utils-normalize-figure-bbox.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_012_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_012_REAL_MIGRATION.md

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
