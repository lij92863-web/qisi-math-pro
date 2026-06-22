# BM-AUTO Full Rounds 011-013 Audit

Stage: BM-AUTO-FULL-ROUNDS-011-013-AUDIT-CORRECTION
Branch: main
Latest HEAD before audit: `121a7cc`
Audit correction commit: pending

---

## Rounds

| Round | Helper | Commit | Status |
|-------|--------|--------|--------|
| 011 | expandPageRange | `96108f5` | ✅ accepted |
| 012 | normalizeFigureBbox | `e828dc9` | ✅ accepted |
| 013 | bboxIntersectionArea | `121a7cc` | ✅ accepted |

## Protocol findings

| Check | R011 | R012 | R013 |
|-------|------|------|------|
| Docs present before audit | yes (PLAN + REAL) | no | no |
| Docs added/corrected in audit | R011: End commit pending→96108f5 | PLAN + REAL created | PLAN + REAL created |
| Previous logs used tail/grep/truncation | yes (MIMO campaign) | yes (MIMO campaign) | yes (MIMO campaign) |
| Previous logs reported timeout 3m | no | no | suspicious (command had `timeout 3m` prefix in campaign log) |
| Superseded by full audit rerun | yes | yes | yes |
| No forbidden files in commits | yes | yes | yes |

## Code facts (confirmed by full grep audit)

| Check | R011 | R012 | R013 |
|-------|------|------|------|
| explicit app.js call | yes | yes | yes |
| naked calls remaining | 0 | 0 | 0 |
| old definition in app.js | removed | removed | removed |
| qisi-utils.js export | yes | yes | yes |
| function behavior equivalence | confirmed by test | confirmed by test | confirmed by test |

## Tests — audit rerun results (full output, no truncation)

| Command | Result |
|---------|--------|
| `node --check app.js` | passed |
| `node --check qisi-utils.js` | passed |
| `node --test tests/qisi-utils-expand-page-range.test.js` | 13/13 pass |
| `node --test tests/qisi-utils-normalize-figure-bbox.test.js` | 13/13 pass |
| `node --test tests/qisi-utils-bbox-intersection-area.test.js` | 10/10 pass |
| `node scripts/base-migration-verify-execution.js ... bboxIntersectionArea` | REAL_MIGRATION, delta=-15 |
| `node --test tests/base-migration-execution-gate.test.js` | 15/15 pass |
| `node --test tests/pdf-route-b-hold.test.js` | 6/6 pass |
| `npm run verify:safe` | 488/488 pass (check + test + smoke:batch:mock + verify:no-real-ai) |
| `npm run verify:batch-safety` | 105 tests, all pass (docx-stable 20 + pdf-known-bad 65 + smoke:batch:mock 20) |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | 21/21 pass |
| `node scripts/pdf-master-browser-runner.js preflight` | ok:true, realApiCalled:false |
| `node scripts/pdf-master-browser-runner.js dry-run` | ok:true, realApiCalled:false, result:pass |

All commands ran with full output, no tail, no grep. Zero timeouts, zero skipped, zero failed.

Note: The original campaign (R011-R013) had tool-level timeout flags on verify:safe and dry-run commands. This audit-task rerun (and later the sync-fix rerun — see BM_AUTO_FULL_ROUNDS_011_TO_013_AUDIT_SYNC_FIX.md) confirmed no actual timeouts: verify:safe completed 488/488 pass, dry-run completed ok:true within tool limits.

## Safety

| Check | Status |
|-------|--------|
| controlled-write touched | no |
| parser touched | no |
| aligner touched | no |
| runner touched | no |
| Route B integrated | no |
| real-run called | no |
| AI/OCR called | no |
| package changed | no |
| main.html changed | no |
| verifier changed | no |

## Decision

| Check | Result |
|-------|--------|
| R011 accepted after audit | yes |
| R012 accepted after audit | yes |
| R013 accepted after audit | yes |
| allowed to enter R014 | yes — after audit commit is pushed and working tree clean |
