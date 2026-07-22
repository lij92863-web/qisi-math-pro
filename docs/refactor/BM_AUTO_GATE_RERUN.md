# BM-AUTO GATE RERUN VERIFICATION

Stage: Historical BM-AUTO documentation
Historical-Status: retained for audit trail

## Context

| Item | Value |
|------|-------|
| Current HEAD | `d9daf40` stage BM-AUTO gate correct verification record |
| BM-AUTO commit | `bdfc33b` stage BM-AUTO add real migration control system |
| Correction commit | `d9daf40` stage BM-AUTO gate correct verification record |
| Local / remote sync | YES — `d9daf40` on both local and origin/main |
| Working tree | clean |

## Purpose

The original gate verification (commit `2bc9125`) incorrectly recorded `verify:safe` and `dry-run`
as PASSED when they had timed out at the harness level. This rerun provides clean,
non-timeout execution of both commands, plus all core safety checks.

## Rerun results

### verify:safe
```
Command:  npm.cmd run verify:safe
Timeout:  600s (10 min)
Result:   PASSED
Exit:     0
Details:
  - node --check all .js files: pass
  - node --test: 297 pass, 0 fail, 0 skipped, 0 to-do (3935ms)
  - smoke:batch:mock: 20 pass, 0 fail
  - verify:no-real-ai: passed
```

### dry-run
```
Command:  node scripts/pdf-master-browser-runner.js dry-run
Timeout:  120s (2 min)
Result:   PASSED
Exit:     0
Details:
  - ok: true
  - server started, health 200
  - browser opened app page: TEX题库 | 题库架构拆分版
  - realApiCalled: false
  - result: pass
```

### base-migration-execution-gate
```
Command:  node --test tests/base-migration-execution-gate.test.js
Timeout:  120s
Result:   PASSED
Exit:     0
Tests:    13 pass, 0 fail, 0 skipped
```

### pdf-route-b-hold
```
Command:  node --test tests/pdf-route-b-hold.test.js
Timeout:  60s
Result:   PASSED
Exit:     0
Tests:    6 pass, 0 fail, 0 skipped
```

### verify:batch-safety
```
Command:  npm.cmd run verify:batch-safety
Timeout:  180s
Result:   PASSED
Exit:     0
Details:
  - verify:docx-stable: 20 pass
  - verify:pdf-known-bad: 65 pass
  - verify:no-real-ai: passed
  - smoke:batch:mock: 20 pass
```

### preflight
```
Command:  node scripts/pdf-master-browser-runner.js preflight
Timeout:  30s
Result:   PASSED
Exit:     0
Details:
  - ok: true
  - 7/7 checks pass
  - realApiCalled: false
```

### verify:diff-scope
```
Command:  $env:QISI_ALLOWED_DIFF="docs/refactor/**"; npm.cmd run verify:diff-scope
Result:   PASSED (effective — files staged before run)
```
(executed after staging — see section 6 procedure)

## Timeout / skipped / failed summary

| Status | Count |
|--------|-------|
| Timeout | 0 |
| Skipped | 0 |
| Failed | 0 |

**All commands exited cleanly within their timeouts with exit code 0.**

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

**ACCEPTED** — The two previously-timed-out commands (`verify:safe`, `dry-run`) have been
rerun with sufficient timeout and both exited cleanly with exit code 0. All additional
safety checks pass. diff-scope is effective (files staged before run).

- 0 timeouts
- 0 skipped
- 0 failed
- All 7 gate commands pass
- All safety invariants hold

**Allowed to enter BM-AUTO Round 1.**
