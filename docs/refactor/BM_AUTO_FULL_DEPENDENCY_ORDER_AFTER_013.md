# BM-AUTO Full Dependency Order After Round 013

Stage: BM-AUTO-FULL-AUTONOMOUS-HELPER-MIGRATION

## Known dependency chains

### Chain 1: optionTextHasContent
```
cleanDisplayTextForBatchSave → hasBatchMediaToken → optionTextHasContent
```
- optionTextHasContent calls: cleanDisplayTextForBatchSave, hasBatchMediaToken
- Both upstream dependencies are still in app.js
- Strategy: migrate cleanDisplayTextForBatchSave first, then hasBatchMediaToken, then optionTextHasContent

### Chain 2: splitAnswerSolutionSections
```
normalizeAnswerSolutionSource → splitAnswerSolutionSections
```
- splitAnswerSolutionSections calls: normalizeAnswerSolutionSource
- normalizeAnswerSolutionSource is still in app.js
- normalizeAnswerSolutionSource also calls other helpers (needs audit)

## Migration order (recommended)

### Wave 1: Independent helpers (Queue A)
Priority order based on risk, score, and delta:
1. stripAiCodeFence — pure text, 13 lines, no deps, score 59
2. hasUnconvertedImagePlaceholder — pure check, 11 lines, score 61
3. cleanDisplayFieldsOnly — needs audit for deps
4. hasUnconvertedOptionPlaceholder — 10 lines, score 60
5. toLineEvidence — 10 lines, score 56
6. optionQualityScore — 10 lines, score 56
7. draftSummaryQuestionNo — 10 lines, score 56

### Wave 2: Upstream (Queue B)
8. cleanDisplayTextForBatchSave — unlocks optionTextHasContent
9. normalizeAnswerSolutionSource — unlocks splitAnswerSolutionSections
10. hasBatchMediaToken — unlocks optionTextHasContent

### Wave 3: Downstream (Queue C)
11. optionTextHasContent (after B1 + B2)
12. splitAnswerSolutionSections (after B3)

## Rules
- If upstream is not eligible → downstream stays blocked
- If upstream delta < 10 → both blocked
- No grouped migration — one helper per round
- All internal deps must already be in qisi-utils


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
