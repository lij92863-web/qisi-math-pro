# BM-AUTO A4 R3 Residual State Inventory

Stage: BM-AUTO-A4-R3-RESIDUAL-STATE-INVENTORY

Branch: main

Start commit: 5f258add994668d49de2e39514a48165e1a114e3

## Current State

Current naked callsites: 40.

Current explicit module callsites: 75.

Wrappers remain: 4.

Staged verifier classification: CALLSITE_PARTIAL.

The local before snapshot `.bm_a4_app_before.js` exists and was used by the staged verifier. It is locally ignored through `.git/info/exclude` and is not tracked for commit.

## Remaining By Helper

| Helper | Remaining naked callsites |
| --- | ---: |
| cleanDisplayTextForBatchSave | 13 |
| cleanDisplayOptionsForBatchSave | 11 |
| addWarningOnce | 15 |
| cleanDisplayFieldsOnly | 1 |

## Remaining By Rank Decision

| Rank decision | Count |
| --- | ---: |
| AUTO_FIXTURE_CANDIDATE | 0 |
| PROOF_REQUIRED | 8 |
| DEFER_UNLESS_STRONG_FIXTURE | 11 |
| BLOCK_UNTIL_MANUAL | 21 |
| ALWAYS_BLOCK | 0 |
| DEFER | 0 |

## Remaining By Proof Decision

| Proof decision | Count |
| --- | ---: |
| Replacement allowed | 7 |
| Blocked | 30 |
| Deferred | 3 |

## Remaining By Ownership Risk

The existing proof inventory blocks 30 callsites and attributes the current blocked set to answer/solution ownership risk. No residual callsite is safe for direct replacement without the stronger residual proof tools requested by this campaign.

## Remaining By Support Risk

Candidate ranking flags support attachment risk on at least these residual callsites:

| ID | Helper | Line |
| --- | --- | ---: |
| R3-07215 | cleanDisplayTextForBatchSave | 7215 |
| R3-13714 | cleanDisplayOptionsForBatchSave | 13714 |
| R3-13758 | cleanDisplayOptionsForBatchSave | 13758 |
| R3-13859 | cleanDisplayOptionsForBatchSave | 13859 |

## Remaining By Answer/Solution Risk

Candidate ranking flags answer/solution ownership risk on 21 BLOCK_UNTIL_MANUAL callsites. The proof inventory also blocks 30 callsites as `BLOCK_ANSWER_SOLUTION_OWNERSHIP`.

## Remaining By Controlled-Write Risk

The current candidate ranking reports no `ALWAYS_BLOCK` residual callsites. Controlled-write adjacency still requires the new ownership trace and field mutation map tools before any residual replacement can be approved.

## Top Possible False-Positive Blocked Candidates

The current proof builder marks these blocked-by-rank warning callsites as replacement-allowed with synthetic proof, making them possible false-positive blocked candidates for the stronger proof campaign:

| ID | Helper | Line | Rank decision | Proof |
| --- | --- | ---: | --- | --- |
| R3-07444 | addWarningOnce | 7444 | BLOCK_UNTIL_MANUAL | PROVE_WITH_SYNTHETIC_FIXTURE |
| R3-18952 | addWarningOnce | 18952 | BLOCK_UNTIL_MANUAL | PROVE_WITH_SYNTHETIC_FIXTURE |
| R3-18971 | addWarningOnce | 18971 | BLOCK_UNTIL_MANUAL | PROVE_WITH_SYNTHETIC_FIXTURE |
| R3-19212 | addWarningOnce | 19212 | BLOCK_UNTIL_MANUAL | PROVE_WITH_SYNTHETIC_FIXTURE |

## Top Possible Display-Only Candidates

| ID | Helper | Line | Rank decision |
| --- | --- | ---: | --- |
| R3-02402 | cleanDisplayTextForBatchSave | 2402 | PROOF_REQUIRED |
| R3-02403 | cleanDisplayTextForBatchSave | 2403 | PROOF_REQUIRED |
| R3-06869 | cleanDisplayOptionsForBatchSave | 6869 | PROOF_REQUIRED |
| R3-09936 | cleanDisplayOptionsForBatchSave | 9936 | PROOF_REQUIRED |
| R3-15396 | cleanDisplayOptionsForBatchSave | 15396 | PROOF_REQUIRED |
| R3-19257 | cleanDisplayOptionsForBatchSave | 19257 | PROOF_REQUIRED |
| R3-19335 | cleanDisplayOptionsForBatchSave | 19335 | PROOF_REQUIRED |

## Top Possible Warning-Only Candidates

| ID | Helper | Line | Rank decision | Proof |
| --- | --- | ---: | --- | --- |
| R3-20032 | addWarningOnce | 20032 | PROOF_REQUIRED | blocked: BLOCK_ANSWER_SOLUTION_OWNERSHIP |
| R3-07342 | addWarningOnce | 7342 | DEFER_UNLESS_STRONG_FIXTURE | PROVE_WITH_SYNTHETIC_FIXTURE |
| R3-19010 | addWarningOnce | 19010 | DEFER_UNLESS_STRONG_FIXTURE | PROVE_WITH_SYNTHETIC_FIXTURE |
| R3-18247 | addWarningOnce | 18247 | DEFER_UNLESS_STRONG_FIXTURE | PROVE_WITH_SYNTHETIC_FIXTURE |

## Top Possible Local-Cleanup-Only Candidates

| ID | Helper | Line | Rank decision |
| --- | --- | ---: | --- |
| R3-19013 | cleanDisplayFieldsOnly | 19013 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-06989 | cleanDisplayTextForBatchSave | 6989 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-14545 | cleanDisplayTextForBatchSave | 14545 | DEFER_UNLESS_STRONG_FIXTURE |

## Decision

Residual inventory is complete for the current baseline.

Do not remove wrappers. The staged verifier remains `CALLSITE_PARTIAL`, with 40 naked helper callsites.

Do not replace any residual callsite from this inventory alone. Continue with the ownership trace, field mutation map, residual proof, and freeze register tools before any replacement.
