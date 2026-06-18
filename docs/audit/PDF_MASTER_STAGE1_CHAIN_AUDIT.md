# PDF Master Stage 1 Chain Audit

## Scope

- Stage: PDF-MASTER-AUTO stage 1
- Goal: audit the current double PDF chain from question PDF and support PDF into review drafts.
- No real PDF files were read.
- No AI/OCR/API call was made.
- No business code was changed.

## 1. PDF Question Recognition Entry

- UI creates a draft import batch through `createDraftImportBatch` in `app.js`.
- `runBatchRecognition` calls `processDraftImportBatch`.
- For PDF question files, `processDraftImportBatch` renders PDF pages through `renderPdfFilePages`, then page-level recognition uses `recognizeExamPageStructuredWithQwen`.
- The page recognizer returns `questions`, `answers`, and `solutions`, then post-processing normalizes question items before they enter `questionItems` or `fullItems`.

Relevant locations:

- `main.html`: loads `pdfjs-dist`, `qisi-pdf-support-aligner.js`, `qisi-pdf-support-block-parser.js`, `qisi-pdf-support-controlled-write.js`, then `app.js`.
- `app.js`: `processDraftImportBatch`, `renderPdfFilePages`, `recognizeExamPageStructuredWithQwen`.

## 2. PDF Support Recognition Entry

- Support PDF files are processed in the same legacy batch flow.
- The OCR/page recognition result is treated as support evidence when the file has answer or solution roles.
- The support path first cleans recognized answer artifacts, then builds both legacy support gate input and parser-gate input.

Relevant current variables:

- `answerItems`
- `solutionItems`
- `expectedQuestionNumbers`
- `pageResult.answers`
- `pageResult.solutions`
- `normalizedPdfSupportRawTextPages`

## 3. PDF+PDF Merge Entry

- `mergeDraftRecognition(questionItems, answerItems, solutionItems, fullItems, batch, files, { authoritativeQuestionContract })` is the main merge entry.
- When no authoritative question contract exists, the legacy path may call `repairDraftAnswersByOrder`; PDF support fail-closed state then adds warnings rather than unsafe content.
- Final drafts are deduped, normalized, image-bound, and persisted as draft rows for review.

## 4. Block Parser Call Position

- `window.Qisi.PdfSupportControlledWrite.buildPdfSupportParserGate` receives:
  - `window.Qisi.PdfSupportBlockParser.parsePdfSupportBlocks`
  - raw support text pages extracted from page results
  - expected question numbers
- `qisi-pdf-support-block-parser.js` splits support OCR/raw text into blocks, emits `answerItems`, `solutionItems`, warnings, coverage, and sequence reports.

## 5. Aligner Call Position

- Legacy gate: `applyPdfSupportFailClosedGate` calls `window.Qisi.PdfSupportAligner.alignPdfSupport`.
- Parser gate: `buildPdfSupportParserGate` also calls the same `alignPdfSupport`.
- `qisi-pdf-support-aligner.js` is the source of the allowed modes:
  - `full`
  - `prefix`
  - `fail-closed`

## 6. Controlled-Write Call Position

- `window.Qisi.PdfSupportControlledWrite.buildPdfSupportFieldLevelControlledWrite` combines legacy safe items and parser safe items.
- It decides effective answer and solution items per question.
- It preserves safer legacy objective answers, rejects unsafe objective parser answers, and carries field-level warnings.

## 7. Draft Write Position

- Drafts are written only after merge, warning propagation, normalization, image binding, and final dedupe.
- The legacy path writes via an IndexedDB transaction over:
  - `db.draftImportBatches`
  - `db.draftQuestions`
  - `db.draftImages`
- It deletes previous draft rows for the batch, then `bulkPut`s final draft questions and draft images.
- This is review-draft persistence, not formal question-bank submission.

## 8. Current app.js PDF Scheduling Responsibilities

`app.js` currently owns high-level PDF orchestration:

- batch creation and status updates
- file role ordering
- PDF page rendering through pdf.js
- Qwen page recognition calls
- collecting question/support items
- invoking qisi-pdf gates
- invoking merge and final draft cleanup
- writing review drafts to IndexedDB
- tracking warnings and progress

`app.js` is therefore the coordinator and wiring layer. New parsing, alignment, and field-write policy should stay in `qisi-pdf-*` modules.

## 9. Current qisi-pdf-* Module Responsibilities

- `qisi-pdf-support-block-parser.js`
  - normalizes raw support text pages
  - detects question and answer/solution labels
  - builds support blocks
  - emits parser-level answer/solution items, warnings, coverage, and sequence reports

- `qisi-pdf-support-aligner.js`
  - normalizes support question numbers
  - checks invalid, duplicate, non-increasing, discontinuous, mismatched, and expected-set conditions
  - returns `full`, `prefix`, or `fail-closed`

- `qisi-pdf-support-controlled-write.js`
  - extracts parser raw text pages from page results
  - builds parser gate results
  - applies field-level answer/solution decisions
  - protects objective answers and rejects unsafe option-value conversion

## 10. Existing Test Coverage

- `tests/pdf-support-aligner.test.js`
  - full sequence
  - prefix on missing question
  - known-bad jump-back
  - duplicate markers
  - answer/solution mismatch
  - fail-closed when start does not match expected
  - fullwidth and labelled number normalization

- `tests/pdf-support-block-parser.test.js`
  - normal answer/solution block parsing
  - labelled question markers
  - cross-page continuation
  - duplicate and jump-back warnings
  - unknown marker filtering
  - missing solution behavior
  - formula numbers not treated as question markers
  - no semantic keyword ownership inference

- `tests/batch-smoke-mock.test.js`
  - known-bad PDF support does not attach unsafe answers
  - field-level controlled write behavior
  - parser answer rejection for ambiguous objective answers
  - fused parser questions are not written
  - DOCX stable mock remains intact

- `tests/fixtures/pdf-support-known-bad.js`
  - encodes the bad sequence `1,3,4,5,6,7,8,9,10,11,2`
  - carries known wrong answers that must not appear in draft output

## 11. Current Highest Risk Points

1. `app.js` still contains substantial PDF orchestration and legacy fallback paths.
2. Real OCR output may differ from current mock raw text shapes.
3. Parser gate and legacy gate can disagree; field-level controlled write is the main safety boundary.
4. Order-based repair remains risky if no authoritative question contract exists, though PDF fail-closed warnings are applied.
5. The current real case02 behavior is unknown until a controlled real run is prepared and bounded.

## 12. Recommended Repair Order

1. Keep stage 2 mock and known-bad coverage analysis document-only.
2. Add minimal sanitized PDF fixture for one uncovered risk before any code repair.
3. Fix only qisi-pdf parser/aligner/controlled-write bugs exposed by that fixture.
4. Preserve DOCX stable checks after every PDF change.
5. Prepare a controlled real PDF probe only after mock safety coverage is clear.
6. Use real case02 attempts only with attempt ledger and strict cap.
