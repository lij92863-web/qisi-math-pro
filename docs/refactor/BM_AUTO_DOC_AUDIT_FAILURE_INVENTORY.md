# BM-AUTO A4 Doc Audit

Stage: BM-AUTO-A4-DOC-AUDIT
Branch: main

## Summary

Docs checked: 155.
Total failures: 63.
Doc audit passed: no.
Rules: >= 20 lines, >= 5 sections, < 1200 max line.

## Failure Inventory

| File | Lines | Headings | Max Line | Literal \n | TODO | Pending | Missing Stage | Missing Branch/Commit | Missing Validation/Tests | Missing Safety | Missing Decision | Current Campaign | Historical | Recommended Action | Errors |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BM_AUTO_A4_R3_AUTO_BATCH_R3-AUTO-BATCH-006.md | 26 | 4 | 204 | yes | no | no | no | no | yes | yes | no | no | yes | archive-normalize | 3 lines use escaped \n as line separator |
| BM_AUTO_A4_R3_COMMITTED_DOC_NEWLINE_FIX.md | 71 | 11 | 302 | yes | no | no | no | no | no | no | no | yes | no | archive-normalize | 3 lines use escaped \n as line separator |
| BM_AUTO_A4_R3_DOC_AUDIT_RAW_LINE_FIX.md | 54 | 8 | 219 | yes | no | no | no | no | no | no | no | yes | no | archive-normalize | 1 lines use escaped \n as line separator |
| BM_AUTO_A4_R3_PROGRESS_REPORT.md | 46 | 10 | 119 | no | no | no | no | no | yes | yes | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_A4_R3_REMAINING_CALLSITES_FINAL.md | 67 | 13 | 178 | no | no | no | no | no | yes | yes | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_A4_R3_RESIDUAL_FREEZE_FINAL.md | 79 | 5 | 255 | no | no | no | no | no | yes | yes | no | yes | no | investigate | missing Safety; missing Tests or Validation |
| BM_AUTO_A4_R3_RESIDUAL_PROOF.md | 67 | 5 | 212 | no | no | no | no | no | yes | yes | no | yes | no | investigate | missing Safety; missing Tests or Validation |
| BM_AUTO_A4_R3_RESIDUAL_RECLASSIFICATION.md | 59 | 5 | 226 | no | no | no | no | no | yes | yes | no | yes | no | investigate | missing Safety; missing Tests or Validation |
| BM_AUTO_A4_R3_RESIDUAL_STATE_INVENTORY.md | 119 | 14 | 244 | no | no | no | no | no | yes | yes | no | yes | no | investigate | missing Safety; missing Tests or Validation |
| BM_AUTO_A4_R3_RESIDUAL_STOP_DOC_AUDIT_FAILED.md | 116 | 13 | 242 | no | yes | yes | no | no | no | no | yes | yes | no | fix | pending marker found; TODO marker found; missing Decision |
| BM_AUTO_A4_R3_RESIDUAL_WRAPPER_REMOVAL_GATE.md | 42 | 4 | 82 | no | no | no | no | no | yes | no | no | yes | no | investigate | missing Tests or Validation |
| BM_AUTO_A4_R3_SHARD_R3-S003.md | 7 | 1 | 165 | no | no | no | no | no | yes | yes | yes | no | yes | archive-normalize | less than 10 physical lines (7); missing Decision or Historical status |
| BM_AUTO_A4_R3_SHARD_R3-S004.md | 7 | 1 | 134 | no | no | no | no | no | yes | yes | yes | no | yes | archive-normalize | less than 10 physical lines (7); missing Decision or Historical status |
| BM_AUTO_A4_R3_SHARD_R3-S005.md | 7 | 1 | 204 | no | no | no | no | no | yes | yes | yes | no | yes | archive-normalize | less than 10 physical lines (7); missing Decision or Historical status |
| BM_AUTO_A4_R3_STOP_NO_REPLACEABLE_SHARDS.md | 57 | 7 | 318 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_CALL_GRAPH_MIGRATION_CONTROL.md | 201 | 16 | 337 | no | no | no | yes | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_CHAIN_A_A4_CALLSITE_MAP.md | 165 | 7 | 272 | yes | no | no | no | no | no | yes | no | no | yes | archive-normalize | 3 lines use escaped \n as line separator |
| BM_AUTO_CHAIN_A_A4_CURRENT_STATE_AUDIT.md | 107 | 12 | 199 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_CHAIN_A_A4_DEEP_CAMPAIGN_SUMMARY.md | 159 | 18 | 133 | no | yes | yes | no | no | no | no | no | no | yes | fix | pending marker found; TODO marker found |
| BM_AUTO_CHAIN_A_A4_RISK_MATRIX.md | 145 | 5 | 279 | yes | no | no | no | no | no | yes | no | no | yes | archive-normalize | 3 lines use escaped \n as line separator |
| BM_AUTO_CHAIN_A_A4_STOP_R3_NO_SAFE_CANDIDATES.md | 72 | 12 | 241 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_CHAIN_A_BATCH_A1_DOC_AUDIT.md | 39 | 6 | 296 | no | no | no | yes | no | no | no | no | no | yes | policy-exempt-with-marker | missing Stage or Historical note |
| BM_AUTO_CHAIN_A_BATCH_A1_PLAN.md | 5 | 1 | 194 | no | no | no | no | yes | yes | no | yes | no | yes | archive-normalize | less than 10 physical lines (5); missing Decision or Historical status |
| BM_AUTO_CHAIN_A_BATCH_A2_DOC_AUDIT.md | 54 | 7 | 206 | no | no | no | yes | no | no | no | no | no | yes | policy-exempt-with-marker | missing Stage or Historical note |
| BM_AUTO_CHAIN_A_BATCH_A2_PLAN.md | 72 | 9 | 174 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_CHAIN_A_BATCH_A4_FIXTURE_PLAN.md | 74 | 9 | 197 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_DOC_AUDIT_FAILURE_INVENTORY.md | 128 | 4 | 302 | yes | yes | yes | no | no | no | no | no | yes | no | archive-normalize | 2 lines use escaped \n as line separator; pending marker found; TODO marker found |
| BM_AUTO_DOC_AUDIT_POLICY.md | 106 | 9 | 167 | yes | yes | yes | no | no | no | no | no | yes | no | archive-normalize | 4 lines use escaped \n as line separator; pending marker found; TODO marker found |
| BM_AUTO_FULL_CANDIDATE_POOL.md | 84 | 5 | 273 | no | no | yes | no | no | yes | no | no | no | yes | fix | pending marker found |
| BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_006.md | 86 | 4 | 96 | no | no | no | yes | no | yes | yes | yes | no | yes | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_010.md | 93 | 12 | 161 | no | no | no | no | no | yes | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_013.md | 53 | 8 | 113 | no | no | no | no | no | yes | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_DEPENDENCY_ORDER_AFTER_013.md | 49 | 9 | 106 | no | no | no | no | yes | yes | yes | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_ROUNDS_011_TO_013_AUDIT.md | 84 | 7 | 325 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_FULL_ROUND_006_PLAN.md | 83 | 14 | 164 | no | no | no | yes | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_007_PLAN.md | 82 | 14 | 210 | no | no | yes | yes | no | no | no | yes | no | yes | fix | pending marker found; missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_007_REAL_MIGRATION.md | 91 | 9 | 191 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_FULL_ROUND_008_PLAN.md | 82 | 14 | 210 | no | no | no | yes | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_008_REAL_MIGRATION.md | 91 | 9 | 196 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_FULL_ROUND_009_PLAN.md | 57 | 8 | 109 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_009_REAL_MIGRATION.md | 114 | 11 | 170 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_FULL_ROUND_010_PLAN.md | 53 | 7 | 94 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_010_SYNC_CORRECTION.md | 51 | 6 | 95 | no | no | yes | no | no | no | yes | no | no | yes | fix | pending marker found |
| BM_AUTO_FULL_ROUND_011_PLAN.md | 49 | 7 | 81 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_012_PLAN.md | 48 | 7 | 85 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_013_PLAN.md | 50 | 7 | 139 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_014_PLAN.md | 5 | 1 | 200 | no | no | no | no | no | yes | yes | yes | no | yes | archive-normalize | less than 10 physical lines (5); missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_014_REAL_MIGRATION.md | 9 | 1 | 94 | no | no | no | no | no | no | no | yes | no | yes | archive-normalize | less than 10 physical lines (9); missing Decision or Historical status |
| BM_AUTO_FULL_ROUND_014_SYNC.md | 2 | 0 | 59 | no | no | no | yes | no | yes | yes | yes | no | yes | archive-normalize | less than 10 physical lines (2); missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_FULL_STOP_NO_ELIGIBLE_LOW_RISK_HELPER.md | 70 | 10 | 209 | no | no | no | yes | no | yes | no | yes | no | yes | policy-exempt-with-marker | missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_GATE_CORRECTION.md | 56 | 7 | 322 | no | no | no | yes | no | no | yes | no | no | yes | policy-exempt-with-marker | missing Stage or Historical note |
| BM_AUTO_GATE_RERUN.md | 135 | 14 | 98 | no | yes | no | yes | no | no | no | yes | no | yes | fix | TODO marker found; missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_GATE_VERIFICATION.md | 162 | 16 | 164 | no | yes | no | yes | no | no | no | yes | no | yes | fix | TODO marker found; missing Stage or Historical note; missing Decision or Historical status |
| BM_AUTO_GROUPED_HELPER_CHAIN_B_PLAN.md | 14 | 1 | 199 | no | no | no | no | no | no | no | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_GROUPED_HELPER_CHAIN_B_REAL_MIGRATION.md | 128 | 14 | 335 | yes | no | no | no | no | no | no | no | no | yes | archive-normalize | 3 lines use escaped \n as line separator |
| BM_AUTO_GROUPED_HELPER_CHAIN_B_SYNC.md | 28 | 4 | 100 | no | no | yes | no | no | no | yes | no | no | yes | fix | pending marker found |
| BM_AUTO_GROUPED_HELPER_GATE.md | 148 | 21 | 297 | no | no | yes | no | no | yes | no | no | no | yes | fix | pending marker found |
| BM_AUTO_MIGRATION_PROTOCOL.md | 199 | 19 | 150 | no | no | no | yes | no | no | no | no | no | yes | policy-exempt-with-marker | missing Stage or Historical note |
| BM_AUTO_ROUND_1_PLAN.md | 93 | 17 | 311 | no | no | no | no | no | no | yes | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_ROUND_1_REAL_MIGRATION.md | 209 | 38 | 283 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_ROUND_2_PLAN.md | 77 | 17 | 142 | no | no | no | no | no | no | yes | yes | no | yes | policy-exempt-with-marker | missing Decision or Historical status |
| BM_AUTO_ROUND_2_REAL_MIGRATION.md | 145 | 30 | 140 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |
| BM_AUTO_STRICT_RUN_CORRECTION.md | 105 | 12 | 121 | no | no | yes | no | no | no | no | no | no | yes | fix | pending marker found |

## Decision

A4 docs accepted: no.

