# BM-AUTO A4 R3 Current State Re-Audit

Stage: BM-AUTO-A4-R3-CURRENT-STATE-REAUDIT
Branch: main
Start commit: 1c28a42 stage BM-AUTO summarize A4 deep campaign
Current commit: 1c28a42 stage BM-AUTO summarize A4 deep campaign

## Remaining Naked Callsites

Total remaining naked callsites: 105.

| Helper | Naked Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 42 |
| cleanDisplayOptionsForBatchSave | 42 |
| addWarningOnce | 19 |
| cleanDisplayFieldsOnly | 2 |

## Wrappers Remaining

All 4 wrappers remain intact (lines 1924-1934):
- cleanDisplayTextForBatchSave → window.Qisi.Utils.cleanDisplayTextForBatchSave
- cleanDisplayOptionsForBatchSave → window.Qisi.Utils.cleanDisplayOptionsForBatchSave
- addWarningOnce → window.Qisi.Utils.addWarningOnce
- cleanDisplayFieldsOnly → window.Qisi.Utils.cleanDisplayFieldsOnly

## Explicit Module Callsites

Total explicit calls: 10 (5 wrappers + 5 R1/R2 replacements).
Staged verifier: CALLSITE_PARTIAL.

## R3 Candidate Count

105 remaining naked callsites are R3 candidates.
All 105 are HIGH risk.

## Callsites by Classification (Overlapping)

| Classification | Count | Risk Context |
| --- | ---: | --- |
| BATCH_SAVE_PATH | 94 | Adjacent to batch save operations; potential controlled-write adjacency |
| DRAFT_WRITE_PATH | 40 | Mutates draft object fields; touches answer/solution ownership |
| PDF_PATH | 8 | PDF processing contexts; touches PDF answer/solution ownership |
| DOCX_PATH | 10 | DOCX-specific processing; lower ownership risk |
| OPTION_REPAIR_PATH | 91 | Option manipulation during repair; may invent options |
| VISUAL_REPAIR_PATH | 23 | Visual display repair; may touch support attachment |
| WARNING_MUTATION_PATH | 38 | Warning-only mutation; generally lowest ownership risk |
| DISPLAY_ONLY_PATH | 103 | Display cleanup only; least risky in isolation |
| FINAL_VALIDATION_PATH | 11 | Final validation before save; touches answer completeness |

## PDF Path Callsites

8 callsites are classified as PDF_PATH. These are the highest-risk group and will be analyzed last in the shard plan.

## Batch Save Callsites

94 of 105 callsites carry BATCH_SAVE_PATH. Most are display-only cleaning within batch save pipelines. Controlled-write adjacency must be checked per-callsite.

## Draft Write Callsites

40 callsites carry DRAFT_WRITE_PATH — they write cleaned values back into draft objects (stem, options, answer, solution fields). This directly touches answer/solution ownership boundaries.

## Controlled-Write Adjacent Callsites

Cannot be precisely counted without per-callsite context analysis. All 94 BATCH_SAVE_PATH callsites are potentially controlled-write adjacent. The ownership audit tool (Phase 3) will perform exact analysis.

## Support Attachment Risk Callsites

Callsites in visual repair and PDF processing contexts (approximately 31 combined) carry potential support attachment risk. Exact count requires per-callsite analysis.

## Answer/Solution Ownership Risk Callsites

All 40 DRAFT_WRITE_PATH callsites carry answer/solution ownership risk. Additionally, any callsite operating on answer or solution fields in PDF or batch save contexts.

## Unknown Callsites

0 UNKNOWN callsites.

## Blocked Callsites

0 BLOCK-classified callsites exist. All 105 are HIGH risk but not BLOCKED — they require per-callsite ownership audit before any replacement decision.

## Risk Matrix Summary

| Risk Level | Count |
| --- | ---: |
| HIGH | 105 |
| MEDIUM | 5 (all replaced in R2) |
| LOW | 1 (replaced in R1) |
| BLOCK | 0 |

## Decision

- **R3 shard campaign may proceed: yes** — 105 callsites remain; sharding allows progressive safe migration.
- **Direct global replacement allowed: no** — All 105 are HIGH risk; must be audited per-callsite.
- **Wrapper removal allowed now: no** — CALLSITE_PARTIAL; 105 naked callsites still need wrappers.
- **Next step:** Build R3 tooling (shard planner, ownership audit, shard verifier), then execute shards in order.
