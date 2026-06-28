# BM-AUTO A4 R3 Full Proof Inventory Summary

Stage: BM-AUTO-A4-R3-FULL-PROOF-INVENTORY-SUMMARY
Branch: main
Start commit: b5f2298

## Summary

| Category | Count |
| --- | ---: |
| Total remaining callsites | 105 |
| AUTO_FIXTURE_CANDIDATE | 60 |
| PROOF_REQUIRED | 13 |
| DEFER_UNLESS_STRONG_FIXTURE | 11 |
| BLOCK_UNTIL_MANUAL | 21 |
| ALWAYS_BLOCK | 0 |
| DEFER | 0 |
| Proof replacementAllowed | 72 |
| Proof blocked | 30 |
| Proof deferred | 3 |

## Batch execution plan

Replace up to 3 per batch across ~24 batches.
Each batch: write fixtures, apply replacements, test, commit.

## Decision

Proceed to automatic micro-batch replacement loop.
