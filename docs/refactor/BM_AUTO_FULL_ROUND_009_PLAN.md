# BM-AUTO Full Round 009 PLAN

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Branch: main
Start commit: `dea3cf6`

---

## Selected candidate

- **Name:** isFatalQwenServiceError
- **Target module:** qisi-utils.js
- **Estimated app.js delta:** -20 lines
- **Risk markers:** none (pure string pattern matching, JS built-ins only)
- **Call sites:** 9 in app.js

## Why eligible

- Pure helper: takes error, returns boolean based on string pattern matching
- No DOM, no DB, no AI, no OCR, no async, no controlled-write, no Route B
- No dependencies on other app.js functions
- 20 lines, well above 10-line minimum
- 9 call sites in app.js
- Behavior testable

## Rejected candidates

1. **replaceQisiImageTokensForLatex** (score 82, 32 lines): Rejected — no call sites in app.js (never called)
2. **normalizeEditorChoiceLabel** (score 98): Rejected — only 4 lines, below 10-line minimum
3. **ommlChildren** (score 94): Rejected — only 2 lines alone, needs group migration
4. **splitMergedRecognizedItems** (score 94): Rejected — depends on 3 app.js functions
5. **isLikelyRealQuestionFigure** (score 90): Rejected — depends on 4 app.js functions

## Expected tests

- tests/qisi-utils-is-fatal-qwen-service-error.test.js (new, ≥8 tests)

## Allowed files

- app.js
- qisi-utils.js
- tests/qisi-utils-replace-qisi-image-tokens-for-latex.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_009_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_009_REAL_MIGRATION.md

## Forbidden files

- All files listed in CODEX_TASK.local.md forbidden list

## Stop conditions

- If replaceQisiImageTokensForLatex has hidden dependencies on app.js functions
- If tests fail
- If classification != REAL_MIGRATION
- If delta > -10
- If any safety test fails


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
