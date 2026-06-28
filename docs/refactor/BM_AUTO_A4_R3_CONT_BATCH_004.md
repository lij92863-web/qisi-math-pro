# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe02j5
Branch: main
Batch ID: AUTO-mqxe02j5

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-02352 | cleanDisplayOptionsForBatchSave | 2352 | const primary = cleanDisplayOptionsForBatchSave(primaryOptions || []); | const primary = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(primaryOptions || []); |
| R3-02353 | cleanDisplayOptionsForBatchSave | 2353 | const fallback = cleanDisplayOptionsForBatchSave(fallbackOptions || []); | const fallback = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(fallbackOptions || []); |
| R3-02366 | cleanDisplayOptionsForBatchSave | 2366 | cleanDisplayOptionsForBatchSave(options || []).filter(Boolean).length; | window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options || []).filter(Boolean).length; |

## Decision

Replaced 3 callsites.
