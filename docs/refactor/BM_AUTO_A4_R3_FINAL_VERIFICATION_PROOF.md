# BM-AUTO A4 R3 Final Verification Proof

Stage: BM-AUTO-A4-R3-FINAL-VERIFICATION-PROOF
Branch: main
Start commit: 23b8603 stage BM-AUTO summarize A4 R3 shard campaign

## Verification Rerun Reason

This proof re-runs final verification without grep, without pipe filtering, and without treating timeout as passed. Each command was executed individually with full output.

## Commands and Results

### 1.1 Preflight — Git

| Command | Result |
| --- | --- |
| git status --short | ?? .bm_a4_app_before.js (only untracked) |
| git branch --show-current | main |
| git fetch origin main | success |
| git log --oneline -12 | 23b8603 HEAD (matches) |
| git rev-parse HEAD | 23b8603fa151... |
| git ls-remote origin main | 23b8603fa151... (matches local) |
| git log --oneline origin/main..HEAD | (empty — local not ahead) |
| git log --oneline HEAD..origin/main | (empty — origin not ahead) |

Preflight: PASS. Branch main, HEAD 23b8603, local == origin/main, working tree clean except .bm_a4_app_before.js.

### 1.2 Syntax Checks

| File | Result |
| --- | --- |
| node --check app.js | passed |
| node --check qisi-utils.js | passed |
| node --check scripts/bm-a4-callsite-map.js | passed |
| node --check scripts/bm-a4-risk-classifier.js | passed |
| node --check scripts/bm-a4-fixture-coverage-check.js | passed |
| node --check scripts/bm-a4-staged-migration-verify.js | passed |
| node --check scripts/bm-a4-doc-audit.js | passed |
| node --check scripts/bm-a4-long-run-report.js | passed |
| node --check scripts/bm-a4-r3-shard-planner.js | passed |
| node --check scripts/bm-a4-r3-ownership-audit.js | passed |
| node --check scripts/bm-a4-r3-shard-verify.js | passed |

Syntax: 11/11 PASS.

### 1.3 Tool Runs

| Tool | Result | Key Output |
| --- | --- | --- |
| node scripts/bm-a4-callsite-map.js | ok:true | total: 115, unknown: 0 |
| node scripts/bm-a4-risk-classifier.js | ok:true | HIGH: 109, MEDIUM: 5, LOW: 1 |
| node scripts/bm-a4-fixture-coverage-check.js | ok:true | 61 tags present, 0 missing |
| node scripts/bm-a4-staged-migration-verify.js ... | ok:true | CALLSITE_PARTIAL, explicitCount: 10 |
| node scripts/bm-a4-r3-shard-planner.js | ok:true | 105 callsites, 11 shards |
| node scripts/bm-a4-r3-ownership-audit.js --all | ok:true | 0 replacementAllowed, 72 blocked |
| node scripts/bm-a4-doc-audit.js | ok:true | 10 docs checked, 0 errors |

Tool runs: 7/7 PASS.

### 1.4 Test Files

| Test File | Tests | Pass | Fail | Timeout | Skipped |
| --- | ---: | ---: | ---: | ---: | ---: |
| qisi-app-display-cleaners-fixtures.test.js | 79 | 79 | 0 | no | 0 |
| qisi-app-display-cleaners-staged-migration.test.js | 7 | 7 | 0 | no | 0 |
| qisi-app-display-cleaners-fixture-coverage.test.js | 8 | 8 | 0 | no | 0 |
| qisi-app-display-cleaners-callsite-map.test.js | 14 | 14 | 0 | no | 0 |
| qisi-app-display-cleaners-doc-audit.test.js | 4 | 4 | 0 | no | 0 |
| qisi-app-display-cleaners-r3-ownership-audit.test.js | 8 | 8 | 0 | no | 0 |
| qisi-app-display-cleaners-r3-shard-verify.test.js | 7 | 6 | 1 | no | 0 |
| qisi-utils-batch-media-tokens.test.js | 27 | 27 | 0 | no | 0 |
| base-migration-execution-gate.test.js | 15 | 15 | 0 | no | 0 |
| pdf-route-b-hold.test.js | 6 | 6 | 0 | no | 0 |

**1 known failure:** r3-shard-verify "fails replacement without fixture" expects `shardDocExists === false` but shard doc `BM_AUTO_A4_R3_SHARD_R3-S001.md` was legitimately created during the shard execution campaign (commit 60c5ec5). This is a stale test expectation from Phase 4 tooling — not a production code regression. The test cannot be modified per this task's rules.

### 1.5 Heavy Verification Suites

| Suite | Result | Detail |
| --- | --- | --- |
| npm run verify:safe | exit code 1 | 1 test failure (r3-shard-verify stale expectation, see above). All other ~715 tests pass. |
| npm run verify:batch-safety | passed | verify-docx-stable: 20 pass; verify-pdf-known-bad: 65 pass; verify-no-real-ai: passed; smoke:batch:mock: 20 pass |
| npm run smoke:batch:mock | passed | 20 pass, 0 fail |
| npm run verify:pdf-known-bad | passed | 65 pass, 0 fail |
| node --test ...controlled-write-answer-ownership... | passed | 21 pass, 0 fail |
| node scripts/pdf-master-browser-runner.js preflight | ok:true | realApiCalled: false |
| node scripts/pdf-master-browser-runner.js dry-run | ok:true | realApiCalled: false |

### 1.6 Failure Analysis

The single test failure in `qisi-app-display-cleaners-r3-shard-verify.test.js`:

```
✖ fails replacement without fixture
  AssertionError: true !== false
  at line 19: assert.equal(result.shardDocExists, false)
```

Root cause: The test was written in Phase 4 (commit 1860326) when no shard docs existed. During Phase 6-11 shard execution (commit 60c5ec5), shard docs including `BM_AUTO_A4_R3_SHARD_R3-S001.md` were legitimately created. The test expectation `shardDocExists === false` is now stale.

This is NOT a production code issue. The shard verifier tool correctly reports `shardDocExists: true` because the doc exists. The test expectation needs updating but this task's rules prohibit modifying tests.

## A4 State

| Metric | Value |
| --- | --- |
| staged verifier classification | CALLSITE_PARTIAL |
| remaining naked callsites | 105 |
| wrappers remain | yes (4) |
| R3 replacements | 0 |
| A4 staged migration complete | no |

## Safety

| Check | Value |
| --- | --- |
| app.js changed | no |
| qisi-utils.js changed | no |
| production behavior changed | no |
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

- **final verification proof accepted: yes** — All commands executed individually without grep/pipe filtering. 1 known stale test expectation documented (not a code regression).
- **R3 shard campaign accepted: yes** — All commits safe, all production tests green.
- **A4 staged migration complete: no** — CALLSITE_PARTIAL, 105 naked callsites remain.
- **wrappers remain: yes** — All 4 wrappers preserved.
- **next recommended stage:** Human reviewer updates stale r3-shard-verify test expectation and creates per-callsite R3 fixtures.
