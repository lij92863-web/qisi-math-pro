# BM-AUTO GATE CORRECTION

## Summary

Commit `2bc9125` (`stage BM-AUTO gate verification`) was pushed with an inaccurate
gate verification record in `docs/refactor/BM_AUTO_GATE_VERIFICATION.md`.

## What was wrong

| Issue | Detail |
|-------|--------|
| verify:safe recorded as PASSED | The npm command timed out at the 5-minute harness-level timeout. All visible sub-test output (297 tests, check, smoke, no-real-ai) was passing, but the command itself did not exit. |
| dry-run recorded as PASSED | The command timed out at the 1-minute harness-level timeout. The partial JSON output showed `ok: true`, `realApiCalled: false`, browser chain verified — but the command did not exit cleanly. |
| Timeout count recorded as 0 | Two commands timed out. The count should be at least 2. |
| verify:diff-scope recorded as effective PASSED | diff-scope returned "passed: no changed files" because the new document was **untracked** at the time. diff-scope only checks `git diff` and `git diff --cached`, neither of which includes untracked files. This result is true but meaningless for gating the new document. |
| Conclusion recorded as ACCEPTED | With 2 unresolved timeouts and an ineffective diff-scope, the correct conclusion is REJECTED / INCONCLUSIVE. |

## Root cause

The harness tool-timeout limits (5m for verify:safe, 1m for dry-run) were shorter
than the commands' actual execution time. The tools returned partial success output
before being killed by the timeout, creating a false impression of completion.

For verify:diff-scope, the document was created but not yet `git add`-ed, so `git diff`
and `git diff --cached` both returned empty — the document was invisible to the check.

## Corrections applied

1. `docs/refactor/BM_AUTO_GATE_VERIFICATION.md` has been corrected:
   - verify:safe → **TIMEOUT** (5m)
   - dry-run → **TIMEOUT** (1m)
   - Timeout count → **2**
   - verify:diff-scope → **passed but ineffective** (untracked document)
   - Conclusion → **REJECTED / INCONCLUSIVE**

2. This correction document (`BM_AUTO_GATE_CORRECTION.md`) records the errors
   and the correction for audit trail.

## Current decision

**BM-AUTO Round 1 remains PROHIBITED.**

The gate has not been cleared. Before BM-AUTO Round 1 can proceed:

1. `verify:safe` must be rerun and must exit cleanly within its timeout
2. `dry-run` must be rerun and must exit cleanly within its timeout
3. `verify:diff-scope` must be rerun with all changed files tracked (git-added)
   and must produce a meaningful pass

Until all three conditions are met, the gate is not satisfied.

## Commit reference

- Erroneous gate commit: `2bc9125` stage BM-AUTO gate verification
- Correction commit: to be committed as `stage BM-AUTO gate correct verification record`
