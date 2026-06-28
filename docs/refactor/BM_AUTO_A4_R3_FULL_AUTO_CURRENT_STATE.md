# BM-AUTO A4 R3 Full-Auto Current State

Stage: BM-AUTO-A4-R3-FULL-AUTO-CURRENT-STATE
Branch: main
Start commit: 78e2bd7 stage BM-AUTO align A4 R3 shard verifier test
Current commit: 78e2bd7

## Remaining Naked Callsites

Total: 105. Classification: CALLSITE_PARTIAL. explicitCount: 10.

## Wrappers Remaining

4 wrappers (lines 1924-1934). All delegate to window.Qisi.Utils.*.

## Explicit Module Callsites

10 explicit (5 wrappers + 5 R2 replacements).

## Remaining by Helper

| Helper | Count |
| --- | ---: |
| cleanDisplayTextForBatchSave | 42 |
| cleanDisplayOptionsForBatchSave | 42 |
| addWarningOnce | 19 |
| cleanDisplayFieldsOnly | 2 |

## Remaining by Risk Class

| Risk | Count |
| --- | ---: |
| HIGH | 105 |
| LOW/MEDIUM | 0 (all replaced) |

## Remaining by Path

| Path | Count |
| --- | ---: |
| batch save | 94 |
| draft write | 40 |
| PDF path | 8 |
| warning mutation | 38 |
| option cleanup | 91 |
| validation | 11 |
| support attachment risk | ~31 |
| answer/solution ownership risk | ~40 |
| unknown | 0 |

## Decision

- R3 full-auto campaign may proceed: yes
- Tooling needed: candidate ranker, proof builder, fixture generator, batch executor
- Direct replacement: no — must go through proof+fixture pipeline
- Wrapper removal: no — CALLSITE_PARTIAL
