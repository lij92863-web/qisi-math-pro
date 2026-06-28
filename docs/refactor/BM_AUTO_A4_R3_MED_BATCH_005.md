# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-MED-mqxeow1k
Branch: main
Batch ID: MED-mqxeow1k

## Summary

Candidates audited: 1.
Proof allowed: 1.
Replacements applied: 1.
Fixtures generated: 1.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-13559 | cleanDisplayTextForBatchSave | 13559 | const patchedStem = cleanDisplayTextForBatchSave(patch.stem || patch.题干 || ''); | const patchedStem = window.Qisi.Utils.cleanDisplayTextForBatchSave(patch.stem || patch.题干 || ''); |

## Decision

Replaced 1 callsites.
