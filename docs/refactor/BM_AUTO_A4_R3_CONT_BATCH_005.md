# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe069o
Branch: main
Batch ID: AUTO-mqxe069o

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-02369 | cleanDisplayOptionsForBatchSave | 2369 | const aa = cleanDisplayOptionsForBatchSave(a || []); | const aa = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(a || []); |
| R3-02370 | cleanDisplayOptionsForBatchSave | 2370 | const bb = cleanDisplayOptionsForBatchSave(b || []); | const bb = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(b || []); |
| R3-02894 | cleanDisplayOptionsForBatchSave | 2894 | options: cleanDisplayOptionsForBatchSave(options), | options: window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options), |

## Decision

Replaced 3 callsites.
