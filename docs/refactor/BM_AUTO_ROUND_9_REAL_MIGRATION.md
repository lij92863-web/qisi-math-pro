# BM-AUTO Round 9 Real Migration

## Stage
BMR9/BMG9

## Start Commit
7e7980e50aa058625d905d6a1ad558da02034bc0

## Candidate Selection
- selected candidate: decodeXmlEntitiesSafe, stripXmlTagsForDocxText
- score: 62 (decodeXmlEntitiesSafe individual), 15-line block spanning both functions
- target module: qisi-docx-pipeline.js
- old function names:
  - decodeXmlEntitiesSafe
  - stripXmlTagsForDocxText
- original app.js line range: 3717-3731
- estimatedRemovedAppLines: 15
- reason selected: both functions already existed as private helpers in qisi-docx-pipeline.js (lines 136-150); app.js had duplicate copies; promoting to exported eliminates redundancy without adding new logic; pure XML string helpers, no DOM/DB/AI/OCR/controlled-write access; natural fit in DOCX pipeline module
- skipped candidates:
  - openBatchCreate group (SCORE=71): Vue closure variable dependencies (batchUploadInput, batchImportMode refs)
  - mimeFromFilename group (SCORE=60): no app.js callers
  - buildQuestionFingerprintMaps group (SCORE=64): Vue reactive state access (coreFingerprintMap.value)
  - qisi-utils mega-group (SCORE=66): 27 functions, 479 lines — too large for single round
- skipped reasons: zero or more of: Vue ref access, no app.js callers, forbidden module target (parser/AI-OCR), too large

## Already Migrated Exclusion Check
- BMR1 exclusions: repairChoiceOptions, tryRepairedCandidate — not this candidate
- BMR2 exclusions: extractDocxQuestionBlockByNumber, extractDocxTableTextFallback, parseDocxRelationshipMap, mimeFromDocxMediaPath, debugDocxXmlStructure, extractPlainTextFromDocxOptionXmlFragment, splitDocxParagraphsForOptionMap, findUploadedVisualCompanionForDocx, docxVisualTextIsBetterForV2, mergeDocxVisualOptionsForV2 — not this candidate; stripXmlTagsForDocxText and decodeXmlEntitiesSafe are existing DOCX pipeline internals, not BMR2 migrations
- BMR3/BMR4/BMR6/BMR7 exclusions read from docs: none overlap
- BMR8 exclusions: attachPdfPageTrace, attachSinglePdfPageTrace — not this candidate
- action: confirmed no overlap with any prior round

## A4 Exclusion Check
- related to A4 remaining callsites: no
- related to A4 wrapper removal: no
- action: none — functions are XML/DOCX text processing helpers, not A4-related

## Fixed-Line / Ownership Test Preflight
- tests scanned: tests/docx-pipeline.test.js, tests/*.js
- relevant fixed-line fixtures found: none targeting BMR9 functions
- action taken: none needed
- any ownership/audit test updated: no

## Risk Check
- DOM access: no
- DB access: no
- AI/OCR access: no
- controlled-write access: no
- async: no
- Route B: no
- target existing module: yes (qisi-docx-pipeline.js; both functions already existed as private helpers since before BMR2)

## Migration
- moved functions:
  - decodeXmlEntitiesSafe (XML entity decoder: &lt; &gt; &amp; &quot; &apos;)
  - stripXmlTagsForDocxText (DOCX XML tag stripper for w:t, w:tab, w:br)
- source: app.js lines 3717-3731 (duplicate definitions, removed)
- target: qisi-docx-pipeline.js (promoted existing private helpers at lines 136-150 to exported; no new code added)
- app.js calls new module: yes — `window.Qisi.DocxPipeline.decodeXmlEntitiesSafe(...)` at lines 3821, 4575
- old definitions removed: yes — original const definitions deleted from app.js; no local aliases left

## Execution Verification
- before app.js lines: 21995
- after app.js lines: 21980
- delta: -15
- verifier classification: REAL_MIGRATION
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests
| Command | Result | Notes |
| --- | --- | --- |
| node --test tests/docx-pipeline.test.js | passed | 16/16 (10 existing + 6 new BMR9) |
| node --test tests/base-migration-execution-gate.test.js | passed | 15/15 |
| node --test tests/pdf-route-b-hold.test.js | passed | 6/6 |
| npm.cmd run smoke:batch:mock | passed | 20/20 |
| npm.cmd run verify:safe | passed | 860/860 + node --check all files + verify:no-real-ai |
| npm.cmd run verify:batch-safety | passed | all sub-commands passed |
| npm.cmd run verify:pdf-known-bad | passed | 65/65 |
| node --test tests/pdf-support-controlled-write-answer-ownership.test.js | passed | 21/21 |
| node scripts/pdf-master-browser-runner.js preflight | passed | realApiCalled=false, underlyingApiCallCount=0 |
| node scripts/pdf-master-browser-runner.js dry-run | passed | realApiCalled=false, underlyingApiCallCount=0 |
| npm.cmd run verify:docx-stable | passed | 20/20 (DOCX stable chain intact) |
| npm.cmd run verify:diff-scope | passed | |

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
- app.css changed: no

## Git Diff
- changed files: app.js, qisi-docx-pipeline.js, tests/docx-pipeline.test.js
- app.js delta: -16 lines (+0, -16: removed duplicate definitions block)
- qisi-docx-pipeline.js delta: +2 lines (added exports to existing functions; no new function bodies)
- tests/docx-pipeline.test.js delta: +33 lines (6 new BMR9 tests)

## Decision
REAL_MIGRATION ACCEPTED

## Next Stage
If accepted, BMR10 may start automatically per CODEX_TASK.local.md Section 5 conditions.
