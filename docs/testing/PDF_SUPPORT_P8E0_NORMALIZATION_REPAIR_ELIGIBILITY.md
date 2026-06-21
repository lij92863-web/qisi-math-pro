# PDF Support P8E0 Normalization Repair Eligibility Audit

## Stage

P8E0 — objective answer normalization repair eligibility audit (read-only)

## Objective

Determine whether P7 rejected answers 2, 8, and 9 have sufficient structural evidence to justify a normalization repair in P8E1.

## Assessment Per Answer

### Answer 2

| Criterion | Assessment |
| --- | --- |
| Question marker | `section-marker` (implicit from expectedQuestionNumbers) |
| Answer label | Present (residual marker pattern) |
| sourceTrace | Available (rawBlockExcerpt exists) |
| evidenceLevel | `section-marker` |
| originalAnswer type | Non-structural value |
| normalizedCandidate | None (not a structural shell) |
| Rejection reason | `option-value-not-matched` |
| Structural shell detected | No — `not-structural-label-shell` |
| Unsafe math command | No |
| Empty answer | No |
| Out-of-range | No |
| Unknown block | No |
| Requires semantic guessing | Would require guessing to match to an option |

**Decision: NOT ELIGIBLE.**

Answer 2 is a genuine non-match. The answer text does not match any option value and is not a structural label shell. There is no normalization "mis-fire" to repair — the controlled-write correctly rejected a value that cannot be safely normalized to an option label.

The fact that answer 2 appeared in the draft snapshot (P7) suggests a separate draft population path (review/repair) filled it, not that controlled-write erroneously rejected it. This is a P8D-level summary consistency issue, now fixed.

### Answer 8

| Criterion | Assessment |
| --- | --- |
| Question marker | `section-marker` (implicit from expectedQuestionNumbers) |
| Answer label | Present (residual marker pattern) |
| sourceTrace | Available |
| evidenceLevel | `section-marker` |
| originalAnswer type | Structural shell (`}_` pattern detected) |
| Structural candidate | Yes |
| Structural reason | `non-label-payload` |
| Rejection reason | `multiple-option-value-rejected` |
| Compact result | Non-A-F content (X and Y in fixture model) |
| Unsafe math command | No |
| Empty answer | No |
| Requires semantic guessing | Would be required |

**Decision: NOT ELIGIBLE.**

Answer 8 was correctly identified as a structural shell. However, after removing LaTeX commands and structural wrappers, the remaining content contained characters outside the A-F label range (`non-label-payload`). This means the answer payload genuinely cannot be interpreted as valid option labels.

Evidence that the system handles structural shells correctly when labels ARE valid:
- The `case02AnswerMissing89Fixture` shows that `}B_\A{D}` → `BD` (valid labels) → accepted
- The `p7AnswerRejectionFixture` shows that `}X_\A{Y}` → `XY` (non-labels) → rejected

The `non-label-payload` result means the P7 answer 8 content was structurally a shell but contained non-label characters — a genuine rejection, not a normalization mis-fire.

### Answer 9

Same assessment as Answer 8. Structural shell detected, compaction yielded `non-label-payload`.

**Decision: NOT ELIGIBLE.**

## Aggregate Decision

```
P8E NOT ALLOWED: insufficient structural evidence.

For answer 2:     genuinely unmatched value, not a normalization issue.
For answers 8/9:  structural shells with non-label-payload — 
                  content after compaction cannot be interpreted as A-F labels.
                  This is correct fail-closed behavior, not a repair opportunity.

Next: skip P8E1, continue to P8F (pre-real-run gate).
```

## Normalization Behavior Confirmed Correct

The `normalizeObjectiveAnswerToLabels` function correctly:

1. **Accepts** structural shells with valid A-F labels (e.g., `}B_\A{D}` → `BD`)
2. **Rejects** structural shells with non-A-F content (e.g., `}X_\A{Y}` → `XY`)
3. **Rejects** non-matching values (e.g., `P7_MISMATCHED_ANSWER_2`)
4. **Rejects** unsafe math commands (e.g., `A_\frac{B}`)
5. **Rejects** empty answers
6. **Accepts** plain option labels (e.g., `A`, `ACD`)

No normalization repair is warranted. The rejections are structurally correct.

## P8E0 Tests

```
npm run verify:safe    → 137/137 pass
npm run verify:batch-safety → all pass
npm run verify:diff-scope    → passed
```

## Next Stage

**P8F** — pre-real-run full regression gate.
