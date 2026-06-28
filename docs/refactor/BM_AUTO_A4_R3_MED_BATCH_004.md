# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-MED-mqxeovux
Branch: main
Batch ID: MED-mqxeovux

## Summary

Candidates audited: 1.
Proof allowed: 1.
Replacements applied: 1.
Fixtures generated: 1.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-19275 | cleanDisplayOptionsForBatchSave | 19275 | const options = cleanDisplayOptionsForBatchSave(d.options); | const options = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(d.options); |

## Decision

Replaced 1 callsites.
