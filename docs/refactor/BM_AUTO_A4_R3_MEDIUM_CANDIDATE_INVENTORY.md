# BM-AUTO A4 R3 Medium Candidate Inventory

Stage: BM-AUTO-A4-R3-MEDIUM-INVENTORY
Branch: main
Commit: e7b8dd5

## Summary

| Category | Count |
| --- | ---: |
| Remaining naked callsites | 45 |
| PROOF_REQUIRED | 13 |
| DEFER | 11 |
| BLOCK | 21 |
| PROVE_WITH_CONTEXT_FIXTURE (medium eligible) | 5 |

## Medium Candidates (PROVE_WITH_CONTEXT_FIXTURE)

| ID | Helper | Line | Score | Context |
| --- | --- | ---: | ---: | --- |
| R3-02819 | cleanDisplayTextForBatchSave | 2819 | 80 | DOCX batch-save stem cleanup |
| R3-02820 | cleanDisplayOptionsForBatchSave | 2820 | 80 | DOCX batch-save options cleanup |
| R3-16933 | cleanDisplayOptionsForBatchSave | 16933 | 80 | Batch save option count display |
| R3-19275 | cleanDisplayOptionsForBatchSave | 19275 | 80 | Draft option extraction |
| R3-13559 | cleanDisplayTextForBatchSave | 13559 | 75 | Patch stem processing |

## Not Safe For Medium

Remaining PROOF_REQUIRED (8), DEFER (11), and BLOCK (21) callsites are not eligible:
- Some have ownership risk that can't be resolved by context fixture
- Some require stronger proof than the current proof builder provides
- 21 are BLOCK_UNTIL_MANUAL requiring human review

## Medium Batch Rules

- Audit up to 5, replace up to 1 per batch
- Full safety required before each commit
- Only PROOF_REQUIRED + PROVE_WITH_CONTEXT_FIXTURE

## Tests

- verify:safe: passed
- verify:batch-safety: passed

## Safety

- controlled-write touched: no
- qisi-utils.js changed: no

## Decision

5 medium candidates eligible. Process one per batch with full safety.
