# BM-AUTO Full Candidate Pool Update After Round 010

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Start commit: `3ddb622`

## Inventory

```bash
node scripts/base-migration-inventory.js
```

Result: 371 total functions, 211 eligible (basic filter)

## Score

```bash
node scripts/base-migration-score.js
```

Result: 98 eligible (after score filter), 11 eligible groups, 273 ineligible

## Selected Queue (sorted by risk + score)

Only low-risk, pure helpers, >=10 lines, no DOM/db/AI/OCR/async.

### Priority 1 — Pure string helpers

| # | Name | Module | Lines | Score | Call Sites |
|---|------|--------|-------|-------|-------------|
| 1 | decodeXmlEntitiesSafe | qisi-utils.js | 15 | 62 | TBD |
| 2 | toLineEvidence | qisi-utils.js | 10 | 56 | TBD |
| 3 | stripAiCodeFence | qisi-utils.js | 13 | 59 | TBD |
| 4 | normalizeDraftEditorNewlines | qisi-review-draft-state.js | 18 | 69 | TBD |
| 5 | splitAnswerSolutionSections | qisi-utils.js | 17 | 64 | TBD |

### Priority 2 — Pure array/object helpers

| # | Name | Module | Lines | Score |
|---|------|--------|-------|-------|
| 6 | preserveRawEvidence | qisi-utils.js | 16 | 63 |
| 7 | shouldMatchByOrder | qisi-utils.js | 16 | 67 |
| 8 | draftRawOptionSourceCandidates | qisi-review-draft-state.js | 18 | 65 |
| 9 | mergeImageListsById | qisi-utils.js | 11 | 57 |

### Priority 3 — Pure number/math helpers

| # | Name | Module | Lines | Score |
|---|------|--------|-------|-------|
| 10 | bboxIntersectionArea | qisi-utils.js | 14 | 60 |
| 11 | normalizeFigureBbox | qisi-utils.js | 16 | 67 |

### Priority 4 — Pure file name/type helpers

| # | Name | Module | Lines | Score |
|---|------|--------|-------|-------|
| 12 | mimeFromFilename | qisi-file-dispatcher.js | 16 | 63 |
| 13 | fileBaseNameForMatch | qisi-file-dispatcher.js | 11 | 57 |

### Priority 5 — Pure draft/view-model helpers

| # | Name | Module | Lines | Score |
|---|------|--------|-------|-------|
| 14 | cleanDisplayFieldsOnly | qisi-utils.js | 10 | 56 |
| 15 | optionTextHasContent | qisi-utils.js | 15 | 62 |
| 16 | optionHasSubstance | qisi-utils.js | 14 | 60 |
| 17 | optionQualityScore | qisi-utils.js | 10 | 56 |
| 18 | draftSummaryQuestionNo | qisi-review-draft-state.js | 10 | 56 |
| 19 | attachSourceTraceToDraftQuestion | qisi-review-draft-state.js | 28 | 77 |
| 20 | syncActiveDraftEditorFromQuestion | qisi-review-draft-state.js | 15 | 62 |

### Higher-score candidates (later rounds, need closer audit)

| # | Name | Module | Lines | Score |
|---|------|--------|-------|-------|
| 21 | ommlChildren | qisi-utils.js | 46 | 94 |
| 22 | ommlToLatex | qisi-utils.js | 12 | 58 |
| 23 | expandPageRange | qisi-utils.js | 17 | 64 |
| 24 | inferExpectedQuestionCount | qisi-utils.js | 24 | 72 |
| 25 | isLikelyRealQuestionFigure | qisi-utils.js | 35 | 90 |
| 26 | reconcileAnswerWithSolution | qisi-utils.js | 22 | 70 |
| 27 | hasUnconvertedImagePlaceholder | qisi-utils.js | 11 | 61 |
| 28 | hasUnconvertedOptionPlaceholder | qisi-utils.js | 10 | 60 |
| 29 | findVisualItemForQuestion | qisi-utils.js | 20 | 72 |
| 30 | questionMatchesLibraryFilters | qisi-utils.js | 17 | 64 |

## High-Risk / Rejected Candidates

Functions marked with DOM, DB, async, AI/OCR, PDF safety, controlled-write, Route B, workflow indicators are all rejected and will NOT be migrated automatically.

## Next round

**Round 011** — first candidate: `decodeXmlEntitiesSafe` (qisi-utils.js, 15 lines, score 62)


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
