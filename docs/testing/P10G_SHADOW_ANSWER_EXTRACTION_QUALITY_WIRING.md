# P10G Shadow Answer Extraction Quality Wiring

## Stage

P10G — wire classifier into runner shadow diagnostics, observation only

## Changes

### `scripts/pdf-master-browser-runner.js`

- Imported `classifyAnswerExtractionQuality` from `qisi-pdf-answer-extraction-quality.js`
- Added `buildAnswerExtractionQualityShadow(controlledWriteSummary)` function
- Shadow built from `rejectedAnswerWarnings` in controlledWriteSummary
- Added `answerExtractionQualityShadow` field to ledger entry and report
- Shadow only populated for real-run mode

### `tests/pdf-master-browser-runner.test.js`

5 new shadow tests (16 total now):
- Q2 → `safe-wrapper-candidate`, `canDirectlyAccept: false`
- Q8/Q9 → `dirty-structural-shell`, `normalizedCandidate: null`
- Shadow does NOT affect controlledWrite accepted/rejected
- Shadow does NOT affect baseline candidate
- pass-safe-partial unchanged by shadow classification
- Null shadow when no warnings or classifier unavailable

## Shadow Output Example

```json
{
  "2": {
    "originalAnswerShape": "\\A{A}",
    "status": "safe-wrapper-candidate",
    "normalizedCandidate": "A",
    "reasonCode": "safe-latex-wrapper",
    "canDirectlyAccept": false,
    "affectsControlledWrite": false,
    "affectsBaselineCandidate": false
  },
  "8": {
    "originalAnswerShape": "}A_\\A{A}",
    "status": "dirty-structural-shell",
    "normalizedCandidate": null,
    "reasonCode": "dirty-structural-shell",
    "canDirectlyAccept": false,
    "affectsControlledWrite": false,
    "affectsBaselineCandidate": false
  }
}
```

## Key Invariant

```
Shadow is observation ONLY.
controlled-write is still the only truth gate.
baselineCandidateAnswerNumbers still from controlledWriteAcceptedAnswerNumbers.
```
