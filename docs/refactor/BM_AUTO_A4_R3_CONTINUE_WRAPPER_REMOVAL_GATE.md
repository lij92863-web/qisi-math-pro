# BM-AUTO A4 R3 Continue Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-CONTINUE-WRAPPER-GATE
Branch: main
Commit: 46533b1

## Summary

Wrapper removal gate for the R3 continue campaign.
Gate evaluation determines whether the four A4 wrapper functions can be safely removed from app.js.

## Wrappers Status

Four wrappers remain in app.js:
- cleanDisplayTextForBatchSave (line 1924)
- cleanDisplayOptionsForBatchSave (line 1927)
- addWarningOnce (line 1933)
- cleanDisplayFieldsOnly (line 1930)

All wrappers delegate to window.Qisi.Utils.* equivalents.

## Gate Criteria

| Criterion | Status | Detail |
| --- | --- | --- |
| 0 naked callsites outside wrappers | FAIL | 45 naked callsites remain |
| All app.js calls explicit window.Qisi.Utils.* | FAIL | 70 of 115 calls are explicit |
| Wrappers unused | FAIL | 45 callsites depend on wrappers |
| UNKNOWN callsites = 0 | PASS | 0 UNKNOWN |
| Deferred callsites = 0 | FAIL | 24 deferred |
| Blocked callsites = 0 | FAIL | 21 blocked |
| verify:safe passed | PASS | All tests green |
| verify:batch-safety passed | PASS | All safety checks pass |
| verify:pdf-known-bad passed | PASS | PDF safety verified |
| controlled-write ownership passed | PASS | Ownership verified |
| preflight ok:true realApiCalled:false | PASS | Preflight clean |
| dry-run ok:true realApiCalled:false | PASS | Dry-run clean |

## Tests

- verify:safe: passed
- verify:batch-safety: passed
- smoke:batch:mock: passed
- verify:pdf-known-bad: passed
- controlled-write ownership: passed
- preflight: ok:true
- dry-run: ok:true

## Safety

- app.js changed: no in this stage
- qisi-utils.js changed: no
- controlled-write touched: no
- parser/aligner/runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package/main.html changed: no

## Decision

**Wrapper removal allowed: no.**

45 naked callsites remain. 24 deferred. 21 blocked.
Wrappers must be preserved until all 115 callsites are explicit window.Qisi.Utils.* calls and all gate criteria pass.
