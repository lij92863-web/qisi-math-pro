# P10C Diagnostic Real-Run Trace

## Stage

P10C — single controlled diagnostic real-run to capture OCR raw answer evidence

## Run Identity

| Field | Value |
| --- | --- |
| runId | `pdf-master-real-run-20260621182218` |
| commit | `8371dda` |
| AI/OCR calls | 10 |
| Purpose | Diagnostic trace capture, NOT completion attempt |

## Result

pass-safe-partial. Same signature as P7 and P8G attempt 1.

## Per-Question OCR Raw Evidence

| Q | cw Accepted | cw Rejected | ocrRawShape | originalAnswerShape | Drop Stage |
| --- | --- | --- | --- | --- | --- |
| 1 | ✅ | | unknown | — | none-accepted |
| 2 | | ✅ | label-shell | `\A{A}` | controlled-write |
| 3 | ✅ | | unknown | — | none-accepted |
| 4 | ✅ | | unknown | — | none-accepted |
| 5 | ✅ | | unknown | — | none-accepted |
| 6 | ✅ | | unknown | — | none-accepted |
| 7 | ✅ | | unknown | — | none-accepted |
| 8 | | ✅ | label-shell | `}A_\A{A}` | controlled-write |
| 9 | | ✅ | label-shell | `}A_\A{A}` | controlled-write |
| 10 | ✅ | | unknown | — | none-accepted |
| 13 | ✅ | | unknown | — | none-accepted |
| 15 | ✅ | | unknown | — | none-accepted |

## Key Findings

### Answer 2

- OCR produced: `\A{A}` (fingerprint) — LaTeX command wrapping a letter inside braces
- Controlled-write rejected: `option-value-not-matched`
- The label IS present inside the LaTeX command braces, but normalization doesn't unwrap it
- This is an **answer extraction quality gap** — raw text exists with label inside formatting

### Answers 8 and 9

- OCR produced: `}A_\A{A}` (fingerprint) — structural shell with LaTeX command
- Controlled-write rejected: `multiple-option-value-rejected` with `non-label-payload`
- The shell structure was detected, but compaction yielded non-A-F content
- The actual letters were **not valid option labels** (X/Y or similar)
- This is an **answer extraction quality gap** — raw format captured but labels not clean

### Overall

- ocrRawObserved: true for all rejected answers
- ocrRawShape: "label-shell" (LaTeX or structural wrapping)
- dropStage: controlled-write — but the root cause is upstream answer format, not normalization logic
- P8E0 confirmed normalization is correct; the issue is OCR producing formatted content instead of clean labels

## Real OCR Text NOT Committed

Only sanitized fingerprints recorded. No full OCR text committed to repository.

## Next

P10D — formal causality decision.
