# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdljux
Branch: main
Batch ID: AUTO-mqxdljux

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-02145 | cleanDisplayTextForBatchSave | 2145 | const old = cleanDisplayTextForBatchSave(existing); | const old = window.Qisi.Utils.cleanDisplayTextForBatchSave(existing); |
| R3-02753 | cleanDisplayTextForBatchSave | 2753 | stem: cleanDisplayTextForBatchSave(source), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source), |
| R3-02802 | cleanDisplayTextForBatchSave | 2802 | options[optionIndex] = cleanDisplayTextForBatchSave(value); | options[optionIndex] = window.Qisi.Utils.cleanDisplayTextForBatchSave(value); |

## Decision

Replaced 3 callsites.
