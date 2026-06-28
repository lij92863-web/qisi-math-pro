# BM-AUTO Doc Audit Failure Inventory

Stage: BM-AUTO-DOC-AUDIT-FAILURE-INVENTORY
Branch: main
Generated at: 2026-06-28T10:54:24.082Z
Audit command: node scripts/bm-a4-doc-audit.js --write-report docs/refactor/BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md

## Summary

Docs checked: 156.
Total failures: 63.
Doc audit passed: no.
Rules: >= 20 lines, >= 5 sections, < 1200 max line.

## Failure Count By Class

| Class | Count |
| --- | ---: |
| literalBackslashN | 9 |
| todoMarker | 7 |
| pendingMarker | 16 |
| compressedRawLines | 7 |
| missingStageOrHistoricalNote | 13 |
| missingDecisionOrHistoricalStatus | 33 |
| missingValidationOrTests | 20 |
| missingSafety | 21 |

## Failure Count By Policy Class

| Policy Class | Count |
| --- | ---: |
| historical | 52 |
| active | 11 |

## Failure Table

| Index | File | Policy Class | Line Count | Heading Count | Max Line Length | hasLiteralBackslashN | hasTODO | hasPending | Missing Stage Or Historical Note | Missing Decision Or Historical Status | Missing Validation Or Tests | Missing Safety | Recommended Action | Reasons |
| ---: | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | BM_AUTO_A4_R3_AUTO_BATCH_R3-AUTO-BATCH-006.md | historical | 26 | 4 | 204 | yes | no | no | no | no | yes | yes | archive-normalize | 3 lines use escaped backslash-n as line separator |
| 2 | BM_AUTO_A4_R3_COMMITTED_DOC_NEWLINE_FIX.md | active | 71 | 11 | 302 | yes | no | no | no | no | no | no | archive-normalize | 3 lines use escaped backslash-n as line separator |
| 3 | BM_AUTO_A4_R3_DOC_AUDIT_RAW_LINE_FIX.md | active | 54 | 8 | 219 | yes | no | no | no | no | no | no | archive-normalize | 1 lines use escaped backslash-n as line separator |
| 4 | BM_AUTO_A4_R3_PROGRESS_REPORT.md | historical | 46 | 10 | 119 | no | no | no | no | yes | yes | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 5 | BM_AUTO_A4_R3_REMAINING_CALLSITES_FINAL.md | historical | 67 | 13 | 178 | no | no | no | no | yes | yes | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 6 | BM_AUTO_A4_R3_RESIDUAL_FREEZE_FINAL.md | active | 79 | 5 | 255 | no | no | no | no | no | yes | yes | investigate | missing Safety; missing Tests or Validation |
| 7 | BM_AUTO_A4_R3_RESIDUAL_PROOF.md | active | 67 | 5 | 212 | no | no | no | no | no | yes | yes | investigate | missing Safety; missing Tests or Validation |
| 8 | BM_AUTO_A4_R3_RESIDUAL_RECLASSIFICATION.md | active | 59 | 5 | 226 | no | no | no | no | no | yes | yes | investigate | missing Safety; missing Tests or Validation |
| 9 | BM_AUTO_A4_R3_RESIDUAL_STATE_INVENTORY.md | active | 119 | 14 | 244 | no | no | no | no | no | yes | yes | investigate | missing Safety; missing Tests or Validation |
| 10 | BM_AUTO_A4_R3_RESIDUAL_STOP_DOC_AUDIT_FAILED.md | active | 116 | 13 | 242 | no | yes | yes | no | yes | no | no | fix | pending marker found; TODO marker found; missing Decision |
| 11 | BM_AUTO_A4_R3_RESIDUAL_WRAPPER_REMOVAL_GATE.md | active | 42 | 4 | 82 | no | no | no | no | no | yes | no | investigate | missing Tests or Validation |
| 12 | BM_AUTO_A4_R3_SHARD_R3-S003.md | historical | 7 | 1 | 165 | no | no | no | no | yes | yes | yes | archive-normalize | less than 10 physical lines (7); missing Decision or Historical status |
| 13 | BM_AUTO_A4_R3_SHARD_R3-S004.md | historical | 7 | 1 | 134 | no | no | no | no | yes | yes | yes | archive-normalize | less than 10 physical lines (7); missing Decision or Historical status |
| 14 | BM_AUTO_A4_R3_SHARD_R3-S005.md | historical | 7 | 1 | 204 | no | no | no | no | yes | yes | yes | archive-normalize | less than 10 physical lines (7); missing Decision or Historical status |
| 15 | BM_AUTO_A4_R3_STOP_NO_REPLACEABLE_SHARDS.md | historical | 57 | 7 | 318 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 16 | BM_AUTO_CALL_GRAPH_MIGRATION_CONTROL.md | historical | 201 | 16 | 337 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 17 | BM_AUTO_CHAIN_A_A4_CALLSITE_MAP.md | historical | 165 | 7 | 272 | yes | no | no | no | no | no | yes | archive-normalize | 3 lines use escaped backslash-n as line separator |
| 18 | BM_AUTO_CHAIN_A_A4_CURRENT_STATE_AUDIT.md | historical | 107 | 12 | 199 | no | no | yes | no | no | no | no | fix | pending marker found |
| 19 | BM_AUTO_CHAIN_A_A4_DEEP_CAMPAIGN_SUMMARY.md | historical | 159 | 18 | 133 | no | yes | yes | no | no | no | no | fix | pending marker found; TODO marker found |
| 20 | BM_AUTO_CHAIN_A_A4_RISK_MATRIX.md | historical | 145 | 5 | 279 | yes | no | no | no | no | no | yes | archive-normalize | 3 lines use escaped backslash-n as line separator |
| 21 | BM_AUTO_CHAIN_A_A4_STOP_R3_NO_SAFE_CANDIDATES.md | historical | 72 | 12 | 241 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 22 | BM_AUTO_CHAIN_A_BATCH_A1_DOC_AUDIT.md | historical | 39 | 6 | 296 | no | no | no | yes | no | no | no | policy-exempt-with-marker | missing Stage or Historical note |
| 23 | BM_AUTO_CHAIN_A_BATCH_A1_PLAN.md | historical | 5 | 1 | 194 | no | no | no | no | yes | yes | no | archive-normalize | less than 10 physical lines (5); missing Decision or Historical status |
| 24 | BM_AUTO_CHAIN_A_BATCH_A2_DOC_AUDIT.md | historical | 54 | 7 | 206 | no | no | no | yes | no | no | no | policy-exempt-with-marker | missing Stage or Historical note |
| 25 | BM_AUTO_CHAIN_A_BATCH_A2_PLAN.md | historical | 72 | 9 | 174 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 26 | BM_AUTO_CHAIN_A_BATCH_A4_FIXTURE_PLAN.md | historical | 74 | 9 | 197 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 27 | BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md | active | 85 | 4 | 233 | yes | yes | yes | no | no | no | no | archive-normalize | 9 lines use escaped backslash-n as line separator; pending marker found; TODO marker found |
| 28 | BM_AUTO_DOC_AUDIT_POLICY.md | active | 106 | 9 | 167 | yes | yes | yes | no | no | no | no | archive-normalize | 4 lines use escaped backslash-n as line separator; pending marker found; TODO marker found |
| 29 | BM_AUTO_DOC_AUDIT_POLICY_STOP_TOO_MANY_HISTORICAL_FAILURES.md | active | 134 | 14 | 206 | yes | yes | yes | no | no | no | no | archive-normalize | 2 lines use escaped backslash-n as line separator; pending marker found; TODO marker found |
| 30 | BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_006.md | historical | 86 | 4 | 96 | no | no | no | yes | yes | yes | yes | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 31 | BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_010.md | historical | 93 | 12 | 161 | no | no | no | no | yes | yes | no | policy-exempt-with-marker | missing Decision or Historical status |
| 32 | BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_013.md | historical | 53 | 8 | 113 | no | no | no | no | yes | yes | no | policy-exempt-with-marker | missing Decision or Historical status |
| 33 | BM_AUTO_FULL_DEPENDENCY_ORDER_AFTER_013.md | historical | 49 | 9 | 106 | no | no | no | no | yes | yes | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 34 | BM_AUTO_FULL_ROUNDS_011_TO_013_AUDIT.md | historical | 84 | 7 | 325 | no | no | yes | no | no | no | no | fix | pending marker found |
| 35 | BM_AUTO_FULL_ROUND_006_PLAN.md | historical | 83 | 14 | 164 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 36 | BM_AUTO_FULL_ROUND_007_PLAN.md | historical | 82 | 14 | 210 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 37 | BM_AUTO_FULL_ROUND_007_REAL_MIGRATION.md | historical | 91 | 9 | 191 | no | no | yes | no | no | no | no | fix | pending marker found |
| 38 | BM_AUTO_FULL_ROUND_008_PLAN.md | historical | 82 | 14 | 210 | no | no | no | yes | yes | no | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 39 | BM_AUTO_FULL_ROUND_008_REAL_MIGRATION.md | historical | 91 | 9 | 196 | no | no | yes | no | no | no | no | fix | pending marker found |
| 40 | BM_AUTO_FULL_ROUND_009_PLAN.md | historical | 57 | 8 | 109 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 41 | BM_AUTO_FULL_ROUND_009_REAL_MIGRATION.md | historical | 114 | 11 | 170 | no | no | yes | no | no | no | no | fix | pending marker found |
| 42 | BM_AUTO_FULL_ROUND_010_PLAN.md | historical | 53 | 7 | 94 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 43 | BM_AUTO_FULL_ROUND_010_SYNC_CORRECTION.md | historical | 51 | 6 | 95 | no | no | yes | no | no | no | yes | fix | pending marker found |
| 44 | BM_AUTO_FULL_ROUND_011_PLAN.md | historical | 49 | 7 | 81 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 45 | BM_AUTO_FULL_ROUND_012_PLAN.md | historical | 48 | 7 | 85 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 46 | BM_AUTO_FULL_ROUND_013_PLAN.md | historical | 50 | 7 | 139 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 47 | BM_AUTO_FULL_ROUND_014_PLAN.md | historical | 5 | 1 | 200 | no | no | no | no | yes | yes | yes | archive-normalize | less than 10 physical lines (5); missing Decision or Historical status |
| 48 | BM_AUTO_FULL_ROUND_014_REAL_MIGRATION.md | historical | 9 | 1 | 94 | no | no | no | no | yes | no | no | archive-normalize | less than 10 physical lines (9); missing Decision or Historical status |
| 49 | BM_AUTO_FULL_ROUND_014_SYNC.md | historical | 2 | 0 | 59 | no | no | no | yes | yes | yes | yes | archive-normalize | less than 10 physical lines (2); missing Stage or Historical note; missing Decision or Historical status |
| 50 | BM_AUTO_FULL_STOP_NO_ELIGIBLE_LOW_RISK_HELPER.md | historical | 70 | 10 | 209 | no | no | no | yes | yes | yes | no | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| 51 | BM_AUTO_GATE_CORRECTION.md | historical | 56 | 7 | 322 | no | no | no | yes | no | no | yes | policy-exempt-with-marker | missing Stage or Historical note |
| 52 | BM_AUTO_GATE_RERUN.md | historical | 135 | 14 | 98 | no | yes | no | yes | yes | no | no | fix | TODO marker found; missing Stage or Historical note; missing Decision or Historical status |
| 53 | BM_AUTO_GATE_VERIFICATION.md | historical | 162 | 16 | 164 | no | yes | no | yes | yes | no | no | fix | TODO marker found; missing Stage or Historical note; missing Decision or Historical status |
| 54 | BM_AUTO_GROUPED_HELPER_CHAIN_B_PLAN.md | historical | 14 | 1 | 199 | no | no | no | no | yes | no | no | policy-exempt-with-marker | missing Decision or Historical status |
| 55 | BM_AUTO_GROUPED_HELPER_CHAIN_B_REAL_MIGRATION.md | historical | 128 | 14 | 335 | yes | no | no | no | no | no | no | archive-normalize | 3 lines use escaped backslash-n as line separator |
| 56 | BM_AUTO_GROUPED_HELPER_CHAIN_B_SYNC.md | historical | 28 | 4 | 100 | no | no | yes | no | no | no | yes | fix | pending marker found |
| 57 | BM_AUTO_GROUPED_HELPER_GATE.md | historical | 148 | 21 | 297 | no | no | yes | no | no | yes | no | fix | pending marker found |
| 58 | BM_AUTO_MIGRATION_PROTOCOL.md | historical | 199 | 19 | 150 | no | no | no | yes | no | no | no | policy-exempt-with-marker | missing Stage or Historical note |
| 59 | BM_AUTO_ROUND_1_PLAN.md | historical | 93 | 17 | 311 | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 60 | BM_AUTO_ROUND_1_REAL_MIGRATION.md | historical | 209 | 38 | 283 | no | no | yes | no | no | no | no | fix | pending marker found |
| 61 | BM_AUTO_ROUND_2_PLAN.md | historical | 77 | 17 | 142 | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| 62 | BM_AUTO_ROUND_2_REAL_MIGRATION.md | historical | 145 | 30 | 140 | no | no | yes | no | no | no | no | fix | pending marker found |
| 63 | BM_AUTO_STRICT_RUN_CORRECTION.md | historical | 105 | 12 | 121 | no | no | yes | no | no | no | no | fix | pending marker found |

## Validation

This report is generated by `scripts/bm-a4-doc-audit.js`.

## Safety

This report is documentation-only. No production code is changed by generating it.

## Decision

Doc audit accepted: no.

