# BM-AUTO Full Stop — NO_ELIGIBLE_LOW_RISK_HELPER

Stop reason: No independent low-risk helper with >=10 lines delta remains available.
Latest commit: `c5e8df4`

## Completed rounds (after R010)

| Round | Helper | Delta | Queue | Migration commit | Sync commit |
|-------|--------|-------|-------|------------------|-------------|
| R011 | expandPageRange | -18 | A | `96108f5` | (sync correction later) |
| R012 | normalizeFigureBbox | -17 | A | `e828dc9` | (sync correction later) |
| R013 | bboxIntersectionArea | -15 | A | `121a7cc` | (sync correction later) |
| R014 | preserveRawEvidence | -17 | A | `c441ab0` | `c5e8df4` |

**Total app.js delta: -67 lines** (R011-R014)

## Remaining landscape after R014

- app.js: 22921 lines
- Automated scan found 334 function definitions
- Independent candidates (>=14 lines, no deps): 1 (attachTextLayerEvidence — blocked by closure-captured `file`/`text`)
- Candidates rejected by deps: 97
- Candidates rejected by size (<14 lines): 134
- Candidates rejected by risk (DOM/DB/async/AI): 101

## Dependency chain analysis

### Chain 1: optionTextHasContent
```
hasBatchMediaToken (4 lines, too small)
  ↓
cleanDisplayTextForBatchSave (5 lines, too small)
  ↓
stripBatchImagePlaceholders (13 lines — depends on protectBatchMediaTokens, restoreBatchMediaTokens, BATCH_BAD_PLACEHOLDER_RE)
  ↓
optionTextHasContent (15 lines — depends on cleanDisplayTextForBatchSave + hasBatchMediaToken)
```
**Blocked:** upstream functions are individually too small for migration (delta < 10).

### Chain 2: splitAnswerSolutionSections
```
normalizeAnswerSolutionSource (7 lines, depends only on cleanRecognizedText in qisi-utils)
  ↓
splitAnswerSolutionSections (17 lines)
```
**Blocked:** normalizeAnswerSolutionSource is 7 lines (delta < 10). splitAnswerSolutionSections depends on it.

### Chain 3: cleanDisplayFieldsOnly
```
cleanDisplayTextForBatchSave (5 lines) + cleanDisplayOptionsForBatchSave (dep on cleanDisplayTextForBatchSave)
  ↓
cleanDisplayFieldsOnly (10 lines)
```
**Blocked:** upstream too small.

## Why grouped migration is not an option

Per campaign rules: "禁止把多个 helper group 合并成一轮"。Grouped migration of these small+downstream pairs is forbidden by design.

## Working tree state

Clean. All commits pushed to origin/main.

## Next recommended action

1. **User review:** Confirm the STOP is acceptable, or authorize grouped migration of the small upstream + downstream pairs.
2. **If grouped migration is approved:** Migrate batch-media-token helpers (hasBatchMediaToken + cleanDisplayTextForBatchSave + stripBatchImagePlaceholders) as a single group, then unlock optionTextHasContent.
3. **Alternative:** Migrate normalizeAnswerSolutionSource (7 lines, delta would be ~7, breaks delta rule but is fully independent) to unlock splitAnswerSolutionSections.
4. **Otherwise:** Campaign ends here. Remaining app.js functions are either too small for individual migration, have unresolved dependency chains, or are high-risk (DOM/DB/async/AI/OCR/PDF-safety/Route-B).
