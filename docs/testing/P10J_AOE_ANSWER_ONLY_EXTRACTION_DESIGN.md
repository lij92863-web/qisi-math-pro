# P10J-AOE Answer-Only Extraction Design for Q8/Q9

## Stage

P10J-AOE — design answer-only OCR/AI extraction route for dirty structural shell answers

## Decision Answers

### 1. Q8/Q9 must go through AOE?

**Yes.** P10H already established that Q8/Q9 dirty structural shells cannot be fixed by safe wrapper unwrap. The `non-label-payload` result means the OCR output for Q8/Q9 inherently contains non-A-F characters. Only an answer-only extraction can separate the label from the noise.

### 2. Recommended AOE route?

**Route A: Based on existing OCR rawTextPages re-extraction.**

Route A is recommended because:
- No additional AI/OCR cost (uses existing rawTextPages from the support PDF OCR)
- The answer text IS present (proven by P10C — ocrRawObserved: true)
- The issue is extraction QUALITY, not extraction PRESENCE
- Route B (new AI pass) adds cost without guaranteed improvement
- Route C (region extraction) requires layout parsing that adds complexity

The AOE module will post-process the existing OCR text to extract labels-only content.

### 3. Need new AI/OCR call?

**No — Route A uses existing OCR data.** The raw text pages already contain the answer content. The AOE module extracts labels-only evidence from that existing text.

If Route A proves insufficient in practice (P10M real-run), then Route B can be reconsidered.

### 4. Expected call cost?

Route A: **0 additional AI/OCR calls.** Uses existing rawTextPages.

### 5. How does AOE output enter controlled-write?

As **upstream evidence enrichment** — same pattern as P10I-Q2:

1. AOE module processes rawTextPages → produces `aoeAnswerCandidates`
2. Each candidate has: `{ question, label, evidenceType: 'answer-only-extraction' }`
3. In controlled-write's objective answer branch, if original normalization rejects:
   - Check if AOE candidate exists for this question
   - If yes, re-validate the AOE label through `normalizeObjectiveAnswerToLabels`
   - If passes → accept with evidence path
4. If no AOE candidate or re-validation fails → keep original rejection

### 6. Need new module?

**Yes — `qisi-pdf-answer-only-extraction.js`.**

Exported functions:
- `normalizeAnswerOnlyItem(item)` — validate/normalize single item
- `validateAnswerOnlyExtraction({items, expectedCount})` — full sequence validation
- `buildAoeEvidenceCandidates(aoeResult, expectedQuestionNumbers)` — align to expected sequence
- `extractAnswerOnlyCandidates(rawTextPages, expectedQuestionNumbers)` — full pipeline (future)

### 7. Module naming?

`qisi-pdf-answer-only-extraction.js` (UMD, browser + Node compatible).

### 8. Need runner change?

**Yes — P10K-AOE shadow wiring.** Similar to P10G, the AOE shadow would be added to the runner's diagnostic output first, before any controlled-write integration.

### 9. Need app.js change?

**No — for Route A.** Route A uses existing rawTextPages that are already available in the pipeline. No server/API changes needed. If Route B is later needed, then app.js/server changes would be required.

### 10. Next stage?

**P10K-AOE: shadow-mode wiring.** Implement the module and wire it as shadow diagnostics first (observation only, no controlled-write change). Then P10L-AOE can integrate into controlled-write after shadow proves stable.

## AOE Schema

```json
{
  "items": [
    {
      "sourceOrder": 1,
      "questionNumberCandidate": null,
      "label": "A",
      "rawEvidenceShape": "label-only",
      "confidence": "high"
    }
  ],
  "warnings": []
}
```

## AOE Validator Rules

1. label must be `^[A-F]+$` (single or multi-choice labels)
2. sourceOrder must be positive integer
3. No duplicate sourceOrders → fail-closed
4. No jumpBack → fail-closed
5. No LaTeX, no explanations, no math in label
6. `questionNumberCandidate` is reference only, NOT used for alignment
7. Alignment by sourceOrder + expectedQuestionNumbers position

## Mock Tests (10)

| # | Test | Verdict |
| --- | --- | --- |
| 1 | Clean labels 1-12 | Valid |
| 2 | Non-label payload | Rejected |
| 3 | Dirty structural shell | Rejected |
| 4 | Duplicate sourceOrder | Fail-closed |
| 5 | JumpBack | Fail-closed |
| 6 | AI question field not trusted | Correctly ignored |
| 7 | Incomplete coverage | Partial status |
| 8 | Empty input | Invalid |
| 9 | Candidate ≠ accepted | Evidence only |
| 10 | Controlled-write truth gate | Preserved |

## Implementation Sequence

```
P10K-AOE: implement module + shadow wiring (no controlled-write change)
P10L-AOE: integrate into controlled-write as evidence enrichment
P10M-AOE: pre-real-run gate
P10N-AOE: 1 diagnostic real-run
```
