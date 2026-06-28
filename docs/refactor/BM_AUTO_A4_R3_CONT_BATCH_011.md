# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe74h5
Branch: main
Batch ID: AUTO-mqxe74h5

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-03119 | cleanDisplayOptionsForBatchSave | 3119 | const visualOptions = cleanDisplayOptionsForBatchSave(visual?.options || []); | const visualOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(visual?.options || []); |
| R3-03227 | cleanDisplayOptionsForBatchSave | 3227 | const options = cleanDisplayOptionsForBatchSave(parsed?.options || []); | const options = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(parsed?.options || []); |
| R3-06976 | cleanDisplayOptionsForBatchSave | 6976 | const patchedOptions = cleanDisplayOptionsForBatchSave(patch.options || patch.选项 || []); | const patchedOptions = window.Qisi.Utils.cleanDisplayOptionsForBatchSave(patch.options || patch.选项 || []); |

## Decision

Replaced 3 callsites.
