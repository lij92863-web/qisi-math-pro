# BM-AUTO Chain A A4 Current State Audit

Stage: BM-AUTO-CHAIN-A-A4-CURRENT-STATE-AUDIT
Branch: main
Start commit: 1231c49 stage BM-AUTO align A4 safe test expectations
Current commit: 1231c49 stage BM-AUTO align A4 safe test expectations

## A4 Helpers

The four A4 helpers are implemented in `qisi-utils.js` and exported as `window.Qisi.Utils.*`:

- `cleanDisplayTextForBatchSave`
- `cleanDisplayOptionsForBatchSave`
- `addWarningOnce`
- `cleanDisplayFieldsOnly`

## Current Wrappers Status

Four wrappers exist in `app.js` (lines 1924–1934) that delegate to `window.Qisi.Utils.*`:

| Wrapper | Line |
| --- | ---: |
| cleanDisplayTextForBatchSave | 1924 |
| cleanDisplayOptionsForBatchSave | 1927 |
| addWarningOnce | 1933 |
| cleanDisplayFieldsOnly | 1930 |

All four wrappers delegate correctly to `window.Qisi.Utils.*` equivalents.
Wrapper removal is NOT allowed at this stage.

## Current Explicit Module Callsites

There are 5 explicit `window.Qisi.Utils.*` calls in `app.js`:
- Lines 1925, 1928, 1931, 1934 (wrapper definitions)
- Line 19576: `window.Qisi.Utils.cleanDisplayFieldsOnly(q);` (already migrated)

## Current Naked Callsites

From the staged migration verifier:

| Helper | Naked Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 43 |
| cleanDisplayOptionsForBatchSave | 43 |
| addWarningOnce | 24 |
| cleanDisplayFieldsOnly | 5 |

Total naked callsites: 115.
Explicit callsites: 5.
Staged verifier classification: CALLSITE_PARTIAL.

## Current Risk Counts

| Risk | Count |
| --- | ---: |
| LOW | 1 |
| MEDIUM | 5 |
| HIGH | 109 |
| BLOCK | 0 |

## R1 Completed Callsites

R1 (DISPLAY_ONLY_PATH without high-risk markers) was completed in prior commits.
Only one DISPLAY_ONLY_PATH callsite was safe to replace: line 19576 (`cleanDisplayFieldsOnly`).

## R2 Candidate Callsites

R2 scope: OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH callsites that are NOT HIGH risk and NOT carrying BATCH_SAVE_PATH / DRAFT_WRITE_PATH / PDF_PATH markers.

Five MEDIUM-risk R2 candidates identified:

| Line | Helper | Risk | Classification |
| ---: | --- | --- | --- |
| 3739 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH |
| 19632 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH |
| 20021 | addWarningOnce | MEDIUM | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH |
| 20042 | addWarningOnce | MEDIUM | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH |
| 20329 | cleanDisplayFieldsOnly | MEDIUM | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH |

None of these carry BATCH_SAVE_PATH, DRAFT_WRITE_PATH, or PDF_PATH classifications.
None are HIGH risk.
None are UNKNOWN.
None involve PDF ownership or controlled-write adjacency.

## R3 Candidate Callsites

R3 scope: BATCH_SAVE_PATH, DRAFT_WRITE_PATH, PDF_PATH.
All 109 HIGH-risk callsites fall into R3 scope because they carry at least one of these markers.
R3 replacement is blocked until fixtures and safety analysis are complete.

## Blocked Callsites

No BLOCK-classified callsites exist in the current risk matrix.

## Deferred Callsites

All 109 HIGH-risk callsites are effectively deferred to R3, not-completed:
- Call-site-specific fixtures for BATCH_SAVE_PATH, DRAFT_WRITE_PATH, PDF_PATH
- PDF ownership analysis
- Controlled-write adjacency analysis

## Decision

- **R2 may proceed: yes** — 5 MEDIUM-risk callsites are clear R2 candidates with no BATCH_SAVE_PATH / DRAFT_WRITE_PATH / PDF_PATH overlap.
- **R3 may proceed now: no** — 109 HIGH-risk callsites require R3 fixtures and safety gates first.
- **Wrapper removal allowed now: no** — CALLSITE_PARTIAL classification; 115 naked calls remain.
