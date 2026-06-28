# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe64qu
Branch: main
Batch ID: AUTO-mqxe64qu

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-13497 | cleanDisplayOptionsForBatchSave | 13497 | return cleanDisplayOptionsForBatchSave(arr); | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(arr); |
| R3-13500 | cleanDisplayOptionsForBatchSave | 13500 | return cleanDisplayOptionsForBatchSave(raw); | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(raw); |
| R3-13504 | cleanDisplayOptionsForBatchSave | 13504 | return cleanDisplayOptionsForBatchSave([ | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave([ |

## Decision

Replaced 3 callsites.
