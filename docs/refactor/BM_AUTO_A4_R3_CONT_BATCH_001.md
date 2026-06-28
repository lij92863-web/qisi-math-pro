# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdyhjv
Branch: main
Batch ID: AUTO-mqxdyhjv

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-03066 | cleanDisplayTextForBatchSave | 3066 | stem: cleanDisplayTextForBatchSave(source), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source), |
| R3-03466 | cleanDisplayTextForBatchSave | 3466 | stem: parsed.stem || cleanDisplayTextForBatchSave(item.block), | stem: parsed.stem || window.Qisi.Utils.cleanDisplayTextForBatchSave(item.block), |
| R3-04920 | cleanDisplayTextForBatchSave | 4920 | cleanDisplayTextForBatchSave(String(x || '') | window.Qisi.Utils.cleanDisplayTextForBatchSave(String(x || '') |

## Decision

Replaced 3 callsites.
