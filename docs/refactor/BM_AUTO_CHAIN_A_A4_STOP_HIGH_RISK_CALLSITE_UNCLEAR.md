# BM-AUTO Chain A A4 Stop — High Risk Callsite Unclear

Stage: BM-AUTO-CHAIN-A-A4-R2-R3-STOP
Branch: main
Latest accepted commit: a4ad680 stage BM-AUTO replace A4 display-only callsites

## Stop reason

R1 completed and was accepted. R2/R3 were not continued because the remaining naked A4 callsites are not clearly safe under the staged migration rules.

R2 requires explicit fixture coverage for OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, VISUAL_REPAIR_PATH, and WARNING_MUTATION_PATH callsites. R3 requires stricter coverage for BATCH_SAVE_PATH, DRAFT_WRITE_PATH, and PDF_PATH callsites. The current reports show remaining MEDIUM/HIGH callsites whose local behavior and ownership are not narrow enough to replace without additional callsite-specific fixtures.

## Current state

- Wrapper adapter commit: 693be01
- R1 commit: a4ad680
- Staged verifier after R1: CALLSITE_PARTIAL
- Wrappers remain in app.js: yes
- Explicit module callsites after R1: 5
- R1 replaced naked LOW/DISPLAY_ONLY callsites: 1

## Remaining risk profile

From `docs/refactor/BM_AUTO_CHAIN_A_A4_RISK_MATRIX.md` after R1:

- LOW: 1, already explicit module callsite
- MEDIUM: 5
- HIGH: 109
- BLOCK: 0

Remaining MEDIUM/HIGH naked callsites include option repair, warning mutation, visual repair, draft write, batch save, PDF, and final validation paths.

## Decision

- R2 accepted: no
- R3 accepted: no
- Final wrapper removal accepted: no
- A4 staged migration complete: no

## Next recommended task

Add callsite-specific fixture coverage for the remaining MEDIUM candidates first, then run a separate R2 task that replaces only covered, non-PDF, non-controlled-write, non-UNKNOWN callsites.

