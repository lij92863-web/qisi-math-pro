# BM-AUTO Doc Audit Failure Inventory

Stage: BM-AUTO-DOC-AUDIT-FAILURE-INVENTORY
Branch: main
Generated at: 2026-06-28T10:59:00.444Z
Audit command: node scripts/bm-a4-doc-audit.js --write-report docs/refactor/BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md

## Summary

Docs checked: 159.
Total failures: 33.
Doc audit passed: no.
Rules: >= 20 lines, >= 5 sections, < 1200 max line.

## Failure Count By Class

| Class | Count |
| --- | ---: |
| literalBackslashN | 1 |
| todoMarker | 2 |
| pendingMarker | 10 |
| compressedRawLines | 3 |
| missingStageOrHistoricalNote | 9 |
| missingDecisionOrHistoricalStatus | 20 |
| missingValidationOrTests | 7 |
| missingSafety | 8 |

## Failure Count By Policy Class

| Policy Class | Count |
| --- | ---: |
| historical | 33 |

## Failure Table

| Index | File | Policy Class | Line Count | Heading Count | Max Line Length | hasLiteralBackslashN | hasTODO | hasPending | Missing Stage Or Historical Note | Missing Decision Or Historical Status | Missing Validation Or Tests | Missing Safety | Recommended Action | Reasons |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_010.md | historical | 93 | 12 | 161 | no | no | no | no | yes | yes | no | policy-exempt-with-marker | missing Decision or Historical status |
| 2 | BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_013.md | historical | 53 | 8 | 113 | no | no | no | no | yes | yes | no | policy-exempt-with-marker | missing Decision or Historical status |
| 3 | BM_AUTO_FULL_DEPENDENCY_ORDER_AFTER_013.md | historical | 49 | 9 | 106 | no | no | no | no | yes | yes | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 4 | BM_AUTO_FULL_ROUNDS_011_TO_013_AUDIT.md | historical | 84 | 7 | 325 | no | no | yes | no | no | no | no | fix | not-completed marker found |
| 5 | BM_AUTO_FULL_ROUND_006_PLAN.md | historical | 83 | 14 | 164 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 6 | BM_AUTO_FULL_ROUND_007_PLAN.md | historical | 82 | 14 | 210 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 7 | BM_AUTO_FULL_ROUND_007_REAL_MIGRATION.md | historical | 91 | 9 | 191 | no | no | yes | no | no | no | no | fix | not-completed marker found |
| 8 | BM_AUTO_FULL_ROUND_008_PLAN.md | historical | 82 | 14 | 210 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 9 | BM_AUTO_FULL_ROUND_008_REAL_MIGRATION.md | historical | 91 | 9 | 196 | no | no | yes | no | no | no | no | fix | not-completed marker found |
| 10 | BM_AUTO_FULL_ROUND_009_PLAN.md | historical | 57 | 8 | 109 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 11 | BM_AUTO_FULL_ROUND_009_REAL_MIGRATION.md | historical | 114 | 11 | 170 | no | no | yes | no | no | no | no | fix | not-completed marker found |
| 12 | BM_AUTO_FULL_ROUND_010_PLAN.md | historical | 53 | 7 | 94 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 13 | BM_AUTO_FULL_ROUND_010_SYNC_CORRECTION.md | historical | 51 | 6 | 95 | no | no | yes | no | no | no | yes | fix | not-completed marker found |
| 14 | BM_AUTO_FULL_ROUND_011_PLAN.md | historical | 49 | 7 | 81 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 15 | BM_AUTO_FULL_ROUND_012_PLAN.md | historical | 48 | 7 | 85 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 16 | BM_AUTO_FULL_ROUND_013_PLAN.md | historical | 50 | 7 | 139 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 17 | BM_AUTO_FULL_ROUND_014_PLAN.md | historical | 5 | 1 | 200 | no | no | no | no | yes | yes | yes | archive-normalize | less than 10 physical lines (5); missing Decision or Historical status |
| 18 | BM_AUTO_FULL_ROUND_014_REAL_MIGRATION.md | historical | 9 | 1 | 94 | no | no | no | no | yes | no | no | archive-normalize | less than 10 physical lines (9); missing Decision or Historical status |
| 19 | BM_AUTO_FULL_ROUND_014_SYNC.md | historical | 2 | 0 | 59 | no | no | no | yes | yes | yes | yes | archive-normalize | less than 10 physical lines (2); missing Stage or Historical note; missing Decision or Historical status |
| 20 | BM_AUTO_FULL_STOP_NO_ELIGIBLE_LOW_RISK_HELPER.md | historical | 70 | 10 | 209 | no | no | no | yes | yes | yes | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 21 | BM_AUTO_GATE_CORRECTION.md | historical | 56 | 7 | 322 | no | no | no | yes | no | no | yes | policy-exempt-with-marker | missing Stage or Historical note |
| 22 | BM_AUTO_GATE_RERUN.md | historical | 135 | 14 | 98 | no | yes | no | yes | yes | no | no | fix | to-do marker found; missing Stage or Historical note; missing Decision or Historical status |
| 23 | BM_AUTO_GATE_VERIFICATION.md | historical | 162 | 16 | 164 | no | yes | no | yes | yes | no | no | fix | to-do marker found; missing Stage or Historical note; missing Decision or Historical status |
| 24 | BM_AUTO_GROUPED_HELPER_CHAIN_B_PLAN.md | historical | 14 | 1 | 199 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 25 | BM_AUTO_GROUPED_HELPER_CHAIN_B_REAL_MIGRATION.md | historical | 128 | 14 | 335 | yes | no | no | no | no | no | no | archive-normalize | 3 lines use escaped backslash-n as line separator |
| 26 | BM_AUTO_GROUPED_HELPER_CHAIN_B_SYNC.md | historical | 28 | 4 | 100 | no | no | yes | no | no | no | yes | fix | not-completed marker found |
| 27 | BM_AUTO_GROUPED_HELPER_GATE.md | historical | 148 | 21 | 297 | no | no | yes | no | no | yes | no | fix | not-completed marker found |
| 28 | BM_AUTO_MIGRATION_PROTOCOL.md | historical | 199 | 19 | 150 | no | no | no | yes | no | no | no | policy-exempt-with-marker | missing Stage or Historical note |
| 29 | BM_AUTO_ROUND_1_PLAN.md | historical | 93 | 17 | 311 | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 30 | BM_AUTO_ROUND_1_REAL_MIGRATION.md | historical | 209 | 38 | 283 | no | no | yes | no | no | no | no | fix | not-completed marker found |
| 31 | BM_AUTO_ROUND_2_PLAN.md | historical | 77 | 17 | 142 | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 32 | BM_AUTO_ROUND_2_REAL_MIGRATION.md | historical | 145 | 30 | 140 | no | no | yes | no | no | no | no | fix | not-completed marker found |
| 33 | BM_AUTO_STRICT_RUN_CORRECTION.md | historical | 105 | 12 | 121 | no | no | yes | no | no | no | no | fix | not-completed marker found |

## Validation

This report is generated by `scripts/bm-a4-doc-audit.js`.

## Safety

This report is documentation-only. No production code is changed by generating it.

## Decision

Doc audit accepted: no.

