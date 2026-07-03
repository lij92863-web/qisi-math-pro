# Next Stage Handoff After BMR10

## Current Safe State
- latest commit: 0dff497cb53f291732e63b005055b3df42c5e1c1 (POST-BMR10 final summary)
- BMR10 no-eligible commit: 3034083
- branch: main
- working tree: clean (except pre-existing ai/CODEX_TASK.local.md task doc edit)
- local/remote equal: yes
- local HEAD: 0dff497cb53f291732e63b005055b3df42c5e1c1
- origin/main: 0dff497cb53f291732e63b005055b3df42c5e1c1

## Completed Work
- BMR8/BMG8: accepted — attachPdfPageTrace, attachSinglePdfPageTrace → qisi-pdf-safe-partial-pipeline.js (delta -45)
- BMR9/BMG9: accepted — decodeXmlEntitiesSafe, stripXmlTagsForDocxText → qisi-docx-pipeline.js (delta -15, code deduplication)
- BMR10/BMG10: no eligible candidate — documented in BM_AUTO_ROUND_10_NO_ELIGIBLE_CANDIDATE.md
- POST-BMR10 FINAL GATE: all passed, 0 fail/skip/timeout, realApiCalled=false on preflight and dry-run
- BM-AUTO long run (BMR1-BMR10): complete

## Still Forbidden
- controlled-write modification
- parser modification
- aligner modification
- runner modification
- Route B production integration
- real-run (node scripts/pdf-master-browser-runner.js real-run)
- AI/OCR real calls (npm run test:ai-proxy, npm run test:ai-vision-proxy)
- A4 remaining callsite migration (without manual review)
- A4 wrapper removal
- CALLSITE_PARTIAL → COMPLETE
- package.json / package-lock.json modification
- main.html / app.css modification

## Remaining Work
- app.js still has remaining responsibilities (currently 21980 lines):
  - Vue component logic (batch create/import workflow, draft editor, exam config)
  - PDF recognition orchestration
  - DOCX import orchestration
  - Knowledge tree management
  - Template rendering (LaTeX, HTML, exam paper generation)
  - Image management
  - Local server API
  - Storage and backup
- possible next candidate areas:
  - LaTeX helper cluster (ensureLatexPackage, ensureImagePackagesForLatex, escapeImageIdForRegExp) — pure functions but deeply interconnected with normalizeImagePlacementDuplicates
  - ommlChildren / ommlFirst / ommlText OMML math cluster — pure XML node helpers but tightly coupled
  - Batch final gate helpers (batchFinalGateMeaningfulOption, batchFinalGateMergeImages, batchFinalGateBetterText) — pure but embedded in larger Vue-dependent batch group
- recommended next gate: user review of remaining candidates and decision on BM-AUTO long run continuation vs. freeze

## Risk Register
- fixed-line audit tests: doc-audit tests check for SKIP/TODO/ONLY patterns; no stale fixtures detected for BMR8-BMR9
- A4 partial state: CALLSITE_PARTIAL markers remain; no A4 wrappers removed; no A4 remaining callsites auto-migrated
- PDF safe partial boundary: intact — controlled-write is sole truth gate; safe partial mode unchanged
- DOCX stable chain: intact — verify:docx-stable passes; DOCX+DOCX pipeline unchanged through BMR8-BMR10

## Commits Pushed (BMR8-BMR10)
| Stage | Commit | Description |
| --- | --- | --- |
| BMR8 | 7e7980e | stage BM-AUTO round 8 migrate pdf page trace helpers |
| BMR9 | c154d30 | stage BM-AUTO round 9 migrate xml docx text helpers |
| BMR10 | 3034083 | stage BM-AUTO round 10 no eligible candidate |

## User Decision Points
- 是否继续 BMR11？(Recommendation: no — remaining candidates all have blockers)
- 是否先做 app.js responsibility audit？(Recommendation: yes — review the 37 eligible-but-blocked functions)
- 是否冻结 BM-AUTO long run？(Recommendation: yes — long run has reached natural stopping point)
