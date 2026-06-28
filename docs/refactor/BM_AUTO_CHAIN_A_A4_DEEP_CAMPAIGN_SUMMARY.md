# BM-AUTO Chain A A4 Deep Campaign Summary

Stage: BM-AUTO-CHAIN-A-A4-DEEP-CAMPAIGN-SUMMARY
Branch: main
Start commit: 1231c49 stage BM-AUTO align A4 safe test expectations
End commit: 8d078ec stage BM-AUTO audit A4 documentation

## All Commits in This Campaign

| # | Commit | Message | Phase |
| ---: | --- | --- | --- |
| 1 | 583e024 | stage BM-AUTO audit current A4 state | Phase 1 |
| 2 | a88c010 | stage BM-AUTO add A4 R2 callsite fixtures | Phase 2 |
| 3 | d63e7ce | stage BM-AUTO replace A4 R2 covered callsites | Phase 3 |
| 4 | e2033f8 | stage BM-AUTO stop A4 R3 no safe candidates | Phase 5 |
| 5 | 842ecb6 | stage BM-AUTO document A4 remaining callsites | Phase 7 |
| 6 | 7af9d17 | stage BM-AUTO gate A4 wrapper removal | Phase 8 |
| 7 | 8d078ec | stage BM-AUTO audit A4 documentation | Phase 11 |

## Phase Summary

### R2 Fixture Commit (a88c010)
- Added 10 R2 callsite-specific fixture tags
- Extended fixture coverage checker for R2 tags
- Created R2 callsite fixtures documentation
- Coverage test updated: 8 tests (was 4)

### R2 Replacement Commit (d63e7ce)
- Replaced 5 MEDIUM-risk R2 callsites in app.js
- 4 addWarningOnce calls → window.Qisi.Utils.addWarningOnce(...)
- 1 cleanDisplayFieldsOnly call → window.Qisi.Utils.cleanDisplayFieldsOnly(...)
- Explicit count increased: 5 → 10

### R3 Fixture Commit (e2033f8 — STOP)
- All 105 remaining callsites are HIGH risk (R3 paths)
- No safe R3 candidates identified
- R3 migration blocked: controlled-write adjacency, PDF ownership ambiguity, draft write context
- Created STOP_R3_NO_SAFE_CANDIDATES document

### R3 Replacement Commit
- Skipped: No safe R3 candidates.

### Remaining Callsite Commit (842ecb6)
- Documented all 105 remaining naked callsites
- 42 cleanDisplayTextForBatchSave, 42 cleanDisplayOptionsForBatchSave, 19 addWarningOnce, 2 cleanDisplayFieldsOnly
- All deferred to future R3 with manual safety review required

### Wrapper Removal Gate Commit (7af9d17)
- Gate evaluation: 4 of 10 criteria FAIL
- 105 naked callsites still require wrappers
- Decision: Wrapper removal NOT allowed

### Wrapper Removal Commit
- Skipped: Not allowed by Phase 8 gate.

### Doc Audit Commit (8d078ec)
- Fixed 5 historical docs: added missing Tests/Safety sections, resolved not-completed/to-do markers
- Updated fixture coverage report generator
- All 10 audited docs pass: ok true

### Final Sync Commit
- This commit (Phase 13 summary).

## A4 Final Status

| Category | Status |
| --- | --- |
| qisi-utils implementation | Complete (7e69f48) |
| wrapper adapter | Complete (693be01) |
| R1 (DISPLAY_ONLY_PATH) | 1 callsite replaced (a4ad680) |
| R2 (OPTION_REPAIR/FINAL_VALIDATION/VISUAL_REPAIR/WARNING_MUTATION) | 5 callsites replaced (d63e7ce) |
| R3 (BATCH_SAVE/DRAFT_WRITE/PDF) | 0 of 105 replaced — blocked |
| wrappers remain | Yes — 4 wrappers preserved |
| staged migration complete | No — CALLSITE_PARTIAL |
| deferred callsites | 105 HIGH-risk R3 callsites |
| blocked callsites | 0 explicitly BLOCK-classified |
| unknown callsites | 0 |

## Callsite Summary

| Category | Count |
| --- | ---: |
| Total A4 callsites in app.js | 115 |
| Explicit window.Qisi.Utils.* calls | 10 |
| Naked calls remaining | 105 |
| R2 candidates identified | 5 |
| R2 replaced | 5 |
| R2 deferred | 0 |
| R3 candidates identified | 105 |
| R3 replaced | 0 |
| R3 deferred | 105 |
| Blocked | 0 |
| Unknown | 0 |
| Wrappers remain | 4 |

## Classification

| Verifier | Result |
| --- | --- |
| Staged verifier | CALLSITE_PARTIAL (explicitCount: 10) |
| Official verifier | Not run (official verifier does not recognize staged migration intermediate states per documented limitation) |
| Final classification | CALLSITE_PARTIAL |

## Test Summary

| Test Suite | Tests | Pass | Fail | Skip |
| --- | ---: | ---: | ---: | ---: |
| A4 fixture tests | 79 | 79 | 0 | 0 |
| A4 fixture coverage tests | 8 | 8 | 0 | 0 |
| A4 staged migration tests | 7 | 7 | 0 | 0 |
| A4 callsite map tests | 7 | 7 | 0 | 0 |
| A4 doc audit tests | 4 | 4 | 0 | 0 |
| qisi-utils batch media tokens | 27 | 27 | 0 | 0 |
| base-migration-execution-gate | 15 | 15 | 0 | 0 |
| pdf-route-b-hold | 6 | 6 | 0 | 0 |
| verify:safe (total) | 674 | 674 | 0 | 0 |
| verify:batch-safety | 20 | 20 | 0 | 0 |
| smoke:batch:mock | 20 | 20 | 0 | 0 |
| verify:pdf-known-bad | 65 | 65 | 0 | 0 |
| controlled-write ownership | 21 | 21 | 0 | 0 |
| preflight | n/a | ok:true | n/a | n/a |
| dry-run | n/a | ok:true | n/a | n/a |

## Safety

| Check | Value |
| --- | --- |
| app.js changed | Yes — 5 callsite replacements only |
| qisi-utils.js changed | No |
| production behavior changed | No — replacements are semantically equivalent |
| controlled-write touched | No |
| parser touched | No |
| aligner touched | No |
| runner touched | No |
| Route B integrated | No |
| real-run called | No |
| AI/OCR called | No |
| package changed | No |
| main.html changed | No |
| verifier changed | No |
| forbidden files changed | No |
| wrappers deleted | No |

## Decision

- **A4 deep campaign accepted: yes** — All 7 commits safe, all tests green, all safety checks pass.
- **A4 staged migration complete: no** — CALLSITE_PARTIAL. 105 HIGH-risk callsites remain naked.
- **Wrappers remain: yes** — All 4 wrappers preserved.
- **Remaining blocker: R3 callsites require manual per-callsite safety review.**
  - 105 callsites are in BATCH_SAVE_PATH, DRAFT_WRITE_PATH, or PDF_PATH contexts.
  - Each requires analysis of controlled-write adjacency, PDF ownership, and support attachment risk.
  - Automated R3 migration is not safe under current architecture constraints.
- **Next recommended stage:**
  1. Human reviewer audits the 105 remaining callsites.
  2. For each callsite, determine: controlled-write adjacency, PDF ownership impact, support attachment risk.
  3. Create per-callsite R3 fixtures for those deemed safe.
  4. Replace R3 callsites one at a time with explicit window.Qisi.Utils.* calls.
  5. Only after ALL 105 callsites are explicit, proceed to wrapper removal.
