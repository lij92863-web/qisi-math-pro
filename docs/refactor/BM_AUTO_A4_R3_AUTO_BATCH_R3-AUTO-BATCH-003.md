# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdm1ov
Branch: main
Batch ID: AUTO-mqxdm1ov

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-02813 | cleanDisplayTextForBatchSave | 2813 | stem: cleanDisplayTextForBatchSave(source), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source), |
| R3-02883 | cleanDisplayTextForBatchSave | 2883 | options[optionIndex] = cleanDisplayTextForBatchSave(value); | options[optionIndex] = window.Qisi.Utils.cleanDisplayTextForBatchSave(value); |
| R3-02893 | cleanDisplayTextForBatchSave | 2893 | stem: cleanDisplayTextForBatchSave(source.slice(0, ordered[0].start).trim()), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(source.slice(0, ordered[0].start).trim()), |

## Decision

Replaced 3 callsites.
