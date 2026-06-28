# BM-AUTO A4 R3 Residual Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-RESIDUAL-WRAPPER-REMOVAL-GATE

Branch: main

## Gate Criteria

| Criterion | Required | Actual | Pass |
| --- | --- | --- | --- |
| remaining naked A4 callsites | 0 | 40 | no |
| frozen callsites | 0 | 40 | no |
| deferred callsites | 0 | 0 after freeze classification | yes |
| blocked callsites | 0 | 40 frozen | no |
| unknown callsites | 0 | 0 | yes |
| all calls explicit window.Qisi.Utils.* | yes | no | no |
| verify:safe passed | yes | passed in Phase 0 baseline | yes |
| verify:batch-safety passed | yes | passed in Phase 0 baseline | yes |
| smoke:batch:mock passed | yes | passed in Phase 0 baseline | yes |
| verify:pdf-known-bad passed | yes | passed in Phase 0 baseline | yes |
| controlled-write ownership passed | yes | passed in Phase 0 baseline | yes |
| preflight ok:true realApiCalled:false | yes | passed in Phase 0 baseline | yes |
| dry-run ok:true realApiCalled:false | yes | passed in Phase 0 baseline | yes |

## Failed Criteria

Remaining naked A4 callsites are not zero.

Frozen callsites are not zero.

Blocked/frozen residual ownership risks remain.

Not all calls are explicit `window.Qisi.Utils.*` calls.

## Decision

Wrapper removal allowed: no.

Reason: remaining naked A4 callsites = 40 and frozen callsites = 40.

Do not remove wrappers.
