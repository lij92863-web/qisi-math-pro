# P10H Fix Strategy Design: safe wrapper vs answer-only OCR extraction

## Stage

P10H — design the actual fix strategy, not just add more diagnostics

## Decision

**Option C — Both routes feasible, Q2 first as low-risk validation, then Q8/Q9 via answer-only OCR/AI extraction.**

## Why Not Option A (Q2 only)?

Q2 alone would improve coverage from 9/12 to 10/12 — worthwhile but insufficient. Q8/Q9 remain the primary gap.

## Why Not Option B (Q8/Q9 directly)?

Q8/Q9 need answer-only OCR/AI extraction — significant design and cost. Q2 is a simpler validation sample to prove the evidence-enrichment pattern works without weakening safety.

## Why Not Option D (stop)?

P10A-P10G proved: Q2 has extractable label evidence; Q8/Q9 need upstream quality improvement but the design constraints are clear. Evidence is sufficient to proceed.

## Q2 Route: Safe Wrapper Candidate Integration

### Problem

OCR produces `\A{A}` — label `A` is present inside a safe LaTeX command.

### Fix Strategy

A lightweight adapter in controlled-write's objective answer path:

1. Before `normalizeObjectiveAnswerToLabels`, call `classifyAnswerExtractionQuality(rawAnswer)`
2. If `status === 'safe-wrapper-candidate'` and `normalizedCandidate` is a valid option label:
   - Use `normalizedCandidate` as the answer text for normalization
   - Pass it through `normalizeObjectiveAnswerToLabels` as if it were the raw parser answer
3. If normalization accepts it → write as controlled-write accepted
4. If normalization rejects it → keep original rejection

### Why This Is Safe

- The classifier only unwraps whitelisted LaTeX commands with single A-F labels
- The unwrapped label STILL goes through `normalizeObjectiveAnswerToLabels` for final validation
- `dirty-structural-shell` answers are NEVER unwrapped
- The controlled-write truth gate is preserved — just with cleaner upstream evidence

### What Changes

`qisi-pdf-support-controlled-write.js` — in the objective answer branch, add a pre-normalization evidence enrichment step.

### Scope

| File | Change |
| --- | --- |
| `qisi-pdf-support-controlled-write.js` | ~15 lines: call classifier before normalization |
| `tests/pdf-support-controlled-write-answer-ownership.test.js` | ~5 new tests |

### Expected Outcome

Q2 moves from rejected → accepted. Coverage: 10/12 instead of 9/12. Not complete, but one fewer gap.

## Q8/Q9 Route: Answer-Only OCR/AI Extraction

### Problem

OCR produces `}_\A{...}` structural shells with non-A-F letters. The answer labels in the PDF were misread by the OCR model.

### Fix Strategy

A dedicated answer-only extraction step:

1. Send the support PDF answer pages to a specialized prompt: "Extract only the answer labels (A/B/C/D/ACD/etc.) from this page. Output labels only, no explanations, no LaTeX, no question numbers."
2. Receive a labels-only array: `[{ sourceOrder: 1, label: "A" }, ...]`
3. Align by `sourceOrder` with `expectedQuestionNumbers` (NOT by AI `question` field)
4. Validate: duplicate → fail-closed, jumpBack → fail-closed, out-of-range → fail-closed
5. Pass clean labels through controlled-write for final acceptance

### Schema

```json
{
  "answers": [
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

### Constraints

- `questionNumberCandidate` is reference only, NOT used for alignment
- Alignment by `sourceOrder` + `expectedQuestionNumbers` sequence
- Labels-only: no LaTeX, no explanations, no math
- Final acceptance: controlled-write truth gate

### Cost

Estimated 1-2 additional AI calls per run (answer-focused prompt on answer pages only).

### Scope

| File | Change |
| --- | --- |
| `qisi-pdf-answer-only-extractor.js` (NEW) | Pure functions for labels-only extraction |
| Server/API config | New prompt schema (requires app.js/server touch — separate authorization) |
| `qisi-pdf-support-controlled-write.js` | Evidence enrichment adapter |

## Why Q8/Q9 Cannot Be Simple Unwrap

The classifier correctly identifies `}_\A{...}` as `dirty-structural-shell`. Unlike `\A{A}` (which is a known-safe LaTeX command with A inside), the structural shell `}_\A{...}` is:
1. Not a whitelisted wrapper pattern
2. The inner content compacts to non-A-F characters
3. The structural meaning is ambiguous — may contain LaTeX formatting mixed with label fragments
4. Accepting it would require guessing which characters are labels

This is fundamentally different from Q2's situation. Q2 has a clean, extractable label. Q8/Q9 need better OCR, not smarter code.

## Implementation Sequence

```
P10I-Q2: safe-wrapper candidate integration (controlled-write adapter, ~15 lines)
P10J-Q2: pre-real-run gate for Q2 fix
P10K-Q2: controlled diagnostic real-run (1 attempt)
P10L-AOE: answer-only extraction design and mock fixtures
P10M-AOE: answer-only extraction implementation
P10N-AOE: pre-real-run gate
P10O-AOE: controlled diagnostic real-run
```

## What Does NOT Change

- `canDirectlyAccept` remains false for classifier output
- Classifier output remains evidence enrichment, not write permission
- controlled-write is still the only truth gate
- baselineCandidate still from controlledWriteAcceptedAnswerNumbers
- Q8/Q9 dirty-structural-shell still rejected by controlled-write
- known-bad, Attempt12, DOCX stable all preserved

## Decision

```
Option: C
Q2 route: safe-wrapper candidate → controlled-write evidence enrichment
Q8/Q9 route: answer-only OCR/AI extraction (separate design track)
OCR/AI extraction required for Q8/Q9: YES
controlled-write must be touched for Q2: YES (~15 lines in pre-normalization step)
controlled-write must be touched for Q8/Q9: YES (evidence enrichment adapter)
real-run needed later: YES (1 diagnostic per fix track)
```
