# P9J Single Truth Gate Invariant: controlled-write 唯一事实源

## Stage

P9J — enforce controlled-write as the only truth gate for complete/pass-safe-partial/failed classification

## Principle

```
controlled-write = 唯一 truth gate
```

Any complete / baseline / accepted / rejected decision must ultimately be rooted in `buildPdfSupportFieldLevelControlledWrite` output.

## Layer Authority

| Layer | Can | Cannot |
| --- | --- | --- |
| **Parser / Block Parser** | Parse raw text into support items with sourceTrace and evidence | Decide field-level safety |
| **Sequence Validator** | Validate structural continuity of answer/solution sequences | Inspect answer/solution content |
| **Aligner** | Map validator result to safe item sets (full/prefix/fail-closed) | Expand ownership beyond validator |
| **Parser Gate** | Assemble parser + aligner output into unified safe items | Make field-level write decisions |
| **Controlled Write** | **THE TRUTH GATE**: decide which answer/solution fields are safe to write, reject unsafe ones | N/A — this is the final authority |
| **Runner / Draft Snapshot** | Observe what was written to draft (including repair path fills) | Determine baseline accepted — must read from controlled-write |
| **Rejection Taxonomy** | Classify rejection reasons for diagnostics | Change accepted/rejected results |

## Complete Baseline Candidate Formula

```text
isComplete = ALL of:
    1. controlledWriteAcceptedAnswerNumbers === expectedQuestionNumbers (full set)
    2. controlledWriteAcceptedSolutionNumbers === expectedQuestionNumbers (full set)
    3. controlledWriteRejectedAnswerNumbers === [] (empty)
    4. controlledWriteRejectedSolutionNumbers === [] (empty)
    5. fusedQuestionNumbers === [] (empty)
    6. parserGateMode === "full"
    7. no safety warnings (parser-objective-answer-rejected, sequence-unreliable, etc.)
    8. known-bad passed
    9. DOCX stable passed
```

## Pass-Safe-Partial Formula

```text
isPassSafePartial = ALL of:
    1. NOT isComplete
    2. No wrong attachment (known-bad safe, no semantic guessing, no special fallback)
    3. known-bad passed
    4. DOCX stable passed

Typically caused by:
    - controlledWriteAcceptedAnswerNumbers incomplete (missing answers)
    - controlledWriteRejectedAnswerNumbers non-empty
    - fusedQuestionNumbers non-empty
    - parserGateMode not "full"
```

After pass-safe-partial: **no baseline, no freeze, no tag**.

## Why ParserGate Full ≠ Complete

Parser gate full means the structural sequences of answer and solution items are continuous and match expected numbers. It does NOT mean each field value is safe to write.

Example: P7 had parserGate full (12/12 blocks) but controlled-write rejected answers 2, 8, 9 due to unnormalizable answer values. ParserGate can confirm structure, but controlled-write must confirm content.

## Why Draft Snapshot ≠ Baseline Accepted

The draft snapshot records what was ultimately written to draft questions. This may include answers filled by:
- The repair pathway (e.g., extracting answer from solution text "故选C")
- Legacy path overrides
- UI-side adjustments

These fills happened AFTER controlled-write. They are NOT validated by the truth gate. Therefore, draft snapshot answers must not be treated as baseline accepted.

P8D fixed this by introducing `baselineCandidateAnswerNumbers = controlledWriteAccepted ∩ draftSnapshotAnswers`.

## Why Rejection Code Cannot Unlock Answers

The rejection taxonomy (`classifyObjectiveAnswerRejection`) enriches rejection warnings with diagnostic metadata (rejectionCode, rejectionDetail, answerEvidence). It does NOT participate in the accept/reject decision. The decision was already made by `normalizeObjectiveAnswerToLabels` returning `ok: false`.

Reading the taxonomy to "if rejectionCode is X, accept anyway" would be a safety violation.

## Constraint on P9I UI

When the review page displays answer status:
- "Accepted" must mean controlledWriteAccepted
- "Rejected" must mean controlledWriteRejected
- "Missing" must mean not in controlledWriteAccepted AND not in draft snapshot
- The UI must not use draft snapshot numbers to claim "12/12 complete" when controlled-write has rejections

## Tests Enforcing This Invariant

| Test | What It Verifies |
| --- | --- |
| P9J parserGate full alone does not determine complete | parser full + cw rejected → not complete |
| P9J complete baseline requires all acceptances | 5 sub-cases: complete, missing, rejected, fused, prefix |
| P9J draft snapshot larger than cw accepted | draft 10/12, cw 5/12 → baseline from cw, not draft |
| P9J cwAccepted is only truth source | P7 and P8G baseline candidates computed from cw only |
| P9J taxonomy is diagnostic only | Enriching warnings doesn't change accepted/rejected sets |
