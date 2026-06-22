# BM-AUTO Full Candidate Pool Update After Round 013

Stage: BM-AUTO-FULL-AUTONOMOUS-HELPER-MIGRATION
Start commit: `5e7bcfd`

## Inventory

- appJsLines: 22938
- totalFunctionsFound: 368
- eligibleCount: 206

## Score

- totalFunctions: 368
- eligibleFunctions: 94
- eligibleGroups: 11
- ineligibleFunctions: 274

## Migration Queue

### Queue A — Independent pure helpers (no app.js dependencies)

| Pri | Name | Est Lines | Score | Target Module | Notes |
|-----|------|-----------|-------|---------------|-------|
| A1 | stripAiCodeFence | 13 | 59 | qisi-utils.js | strip ``` fences from AI text |
| A2 | hasUnconvertedImagePlaceholder | 11 | 61 | qisi-utils.js | check image placeholder |
| A3 | hasUnconvertedOptionPlaceholder | 10 | 60 | qisi-utils.js | check option placeholder |
| A4 | cleanDisplayFieldsOnly | 10 | 56 | qisi-utils.js | depends on cleanDisplayTextForBatchSave (needs audit) |
| A5 | optionQualityScore | 10 | 56 | qisi-utils.js | simple score helper |
| A6 | toLineEvidence | 10 | 56 | qisi-utils.js | format evidence line |
| A7 | draftSummaryQuestionNo | 10 | 56 | qisi-review-draft-state.js | draft question number formatter |
| A8 | syncActiveDraftEditorFromQuestion | 15 | 62 | qisi-review-draft-state.js | pure state helper |
| A9 | parseSolutionItemsFromText | 10 | 60 | qisi-support-parser.js | parser util |
| A10 | parseAnswerAndSolutionItemsFromText | 13 | 63 | qisi-support-parser.js | parser util |

### Queue B — Dependency upstream helpers

| Pri | Name | Est Lines | Score | Unlocks |
|-----|------|-----------|-------|---------|
| B1 | cleanDisplayTextForBatchSave | ~10+ | TBD | optionTextHasContent, cleanDisplayFieldsOnly |
| B2 | normalizeAnswerSolutionSource | ~10+ | TBD | splitAnswerSolutionSections |

### Queue C — Downstream (after upstream migrated)

| Pri | Name | Est Lines | Depends On | Status |
|-----|------|-----------|------------|--------|
| C1 | optionTextHasContent | 15 | cleanDisplayTextForBatchSave, hasBatchMediaToken | blocked |
| C2 | splitAnswerSolutionSections | 17 | normalizeAnswerSolutionSource | blocked |

### Queue D — Deferred / Rejected

Grouped-only chains, DOM, DB, async, AI/OCR, PDF safety, Route B, controlled-write, runner — all rejected.
