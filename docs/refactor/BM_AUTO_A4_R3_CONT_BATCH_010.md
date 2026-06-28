# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxe74a3
Branch: main
Batch ID: AUTO-mqxe74a3

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-15560 | cleanDisplayOptionsForBatchSave | 15560 | return cleanDisplayOptionsForBatchSave(options || []); | return window.Qisi.Utils.cleanDisplayOptionsForBatchSave(options || []); |
| R3-03438 | addWarningOnce | 3438 | addWarningOnce(draft, `已从 Word 文本层本地拆出 ${best.optionCount}/4 个选项，请核对。`); | window.Qisi.Utils.addWarningOnce(draft, `已从 Word 文本层本地拆出 ${best.optionCount}/4 个选项，请核对。`); |
| R3-03569 | cleanDisplayTextForBatchSave | 3569 | next.stem = cleanDisplayTextForBatchSave(local.stem); | next.stem = window.Qisi.Utils.cleanDisplayTextForBatchSave(local.stem); |

## Decision

Replaced 3 callsites.
