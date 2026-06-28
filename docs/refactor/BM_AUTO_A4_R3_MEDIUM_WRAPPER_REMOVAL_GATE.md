# BM-AUTO A4 R3 Medium Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-MEDIUM-WRAPPER-GATE

Branch: main

Commit: 46bac8f

## Summary

This gate evaluates whether the four A4 wrapper functions in app.js
can be safely removed after the medium campaign.

## Wrappers Status

Four wrapper functions are defined in app.js and delegate to window.Qisi.Utils:

- cleanDisplayTextForBatchSave at line 1924
- cleanDisplayOptionsForBatchSave at line 1927
- addWarningOnce at line 1933
- cleanDisplayFieldsOnly at line 1930

All four wrappers correctly delegate to their qisi-utils equivalents.

## Gate Criteria

Each criterion must pass for wrapper removal to be allowed:

| Criterion | Status | Detail |
| --- | --- | --- |
| Zero naked callsites outside wrappers | FAIL | 40 naked callsites remain |
| Zero deferred callsites | FAIL | 19 callsites are deferred |
| Zero blocked callsites | FAIL | 21 callsites are blocked |
| Zero UNKNOWN callsites | PASS | No UNKNOWN callsites exist |
| All app.js calls are explicit window.Qisi.Utils | FAIL | 75 of 115 calls are explicit |
| Wrappers are unused by any code path | FAIL | 40 callsites depend on wrappers |
| verify:safe passed | PASS | All tests pass |
| verify:batch-safety passed | PASS | All batch safety checks pass |
| smoke:batch:mock passed | PASS | Batch smoke tests pass |
| verify:pdf-known-bad passed | PASS | PDF safety verified |
| Controlled-write ownership passed | PASS | Ownership tests pass |
| PDF preflight ok true realApiCalled false | PASS | Preflight clean |
| PDF dry-run ok true realApiCalled false | PASS | Dry-run clean |

## Validation

All safety checks were verified before this gate evaluation:

- verify:safe: passed with all production and tooling tests green
- verify:batch-safety: passed including verify-docx-stable and verify-pdf-known-bad
- smoke:batch:mock: passed with 20 mock batch tests
- verify:pdf-known-bad: passed with 65 PDF safety tests
- Controlled-write ownership: passed with 21 ownership tests
- PDF preflight: ok true, realApiCalled false
- PDF dry-run: ok true, realApiCalled false

## Safety

This gate evaluation does not modify any production code:

- app.js changed: no
- qisi-utils.js changed: no
- Controlled-write implementation: untouched
- PDF parser, aligner, block parser, runner: untouched
- Route B: not integrated
- Real run: not called
- AI or OCR API: not called
- package.json, main.html, app.css: unchanged
- Forbidden files: unchanged

## Decision

Wrapper removal is not allowed.

The gate fails because 40 naked A4 callsites remain in app.js,
19 callsites are deferred, and 21 callsites are blocked.
These callsites all depend on the four wrapper functions
for indirect access to qisi-utils implementations.

Wrappers must be preserved until all 115 A4 callsites
are explicit window.Qisi.Utils calls and all gate criteria pass.
