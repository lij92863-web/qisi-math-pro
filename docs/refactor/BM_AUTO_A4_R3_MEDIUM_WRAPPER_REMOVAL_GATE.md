# BM-AUTO A4 R3 Medium Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-MEDIUM-WRAPPER-GATE
Branch: main
Commit: 46bac8f

## Gate Criteria

| Criterion | Status | Detail |
| --- | --- | --- |
| 0 naked callsites | FAIL | 40 remain |
| 0 deferred callsites | FAIL | 19 deferred |
| 0 blocked callsites | FAIL | 21 blocked |
| 0 UNKNOWN callsites | PASS | 0 UNKNOWN |
| All calls explicit | FAIL | 75 of 115 |
| Wrappers unused | FAIL | 40 depend on wrappers |
| verify:safe passed | PASS | verified |
| verify:batch-safety passed | PASS | verified |
| smoke:batch:mock passed | PASS | verified |
| verify:pdf-known-bad passed | PASS | verified |
| controlled-write ownership passed | PASS | verified |
| preflight ok:true | PASS | verified |
| dry-run ok:true | PASS | verified |

## Decision

**Wrapper removal allowed: no.**

40 naked callsites remain. 19 deferred. 21 blocked.
Wrappers must be preserved until all gate criteria pass.
