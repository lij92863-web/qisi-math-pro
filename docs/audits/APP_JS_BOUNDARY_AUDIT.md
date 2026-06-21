# app.js Boundary Audit

Stage P1.3 is a read-only audit. No `app.js` code was changed.

## Scope

This audit identifies current PDF, AI/OCR, support, draft-write, runner/orchestration, and review-report boundaries in `app.js`. The goal is to document where business logic still lives so later stages can move it deliberately into focused `qisi-*.js` modules without weakening DOCX stable behavior or PDF fail-closed gates.

## Current Entrypoints

| Area | Current `app.js` entrypoint | Notes |
| --- | --- | --- |
| Batch creation | `createDraftImportBatch` around line 1030 | Creates draft batch/file rows and immediately starts recognition. |
| Batch runner/orchestration | `runBatchRecognition` around line 19946 | Guards duplicate runs and delegates to `processDraftImportBatch`. |
| Main legacy batch processor | `processDraftImportBatch` around line 17394 | Large coordinator containing PDF, DOCX, AI/OCR, support merge, warnings, and final draft write behavior. |
| V2 batch processor | `processDraftImportBatchV2` around line 17211 | Present as a separate path but the active runner logs `engine: legacy`. |
| Review page entry | `openBatchReview` around line 19976 | Loads draft rows and selects the first draft for review. |
| Draft workspace clear | `clearBatchDraftWorkspace` around line 413 | Clears draft questions, import batches, files, and images. |
| Draft data load | `loadBatchImportData` around line 616 | Loads batches, files, draft questions, images, and unmatched answers. |
| Draft write | final batch transaction around lines 19898-19914 | Deletes old draft rows/images, bulk writes current run drafts/images, and updates batch summary. |
| Single draft field write | `updateDraftQuestionField` around line 20020 | Mutates active draft fields and writes to `db.draftQuestions`. |
| Draft editor save | `saveActiveDraftQuestion` around line 20079 | Commits editor source projection, cleans, normalizes, and writes the draft. |
| Submit to bank | `submitDraftQuestion` around line 20538 | Validates reviewed draft, writes formal question/image records, and marks draft submitted. |
| Review/report summary | `batchRecognitionSummary` around line 975 and `refreshBatchStats` around line 20646 | Computes UI summary/problem counts from draft rows and images. |

## PDF Support Entrypoints

| Entrypoint | Current boundary |
| --- | --- |
| `applyPdfSupportFailClosedGate` around lines 17706-17764 | Calls `window.Qisi.PdfSupportAligner.alignPdfSupport`, returns `full`/`prefix`/`fail-closed` style safe items, and logs reports. This should remain glue only; sequence validation belongs in `qisi-pdf-support-aligner.js`. |
| `normalizePdfSupportRawTextPagesFromPageResult` around lines 17779-17784 | Delegates to `window.Qisi.PdfSupportControlledWrite` when available. |
| `pdfSupportGate` construction around lines 18751-18840 | Builds field-level gate data, calls controlled-write behavior, gathers fused numbers and warnings. This is high-risk glue and should not grow more business policy. |
| Fail-closed/fused warning propagation around lines 19329-19405 | Adds fail-closed reports, fused question warnings, and field warnings to drafts. This should preserve diagnostics but not decide new ownership. |

## DOCX Support Entrypoints

| Entrypoint | Current boundary |
| --- | --- |
| DOCX conversion helpers around lines 1109-1228 | Check local conversion service and create converted PDF records for visual enhancement. |
| DOCX V2/importer path around lines 17102-17208 | Uses DOCX importer behavior when available and records warnings. |
| Final draft write around lines 19898-19914 | Shared by DOCX and PDF results; this is a critical stable-chain boundary. |

## AI/OCR Entrypoints

