# BM-AUTO A4 R3 Remaining Callsites Final

Stage: BM-AUTO-A4-R3-REMAINING-CALLSITES-FINAL
Branch: main
Current commit: 60c5ec5

## Remaining Naked Callsites

105 naked A4 callsites remain. Zero were replaced by the R3 shard campaign.

## Remaining Wrappers

All 4 wrappers remain intact.

## Explicit Module Callsites

10 explicit window.Qisi.Utils.* calls (5 wrappers + 5 R1/R2 replacements).

## Remaining by Helper

| Helper | Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 42 |
| cleanDisplayOptionsForBatchSave | 42 |
| addWarningOnce | 19 |
| cleanDisplayFieldsOnly | 2 |

## Remaining by Risk Type

| Risk | Count |
| --- | ---: |
| HIGH (all R3 paths) | 105 |
| BLOCKED_UNKNOWN (audit heuristic) | ~72 |
| FIXTURE_REQUIRED | ~33 |

## Blocked Controlled-Write

0 callsites explicitly flagged as controlled-write adjacent by heuristic audit. However, all 94 BATCH_SAVE_PATH callsites are potentially adjacent and would need deeper analysis.

## Blocked PDF Ownership

8 PDF_PATH callsites require per-callsite analysis of PDF support ownership.

## Blocked Support Attachment

Approximately 31 callsites carry support attachment risk markers.

## Blocked Answer/Solution Ownership

All 40 DRAFT_WRITE_PATH callsites touch answer/solution fields.

## Deferred Manual-Only

All 105 callsites require manual per-callsite fixture creation and ownership analysis before replacement can be considered.

## Unknown

0 UNKNOWN-classified callsites.

## Next Action

1. Proceed to wrapper removal gate (Phase 13) — expected: not allowed.
2. Run documentation audit (Phase 15).
3. Run full verification (Phase 16).
4. Create final campaign summary (Phase 17).
5. Future: Human reviewer must create per-callsite fixtures and re-run ownership audit.
