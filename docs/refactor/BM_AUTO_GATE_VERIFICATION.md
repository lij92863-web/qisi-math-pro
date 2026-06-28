# BM-AUTO GATE VERIFICATION

Stage: Historical BM-AUTO documentation
Historical-Status: retained for audit trail

## BM-AUTO commit
`bdfc33b` — stage BM-AUTO add real migration control system

## Local / remote sync

| Check | Value |
|-------|-------|
| Local HEAD | `bdfc33bf0c0b652722bf46798fd8555085a3c776` |
| Remote origin/main | `bdfc33bf0c0b652722bf46798fd8555085a3c776` |
| Branch | main |
| Local ahead of remote | (none) |
| Remote ahead of local | (none) |
| Working tree | clean |
| **Local equals remote** | **YES** |

## 6 BM-AUTO files tracked

| # | File | Tracked |
|---|------|---------|
| 1 | `scripts/base-migration-inventory.js` | ✅ |
| 2 | `scripts/base-migration-score.js` | ✅ |
| 3 | `scripts/base-migration-verify-execution.js` | ✅ |
| 4 | `tests/base-migration-execution-gate.test.js` | ✅ |
| 5 | `docs/refactor/BM_AUTO_CALL_GRAPH_MIGRATION_CONTROL.md` | ✅ |
| 6 | `docs/refactor/BM_AUTO_MIGRATION_PROTOCOL.md` | ✅ |

**All 6 BM-AUTO files confirmed tracked in Git.**

## Test results (run individually, 2026-06-22 ~11:50 UTC)

### Test 1: base-migration-execution-gate
```
Command: node --test tests/base-migration-execution-gate.test.js
Result: PASSED
Tests: 13 pass, 0 fail, 0 skipped, 0 to-do
Duration: 648ms
Summary: All 13 tests pass including BM21→SCAFFOLD_ONLY, BM24→REAL_MIGRATION,
         INVALID detection, DOM/db/AI/OCR ineligibility, and scoring hard gates.
```

### Test 2: pdf-route-b-hold
```
Command: node --test tests/pdf-route-b-hold.test.js
Result: PASSED
Tests: 6 pass, 0 fail, 0 skipped, 0 to-do
Duration: 66ms
Summary: Route B confirmed research-only — no imports in controlled-write,
         runner, or app.js. Q8/Q9 continue as safe partial by design.
```

### Test 3: verify:safe
```
Command: npm.cmd run verify:safe
Result: TIMEOUT (5m tool-level timeout)
Partial output: node --check all .js files passed, node --test showed 297 pass
                 (all sub-tests passing in visible output), smoke:batch:mock 20 pass,
                 verify:no-real-ai passed, BUT the npm command as a whole did not
                 exit within the 5-minute tool timeout — the harness killed it.
⚠ CORRECTION: previously recorded as PASSED in error. The command timed out
  at the harness level even though all visible test output was passing.
```

### Test 4: verify:batch-safety
```
Command: npm.cmd run verify:batch-safety
Result: PASSED
- verify:docx-stable: 20 pass, 0 fail
- verify:pdf-known-bad: 65 pass, 0 fail
- verify:no-real-ai: passed
- smoke:batch:mock: 20 pass, 0 fail
```

### Test 5: preflight
```
Command: node scripts/pdf-master-browser-runner.js preflight
Result: PASSED
ok: true
7/7 checks pass (project-root, case02 PDFs, artifacts gitignored,
API key env present, server start script, browser automation)
realApiCalled: false
```

### Test 6: dry-run
```
Command: node scripts/pdf-master-browser-runner.js dry-run
Result: TIMEOUT (1m tool-level timeout)
Partial output: ok: true, server started, health check 200, browser opened app
                 page successfully, realApiCalled: false, BUT the command did not
                 exit within the 1-minute tool timeout — the harness killed it.
⚠ CORRECTION: previously recorded as PASSED in error. The command timed out
  at the harness level even though visible JSON output showed ok:true.
```

## verify:diff-scope
```
Command: $env:QISI_ALLOWED_DIFF="docs/refactor/**"; npm.cmd run verify:diff-scope
Result: passed but ineffective
Output: [verify-diff-scope] passed: no changed files
```
⚠ CORRECTION: diff-scope returned "passed: no changed files" because the new
  document (BM_AUTO_GATE_VERIFICATION.md) was untracked at the time diff-scope
  ran. diff-scope only checks tracked file changes via `git diff` and
  `git diff --cached`. An untracked file is invisible to diff-scope.
  This diff-scope result cannot serve as a valid gate for the new document.

## Timeout / skipped / failed summary

| Status | Count |
|--------|-------|
| Timeout | 2 (verify:safe 5m, dry-run 1m) |
| Skipped | 0 |
| Failed | 0 |

⚠ CORRECTION: previously recorded as 0 timeouts. Two commands timed out at
  the harness level. All visible sub-test output was passing, but the commands
  themselves did not exit within their tool timeout windows.

**2 timeouts, 0 skipped, 0 failed. Gate record is INCONCLUSIVE.**

## Untracked / ignored files

| Category | Files |
|----------|-------|
| Untracked project files | (none) |
| Ignored local files | `.claude/`, `.env`, `CODEX_TASK.local.md`, `local-run-artifacts/`, `local-test-materials/`, `node_modules/`, `tmp/` |

No project files are untracked. All ignored files are correctly excluded (local config, test materials, task file, runtime artifacts, dependencies, temp directory).

## Safety invariants

| Invariant | Status |
|-----------|--------|
| app.js untouched | ✅ |
| main.html untouched | ✅ |
| qisi-*.js untouched | ✅ |
| package.json / package-lock.json unchanged | ✅ |
| tests/*.test.js unchanged | ✅ |
| Route B not integrated | ✅ |
| controlled-write untouched | ✅ |
| real-run not called | ✅ |
| AI/OCR not called | ✅ |

## Conclusion

**REJECTED / INCONCLUSIVE** — The gate verification record initially claimed ACCEPTED
with 0 timeouts, but the actual tool-level results show:

- verify:safe: **TIMEOUT** at 5m (all visible sub-tests passing, but command did not exit)
- dry-run: **TIMEOUT** at 1m (ok:true in partial output, but command did not exit)
- verify:diff-scope: passed but **ineffective** — the new document was untracked,
  so diff-scope could not inspect it

**Must not enter BM-AUTO Round 1 until:**
1. verify:safe is rerun and exits cleanly within timeout
2. dry-run is rerun and exits cleanly within timeout
3. verify:diff-scope is rerun with the new document git-added (so it is visible to git diff --cached)

⚠ CORRECTION: the original conclusion of "ACCEPTED" and "Allowed to enter BM-AUTO Round 1"
  was incorrect. This document now reflects the corrected assessment.
