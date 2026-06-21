# PDF Support Controlled Write Answer Rejection Taxonomy

## Stage

P8C — classify controlled-write answer rejection reasons

## Objective

把 `parser-objective-answer-rejected` 细化为更明确的 `rejectionCode` / `rejectionDetail` / `normalizedCandidate` / `answerEvidence`。

P8C 不让 answer 2/8/9 通过。只改善诊断能力。

## Rejection Taxonomy

### Overview

Each rejected objective answer in controlled-write now carries:

| Field | Type | Description |
| --- | --- | --- |
| `code` | string | `parser-objective-answer-rejected` (unchanged, backward compatible) |
| `reason` | string | Original coarse reason from `normalizeObjectiveAnswerToLabels` (unchanged) |
| `rejectionCode` | string | **NEW** — fine-grained machine-readable rejection code |
| `rejectionDetail` | string | **NEW** — human-readable explanation of why the reject happened |
| `normalizedCandidate` | string | **NEW** — what the structural normalizer attempted, if applicable |
| `answerEvidence` | object | **NEW** — evidence context from the parser answer item |
| `structuralCandidate` | boolean | unchanged |
| `structuralReason` | string | unchanged |
| `originalAnswer` | string | unchanged |

### rejectionCode Values

| rejectionCode | Coarse reason | When triggered |
| --- | --- | --- |
| `rejection-option-value-not-matched` | `option-value-not-matched` | Single-choice: value does not match any option text |
| `rejection-ambiguous-option-value` | `ambiguous-option-value` | Single-choice: value matches multiple options |
| `rejection-options-missing` | `options-missing` | Draft has no options defined |
| `rejection-unsafe-math-command` | `unsafe-math-command` | Structural shell with unsafe LaTeX math |
| `rejection-invalid-option-label` | `invalid-option-label` | Looks like labels but some are invalid |
| `rejection-invalid-structural-label` | `invalid-structural-option-label` | Structural shell compacts to labels, but some are invalid |
| `rejection-not-structural-shell` | `not-structural-label-shell` | Answer does not match structural shell pattern |
| `rejection-multi-option-value-rejected` | `multiple-option-value-rejected` | Multi-choice: value cannot be safely segmented |
| `rejection-multi-value-not-matched` | `multiple-option-value-not-matched` | Multi-choice: segmented value does not match uniquely |
| `rejection-ambiguous-multi-value` | `ambiguous-multiple-option-value` | Multi-choice: segmented value matches multiple options |
| `unknown-objective-answer-rejection` | (unrecognized) | Fallback for any unrecognized rejection reason |

### answerEvidence Structure

| Field | Type | Description |
| --- | --- | --- |
| `hasQuestionMarker` | boolean | Whether the parser answer item has a question marker |
| `hasAnswerLabel` | boolean | Whether the parser answer item has an answer label marker |
| `evidenceLevel` | string | `explicit-marker`, `section-marker`, or `unsafe` |
| `sourceTraceAvailable` | boolean | Whether rawBlockExcerpt exists in sourceTrace |
| `label` | string | The detected answer label text |

### normalizedCandidate Format

- Empty string when no structural candidate was attempted
- `structural-candidate:<reason>:<answer>` when structural normalizer produced an answer (even if rejected)
- `structural-candidate:<reason>` when structural candidate was detected but no answer produced

## P7 Answer Classification

| Question | rejectionCode | Reason | Diagnostic |
| --- | --- | --- | --- |
| 2 | `rejection-option-value-not-matched` | Value does not match any option | Single-choice, answer text not an option label and not matching any option text. |
| 8 | `rejection-multi-option-value-rejected` | Non-label-payload structural shell | Multi-choice, structural shell `}X_\A{Y}` detected but compacts to non-A-F payload `XY`. |
| 9 | `rejection-multi-option-value-rejected` | Non-label-payload structural shell | Multi-choice, structural shell `}P_\A{Q}` detected but compacts to non-A-F payload `PQ`. |

## Safety Invariants Preserved

- `code: 'parser-objective-answer-rejected'` remains on every rejected answer
- `reason`, `originalAnswer`, `structuralCandidate`, `structuralReason` all preserved
- New fields are additive only — rejected answers remain rejected
- Unknown rejection reasons map to `unknown-objective-answer-rejection` (fail-safe fallback)
- No change to parser, aligner, or runner

## Implementation

- New function: `classifyObjectiveAnswerRejection(reason, structuralDiagnostic, answerItem, draft)` in `qisi-pdf-support-controlled-write.js`
- Called in `buildPdfSupportFieldLevelControlledWrite` at the point where rejection warnings are pushed
- Exported for testing and external use

## Tests Added

| Test | What it verifies |
| --- | --- |
| P8C rejection taxonomy provides rejectionCode for each rejected answer | All 3 rejected answers have rejectionCode, rejectionDetail, normalizedCandidate, answerEvidence |
| P8C rejection taxonomy preserves old warning code | All warnings still have `code: parser-objective-answer-rejected`, `reason`, `structuralCandidate`, `originalAnswer` |
| P8C classifier returns unknown-objective-answer-rejection for unrecognized reason | Fallback works for future/new reasons |
| P8C normal objective answer still accepted | Normalization still works, no regression |
| P8C empty answer is rejected | Empty answer does not silently pass |
| P8C unsafe math command taxonomy | `unsafe-math-command` maps to `rejection-unsafe-math-command` |

## Next Stage: P8D

P8D will fix runner summary consistency:
- Runner report must not treat draft snapshot answer numbers as baseline accepted
- Answer 2 (controlled-write rejected) must not appear in baseline accepted set
- ParserGate full must not be reported as complete when controlled-write is incomplete
