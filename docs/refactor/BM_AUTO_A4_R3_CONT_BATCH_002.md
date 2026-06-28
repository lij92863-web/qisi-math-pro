# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdylby
Branch: main
Batch ID: AUTO-mqxdylby

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-04974 | cleanDisplayTextForBatchSave | 4974 | const textOption = cleanDisplayTextForBatchSave( | const textOption = window.Qisi.Utils.cleanDisplayTextForBatchSave( |
| R3-05275 | cleanDisplayTextForBatchSave | 5275 | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)), | solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(block)), |
| R3-05342 | cleanDisplayTextForBatchSave | 5342 | solution: cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)), | solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(stripQuestionSectionNoise(solution)), |

## Decision

Replaced 3 callsites.
