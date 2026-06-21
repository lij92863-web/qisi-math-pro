# BM01 Architecture Audit

## Stage

BM01 — read-only architecture audit. No code changes.

## app.js Current Responsibilities (23,215 lines)

| Area | Lines (approx) | Risk |
| --- | --- | --- |
| Batch import orchestration | ~8,000 | HIGH |
| DOCX parsing + conversion | ~3,000 | HIGH |
| PDF support fail-closed gate | ~2,000 | HIGH |
| AI/OCR request construction | ~1,500 | HIGH |
| Draft write transactions | ~2,000 | HIGH |
| Review page rendering | ~3,000 | Medium |
| UI event bindings | ~1,500 | Medium |
| Storage/Dexie operations | ~1,000 | Medium |
| LaTeX template/config | ~500 | Low |
| Utility/helpers | ~700 | Low |

## main.html Script Loading Order

`main.html` loads scripts in this order (simplified):
1. Vue, Dexie (CDN)
2. qisi-config.js → qisi-db.js → qisi-utils.js → qisi-runtime.js
3. qisi-components.js → qisi-batch-importer.js → qisi-support-parser.js
4. qisi-batch-engine-v2.js → qisi-support-repair.js
5. qisi-pdf-support-block-parser.js → qisi-pdf-support-aligner.js
6. qisi-pdf-support-controlled-write.js
7. qisi-pdf-answer-extraction-quality.js
8. qisi-pdf-answer-only-extraction.js
9. qisi-local-server.js
10. app.js (last — shell)

## Qisi Module Responsibility Table

| Module | Responsibility | Lines | Stable? |
| --- | --- | --- | --- |
| `qisi-config.js` | LaTeX templates | 140 | Yes |
| `qisi-db.js` | IndexedDB init | 202 | Yes |
| `qisi-utils.js` | Utility helpers | 318 | Yes |
| `qisi-runtime.js` | Runtime/env checks | 125 | Yes |
| `qisi-backup.js` | Backup utility | 371 | Yes |
| `qisi-components.js` | UI component helpers | 440 | Yes |
| `qisi-batch-importer.js` | DOCX import base | 992 | Yes |
| `qisi-batch-engine-v2.js` | Batch engine v2 | 1,430 | Yes |
| `qisi-support-parser.js` | Support/doc parser | 1,652 | Yes |
| `qisi-support-repair.js` | Answer/solution repair | 437 | Yes |
| `qisi-local-server.js` | Express server + AI proxy | 693 | Yes |
| `qisi-pdf-support-block-parser.js` | PDF block parsing | 1,091 | Stable |
| `qisi-pdf-support-aligner.js` | Sequence alignment | 548 | Stable |
| `qisi-pdf-support-controlled-write.js` | Truth gate | 958 | FROZEN |
| `qisi-pdf-answer-extraction-quality.js` | Extraction classifier | 297 | Stable |
| `qisi-pdf-answer-only-extraction.js` | AOE (Route A) | 380 | Stable (research) |

## Pipeline Call Graphs

### DOCX+DOCX Stable Chain

```
User uploads DOCX files
→ app.js: createDraftImportBatch()
→ app.js: processDraftImportBatch()
→ qisi-batch-importer.js: DOCX parse
→ qisi-support-parser.js: support parse
→ app.js: draft write transaction
→ Draft in review page
```

### PDF+PDF Safe Partial Chain

```
User uploads PDF files
→ app.js: createDraftImportBatch()
→ app.js: processDraftImportBatch()
→ AI/OCR call (via qisi-local-server.js proxy)
→ qisi-pdf-support-block-parser.js: parse support
→ qisi-pdf-support-aligner.js: align sequences
→ qisi-pdf-support-controlled-write.js: truth gate
→ app.js: draft write transaction
→ Draft in review page (safe partial)
```

### Controlled-Write Position

```
qisi-pdf-support-controlled-write.js = FINAL gate before draft write.
Located inside app.js processDraftImportBatch, called via:
  app.js: applyPdfSupportFailClosedGate() → controlled-write
Output: accepted/rejected answers, warnings, fused numbers.
```

### Route B Hold Position

```
Route B (answer-only AI pass) is FROZEN.
  docs/testing/P10K_B_ROUTE_B_ANSWER_ONLY_AI_PASS_DESIGN.md
  tests/pdf-answer-only-ai-pass.test.js
  tests/pdf-route-b-hold.test.js ← enforces no-integration
No production code references Route B.
```

## Can Split Now

| Candidate | Why |
| --- | --- |
| Review draft state (BM08) | Pure data normalization, no DOM |
| Review view model (BM09) | Data transformation, no side effects |
| File type dispatcher (BM10) | Simple classification logic |
| Batch import helpers (BM07) | Small pure functions |

## Cannot Split Yet

| Candidate | Why |
| --- | --- |
| AI/OCR request logic | Tightly coupled with app.js state |
| Draft write transactions | Mixed with UI state + IndexedDB |
| Large PDF gate orchestration | Too complex, needs facade first |

## Needs Tests Before Split

| Candidate | Tests Needed |
| --- | --- |
| DOCX pipeline facade (BM11) | DOCX stable smoke already exists |
| PDF safe partial pipeline (BM12) | Covered by existing PDF tests |
| Storage facade (BM14) | Needs mock IndexedDB or adapter |