| Entrypoint | Current boundary |
| --- | --- |
| `DASHSCOPE_CHAT_URL` and `DASHSCOPE_OCR_URL` around lines 1256-1257 | Browser code targets local proxy endpoints `/api/ai/chat` and `/api/ai/ocr`. |
| `fetchWithTimeout` around lines 1277-1302 | Blocks browser direct DashScope host access and records AI/OCR cost calls for proxy URLs. |
| `window.__qisiCheckAiProxy` around line 1304 | Manual health check for AI proxy configuration. |
| `callDashScopeOcrTask` around line 1645 | OCR proxy request helper. Default tests must not call this. |
| Multiple `fetchWithTimeout(DASHSCOPE_CHAT_URL, ...)` call sites | AI/OCR recognition and repair logic still lives in the legacy coordinator. New real calls require explicit real-run permission. |

## Draft Write Entrypoints

| Entrypoint | Risk |
| --- | --- |
| `cleanSingleDraftForSave` around line 20001 | Preserves raw evidence, cleans display fields, and updates timestamp before draft writes. |
| `updateDraftQuestionField` around line 20020 | Direct field mutation and write. Safe for UI edits, risky if recognition policy is added here. |
| `saveActiveDraftQuestion` around line 20079 | Rebuilds draft from editor projection and normalizes before writing. |
| final bulk write around lines 19898-19914 | Deletes prior draft rows/images for the batch and writes current drafts/images. Later runner work should prove old/stale rows cannot count as current success. |
| `submitDraftQuestion` around line 20538 | Formal question-bank insertion boundary; requires reviewed status and validation. Do not bypass review safeguards. |

## Review Report Entrypoints

| Entrypoint | Current source |
| --- | --- |
| `batchRecognitionSummary` around line 975 | UI computed summary from current in-memory draft rows. |
| `draftQuestionProblems` around line 15734 | Aggregates warnings, missing fields, duplicate/image status, and review blockers. |
| `refreshBatchStats` around line 20646 | Recomputes reviewed/submitted/problem/image counts from IndexedDB draft rows. |
| PDF support sequence logs around lines 17721-17745 and fail-closed reports around lines 19329-19356 | Diagnostic report source is currently console/log plus draft warnings, not a standalone runner report object. |

## High-Risk Business Logic Still in app.js

- PDF support fail-closed gate orchestration is in `app.js` (`applyPdfSupportFailClosedGate`) even though sequence rules belong in `qisi-pdf-support-aligner.js`.
- PDF controlled-write wiring and field warning propagation are still assembled inside the legacy processor.
- JSON pollution repair for PDF stems/options remains in `app.js`; the option cleanup includes content keywords such as triangle/function/area terms and must not be expanded into ownership logic.
- `alignSupportItemsSafely` around line 2584 still performs support item alignment fallback behavior in `app.js`.
- AI/OCR repair, global answer repair, formula OCR, and visual enhancement calls are interleaved with batch processing.
- The final draft write deletes existing draft rows/images and writes new rows in the same legacy processor; runner diagnostics should later prove stale data cannot affect reports.
- Review summary/report state is derived from draft rows rather than an immutable current-run report.

## Logic That Should Move Later

- PDF support gate assembly and report normalization should move into a focused `qisi-pdf-support-*` module after fixture coverage proves behavior.
- Support item sequence validation and answer/solution intersection should stay in `qisi-pdf-support-aligner.js`, with `app.js` only passing inputs and showing warnings.
- Field-level controlled-write decisions should remain in `qisi-pdf-support-controlled-write.js`; `app.js` should only apply returned safe fields and warnings.
- Draft cleanup/current-run report isolation should move toward runner/report utilities, leaving `app.js` as UI orchestration.
- AI/OCR request construction and fallback policy should be isolated behind explicit local-AI/OCR boundaries before any further real-run work.

## Logic That Must Not Move Now

- Do not move or rewrite DOCX stable-chain behavior during this PDF governance batch.
- Do not alter `app.js` script loading, `main.html`, or UI template behavior in this audit stage.
- Do not change final draft write semantics until stale-run and controlled-write fixtures exist.
- Do not delete legacy PDF support paths before complete baseline and human-reviewed freeze criteria are met.
- Do not introduce any new semantic ownership strategy or special question-number fallback.

## Boundary Conclusion

`app.js` remains a high-risk legacy coordinator. The next safe steps are test-first PDF fixture work and root-cause documentation. Any later code movement should be small, module-first, and guarded by DOCX stable, PDF known-bad, batch safety, and diff-scope verification.
