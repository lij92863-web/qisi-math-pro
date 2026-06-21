# P10K-AOE Answer-Only Extraction Shadow Implementation

## Stage

P10K — implement AOE module + shadow diagnostics (observation only, no controlled-write change)

## Module

`qisi-pdf-answer-only-extraction.js` — UMD, 6 exports:

| Export | Purpose |
| --- | --- |
| `normalizeAnswerOnlyExtractionItem` | Validate/normalize single item |
| `isAnswerMarkerLine` | Detect answer marker lines |
| `extractLabelFromAnswerLine` | Extract A-F label from answer line |
| `isDirtyOrNonLabelContent` | Detect dirty content (LaTeX, math, long text) |
| `validateAnswerOnlyExtractionSequence` | Full sequence validation |
| `buildAnswerOnlyExtractionShadow` | Build shadow from rawTextPages |

## Route A

Uses **existing OCR rawTextPages** — 0 additional AI/OCR calls. Scans answer marker lines and extracts labels.

## Shadow Output

```
mode: full | pass-safe-partial | fail-closed
candidateQuestionNumbers: [...]
rejectedQuestionNumbers: [...]
missingQuestionNumbers: [...]
affectsControlledWrite: false (always)
affectsBaselineCandidate: false (always)
```

## Runner Integration

Added `answerOnlyExtractionShadow` to ledger entry and report. Built from existing parser input page data after controlled-write diagnostics are collected.

## Tests

16 module tests. All pass. Controlled-write/parser/aligner untouched.
