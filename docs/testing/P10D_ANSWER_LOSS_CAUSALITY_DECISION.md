# P10D Answer Loss Causality Decision Report

## Stage

P10D — formal answer loss causality decision based on P10A/P10B/P10C evidence

## Decision

**B — Answer extraction quality gap: raw exists but not labels-only.**

## Question 8 Trace (Final)

| Field | Value |
| --- | --- |
| question | 8 |
| expected | true |
| ocrRawObserved | **true** |
| ocrRawShape | **label-shell** |
| originalAnswerShape | `}A_\A{A}` |
| parserObserved | true |
| alignerObserved | true |
| alignerSafe | true |
| controlledWriteAccepted | false |
| controlledWriteRejected | true |
| rejectionCode | `rejection-multi-option-value-rejected` |
| structuralCandidate | true |
| structuralReason | `non-label-payload` |
| draftSnapshotPresent | false |
| baselineCandidatePresent | false |
| dropStage | **controlled-write** (root cause: upstream OCR produced non-A-F content in structural shell) |
| truthSource | controlled-write |

## Question 9 Trace (Final)

Identical to question 8.

## Question 2 Trace (Final)

| Field | Value |
| --- | --- |
| question | 2 |
| expected | true |
| ocrRawObserved | **true** |
| ocrRawShape | **label-shell** |
| originalAnswerShape | `\A{A}` |
| parserObserved | true |
| alignerObserved | true |
| controlledWriteAccepted | false |
| controlledWriteRejected | true |
| rejectionCode | `rejection-option-value-not-matched` |
| dropStage | **controlled-write** (root cause: OCR produced LaTeX command wrapping label `\cmd{A}`) |
| draftSnapshotPresent | true (from repair path) |
| baselineCandidatePresent | false |

## Root Cause Analysis

### Answer 2

OCR produced: LaTeX command wrapping a label — `\cmd{A}`.

The label IS present inside the LaTeX command braces. The current `normalizeObjectiveAnswerToLabels` cannot unwrap arbitrary LaTeX commands. The `unwrapStructuralCommand` in the block parser handles some command patterns but the controlled-write's normalization doesn't apply these unwraps before the objective answer check.

**What would be needed to recover:** a safe LaTeX command unwrapper that extracts the content inside `\cmd{...}` before normalization. This is a structured text normalization improvement — removing known-safe formatting commands to reveal the underlying label.

### Answers 8 and 9

OCR produced: structural shell `}_\A{...}` with letters outside A-F.

The structural shell pattern (`}_`) was correctly detected, but compaction yielded `non-label-payload` because the actual letters (X/Y or similar) are NOT valid option labels (A-D). The OCR captured the formatting of the answer from the PDF but the actual answer content used letters outside the standard option set.

**What would be needed to recover:** the actual answer labels from the PDF. The OCR model reproduces the visual structure but the semantic content (which letters) is incorrect. This is fundamentally an OCR quality issue — not something that code can fix without guessing.

## Why NOT Other Classifications

### A — OCR/AI raw extraction gap: REJECTED

OCR DID produce text for questions 2, 8, 9. The text exists but is formatted/unclean.

### C — Parser/aligner diagnostic issue: REJECTED

Parser correctly produced 12/12 answer items. Aligner correctly maintained full mode. No parser/aligner defect.

### D — Controlled-write bug: REJECTED

P8E0 conclusively proved normalization is correct. Structural shells with non-A-F content SHOULD be rejected. LaTeX-command-wrapped values that don't match option labels SHOULD be rejected. Controlled-write is working correctly.

### E — Safe partial is correct; no improvement eligible: REJECTED

For answer 2 at least, the label IS present inside the LaTeX command. A safe text normalization improvement (unwrapping known-safe LaTeX commands) could potentially recover the label without weakening safety. For answers 8/9, the non-A-F letters suggest the OCR fundamentally misread the labels — improving this would require OCR model changes, not code changes.

### F — Evidence insufficient: REJECTED

P10C provided sufficient evidence. OCR raw answer shapes are captured via sanitized fingerprints.

## Final Decision: B

```
B — Answer extraction quality gap: raw exists but not labels-only.

Answer 2:   label present inside LaTeX command wrapping → eligible for text unwrapping improvement
Answers 8/9: structural shell captured but inner letters not valid labels → OCR quality limitation
```

## Next Stage

**P10E** — design safe answer extraction quality improvement.

Scope: 
- Text-level improvement: safely unwrap LaTeX command wrappers around answer labels
- Does NOT: relax normalization, accept non-labels, modify controlled-write policy
- Only improves the text preprocessing before normalization

## P10D Acceptance

```
[x] Per-question dropStage determined
[x] Q8/Q9 ocrRawObserved confirmed true
[x] Q8/Q9 ocrRawShape confirmed label-shell
[x] Decision: B — answer extraction quality gap
[x] No code modified in P10D
[x] Next: P10E
```
