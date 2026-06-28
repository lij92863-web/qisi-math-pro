# BM-AUTO Chain A A4 STOP R3 No Safe Candidates

Stage: BM-AUTO-CHAIN-A-A4-STOP-R3-NO-SAFE-CANDIDATES
Reason: R3_NO_SAFE_CANDIDATES
Branch: main

## Reason

After R2 replacement (5 MEDIUM-risk callsites migrated), all 110 remaining naked callsites are HIGH risk and carry at least one R3 marker (BATCH_SAVE_PATH, DRAFT_WRITE_PATH, or PDF_PATH). None meet the R3 replacement safety criteria because:

1. **PDF ownership unclear**: All R3-marked callsites operate in contexts where PDF ownership boundaries are not fully resolved.
2. **Controlled-write adjacent**: BATCH_SAVE_PATH and DRAFT_WRITE_PATH callsites are directly adjacent to controlled-write operations.
3. **Support attachment / answer ownership risk**: DRAFT_WRITE_PATH callsites write to draft object fields (stem, options, answer, solution) that are subject to controlled-write ownership rules.
4. **No callsite-specific fixtures**: Creating safe R3 fixtures for 110 callsites requires per-callsite analysis of each of the above risks, which is beyond the safe scope of automated migration.

## Latest Clean Commit

d63e7ce stage BM-AUTO replace A4 R2 covered callsites

## Dirty Files

None. Working tree clean except untracked `.bm_a4_app_before.js`.

## Failed Command

No command failed. This is a proactive stop based on safety criteria analysis.

## Partial Results

- R1 (DISPLAY_ONLY_PATH): 1 callsite replaced (line 19576)
- R2 (OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH): 5 callsites replaced (lines 3739, 19632, 20021, 20042, 20329)
- R3 (BATCH_SAVE_PATH, DRAFT_WRITE_PATH, PDF_PATH): 0 of 110 callsites safe to replace
- Total explicit calls: 10 (5 wrappers + 5 R1/R2 replacements)
- Total naked calls remaining: 110

## What Was Safe

- R2 callsite replacements: All 5 MEDIUM-risk callsites had clear non-R3 contexts, no controlled-write adjacency, no PDF ownership ambiguity, and were verified with callsite-specific fixtures.
- Wrappers remain intact: All 4 wrapper definitions are preserved and continue to delegate to window.Qisi.Utils.*.
- Full test suite passes: verify:safe (674 pass), verify:batch-safety, preflight, dry-run all green.

## What Was Not Safe

- R3 callsite replacement: All 110 remaining callsites are HIGH risk. Automated replacement could:
  - Break controlled-write ownership correctness
  - Alter PDF answer/solution ownership boundaries
  - Change draft write behavior in batch save pipelines
  - Introduce subtle display cleaning regressions in production paths

## Whether app.js Changed

Yes. 5 lines changed: R2 callsite replacements (addWarningOnce × 4, cleanDisplayFieldsOnly × 1). All changes are explicit window.Qisi.Utils.* calls that are semantically equivalent to the wrapper-delegated calls they replaced.

## Whether qisi-utils.js Changed

No. qisi-utils.js was not modified.

## Whether Committed Changes Are Safe

Yes. All 3 commits in this campaign so far are safe:
- 583e024: stage BM-AUTO audit current A4 state (docs only)
- a88c010: stage BM-AUTO add A4 R2 callsite fixtures (tests + scripts + docs)
- d63e7ce: stage BM-AUTO replace A4 R2 covered callsites (app.js 5 lines + docs)

## Next Recommended Action

1. Proceed to Phase 7: Document remaining callsites.
2. Proceed to Phase 8: Final wrapper removal gate (expected: no — wrappers remain needed).
3. Proceed to Phase 11: Documentation audit.
4. Complete Phase 12 (full verification) and Phase 13 (final summary).
5. Future work: R3 callsite migration requires manual per-callsite safety review by a human reviewer familiar with the PDF ownership and controlled-write architecture.


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
