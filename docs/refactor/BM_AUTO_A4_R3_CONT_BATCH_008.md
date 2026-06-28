# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe64l4
Branch: main
Batch ID: AUTO-mqxe64l4

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-04925 | cleanDisplayOptionsForBatchSave | 4925 | return cleanDisplayOptionsForBatchSave(options); | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options); |
| R3-05035 | cleanDisplayOptionsForBatchSave | 5035 | options: cleanDisplayOptionsForBatchSave(options), | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| R3-05111 | cleanDisplayOptionsForBatchSave | 5111 | options: cleanDisplayOptionsForBatchSave(options), | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |

## Decision

Replaced 3 callsites.
