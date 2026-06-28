# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdkmji
Branch: main
Batch ID: AUTO-mqxdkmji

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-01937 | cleanDisplayTextForBatchSave | 1937 | const text = cleanDisplayTextForBatchSave(value); | const text = window.Qisi.Utils.cleanDisplayTextForBatchSave(value); |
| R3-01995 | cleanDisplayTextForBatchSave | 1995 | return cleanDisplayTextForBatchSave(source); | return window.Qisi.Utils.cleanDisplayTextForBatchSave(source); |
| R3-02144 | cleanDisplayTextForBatchSave | 2144 | const next = cleanDisplayTextForBatchSave(candidate); | const next = window.Qisi.Utils.cleanDisplayTextForBatchSave(candidate); |

## Decision

Replaced 3 callsites.
