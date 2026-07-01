# BM-AUTO Round 1 Real Migration

## Stage

BMR1/BMG1

## Start Commit

73c041d3a8547c506c1b180e1dcb14393ecfc6aa

## Candidate

- selected candidate: `repairChoiceOptions, tryRepairedCandidate`
- target module: `qisi-support-repair.js`
- old functions:
  - `repairChoiceOptions`
  - `tryRepairedCandidate`
- original app.js line ranges:
  - `repairChoiceOptions`: `2175-2196`
  - `tryRepairedCandidate`: `6154-6223`
- score: `82`
- reason selected: highest eligible BM-AUTO group, low risk, no DOM/DB/AI/OCR/controlled-write/async markers, and target module already existed.

## Migration

- moved functions:
  - `repairChoiceOptions`
  - `tryRepairedCandidate`
- app.js calls new module: yes, via `window.Qisi.SupportRepair.repairChoiceOptions(...)` and `window.Qisi.SupportRepair.tryRepairedCandidate(...)`
- old definitions removed: yes

## Execution Verification

- before app.js lines: `22785`
- after app.js lines: `22722`
- delta: `-63`
- classification: `REAL_MIGRATION`
- oldDefinitionsStillPresent: `false`
- appCallsNewModule: `true`
- moduleExportsMovedFunctions: `true`

## Gate Failure and Fix

- original failed test: `tests/qisi-app-display-cleaners-r3-ownership-audit.test.js`
- root cause: `B. TEST_STATIC_RULE_NEEDS_MODULE_AWARE_UPDATE`
- fix document: `docs/refactor/BMR1_TEST_AWARE_FIX.md`

The ownership audit test used stale fixed app.js line numbers. The test now resolves stable callsite anchors and includes migrated `window.Qisi.SupportRepair` module-call coverage.

## Tests

| Command | Result |
| --- | --- |
| `node --test tests/support-repair.test.js` | passed |
| `node --test tests/qisi-app-display-cleaners-r3-ownership-audit.test.js` | passed |
| `node --test tests/base-migration-execution-gate.test.js` | passed |
| `node --test tests/pdf-route-b-hold.test.js` | passed |
| `npm.cmd run smoke:batch:mock` | passed |
| `npm.cmd run verify:safe` | passed |
| `npm.cmd run verify:batch-safety` | passed |
| `npm.cmd run verify:pdf-known-bad` | passed |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | passed |
| `node scripts/pdf-master-browser-runner.js preflight` | passed |
| `node scripts/pdf-master-browser-runner.js dry-run` | passed |

## Safety

- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no

## Decision

REAL_MIGRATION ACCEPTED

## Next Stage

Stop. Do not enter Round 2 automatically.
