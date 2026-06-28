# BM-AUTO Full Round 010 PLAN

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Branch: main
Start commit: `143debe`

---

## Selected candidate

- **Name:** stripAnswerSolution
- **Target module:** qisi-utils.js
- **Estimated app.js delta:** -16 lines
- **Risk markers:** none (pure string parsing, JS built-ins only)
- **Call sites:** 1 in app.js

## Why eligible

- Pure helper: takes text, returns { stem, answer, solution }
- No DOM, no DB, no AI, no OCR, no async, no controlled-write, no Route B
- No dependencies on other app.js functions
- 16 lines, above 10-line minimum
- Behavior testable

## Rejected candidates

1. **replaceQisiImageTokensForLatex** (score 82, 32 lines): Rejected — no call sites in app.js
2. **escapeHtml** (score 62, 6 lines): Rejected — below 10-line minimum
3. **decodeXmlEntitiesSafe** (score 62, 6 lines): Rejected — below 10-line minimum
4. **ommlToLatex** (score 58, 12 lines): Rejected — depends on ommlText (app.js)
5. **optionTextHasContent** (score 62, 15 lines): Rejected — depends on 2 app.js functions
6. **cleanDisplayFieldsOnly** (score 56, 10 lines): Rejected — depends on 2 app.js functions

## Expected tests

- tests/qisi-utils-strip-answer-solution.test.js (new, ≥8 tests)

## Allowed files

- app.js
- qisi-utils.js
- tests/qisi-utils-strip-answer-solution.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_010_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_010_REAL_MIGRATION.md

## Stop conditions

- If stripAnswerSolution has hidden dependencies on app.js functions
- If tests fail
- If classification != REAL_MIGRATION
- If delta > -10
- If any safety test fails


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
