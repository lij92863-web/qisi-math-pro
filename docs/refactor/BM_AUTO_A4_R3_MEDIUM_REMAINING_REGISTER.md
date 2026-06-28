# BM-AUTO A4 R3 Medium Remaining Register

Stage: BM-AUTO-A4-R3-MEDIUM-REMAINING

Branch: main

Commit: 46bac8f

## Summary

After both AUTO_FIXTURE_CANDIDATE and PROVE_WITH_CONTEXT_FIXTURE pools were exhausted,
40 naked A4 callsites remain in app.js that cannot be automatically replaced.

| Category | Count |
| --- | ---: |
| Remaining naked callsites | 40 |
| PROOF_REQUIRED but not PROVE_WITH_CONTEXT_FIXTURE | 8 |
| DEFER requiring stronger proof than current tooling | 11 |
| BLOCK requiring manual human review | 21 |
| Explicit window.Qisi.Utils calls in app.js | 75 |
| Wrappers still present in app.js | 4 |

## Why Each Category Cannot Be Replaced

### PROOF_REQUIRED (8 remaining)

These callsites passed the candidate ranker with scores between 70 and 84
but the proof builder could not produce a PROVE_WITH_CONTEXT_FIXTURE decision.
They need either stronger context analysis or per-callsite fixture review.

### DEFER (11 remaining)

These callsites scored between 50 and 69 in the candidate ranker.
The proof builder classified them as DEFER_COMPLEX_MUTATION.
They touch multiple data fields or have complex mutation patterns
that require deeper analysis before replacement.

### BLOCK (21 remaining)

These callsites scored below 50 or have explicit ownership risk markers.
They are classified as BLOCK_UNTIL_MANUAL.
Each requires a human reviewer to examine the surrounding context and
determine whether replacement would change answer ownership,
solution ownership, support attachment, or PDF processing behavior.

## Remaining by Helper Function

| Helper | Approximate Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 17 |
| cleanDisplayOptionsForBatchSave | 17 |
| addWarningOnce | 5 |
| cleanDisplayFieldsOnly | 1 |

## Required Future Evidence

For each remaining callsite, the following must be established before replacement:

- Exact data fields read and written by the callsite
- Whether the callsite is adjacent to controlled-write operations
- Whether the callsite affects PDF answer or solution ownership
- Whether the callsite modifies support attachment data
- Whether the callsite touches answer or solution fields in draft objects
- Per-callsite fixture proving that window.Qisi.Utils replacement is behaviorally equivalent

## Validation

The following checks were verified at the time of this register:

- verify:safe: passed with all tests green
- Staged migration verifier: CALLSITE_PARTIAL with explicitCount 75
- verify:pdf-known-bad: passed
- Controlled-write ownership: passed

## Safety

No production code was changed in this documentation stage:

- app.js changed: no
- qisi-utils.js changed: no
- Controlled-write touched: no
- PDF parser, aligner, block parser, runner: untouched
- Forbidden files: untouched

## Decision

Medium candidate processing is complete.
The remaining 40 callsites require manual review.
Automated replacement is not safe for these remaining callsites
under current tooling and safety constraints.
