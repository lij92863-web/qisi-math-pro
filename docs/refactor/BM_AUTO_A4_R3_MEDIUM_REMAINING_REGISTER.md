# BM-AUTO A4 R3 Medium Remaining Register

Stage: BM-AUTO-A4-R3-MEDIUM-REMAINING

Branch: main

Commit: 46bac8f

## Summary

After exhausting both AUTO_FIXTURE_CANDIDATE and PROVE_WITH_CONTEXT_FIXTURE pools, 40 naked A4 callsites remain in app.js that cannot be automatically replaced.

| Category | Count |
| --- | ---: |
| Remaining naked callsites | 40 |
| PROOF_REQUIRED without context fixture proof | 8 |
| DEFER requiring stronger proof | 11 |
| BLOCK requiring manual human review | 21 |
| Explicit window.Qisi.Utils calls | 75 |
| Wrappers present in app.js | 4 |

## Why Each Category Cannot Be Replaced

### PROOF_REQUIRED (8 remaining)

These callsites passed the candidate ranker with scores 70-84 but the proof builder could not produce a PROVE_WITH_CONTEXT_FIXTURE decision. They need stronger context analysis.

### DEFER (11 remaining)

These callsites scored 50-69 in the candidate ranker. The proof builder classified them as DEFER_COMPLEX_MUTATION. They touch multiple data fields or have complex mutation patterns.

### BLOCK (21 remaining)

These callsites scored below 50 or have explicit ownership risk markers. Each requires a human reviewer to examine surrounding context for answer ownership, solution ownership, support attachment, or PDF processing behavior changes.

## Remaining by Helper

| Helper | Approx Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 17 |
| cleanDisplayOptionsForBatchSave | 17 |
| addWarningOnce | 5 |
| cleanDisplayFieldsOnly | 1 |

## Required Future Evidence

For each remaining callsite, the following must be established:

- Exact data fields read and written
- Whether adjacent to controlled-write operations
- Whether affecting PDF answer or solution ownership
- Whether modifying support attachment data
- Whether touching answer or solution fields in draft objects
- Per-callsite fixture proving behavioral equivalence

## Validation

Verified at time of this register:

- verify:safe: passed with all tests green
- Staged verifier: CALLSITE_PARTIAL explicitCount 75
- verify:pdf-known-bad: passed
- Controlled-write ownership: passed

## Safety

No production code changed in this documentation stage:

- app.js changed: no
- qisi-utils.js changed: no
- Controlled-write touched: no
- PDF parser, aligner, block parser, runner: untouched
- Forbidden files: untouched

## Decision

Medium candidate processing is complete. The remaining 40 callsites require manual review. Automated replacement is not safe under current tooling and safety constraints.
