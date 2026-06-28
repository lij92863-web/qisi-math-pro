# BM-AUTO A4 R3 Medium Wrapper Removal Gate

Stage: BM-AUTO-A4-R3-MEDIUM-WRAPPER-GATE

Branch: main

Commit: 46bac8f

## Summary

This gate evaluates whether the four A4 wrapper functions in app.js can be safely removed after the medium campaign.

## Wrappers Status

Four wrapper functions are defined in app.js:

- cleanDisplayTextForBatchSave at line 1924
- cleanDisplayOptionsForBatchSave at line 1927
- addWarningOnce at line 1933
- cleanDisplayFieldsOnly at line 1930

All four correctly delegate to window.Qisi.Utils equivalents.

## Gate Criteria

| Criterion | Status | Detail |
| --- | --- | --- |
| Zero naked callsites outside wrappers | FAIL | 40 remain |
| Zero deferred callsites | FAIL | 19 deferred |
| Zero blocked callsites | FAIL | 21 blocked |
| Zero UNKNOWN callsites | PASS | 0 UNKNOWN |
| All calls explicit window.Qisi.Utils | FAIL | 75 of 115 |
| Wrappers unused by any code path | FAIL | 40 depend |
| verify:safe passed | PASS | All green |
| verify:batch-safety passed | PASS | All pass |
| smoke:batch:mock passed | PASS | 20 pass |
| verify:pdf-known-bad passed | PASS | 65 pass |
| Controlled-write ownership passed | PASS | 21 pass |
| PDF preflight ok true realApiCalled false | PASS | Clean |
| PDF dry-run ok true realApiCalled false | PASS | Clean |

## Validation

All safety checks verified before this gate evaluation:

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

The gate fails because 40 naked A4 callsites remain in app.js, 19 callsites are deferred, and 21 callsites are blocked. Wrappers must be preserved until all 115 A4 callsites are explicit window.Qisi.Utils calls and all gate criteria pass.
