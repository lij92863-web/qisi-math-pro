# BM-AUTO Full Round 013 PLAN

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Branch: main
Start commit: `e828dc9`

---

## Selected candidate

- **Name:** bboxIntersectionArea
- **Target module:** qisi-utils.js
- **Estimated app.js delta:** -15 lines
- **Risk markers:** none (pure numeric bbox math helper)
- **Call sites:** 1 in app.js (intersection check in isLikelyRealQuestionFigure)

## Why eligible

- Pure helper: computes intersection area of two bounding boxes
- Deterministic, no side effects
- No DOM, no DB, no async, no AI/OCR, no controlled-write, no PDF safety write path, no Route B
- Only dependency is `normalizeFigureBbox` which was already migrated to qisi-utils.js in Round 012
- 14 lines function body, behavior testable

## Rejected nearby candidates

1. **optionTextHasContent** (score 62, 15 lines) — depends on `cleanDisplayTextForBatchSave` and `hasBatchMediaToken`, both still in app.js
2. **splitAnswerSolutionSections** (score 64, 17 lines) — depends on `normalizeAnswerSolutionSource`, still in app.js
3. **isLikelyRealQuestionFigure** (score 90, 35 lines) — complex dependency chain, not yet auditable

## Expected tests

- tests/qisi-utils-bbox-intersection-area.test.js (new, ≥8 tests)

## Allowed files

- app.js
- qisi-utils.js
- tests/qisi-utils-bbox-intersection-area.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_013_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_013_REAL_MIGRATION.md

## Stop conditions

- If tests fail
- If classification != REAL_MIGRATION
- If delta > -10
- If any safety test fails
- If dependency on unmigrated app.js functions is discovered


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
