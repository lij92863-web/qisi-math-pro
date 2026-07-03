# POST-BMR10 Product Validation Report

## Stage
POST-BMR10 PRODUCT VALIDATION

## Current HEAD
a53f549ab48a764217e2d1fe41779512a5f6d93a

## Git State
- branch: main
- local HEAD: a53f549ab48a764217e2d1fe41779512a5f6d93a
- origin/main: a53f549ab48a764217e2d1fe41779512a5f6d93a
- local/remote equal: yes
- working tree: clean (仅 ai/CODEX_TASK.local.md 预存在本地修改)
- local task file status: ai/CODEX_TASK.local.md — tracked, dirty, pre-existing; CODEX_TASK.local.md (root) — gitignored

## Purpose
Validate product chains after BMR1-BMR10 automatic migration and POST-BMR10 freeze.

## Automated Gates
| Command | Result | Notes |
| --- | --- | --- |
| node --test tests/base-migration-execution-gate.test.js | passed | 15/15 |
| node --test tests/pdf-route-b-hold.test.js | passed | 6/6 |
| npm.cmd run smoke:batch:mock | passed | 20/20 |
| npm.cmd run verify:safe | passed | 860/860 main + 20/20 smoke + no-real-ai |
| npm.cmd run verify:batch-safety | passed | docx-stable + pdf-known-bad + no-real-ai + smoke |
| npm.cmd run verify:pdf-known-bad | passed | 65/65 |
| node --test tests/pdf-support-controlled-write-answer-ownership.test.js | passed | 21/21 |
| node scripts/pdf-master-browser-runner.js preflight | passed | realApiCalled=false, apiCallCount=0 |
| node scripts/pdf-master-browser-runner.js dry-run | passed | realApiCalled=false, apiCallCount=0 |
| npm.cmd run verify:docx-stable | passed | 20/20 |

## DOCX+DOCX Validation
- verify:docx-stable: passed (20/20)
- docx-pipeline tests: 16/16 passed (BM11 x2 + BMR2 x8 + BMR9 x6)
- decodeXmlEntitiesSafe location: qisi-docx-pipeline.js (line 136, definition; line 652, export)
- stripXmlTagsForDocxText location: qisi-docx-pipeline.js (line 143, definition; line 653, export)
- app.js module calls: lines 3821, 4575 via `window.Qisi.DocxPipeline.decodeXmlEntitiesSafe()` — no old function definitions
- conclusion: DOCX+DOCX chain intact. BMR2/BMR9 migrated helpers verified.

## PDF Safe Partial Validation
- pdf-safe-partial-pipeline tests: 10/10 passed (BM12 x2 + BMR8 x8)
- pdf-known-bad: passed (65/65)
- controlled-write ownership: passed (21/21)
- Route B hold: passed (6/6)
- attachPdfPageTrace location: qisi-pdf-safe-partial-pipeline.js (line 16, definition; line 75, export)
- attachSinglePdfPageTrace location: qisi-pdf-safe-partial-pipeline.js (line 49, definition; line 75, export)
- app.js module calls: lines 7502-7503 via `window.Qisi.PdfSafePartialPipeline` — no old function definitions
- conclusion: PDF safe partial chain intact. BMR8 migrated helpers verified.

## Route B Freeze Validation
- route-b-hold: passed (6/6)
- production integration found: none
  - app.js: 0 Route B references
  - qisi-pdf-support-controlled-write.js: 0 Route B references
  - scripts/pdf-master-browser-runner.js: references only in hold/safety check logic
- conclusion: Route B remains research-only. Not in production chain.

## Boundary Validation
- controlled-write touched: no (last commit: P10I, pre-BMR8)
- parser touched: no (last commit: P4.1, pre-BMR8)
- aligner touched: no (last commit: P4.2, pre-BMR8)
- runner touched: no (last commit: P10K, pre-BMR8)
- real-run called: no
- AI/OCR called: no
- git diff HEAD..HEAD: empty (no changes during validation)
- conclusion: All safety boundaries intact.

## Browser Runner Safety
- preflight: passed (ok=true, 7/7 checks)
- dry-run: passed (ok=true, server started, browser chain ok)
- realApiCalled: false (both)
- apiCallCount: 0 (both)
- conclusion: No real API calls triggered.

## app.js Status
- current line count: 21980
- responsibility ledger exists: yes (docs/refactor/APP_JS_RESPONSIBILITY_LEDGER.md)
- responsibility map exists: yes (docs/refactor/APP_JS_RESPONSIBILITY_MAP_AFTER_BMR10.md)
- BM-AUTO frozen: yes (documented in ledger)
- BMR11 automatic allowed: no (documented in ledger)

## A4 Boundary
- CALLSITE_PARTIAL preserved: yes (27 docs/refactor files reference CALLSITE_PARTIAL)
- A4 remaining callsites auto-migrated: no
- wrappers removed: no
- conclusion: A4 boundary intact. No automatic migration of remaining callsites.

## Decision
PRODUCT_VALIDATION_ACCEPTED

All automated gates passed. DOCX+DOCX stable chain intact. PDF safe partial chain intact. Route B frozen. All safety boundaries (controlled-write, parser, aligner, runner, A4) verified. Browser runner preflight and dry-run confirm no real AI/OCR calls. No code files modified during validation.

## Next Recommended Stage
- Recommended: manual browser product smoke with real teacher materials (DOCX+DOCX workflow, PDF safe partial review, review page editing, export/import).
- User decision on whether to plan BMR11 (requires new task document, explicit approval, single candidate only).
- Do NOT enter BMR11 automatically.
