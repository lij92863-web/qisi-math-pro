# BM-AUTO A4 R3 Candidate Ranking

Stage: BM-AUTO-A4-R3-CANDIDATE-RANKING
Branch: main

## Summary

Total callsites: 87.

- AUTO_FIXTURE_CANDIDATE: 42
- PROOF_REQUIRED: 13
- DEFER_UNLESS_STRONG_FIXTURE: 11
- BLOCK_UNTIL_MANUAL: 21
- ALWAYS_BLOCK: 0
- DEFER: 0

## Top 20 Safest

| ID | Helper | Line | Score | Decision |
| --- | --- | ---: | ---: | --- |
| R3-03066 | cleanDisplayTextForBatchSave | 3066 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03466 | cleanDisplayTextForBatchSave | 3466 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-04920 | cleanDisplayTextForBatchSave | 4920 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-04974 | cleanDisplayTextForBatchSave | 4974 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-05275 | cleanDisplayTextForBatchSave | 5275 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-05342 | cleanDisplayTextForBatchSave | 5342 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-05435 | cleanDisplayTextForBatchSave | 5435 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-06521 | cleanDisplayTextForBatchSave | 6521 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-01954 | cleanDisplayOptionsForBatchSave | 1954 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02352 | cleanDisplayOptionsForBatchSave | 2352 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02353 | cleanDisplayOptionsForBatchSave | 2353 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02366 | cleanDisplayOptionsForBatchSave | 2366 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02369 | cleanDisplayOptionsForBatchSave | 2369 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02370 | cleanDisplayOptionsForBatchSave | 2370 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02894 | cleanDisplayOptionsForBatchSave | 2894 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02919 | cleanDisplayOptionsForBatchSave | 2919 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02968 | cleanDisplayOptionsForBatchSave | 2968 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03031 | cleanDisplayOptionsForBatchSave | 3031 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03055 | cleanDisplayOptionsForBatchSave | 3055 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03536 | cleanDisplayOptionsForBatchSave | 3536 | 100 | AUTO_FIXTURE_CANDIDATE |

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

Safe auto-fixture candidates: 42.
