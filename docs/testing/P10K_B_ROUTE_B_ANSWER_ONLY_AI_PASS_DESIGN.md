# P10K-B Route B Answer-Only AI Pass Design

## Stage

P10K-B — design Route B: answer-only AI pass for Q8/Q9

## Why Route A Insufficient

P10K-VERIFY proved: existing OCR rawTextPages contain garbled answer markers and dirty structural shells. Text-only post-processing (Route A) cannot extract clean labels for Q8/Q9. 0/12 labels extracted.

## Why Cannot Enter P10L

P10L would integrate AOE candidates into controlled-write evidence enrichment. With 0 candidates from Route A, integration would have no effect. Route B must be designed first.

## Route B: Answer-Only AI Pass

### Input

Answer pages from the support PDF, sent to a dedicated AI prompt that requests labels-only output.

### Output Schema

```json
{
  "mode": "answer-only",
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

### Prompt Draft

```
You are extracting ONLY answer labels from a math exam answer page.
Rules:
1. Output ONLY the answer label (A/B/C/D/E/F or combinations like ACD, BD).
2. Do NOT output explanations, solutions, formulas, or question text.
3. Do NOT output LaTeX or math expressions.
4. Output one item per answer, in the order they appear on the page.
5. If you cannot determine the label, output null for that item.
6. If the content is ambiguous, output null rather than guessing.
7. Output strict JSON matching the specified schema.
```

### Validator

1. JSON schema validation
2. sourceOrder continuity check (duplicate → fail-closed, jumpBack → fail-closed)
3. Label validity: `^[A-F]{1,4}$` only, no LaTeX, no explanation text
4. Label=null → missing → pass-safe-partial
5. Alignment by sourceOrder + expectedQuestionNumbers (NOT AI question field)
6. Final output: candidate evidence only, not accepted

### Cost Control

| Rule | Value |
| --- | --- |
| New AI calls per real-run | 1 call (answer pages only) |
| Trigger condition | controlled-write has rejected/missing answers AND Route A insufficient |
| Default mock tests | No AI calls |
| Real-run requires | Separate P10P-B authorization |

### Safety Access Path

```
P10L-B: Route B mock adapter (no AI calls)
P10M-B: Shadow wiring (observation only)
P10N-B: Evidence enrichment (validator must pass, controlled-write re-validates)
P10O-B: Pre-real-run gate
P10P-B: 1 controlled diagnostic real-run
```

### Mock Tests (10)

All pass. No business code modified.
