# BM-AUTO A4 R3 Candidate Ranking

Stage: BM-AUTO-A4-R3-CANDIDATE-RANKING
Branch: main

## Summary

Total callsites: 40.

- AUTO_FIXTURE_CANDIDATE: 0
- PROOF_REQUIRED: 8
- DEFER_UNLESS_STRONG_FIXTURE: 11
- BLOCK_UNTIL_MANUAL: 21
- ALWAYS_BLOCK: 0
- DEFER: 0

## Top 20 Safest

| ID | Helper | Line | Score | Decision |
| --- | --- | ---: | ---: | --- |
| R3-20032 | addWarningOnce | 20032 | 75 | PROOF_REQUIRED |
| R3-02402 | cleanDisplayTextForBatchSave | 2402 | 70 | PROOF_REQUIRED |
| R3-02403 | cleanDisplayTextForBatchSave | 2403 | 70 | PROOF_REQUIRED |
| R3-06869 | cleanDisplayOptionsForBatchSave | 6869 | 70 | PROOF_REQUIRED |
| R3-09936 | cleanDisplayOptionsForBatchSave | 9936 | 70 | PROOF_REQUIRED |
| R3-15396 | cleanDisplayOptionsForBatchSave | 15396 | 70 | PROOF_REQUIRED |
| R3-19257 | cleanDisplayOptionsForBatchSave | 19257 | 70 | PROOF_REQUIRED |
| R3-19335 | cleanDisplayOptionsForBatchSave | 19335 | 70 | PROOF_REQUIRED |
| R3-07342 | addWarningOnce | 7342 | 65 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-19010 | addWarningOnce | 19010 | 65 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-06989 | cleanDisplayTextForBatchSave | 6989 | 60 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-14545 | cleanDisplayTextForBatchSave | 14545 | 60 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-19013 | cleanDisplayFieldsOnly | 19013 | 60 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-03338 | cleanDisplayOptionsForBatchSave | 3338 | 55 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-13271 | cleanDisplayOptionsForBatchSave | 13271 | 55 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-13582 | addWarningOnce | 13582 | 55 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-18247 | addWarningOnce | 18247 | 55 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-18913 | addWarningOnce | 18913 | 55 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-13570 | cleanDisplayTextForBatchSave | 13570 | 50 | DEFER_UNLESS_STRONG_FIXTURE |
| R3-03732 | cleanDisplayTextForBatchSave | 3732 | 45 | BLOCK_UNTIL_MANUAL |

## Top 20 Most Dangerous

| ID | Helper | Line | Score | Decision | Risks |
| --- | --- | ---: | ---: | --- | --- |
| R3-13153 | cleanDisplayTextForBatchSave | 13153 | 0 | BLOCK_UNTIL_MANUAL | PDF ownership risk; answer/solution ownership |
| R3-18906 | addWarningOnce | 18906 | 5 | BLOCK_UNTIL_MANUAL | PDF ownership risk; answer/solution ownership; warning-only helper; no mutation except warnings |
| R3-18900 | addWarningOnce | 18900 | 5 | BLOCK_UNTIL_MANUAL | PDF ownership risk; answer/solution ownership; warning-only helper; no mutation except warnings |
| R3-13156 | cleanDisplayTextForBatchSave | 13156 | 10 | BLOCK_UNTIL_MANUAL | PDF ownership risk; answer/solution ownership |
| R3-13859 | cleanDisplayOptionsForBatchSave | 13859 | 15 | BLOCK_UNTIL_MANUAL | support attachment risk; answer/solution ownership |
| R3-13758 | cleanDisplayOptionsForBatchSave | 13758 | 15 | BLOCK_UNTIL_MANUAL | support attachment risk; answer/solution ownership |
| R3-13714 | cleanDisplayOptionsForBatchSave | 13714 | 15 | BLOCK_UNTIL_MANUAL | support attachment risk; answer/solution ownership |
| R3-19212 | addWarningOnce | 19212 | 35 | BLOCK_UNTIL_MANUAL | PDF ownership risk; warning-only helper; no mutation except warnings |
| R3-18971 | addWarningOnce | 18971 | 35 | BLOCK_UNTIL_MANUAL | PDF ownership risk; warning-only helper; no mutation except warnings |
| R3-18952 | addWarningOnce | 18952 | 35 | BLOCK_UNTIL_MANUAL | PDF ownership risk; warning-only helper; no mutation except warnings |
| R3-07444 | addWarningOnce | 7444 | 35 | BLOCK_UNTIL_MANUAL | PDF ownership risk; warning-only helper; no mutation except warnings |
| R3-13594 | cleanDisplayTextForBatchSave | 13594 | 35 | BLOCK_UNTIL_MANUAL | answer/solution ownership |
| R3-13587 | cleanDisplayTextForBatchSave | 13587 | 35 | BLOCK_UNTIL_MANUAL | answer/solution ownership |
| R3-13568 | cleanDisplayTextForBatchSave | 13568 | 40 | BLOCK_UNTIL_MANUAL | answer/solution ownership |
| R3-07215 | cleanDisplayTextForBatchSave | 7215 | 40 | BLOCK_UNTIL_MANUAL | support attachment risk; answer/solution ownership |
| R3-06995 | cleanDisplayTextForBatchSave | 6995 | 40 | BLOCK_UNTIL_MANUAL | answer/solution ownership |
| R3-19361 | addWarningOnce | 19361 | 45 | BLOCK_UNTIL_MANUAL | answer/solution ownership; warning-only helper |
| R3-13596 | addWarningOnce | 13596 | 45 | BLOCK_UNTIL_MANUAL | answer/solution ownership; warning-only helper |
| R3-13564 | addWarningOnce | 13564 | 45 | BLOCK_UNTIL_MANUAL | answer/solution ownership; warning-only helper |
| R3-13830 | cleanDisplayOptionsForBatchSave | 13830 | 45 | BLOCK_UNTIL_MANUAL | answer/solution ownership |

## Decision

Safe auto-fixture candidates: 0.
