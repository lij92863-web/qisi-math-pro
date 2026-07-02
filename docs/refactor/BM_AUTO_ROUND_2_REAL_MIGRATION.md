# BM-AUTO Round 2 Real Migration

## Stage
BMR2/BMG2

## Start Commit
72520cc46f674dd29083fa7219872683f442addf

## Candidate Selection
- inventory file: `.bm_auto_inventory_round_2.json`
- score file: `.bm_auto_score_round_2.json`
- selected candidate: `extractDocxQuestionBlockByNumber, extractDocxTableTextFallback, parseDocxRelationshipMap, mimeFromDocxMediaPath, debugDocxXmlStructure, extractPlainTextFromDocxOptionXmlFragment, splitDocxParagraphsForOptionMap, findUploadedVisualCompanionForDocx, docxVisualTextIsBetterForV2, mergeDocxVisualOptionsForV2`
- score: 78
- target module: `qisi-docx-pipeline.js`
- old function names: `extractDocxQuestionBlockByNumber, extractDocxTableTextFallback, parseDocxRelationshipMap, mimeFromDocxMediaPath, debugDocxXmlStructure, extractPlainTextFromDocxOptionXmlFragment, splitDocxParagraphsForOptionMap, findUploadedVisualCompanionForDocx, docxVisualTextIsBetterForV2, mergeDocxVisualOptionsForV2`
- original app.js line range: 3243-15982, non-contiguous helper group
- estimatedRemovedAppLines: 303
- reason selected: highest scored eligible group; all selected helpers were low-risk, synchronous, no DOM, no DB, no AI/OCR, no controlled-write, and target existing module existed
- skipped higher-risk candidates: none with higher group score; lower-ranked groups included PDF extraction, support parser, review draft state, batch engine, UI events, utils, file dispatcher, and OCR repair candidates

## Fixed-Line / Ownership Test Preflight
- tests scanned: `findstr /s /n /i "line lineNumber startLine endLine contextWindow windowStart windowEnd fixed line-number" tests\*.js`
- relevant fixed-line fixtures found: no DOCX-pipeline-specific fixed-line fixture found; existing app.js line/context tests were unrelated or module-aware ownership tests
- action taken: no ownership/audit test update required
- any ownership/audit test updated: no

## Risk Check
- DOM access: no
- DB access: no
- AI/OCR access: no
- controlled-write access: no
- async: no
- Route B: no
- target existing module: yes, `qisi-docx-pipeline.js`

## Migration
- moved functions: `extractDocxQuestionBlockByNumber`, `extractDocxTableTextFallback`, `parseDocxRelationshipMap`, `mimeFromDocxMediaPath`, `debugDocxXmlStructure`, `extractPlainTextFromDocxOptionXmlFragment`, `splitDocxParagraphsForOptionMap`, `findUploadedVisualCompanionForDocx`, `docxVisualTextIsBetterForV2`, `mergeDocxVisualOptionsForV2`
- source: `app.js`
- target: `qisi-docx-pipeline.js`
- app.js calls new module: yes, explicit `window.Qisi.DocxPipeline.*` callsites
- old definitions removed: yes

## Execution Verification
- before app.js lines: 22722
- after app.js lines: 22384
- delta: -338
- verifier classification: REAL_MIGRATION
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests
| Command | Result | Notes |
| --- | --- | --- |
| `node --test tests/docx-pipeline.test.js` | passed | 10 tests |
| `node --test tests/base-migration-execution-gate.test.js` | passed | 15 tests |
| `node --test tests/pdf-route-b-hold.test.js` | passed | 6 tests |
| `npm.cmd run smoke:batch:mock` | passed | 20 tests |
| `npm.cmd run verify:safe` | passed | check + 817 node tests + smoke + no-real-ai |
| `npm.cmd run verify:batch-safety` | passed | docx stable + pdf known-bad + no-real-ai + smoke |
| `npm.cmd run verify:pdf-known-bad` | passed | 65 tests |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | passed | 21 tests |
| `node scripts/pdf-master-browser-runner.js preflight` | passed | `realApiCalled=false` |
| `node scripts/pdf-master-browser-runner.js dry-run` | passed | `realApiCalled=false` |
| `npm.cmd run verify:docx-stable` | passed | DOCX-related extra gate |
| `npm.cmd run verify:diff-scope` | passed | allowed diff: `app.js,qisi-docx-pipeline.js,tests/docx-pipeline.test.js,docs/refactor/**` |

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
- changed files: `app.js`, `qisi-docx-pipeline.js`, `tests/docx-pipeline.test.js`, `docs/refactor/BM_AUTO_ROUND_2_REAL_MIGRATION.md`
- app.js delta: -338 lines
- target module delta: +662 lines
- test delta: +159 lines

## Decision
CONTINUE

## Next Stage
Stop. Do not enter Round 3 automatically.
