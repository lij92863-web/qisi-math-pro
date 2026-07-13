# PDF Projection Owner Extraction Audit R3

## Scope and baseline

- Baseline commit: `7c854d9516f86cf030deed1c22df6229f002a15b`.
- Branch: `stage/app-shell-slimming-r3`.
- Audited owner: `processDraftImportBatch` in `app.js`.
- Target owner: `qisi-pdf-candidate-projection.js`.
- Frozen owners remain authoritative: PDF block parser, aligner, controlled-write,
  answer-only extraction, answer-extraction quality, and the PDF master runner.
- This audit authorizes moving category A statements only. It does not authorize
  parser, aligner, controlled-write, OCR, persistence, UI, or DOCX changes.

Line numbers below describe the baseline file before extraction. The migration
tests retain symbol-based guards because subsequent deletions will change physical
line numbers.

## Production call graph before extraction

```text
processDraftImportBatch
  -> processPdfFilePageByPage
  -> PdfSupportControlledWrite.buildPdfSupportParserGate
       -> PdfSupportBlockParser.parsePdfSupportBlocks
       -> PdfSupportAligner.alignPdfSupport
  -> applyPdfSupportFailClosedGate
       -> PdfSupportAligner.alignPdfSupport
  -> PdfSupportControlledWrite.buildPdfSupportFieldLevelControlledWrite
  -> mergeDraftRecognition
  -> inline PDF warning/fused projection
  -> ProductionImportOutputPort.projectImportOutput
  -> DraftPersistenceService.persistReviewDraftBatch
```

`ProductionImportBridge` currently receives raw `QisiBatchEngineV2` drafts from
`PdfImportCoordinator`. That result does not carry the legacy controlled-write
decision into a canonical candidate. The bridge must consume the same projected
result; it must not recreate the decision.

## Statement classification

| Baseline range | Purpose | Inputs | Outputs | Reactive dependencies | DB/UI effects | Parser / aligner / controlled-write | Provenance / support / review construction | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 15514–15589 | Load batch/files, establish recognition mode and working collections | batch id, repository context | batch context, ordered files, in-memory item arrays | recognition mode and cost counters | progress/status and list reload | none | none | E |
| 15723–15800 | Clean legacy support-answer artifacts before safety gates | parsed support items, question type | cleaned support items plus stable warning | none | none | no parser/aligner call | field preparation only; no acceptance | A |
| 15801–15860 | Legacy sequence fail-closed adapter | answer/solution items, expected sequence | safe items, mode, fused numbers/warnings | none | diagnostic console only | calls existing aligner | sequence result; no candidate construction | A |
| 15861–15882 | Stable question-number/raw-page adapters | support items/page result | normalized numbers/raw page list | none | none | delegates raw-page normalization to controlled-write owner | evidence preparation | A |
| 16131–16138 | Accumulate PDF safety state across files | per-file gate output | fail-closed reports, fused sets, field-warning map | local mutable run state | none | none | temporary projection state | A |
| 16720–16808 | Build question type map, clean support items, invoke parser gate and legacy gate | page result, current question items, expected sequence | parser/legacy alignment results | none | diagnostics only | calls existing parser gate and aligner adapter | no review record | A |
| 16809–16863 | Invoke the single controlled-write decision owner and derive effective support | aligned safe items, question drafts, fused numbers | effective answers/solutions, field decisions, rejection warnings | none | none | calls existing controlled-write owner exactly once | authoritative support-field decision | A |
| 16864–16909 | Accumulate stable controlled-write warning codes and emit diagnostics | controlled-write result | per-question warning-code map | local map | console diagnostics only | no policy call | warning projection is A; console block is C | A/C |
| 16910–16934 | Apply accepted support items to legacy working collections | controlled-write result | answer/solution arrays used by merge | local item arrays | none | consumes decision only | candidate input selection | A |
| 16935–17364 | Page processing, fallback, source image and file state handling | PDF/DOCX page results | question/full/support items and page evidence | cost counters/caches | file status writes, progress, console | may invoke recognition and source processors | unrelated to the bounded candidate projection | B/C/D/E |
| 17404–17418 | Construct legacy review-shaped draft values | safe question/support items, batch/files | draft list and unmatched support | none | diagnostics around call | no new parser/aligner/CW call | calls `mergeDraftRecognition`; shared DOCX/PDF legacy builder | E for this package |
| 17445–17515 | Apply fail-closed, fused and field-level warning results | gate state, warning maps, merged drafts | warnings and explicit missing-field markers | none | console only | consumes existing decisions | PDF safety projection to candidates | A/C |
| 17516–17729 | Optional legacy repair and display normalization | merged drafts and source evidence | cleaned legacy drafts | caches/helpers | progress and console | may call repair/OCR paths | unrelated repair/normalization; must not move | E |
| 17730–17999 | Image hydration, final visual repair, dedupe and diagnostics | drafts, page images, recognition evidence | final drafts/images | cost counters and caches | progress/console | may invoke vision repair | image/review presentation behavior outside this owner | B/C/E |
| 18000–18018 | Atomic review-draft persistence | final drafts/images/batch counts | persisted review batch | active UI batch state | repository transaction and reload | none | persistence only | D |
| 18044–18068 | Normal production entry/coordinator | batch id | legacy run promise | coordinator running state | UI diagnostics | none | routing only | B/C |

## Exact category A move

The new owner receives data, not authority:

- real source manifest/route/engine source-choice context;
- parsed question fields and stable evidence references;
- existing aligner mode, safe/fused question numbers, and reports;
- the unmodified result of
  `buildPdfSupportFieldLevelControlledWrite`;
- existing schema/sequence/ownership validation facts supplied by callers.

It projects only:

- canonical source metadata and source mode;
- per-field provenance from actual source and field decisions;
- accepted/rejected/missing support fields;
- stable controlled-write warnings and evidence references;
- support level, manual-review requirement, and validation facts.

The owner must fail closed when source mode, controlled-write result, or required
validation facts are absent. A PDF AI-derived field without an explicit accepted
controlled-write decision cannot be upgraded to `manual`, `deterministic-source`,
or `controlled-write`.

## Statements that do not move

- UI state, Vue refs, toast/reload/progress application (B).
- console and run-cost diagnostics (C), except stable warning codes passed as data.
- file/batch/draft/image database mutation (D).
- DOCX merge, OCR, page rendering, repair, image crop/binding, display cleanup,
  general legacy merge, and FormalAdmission behavior (E).

## Current safety gaps to characterize

Before extraction, the legacy controlled-write result preserves safe
answer/solution selection, rejection reasons, fused numbers, and warnings, but it
does not itself construct:

- `source.mode`;
- `fieldProvenance`;
- `supportLevel`;
- `manualReviewRequired`;
- schema/sequence/ownership flags on the review candidate.

Those absent fields are not safe defaults. Characterization records the existing
decision output and treats missing source mode or missing controlled-write input as
known-bad cases for the new owner.

## Extraction invariants

1. The parser, aligner, and controlled-write algorithms remain byte-for-byte
   unchanged unless a separate production-linked failing test proves an exposed
   result is insufficient.
2. The legacy path and bridge pass the same controlled-write result object to the
   same projector.
3. Rejected answer/solution values remain empty while rejection reasons and raw
   evidence references remain visible.
4. Gap, rewind, duplicate, mismatch, raw JSON, missing source mode, and missing
   controlled-write decision cannot reach canonical review handoff.
5. `processDraftImportBatch` retains only orchestration and UI/DB effects after
   category A extraction.
6. DOCX code and behavior are unchanged.

