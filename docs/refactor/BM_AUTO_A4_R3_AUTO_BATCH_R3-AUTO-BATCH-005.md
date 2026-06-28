# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdo9im
Branch: main
Batch ID: AUTO-mqxdo9im

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-02912 | cleanDisplayTextForBatchSave | 2912 | cleanDisplayTextForBatchSave(match[4]) | window.Qisi.Utils.cleanDisplayTextForBatchSave(match[4]) |
| R3-02918 | cleanDisplayTextForBatchSave | 2918 | stem: cleanDisplayTextForBatchSave(source.slice(0, match.index).trim()), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source.slice(0, match.index).trim()), |
| R3-02960 | cleanDisplayTextForBatchSave | 2960 | options[idx] = cleanDisplayTextForBatchSave(hit.value); | options[idx] = window.Qisi.Utils.cleanDisplayTextForBatchSave(hit.value); |

## Decision

Replaced 3 callsites.
