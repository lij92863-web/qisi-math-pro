# BM-AUTO Chain A A4 Final Wrapper Removal Gate

Stage: BM-AUTO-CHAIN-A-A4-FINAL-WRAPPER-REMOVAL-GATE
Branch: main
Current commit: 842ecb6 stage BM-AUTO document A4 remaining callsites

## Gate Criteria Evaluation

Wrapper removal is only allowed when ALL of the following conditions are satisfied:

| Criterion | Status | Detail |
| --- | --- | --- |
| No remaining naked A4 callsites outside wrapper definitions | **FAIL** | 105 naked callsites remain in app.js |
| No UNKNOWN callsites | PASS | 0 UNKNOWN callsites |
| No BLOCK callsites | PASS | 0 BLOCK callsites |
| No deferred MEDIUM/HIGH callsites | **FAIL** | 105 HIGH-risk callsites deferred to R3 |
| All app.js calls explicit window.Qisi.Utils.* | **FAIL** | Only 10 of 115 callsites are explicit; 105 use naked wrapper calls |
| Wrappers no longer needed | **FAIL** | 105 callsites still depend on wrappers |
| verify:safe passed | PASS | 674 pass, 0 fail |
| verify:pdf-known-bad passed | PASS | All PDF known-bad tests pass |
| controlled-write ownership passed | PASS | All controlled-write ownership tests pass |
| preflight/dry-run ok:true realApiCalled:false | PASS | Both preflight and dry-run pass with realApiCalled:false |

## Decision

**Wrapper removal allowed: no**

**Reason:** 4 of 10 gate criteria fail:
1. 105 naked callsites remain — wrappers are the only indirection layer for these calls.
2. 105 HIGH-risk callsites are deferred — they depend on wrappers for safe access to qisi-utils.
3. Only 10 of 115 callsites use explicit window.Qisi.Utils.* — far from the "all calls explicit" requirement.
4. Wrappers are still needed by 105 active callsites.

Removing wrappers would leave 105 callsites with no indirection, requiring each to be individually migrated — exactly the R3 work that was blocked by safety concerns (see BM_AUTO_CHAIN_A_A4_STOP_R3_NO_SAFE_CANDIDATES.md).

## Next Steps

- Skip Phase 9 (wrapper removal): Not allowed by gate.
- Proceed to Phase 10 (stale test alignment): Not needed; all tests pass.
- Proceed to Phase 11 (documentation audit).
- Proceed to Phase 12 (full verification).
- Proceed to Phase 13 (final summary).
