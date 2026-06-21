# P10K-VERIFY AOE Route A Shadow Output for Q8/Q9

## Stage

P10K-VERIFY — verify whether Route A AOE extracts clean labels for Q8/Q9 from existing rawTextPages

## Verification Method

Applied `buildAnswerOnlyExtractionShadow` to P8G attempt 1 fixture `rawTextPages`.

## Result

```
mode: fail-closed
candidateQuestionNumbers: []
missingQuestionNumbers: [1,2,3,4,5,6,7,8,9,10,13,15]
Q8 observed: false
Q8 candidate: false
Q9 observed: false
Q9 candidate: false
```

## Root Cause

The fixture's rawTextPages use garbled residual marker characters (`銆怌銆慉`, `銆怌銆慍`) that `isAnswerMarkerLine` does not recognize as answer markers. No answer lines are detected → no labels extracted → fail-closed.

Furthermore, even if marker detection were improved to handle garbled patterns, the answer content for Q8/Q9 (`}X_\A{Y}`, `}P_\A{Q}`) is dirty-structural-shell that `extractLabelFromAnswerLine` would correctly reject as non-label content.

## Decision

**Route A insufficient.**

| Criterion | Result |
| --- | --- |
| Q8 clean label candidate | ❌ None |
| Q9 clean label candidate | ❌ None |
| candidateQuestionNumbers | `[]` (empty) |
| AOE detected any labels | ❌ 0/12 |
| Route A viable for Q8/Q9 | ❌ No |

## Why Route A Fails

1. **Marker detection gap**: OCR outputs garbled answer markers that text-pattern matching cannot reliably detect
2. **Content quality gap**: Q8/Q9 answer content from OCR is dirty structural shell — not clean labels
3. **Fundamental limitation**: Text-only post-processing cannot recover clean labels from garbled OCR output

## Next

**P10K-B** — design Route B: answer-only AI pass. Route A has been tested and proven insufficient. A dedicated AI call with a labels-only prompt is needed to get clean answer labels for Q8/Q9.
