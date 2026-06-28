# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdyo4j
Branch: main
Batch ID: AUTO-mqxdyo4j

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-05435 | cleanDisplayTextForBatchSave | 5435 | cleanDisplayTextForBatchSave( | window.Qisi.Utils.cleanDisplayTextForBatchSave( |
| R3-06521 | cleanDisplayTextForBatchSave | 6521 | solution: cleanDisplayTextForBatchSave(rawSolution), | solution: window.Qisi.Utils.cleanDisplayTextForBatchSave(rawSolution), |
| R3-01954 | cleanDisplayOptionsForBatchSave | 1954 | return cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length; | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length; |

## Decision

Replaced 3 callsites.
