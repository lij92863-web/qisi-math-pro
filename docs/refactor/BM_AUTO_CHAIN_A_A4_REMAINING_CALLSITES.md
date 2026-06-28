# BM-AUTO Chain A A4 Remaining Callsites

Stage: BM-AUTO-CHAIN-A-A4-REMAINING-CALLSITES
Branch: main
Current commit: e2033f8 stage BM-AUTO stop A4 R3 no safe candidates

## Remaining Naked Callsites

Total remaining naked callsites: 105.

| Helper | Naked Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 42 |
| cleanDisplayOptionsForBatchSave | 42 |
| addWarningOnce | 19 |
| cleanDisplayFieldsOnly | 2 |

## Remaining Wrappers

All 4 wrappers remain in app.js and delegate to window.Qisi.Utils.*:

| Wrapper | Line |
| --- | ---: |
| cleanDisplayTextForBatchSave | 1924 |
| cleanDisplayOptionsForBatchSave | 1927 |
| addWarningOnce | 1933 |
| cleanDisplayFieldsOnly | 1930 |

## Explicit Module Callsites

Total explicit callsites: 10 (5 wrappers + 5 R1/R2 replacements).

## Deferred Callsites

All 105 remaining naked callsites are deferred to R3 (BATCH_SAVE_PATH, DRAFT_WRITE_PATH, or PDF_PATH). They are HIGH risk and cannot be automatically replaced due to:
- Controlled-write adjacency
- PDF ownership ambiguity
- Draft write context affecting answer/solution ownership

## Blocked Callsites

All 105 remaining naked callsites are effectively blocked from automated R3 replacement. See BM_AUTO_CHAIN_A_A4_STOP_R3_NO_SAFE_CANDIDATES.md for details.

## UNKNOWN Callsites

No callsites have UNKNOWN classification. All 105 remaining callsites have known HIGH risk classifications.

## Reason for Each Remaining Callsite

Every remaining naked callsite carries at least one HIGH-risk R3 marker:
- **BATCH_SAVE_PATH**: Callsites that execute during batch save operations, adjacent to controlled-write.
- **DRAFT_WRITE_PATH**: Callsites that mutate draft object fields (stem, options, answer, solution), touching answer/solution ownership boundaries.
- **PDF_PATH**: Callsites in PDF processing contexts, touching PDF answer/solution ownership.

Automated replacement of these callsites could:
1. Break controlled-write ownership correctness
2. Alter answer/solution ownership boundaries in PDF processing
3. Change draft write behavior in batch save pipelines
4. Introduce subtle regressions in production display cleaning paths

## Required Future Fixtures

For any future R3 migration, each of the 105 callsites would require:
- Per-callsite analysis of controlled-write adjacency
- Per-callsite analysis of PDF ownership impact
- Per-callsite analysis of support attachment / answer ownership risk
- Callsite-specific fixture tagged with [A4:R3:batch-save:<id>], [A4:R3:draft-write:<id>], or [A4:R3:pdf-path:<id>]
- Manual safety review and explicit sign-off

## Whether Wrapper Removal Is Allowed

Wrapper removal is NOT allowed. Classification is CALLSITE_PARTIAL.
105 naked callsites remain, all of which depend on the wrappers for indirect access to qisi-utils implementations.

## Decision

- Wrapper removal allowed: no
- R3 migration allowed now: no
- Staged migration status: CALLSITE_PARTIAL (10 explicit, 105 naked, 4 wrappers)
- Next step: Proceed to Phase 8 (wrapper removal gate — expected result: no)
