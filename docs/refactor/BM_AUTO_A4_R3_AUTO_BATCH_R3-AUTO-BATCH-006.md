# BM-AUTO A4 R3 Batch Report

Stage: BM-AUTO-A4-R3-BATCH-AUTO-mqxdocsu
Branch: main
Batch ID: AUTO-mqxdocsu

## Summary

Candidates audited: 3.
Proof allowed: 3.
Replacements applied: 3.
Fixtures generated: 3.
Deferred: 0. Blocked: 0.

## Replacements

| ID | Helper | Line | Old | New |
| --- | --- | ---: | --- | --- |
| R3-02967 | cleanDisplayTextForBatchSave | 2967 | stem: cleanDisplayTextForBatchSave(stemLines.join('\n')), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(stemLines.join('\n')), |
| R3-03030 | cleanDisplayTextForBatchSave | 3030 | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |
| R3-03054 | cleanDisplayTextForBatchSave | 3054 | stem: cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), | stem: window.Qisi.Utils.cleanDisplayTextForBatchSave(lines.slice(0, i).join('\n')), |

## Decision

Replaced 3 callsites.
