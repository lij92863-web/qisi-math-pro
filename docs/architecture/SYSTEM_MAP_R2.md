# System Map R2

## End-to-end map

```text
Input (DOCX / PDF / Image)
  -> Recognition (DOCX parser / PDF text+image / OCR-VL / formula+image extraction)
  -> Normalization (JSON repair / wrapper cleanup / text / formula display)
  -> Structure (question / options / answers / solutions / page+source order)
  -> Safety (schema / sequence / ownership / safe-partial / controlled-write)
  -> Application (import / review / library / storage / export)
  -> UI (Vue app.js + main.html)
```

| Node | Current owner | Public API / entry | Main callers | Tests | Risk | Known debt |
|---|---|---|---|---|---|---|
| DOCX input/parser | `qisi-batch-importer.js`, `qisi-docx-pipeline.js`, legacy app glue | importer exports, DocxPipeline | batch flow/app.js | docx-pipeline, docx-real-case, batch smoke | high/stable | significant DOCX logic remains in app.js |
| PDF text/image | `qisi-pdf-safe-partial-pipeline.js`, app glue | PdfSafePartialPipeline | batch flow | pdf-safe-partial, pdf-real-case | high | rendering/OCR orchestration remains coupled |
| Image/OCR-VL | app.js and local server boundary | Qwen helpers/proxy | entry and batch recognition | mock/quality tests | high | no engine registry; direct helpers scattered |
| Formula/image extraction | `qisi-utils.js`, importer, app.js | utility and importer exports | recognition/review | utility fixtures and batch smoke | high | normalization ownership is distributed |
| JSON repair | `qisi-support-repair.js` plus app helpers | SupportRepair | PDF/vision paths | support-repair | high | owner duplication must be audited |
| Wrapper/text normalization | `qisi-utils.js`, parser/repair modules | Utils / parser APIs | batch and review | qisi-utils tests | medium | repeated cleanup calls and legacy wrappers |
| Formula display normalization | `qisi-utils.js`, component/app rendering | Utils + LatexPreview | review/library/export | bare-latex and KaTeX tests | medium/high | display and recognition normalization are adjacent |
| Question parser | `qisi-support-parser.js`, importer, app.js | SupportParser | batch orchestration | support-parser | high | multiple source-specific parsers |
| Option parser | importer/support parser/app helpers | parser exports | DOCX/PDF pipelines | importer/parser tests | high | app.js holds large legacy option routines |
| Answer/solution parser | support parser and frozen PDF modules | parser/block APIs | controlled-write path | PDF extraction and parser tests | critical | answer-only research artifacts must stay isolated |
| Page/source order | aligner/block parser | PdfSupportAligner / BlockParser | support pipeline | aligner/block tests | critical | must remain deterministic/fail-closed |
| Schema validation | currently distributed | draft checks | batch/review | smoke and controlled-write tests | high | no canonical R2 contract owner yet |
| Sequence/ownership | frozen aligner + controlled-write | controlled-write decision APIs | PDF support | known-bad, ownership tests | critical | protected owner; no semantic matching |
| Safe partial | `qisi-pdf-safe-partial-pipeline.js` | assert/normalize safe partial | PDF orchestration | safe-partial tests | critical | product display must expose uncertainty |
| Formal write | `qisi-pdf-support-controlled-write.js` plus repository flow | controlled-write decision | review confirmation | ownership tests | critical | must remain sole truth gate |
| Import orchestration | `qisi-batch-orchestrator.js`, importer, app.js | normalize/summarize plus app workflow | Vue handlers | batch orchestrator/smoke | high | processDraftImportBatch is oversized |
| Review lifecycle | `qisi-review-draft-state.js`, app.js | ReviewDraftState | Vue review | review state/view tests | high | controller and UI state not separated |
| Library | primarily app.js | Vue computed/actions | UI | limited indirect tests | medium/high | no domain service |
| Storage | `qisi-db.js`, tiny `qisi-storage-facade.js`, app.js | QisiDb/facade | application | storage facade tests | high | facade is not a repository |
| Export | app.js and print helpers | Vue actions | UI | limited | medium/high | mapping and browser side effects coupled |
| UI shell | `main.html`, `app.js`, components | Vue setup/handlers | browser | startup/order and smoke | high | app.js remains 22k lines |

## Ownership rule

The target direction is UI -> controller -> domain -> validator -> adapter/repository. Frozen PDF safety files remain read-only unless a dedicated high-risk regression package proves a necessary change.
