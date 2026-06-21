# BM20 Base Migration Handoff

## Final Commit

`a179973` (stage BM19 record full migration regression)

## Module Boundaries

| Layer | Modules | Status |
| --- | --- | --- |
| Shell | `app.js`, `main.html` | Legacy coordinator (23k lines) |
| Facades | `qisi-app-facade.js`, `qisi-docx-pipeline.js`, `qisi-pdf-safe-partial-pipeline.js`, `qisi-batch-orchestrator.js` | Ready |
| Domain | `qisi-review-draft-state.js`, `qisi-review-view-model.js`, `qisi-file-dispatcher.js` | Ready |
| Storage | `qisi-storage-facade.js`, `qisi-db.js` | Ready |
| UI | `qisi-ui-events.js`, `qisi-ui-renderer.js` | Ready |
| PDF | `qisi-pdf-support-*.js`, `qisi-pdf-answer-*.js` | FROZEN |
| Runtime | `qisi-runtime.js` | Enhanced with registry |

## app.js Remaining Responsibilities

- Vue app boot and mount
- Batch import orchestration (8K lines)
- AI/OCR request construction
- Draft write transactions
- Review page rendering
- UI event bindings

## Migrated Modules (12 new)

`qisi-app-facade.js`, `qisi-batch-orchestrator.js`, `qisi-review-draft-state.js`, `qisi-review-view-model.js`, `qisi-file-dispatcher.js`, `qisi-docx-pipeline.js`, `qisi-pdf-safe-partial-pipeline.js`, `qisi-storage-facade.js`, `qisi-ui-events.js`, `qisi-ui-renderer.js`, `qisi-pdf-answer-extraction-quality.js`, `qisi-pdf-answer-only-extraction.js`

## Prohibited

- Route B integration into production
- Relaxing controlled-write
- Pursuing PDF 12/12 complete
- Modifying frozen PDF modules without authorization

## Next Steps

1. Wire facades into app.js incrementally
2. Migrate batch helpers (BM07 proper)
3. Extract review page rendering
4. Shrink app.js gradually
