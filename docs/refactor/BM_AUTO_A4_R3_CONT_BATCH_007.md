# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe64e2
Branch: main
Batch ID: AUTO-mqxe64e2

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-03055 | cleanDisplayOptionsForBatchSave | 3055 | options: cleanDisplayOptionsForBatchSave(options), | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |
| R3-03536 | cleanDisplayOptionsForBatchSave | 3536 | const aiOptions = cleanDisplayOptionsForBatchSave(ai.options); | const aiOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(ai.options); |
| R3-03537 | cleanDisplayOptionsForBatchSave | 3537 | const localOptions = cleanDisplayOptionsForBatchSave(local.options); | const localOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(local.options); |

## Decision

Replaced 3 callsites.
