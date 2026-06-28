# BM-AUTO A4 R3 Medium Campaign Summary

Stage: BM-AUTO-A4-R3-MEDIUM-CAMPAIGN-SUMMARY

Branch: main

Start commit: 8600200

End commit: 46bac8f

## All Commits

Four commits in this medium campaign:

| Commit | Message |
| --- | --- |
| e7b8dd5 | stage BM-AUTO harden A4 doc audit |
| 0ac03a5 | stage BM-AUTO inventory A4 R3 medium candidates |
| 4b1e672 | stage BM-AUTO process A4 R3 medium batch MED-001 |
| 46bac8f | stage BM-AUTO process A4 R3 medium batches MED-002 to 005 |

## Callsites

| Metric | Count |
| --- | ---: |
| Starting naked callsites | 45 |
| Replaced in medium campaign | 5 |
| Total R3 replaced across all campaigns | 65 |
| Remaining naked callsites | 40 |
| Deferred callsites | 19 |
| Blocked callsites | 21 |
| Unknown callsites | 0 |
| Wrappers remain | 4 |
| Explicit module callsites | 75 |

## Medium Batches

| Batch | Callsite Replaced | Line |
| --- | --- | ---: |
| MED-001 | cleanDisplayTextForBatchSave | 2819 |
| MED-002 | cleanDisplayOptionsForBatchSave | 2820 |
| MED-003 | cleanDisplayOptionsForBatchSave | 16933 |
| MED-004 | cleanDisplayOptionsForBatchSave | 19275 |
| MED-005 | cleanDisplayTextForBatchSave | 13559 |

Each batch used medium mode selecting PROOF_REQUIRED candidates with PROVE_WITH_CONTEXT_FIXTURE proof decisions. Full safety verification was run before each commit.

## Classification

Staged migration verifier: CALLSITE_PARTIAL with explicitCount 75.

## Validation

All checks passed throughout the medium campaign:

- Node.js syntax checks: passed for all production files
- Tool runs for A4 tooling scripts: passed
- Tool tests including batch shards with medium mode: 10 tests
- Fixture tests: 85 tests
- Staged migration verifier: CALLSITE_PARTIAL
- verify:safe: passed
- verify:batch-safety: passed
- smoke:batch:mock: passed
- verify:pdf-known-bad: passed
- Controlled-write ownership: passed
- PDF preflight: ok true realApiCalled false
- PDF dry-run: ok true realApiCalled false

## Safety

Safety boundaries were maintained:

- app.js changed: yes, five callsite replacements only
- qisi-utils.js changed: no
- Production behavior changed: no
- Controlled-write touched: no
- PDF parser touched: no
- PDF aligner touched: no
- PDF block parser touched: no
- PDF runner touched: no
- Route B integrated: no
- Real run called: no
- AI or OCR API called: no
- package.json changed: no
- main.html changed: no
- Official verifier changed: no
- Forbidden files changed: no

## Decision

Medium campaign accepted: yes.
A4 staged migration complete: no.
Wrappers remain: yes, all four wrappers are still needed.
Remaining blocker: 40 callsites require manual review.
Next recommended stage: Human reviewer analyzes remaining 40 callsites.
