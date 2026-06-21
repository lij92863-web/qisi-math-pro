# PDF Support Swing Root Cause Audit

Stage P3.1 is documentation-only. It compares the Attempt 11 and Attempt 12 swing and identifies the likely layer boundaries that must be tested before business-code changes.

## Attempt Comparison

| Attempt | Answer result | Solution result | Safe status | Primary symptom |
| --- | --- | --- | --- | --- |
| Attempt 11 | `10/12`; missing `8,9` | `12/12` | Not a complete baseline | Answer-side extraction/normalization incomplete while solution sequence was complete. |
| Attempt 12 | `12/12` | `2/12`; missing `3,4,5,6,7,8,9,10,13,15` | `pass-safe-partial` / `prefix` | Solution-side sequence became discontinuous, so safety gate kept only prefix `1,2`. |

## Sequence Matrix

| Layer | Attempt 11 evidence | Attempt 12 evidence | Audit note |
| --- | --- | --- | --- |
| `answerItems sequence` | Expected 12-question support sequence, but answer fields for `8,9` were not safely writable. | P2 fixture proves apparent answer sequence `1,2,3,4,5,6,7,8,9,10,13,15`. | Answer completeness alone must not unlock solution ownership. |
| `solutionItems sequence` | Solution sequence reached all expected numbers. | P2 fixture uses solution sequence `1,2,4,5,6,7,8,9,10,13,15`, missing `3`. | Once `3` is missing, later solutions are unsafe even if markers exist. |
| `expectedQuestionNumbers` | Expected structural set is `1,2,3,4,5,6,7,8,9,10,13,15`. | Same expected structural set. | `13` and `15` are expected only because the question contract explicitly includes them. |
| `safeQuestionNumbers` | Not established as final complete baseline because answer-side safety was incomplete. | Safe solution prefix is `1,2`. | Safe answer and safe solution sets must be validated independently and intersected at field level. |
| `fusedQuestionNumbers` | Answer-side incomplete questions should stay diagnostic rather than guessed. | P2 fixture expects `3,4,5,6,7,8,9,10,13,15`. | Fused numbers must be preserved through controlled write and review warnings. |
| `prefix cutoff reason` | Answer value/normalization gap around `8,9`. | Missing solution `3` creates sequence discontinuity; later solution ownership is unsafe. | The cutoff is structural, not semantic. |

## Layer Root-Cause Checklist

| Layer | Current risk | Required proof before code changes |
| --- | --- | --- |
| parser | Marker grammar changes can improve one field while disturbing the other. | Fixtures must separately assert answerItems and solutionItems sequences. |
| support-parser | Unknown or wrapped markers can create apparent coverage. | Unknown/out-of-range markers must be reported and must not become safe ownership. |
| block-parser | Missing field inside a block can create answer-only blocks. | Coverage reports must expose missing answer/solution by field. |
| aligner | If answer and solution sets are merged too early, one complete side may mask the incomplete side. | Independent answer/solution validation and safe prefix reporting. |
| parser gate | Parser output can be stricter than legacy support evidence. | Gate mode must remain `prefix` or `fail-closed` when sequence is discontinuous. |
| controlled-write | Legacy answers can be complete while parser solutions are partial. | Field-level write must allow safe answers without expanding unsafe solutions. |
| runner cleanup | Old draft rows/reports can make a partial run look complete. | Later runner diagnostics must record current run id and stale draft cleanup evidence. |
| review report | UI summaries derived from draft rows can miss source/report mismatch. | Review report source should be current-run diagnostics, not stale or merged state. |
| expectedQuestionNumbers | `13,15` are valid only when present in the explicit expected contract. | Tests must reject out-of-range numbers when not in the expected list. |

## Controlled-Write Effective Items

| Attempt | `effectiveAnswerItems` | `effectiveSolutionItems` | Required behavior |
| --- | --- | --- | --- |
| Attempt 11 | Expected to be missing or unsafe for `8,9` until structural answer evidence is safe. | Expected full `1,2,3,4,5,6,7,8,9,10,13,15`. | Do not invent answers `8,9`; preserve full solutions only when solution sequence is independently safe. |
| Attempt 12 | Can be full from safe answer evidence. | Must be only `1,2` in P2 fixture. | Do not let answer `12/12` expand solution ownership. |

## Parser Warnings And Aligner Reasons

Expected diagnostic categories for this swing:

- `missing solution` for question `3` in the Attempt 12 fixture.
- `answer-solution-question-set-mismatch` or equivalent sequence reason at aligner level.
- `prefix` mode rather than `full`.
- `fusedQuestionNumbers` containing `3,4,5,6,7,8,9,10,13,15`.
- No semantic explanation, keyword ownership, or special question fallback.

## Runner Cleanup Evidence Needed Later

P3.1 does not modify the runner. Later P6 work should require:

- run id and attempt id,
- input file identity,
- draft count before cleanup,
- draft count after cleanup,
- current-run-only report source,
- abort when stale report id is read,
- abort when draft cleanup fails.

Without that evidence, a stale successful draft could mask the Attempt 11/12 swing.

## Review Report Source

Current review summaries are derived from draft rows and warning fields. For PDF support governance, the report should later be tied to:

- parser block diagnostics,
- aligner report reasons,
- controlled-write summaries,
- fused question numbers,
- missing answer/solution lists,
- current run id.

## `13` And `15` Expected-Number Decision

In this audit, `13` and `15` are treated as expected because the structural expected contract is explicitly `1,2,3,4,5,6,7,8,9,10,13,15`.

They must not be treated as safe in any other fixture unless:

- `expectedQuestionNumbers` explicitly includes them,
- their sequence position is reliable,
- the relevant field sequence is continuous up to them,
- answer/solution ownership is independently safe for that field.

## Conclusion

The swing is not evidence that the system should patch missing fields by question number. It is evidence that answer and solution sequences can fail independently. The safe direction is fixture-first validation, independent sequence gates, field-level controlled write, and runner/report isolation before any complete baseline or real-run claim.
