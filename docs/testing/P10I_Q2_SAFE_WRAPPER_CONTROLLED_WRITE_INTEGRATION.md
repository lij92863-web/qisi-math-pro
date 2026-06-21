# P10I-Q2 Safe Wrapper Controlled-Write Integration

## Stage

P10I-Q2 — integrate safe wrapper candidate evidence enrichment inside controlled-write truth gate

## Problem

OCR produces `\A{A}` — label `A` wrapped in a safe LaTeX command. The existing `normalizeObjectiveAnswerToLabels` correctly rejects this (not a valid label pattern). But the label IS extractable.

## Solution

Added a **pre-normalization evidence enrichment adapter** in `buildPdfSupportFieldLevelControlledWrite`:

1. First normalization attempt fails → enters rejection branch
2. Before recording rejection, call `classifyAnswerExtractionQuality(rawAnswer)`
3. If status is `clean-label` or `safe-wrapper-candidate` with non-null `normalizedCandidate`:
   - Re-normalize the candidate through `normalizeObjectiveAnswerToLabels` (full re-validation)
   - If passes → accept with evidence path `extraction-enrichment:<status>:<reasonCode>`
4. If classifier unavailable or candidate invalid → keep original rejection

## Changes

### `qisi-pdf-support-controlled-write.js`

- Added `getAnswerExtractionQualityClassifier()` — safe cross-environment access
- In objective answer rejection branch (~30 lines): classifier call → re-validation → accept or fall through to original rejection
- New field on accepted items: `extractionQualityCandidate: true`

## What Works

| Input | First Attempt | Classifier | Re-validation | Result |
| --- | --- | --- | --- | --- |
| `\A{A}` | Rejected (option-value-not-matched) | safe-wrapper-candidate `A` | ok: `A` | **Accepted** |
| `\text{B}` | Rejected | safe-wrapper-candidate `B` | ok: `B` | **Accepted** |
| `}X_\A{Y}` | Rejected (non-label-payload) | dirty-structural-shell null | — | **Rejected** ✅ |
| `\frac{A}{B}` | Rejected | dirty-structural-shell null | — | **Rejected** ✅ |
| `}B_\A{D}` | Accepted (structural-option-label-normalized) | — | — | Accepted (first attempt) |

## Safety

- Classifier is NEVER used as direct acceptance
- Every candidate goes through full `normalizeObjectiveAnswerToLabels` re-validation
- `dirty-structural-shell` → `normalizedCandidate` is null → no enrichment attempted
- controlled-write remains the only truth gate
- No parser/aligner/runner changes
