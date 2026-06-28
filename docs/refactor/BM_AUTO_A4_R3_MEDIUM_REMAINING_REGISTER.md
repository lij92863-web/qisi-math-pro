# BM-AUTO A4 R3 Medium Remaining Register

Stage: BM-AUTO-A4-R3-MEDIUM-REMAINING-REGISTER
Branch: main
Status: active register after medium campaign

## Summary

| Item | Count |
| --- | --- |
| Remaining naked callsites | 40 |
| Deferred callsites | 19 |
| Blocked callsites | 21 |
| Unknown callsites | 0 |
| Wrappers remain | 4 |

## Remaining Categories

| Category | Count | Meaning |
| --- | --- | --- |
| PROOF_REQUIRED / deferred | 19 | Requires stronger context proof before replacement. |
| BLOCK_UNTIL_MANUAL | 21 | Not eligible for automatic replacement under current safety rules. |
| UNKNOWN | 0 | No unknown callsites remain. |

## Ownership Risks

The remaining callsites must not be replaced unless the next proof stage can show all of the following:

- no controlled-write adjacency
- no PDF ownership mutation
- no support attachment mutation
- no answer ownership mutation
- no solution ownership mutation
- no hidden save/draft persistence change
- no behavior change in DOCX+DOCX stable chain

## Required Future Evidence

Each remaining callsite needs a dedicated record with:

1. callsite id
2. helper name
3. source line
4. parent function
5. local context
6. ownership-risk analysis
7. fixture tag
8. expected behavior before replacement
9. expected behavior after replacement
10. final replace/defer/block decision

## Validation

| Check | Result |
| --- | --- |
| staged verifier | CALLSITE_PARTIAL |
| verify:safe | passed |
| verify:pdf-known-bad | passed |
| controlled-write ownership | passed |

## Safety

No production code is modified by this register. The register is documentation-only.

## Decision

- Remaining register accepted: yes.
- Automatic replacement is not allowed for blocked callsites.
- Wrapper removal is not allowed while 40 naked callsites remain.

