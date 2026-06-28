# BM-AUTO A4 R3 Medium Remaining Register

Stage: BM-AUTO-A4-R3-MEDIUM-REMAINING
Branch: main
Commit: 46bac8f

## Summary

After AUTO_FIXTURE_CANDIDATE and PROVE_WITH_CONTEXT_FIXTURE both exhausted, 40 naked callsites remain.

| Category | Count |
| --- | ---: |
| Remaining naked | 40 |
| PROOF_REQUIRED (remaining) | 8 |
| DEFER | 11 |
| BLOCK | 21 |
| Explicit calls | 75 |
| Wrappers | 4 |

## Why Not Replaced

| Reason | Count |
| --- | ---: |
| PROOF_REQUIRED but not PROVE_WITH_CONTEXT_FIXTURE | 8 |
| DEFER requiring stronger proof | 11 |
| BLOCK requiring manual review | 21 |

## Remaining by Helper

| Helper | Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | ~17 |
| cleanDisplayOptionsForBatchSave | ~17 |
| addWarningOnce | ~5 |
| cleanDisplayFieldsOnly | ~1 |

## Required Future Evidence

All remaining callsites need:
- Stronger proof than current tooling provides
- Or manual per-callsite ownership analysis
- Or human review of controlled-write/PDF/support attachment adjacency

## Tests

verify:safe: passed / staged verifier: CALLSITE_PARTIAL (explicitCount: 75)

## Safety

No app.js or qisi-utils.js changes in this stage.

## Decision

Medium exhausted. 40 callsites require manual review or stronger tooling.
