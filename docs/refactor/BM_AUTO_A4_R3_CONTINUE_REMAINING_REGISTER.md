# BM-AUTO A4 R3 Continue Remaining Register

Stage: BM-AUTO-A4-R3-CONTINUE-REMAINING
Branch: main
Commit: 46533b1

## Summary

After AUTO_FIXTURE_CANDIDATE exhaustion, 45 naked callsites remain unprocessed.

| Category | Count |
| --- | ---: |
| Remaining naked callsites | 45 |
| AUTO_FIXTURE_CANDIDATE (exhausted) | 0 |
| PROOF_REQUIRED (medium candidates) | 13 |
| DEFER_UNLESS_STRONG_FIXTURE | 11 |
| BLOCK_UNTIL_MANUAL | 21 |
| Controlled-write blocked | 0 |
| PDF ownership risk | ~5 |
| Support attachment risk | ~15 |
| Answer/solution ownership risk | ~20 |
| Manual review required | 21 |

## Providers Breakdown

| Helper | Remaining |
| --- | ---: |
| cleanDisplayTextForBatchSave | ~18 |
| cleanDisplayOptionsForBatchSave | ~18 |
| addWarningOnce | ~7 |
| cleanDisplayFieldsOnly | ~2 |

## PROOF_REQUIRED Candidates

13 callsites classified as PROOF_REQUIRED. Of these, 5 have proofDecision PROVE_WITH_CONTEXT_FIXTURE and are eligible for medium batch processing.

## DEFER Candidates

11 callsites classified as DEFER_UNLESS_STRONG_FIXTURE. These require stronger proof before fixture generation.

## BLOCK Candidates

21 callsites classified as BLOCK_UNTIL_MANUAL. These have ownership risks that require human review.

## Tests

- verify:safe: passed
- staged verifier: CALLSITE_PARTIAL (explicitCount: 70)

## Safety

- app.js changed: no in this stage
- qisi-utils.js changed: no
- controlled-write touched: no
- parser/aligner/runner touched: no
- Route B integrated: no

## Decision

AUTO_FIXTURE_CANDIDATE exhausted. 5 medium candidates eligible for PROVE_WITH_CONTEXT_FIXTURE processing.
Remaining callsites require stronger proof or manual review.
