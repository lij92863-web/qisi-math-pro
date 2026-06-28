# BM-AUTO A4 R3 Medium Campaign Summary

Stage: BM-AUTO-A4-R3-MEDIUM-CAMPAIGN-SUMMARY

Branch: main

Start commit: 8600200 stage BM-AUTO summarize A4 R3 continue campaign

End commit: 46bac8f stage BM-AUTO process A4 R3 medium batches MED-002 to 005 (medium exhausted)

## All Commits

This medium campaign consisted of 4 commits:

| Commit | Message |
| --- | --- |
| e7b8dd5 | stage BM-AUTO harden A4 doc audit |
| 0ac03a5 | stage BM-AUTO inventory A4 R3 medium candidates |
| 4b1e672 | stage BM-AUTO process A4 R3 medium batch MED-001 |
| 46bac8f | stage BM-AUTO process A4 R3 medium batches MED-002 to 005 (medium exhausted) |

## Callsites

Summary of callsite changes during the medium campaign:

| Metric | Count |
| --- | ---: |
| Starting naked callsites | 45 |
| Replaced in medium campaign | 5 |
| Total R3 replaced across all campaigns | 65 |
| Remaining naked callsites | 40 |
| Deferred callsites (DEFER plus remaining PROOF_REQUIRED) | 19 |
| Blocked callsites (BLOCK_UNTIL_MANUAL) | 21 |
| Unknown callsites | 0 |
| Wrappers remain | 4 |
| Explicit module callsites in app.js | 75 |

## Medium Batches

Five medium batches were executed, each replacing one callsite:

| Batch | Callsite Replaced | Line |
| --- | --- | ---: |
| MED-001 | cleanDisplayTextForBatchSave | 2819 |
| MED-002 | cleanDisplayOptionsForBatchSave | 2820 |
| MED-003 | cleanDisplayOptionsForBatchSave | 16933 |
| MED-004 | cleanDisplayOptionsForBatchSave | 19275 |
| MED-005 | cleanDisplayTextForBatchSave | 13559 |

Each batch was processed with the medium mode batch executor,
which selects only PROOF_REQUIRED candidates with PROVE_WITH_CONTEXT_FIXTURE proof decisions.
Each replacement was verified with full safety checks before commit.

## Tools Built

The medium campaign added medium mode support to the batch executor
and hardened the document audit tool:

- scripts/bm-a4-r3-batch-executor.js: Added medium mode flag
- scripts/bm-a4-doc-audit.js: Added escaped newline detection and heading count checks
- tests/qisi-app-display-cleaners-doc-audit.test.js: Added 8 new test cases
- tests/qisi-app-display-cleaners-r3-batch-shards.test.js: Added medium mode tests

## Classification

The staged migration verifier reports the following state:

- Classification: CALLSITE_PARTIAL
- Explicit count: 75 callsites use window.Qisi.Utils directly
- Remaining naked callsites: 40
- All four wrappers remain in app.js

## Validation

All validation checks passed throughout the medium campaign:

- Node.js syntax checks for all production files: passed
- Tool runs for all A4 tooling scripts: passed
- Tool tests including batch shards with medium mode: 10 tests passing
- Fixture tests: 85 tests passing
- Staged migration verifier: CALLSITE_PARTIAL
- verify:safe: passed
- verify:batch-safety: passed
- smoke:batch:mock: passed
- verify:pdf-known-bad: passed
- Controlled-write ownership tests: passed
- PDF preflight: ok true with realApiCalled false
- PDF dry-run: ok true with realApiCalled false

## Safety

Safety boundaries were strictly maintained:

- app.js changed: yes, five callsite replacements only
- qisi-utils.js changed: no
- Production behavior changed: no
- Controlled-write implementation touched: no
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

The medium campaign is accepted.

- Medium campaign accepted: yes
- A4 staged migration complete: no
- Wrappers remain: yes, all four wrappers are still needed
- Remaining blocker: 40 callsites require manual review
- Next recommended stage: Human reviewer analyzes the remaining
  40 callsites for ownership safety before further automated processing
