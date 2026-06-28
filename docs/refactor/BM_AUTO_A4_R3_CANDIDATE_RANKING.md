# BM-AUTO A4 R3 Candidate Ranking

Stage: BM-AUTO-A4-R3-CANDIDATE-RANKING
Branch: main

## Summary

Total callsites: 105.

- AUTO_FIXTURE_CANDIDATE: 60
- PROOF_REQUIRED: 13
- DEFER_UNLESS_STRONG_FIXTURE: 11
- BLOCK_UNTIL_MANUAL: 21
- ALWAYS_BLOCK: 0
- DEFER: 0

## Top 20 Safest

| ID | Helper | Line | Score | Decision |
| --- | --- | ---: | ---: | --- |
| R3-01937 | cleanDisplayTextForBatchSave | 1937 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-01995 | cleanDisplayTextForBatchSave | 1995 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02144 | cleanDisplayTextForBatchSave | 2144 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02145 | cleanDisplayTextForBatchSave | 2145 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02753 | cleanDisplayTextForBatchSave | 2753 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02802 | cleanDisplayTextForBatchSave | 2802 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02813 | cleanDisplayTextForBatchSave | 2813 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02883 | cleanDisplayTextForBatchSave | 2883 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02893 | cleanDisplayTextForBatchSave | 2893 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02909 | cleanDisplayTextForBatchSave | 2909 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02910 | cleanDisplayTextForBatchSave | 2910 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02911 | cleanDisplayTextForBatchSave | 2911 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02912 | cleanDisplayTextForBatchSave | 2912 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02918 | cleanDisplayTextForBatchSave | 2918 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02960 | cleanDisplayTextForBatchSave | 2960 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-02967 | cleanDisplayTextForBatchSave | 2967 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03030 | cleanDisplayTextForBatchSave | 3030 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03054 | cleanDisplayTextForBatchSave | 3054 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03066 | cleanDisplayTextForBatchSave | 3066 | 100 | AUTO_FIXTURE_CANDIDATE |
| R3-03466 | cleanDisplayTextForBatchSave | 3466 | 100 | AUTO_FIXTURE_CANDIDATE |

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

Safe auto-fixture candidates: 60.
