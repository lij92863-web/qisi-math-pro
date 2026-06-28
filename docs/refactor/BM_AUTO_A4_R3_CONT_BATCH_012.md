# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe74ns
Branch: main
Batch ID: AUTO-mqxe74ns

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-06977 | cleanDisplayOptionsForBatchSave | 6977 | const oldOptions = cleanDisplayOptionsForBatchSave(next.options || []); | const oldOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(next.options || []); |
| R3-20003 | cleanDisplayFieldsOnly | 20003 | cleanDisplayFieldsOnly(q); | window.Qisi.Utils.cleanDisplayFieldsOnly(q); |
| R3-03413 | cleanDisplayOptionsForBatchSave | 3413 | draft.options = cleanDisplayOptionsForBatchSave(best.options); | draft.options = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(best.options); |

## Decision

Replaced 3 callsites.
