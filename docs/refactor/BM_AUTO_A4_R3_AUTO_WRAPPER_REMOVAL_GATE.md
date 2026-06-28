# BM-AUTO A4 R3 Auto Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-AUTO-WRAPPER-GATE
Branch: main / Commit: a753754

## Gate Criteria

| Criterion | Status |
| --- | --- |
| 0 naked A4 callsites | FAIL (87 remain) |
| All calls explicit window.Qisi.Utils.* | FAIL (28 of 115) |
| Wrappers unused | FAIL (87 depend on wrappers) |

## Decision

**Wrapper removal allowed: no.** 87 naked callsites remain. Continue automated batches.
