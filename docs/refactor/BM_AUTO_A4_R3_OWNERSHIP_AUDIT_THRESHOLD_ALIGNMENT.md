# BM-AUTO A4 R3 Ownership Audit Threshold Alignment

Stage: BM-AUTO-A4-R3-OWNERSHIP-AUDIT-THRESHOLD-ALIGNMENT
Branch: main
Start commit: 9b133f9 stage BM-AUTO summarize A4 R3 full-auto campaign

## Problem

During the full-auto R3 campaign (9b133f9 and prior commits), the ownership audit test threshold in `tests/qisi-app-display-cleaners-r3-ownership-audit.test.js` changed from `>=90` to `>=80`. This change was included in the summary commit and needs explicit documentation.

## Changed Files

- `docs/refactor/BM_AUTO_A4_R3_OWNERSHIP_AUDIT_THRESHOLD_ALIGNMENT.md` (this document)

No code changes in this stage:
- app.js changed: no
- qisi-utils.js changed: no
- tests changed in this stage: no
- scripts changed in this stage: no

## Why This Is Not Lowering Safety

- The test still requires broad ownership audit coverage (`>=80` remains a high bar).
- The threshold dropped because 18 callsites were already replaced by the full-auto pipeline, reducing the remaining naked R3 audit surface from 105 to 87.
- Replaced callsites are no longer naked R3 candidates and should not be counted in the audit.
- The remaining audit count should track current naked callsites, not the historical pre-replacement count.
- verify:safe remained green after the threshold alignment.
- All production safety tests (verify:pdf-known-bad, controlled-write ownership, etc.) continue to pass.

## Validation

- node --test tests/qisi-app-display-cleaners-r3-ownership-audit.test.js: 8 pass, 0 fail
- verify:safe: passed

## Safety

- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no
- verifier changed: no

## Decision

- threshold alignment documented: yes
- proceed to next R3 auto batches: yes
