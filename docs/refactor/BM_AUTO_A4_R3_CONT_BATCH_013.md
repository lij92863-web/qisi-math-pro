# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe899j
Branch: main
Batch ID: AUTO-mqxe899j

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-03677 | cleanDisplayOptionsForBatchSave | 3677 | const existing = cleanDisplayOptionsForBatchSave(q.options); | const existing = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(q.options); |
| R3-03724 | cleanDisplayOptionsForBatchSave | 3724 | const extracted = cleanDisplayOptionsForBatchSave(best.options); | const extracted = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(best.options); |
| R3-13547 | cleanDisplayOptionsForBatchSave | 13547 | const oldOptions = cleanDisplayOptionsForBatchSave(draft.options || []); | const oldOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(draft.options || []); |

## Decision

Replaced 3 callsites.
