# P10B Answer Path Trace Fixture

## Stage

P10B — build trace fixtures and diagnostic tests using existing sanitized data

## What Was Built

### `tests/pdf-answer-path-trace.test.js` (NEW)

7 trace tests using existing P8G and P7 fixtures. No new business code.

### Trace Function

`buildAnswerPathTrace(fixture, controlledWrite, parserGate)` — builds per-question trace objects with these fields:

| Field | Source |
| --- | --- |
| `question` | expectedQuestionNumbers |
| `expected` | always true |
| `ocrRawObserved` | **false** — not captured in sanitized fixtures |
| `ocrRawShape` | **"unknown"** — raw OCR answer evidence not available |
| `parserObserved` | parserGate.parserResult.answerItems |
| `alignerObserved` | same as parserObserved (aligner passes full through) |
| `controlledWriteAccepted` | controlledWrite.answerQuestionNumbers |
| `controlledWriteRejected` | controlledWrite.warnings |
| `rejectionCode` | from P8C taxonomy |
| `rejectionDetail` | from P8C taxonomy |
| `draftSnapshotPresent` | fixture.expected.draftSnapshotAnswerNumbers |
| `baselineCandidatePresent` | fixture.expected.baselineCandidateAnswerNumbers |
| `dropStage` | derived from above |
| `truthSource` | "controlled-write" |

## Test Coverage

| Test | Assertions |
| --- | --- |
| P8G trace: per-question truth source | 5 accepted, 7 rejected, 10 draft, 5 baseline, needsDiagnosticRealRun=true |
| P8G trace: Q8/9 rejection | parser observed, controlled-write rejected, structural non-label-payload |
| P8G trace: Q2-6 rejection | controlled-write rejected, draftSnapshotPresent != baselineCandidatePresent |
| P8G trace: Q1,7,10,13,15 accepted | controlled-write accepted, baselineCandidatePresent=true, dropStage=none-accepted |
| P8G trace: solution ≠ answer unlock | 12/12 solutions, answers 8/9 still rejected |
| P8G trace: pass-safe-partial | parser full + cw rejected → not complete |
| P7 trace: correctness | 9 accepted, 3 rejected, baseline only from controlled-write |

## Key Finding

```
needsDiagnosticRealRun: true
ocrRawObserved: false for all questions
```

Existing sanitized fixtures start at `rawTextPages` level — they model what the parser sees, not what the OCR produced. Without raw OCR answer evidence, the `dropStage` for 8/9 can only be narrowed to "controlled-write rejected with non-label-payload" — we cannot determine if the OCR produced clean labels or non-label content.

## Next Stage

**P10C** — single controlled diagnostic real-run to capture per-question OCR raw answer evidence.
