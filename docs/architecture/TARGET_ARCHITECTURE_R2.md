# Target Architecture R2

## Dependency direction

```text
UI / Vue Shell
  -> Controllers / Orchestrators
    -> Domain Services
      -> Validators / Safety Gates
        -> Adapters / Repositories
          -> OCR / Storage / Export / External Services
```

Dependencies may move only downward. Data and results may return upward through explicit contracts; lower layers never import UI state.

## Layer responsibilities

| Layer | Owns | Must not own | Planned modules |
|---|---|---|---|
| UI shell | refs/reactive, lifecycle, user events, progress/error views, view mapping | parsing, ownership, storage implementation, JSON repair | `app.js`, `main.html` |
| Controller/orchestrator | sequencing, cancellation, progress, state transitions, error mapping | OCR implementation, answer guesses, direct persistence | import and review controllers |
| Domain | question drafts, review lifecycle, library query, deterministic candidate aggregation | DOM, external requests, formal write bypass | library/review/import services |
| Validator/safety | schema, sequence, ownership, safe partial, controlled-write decision | network and UI | canonical contracts plus existing frozen safety owners |
| Adapter/repository | qwen/local OCR transport, DOCX/PDF input, storage, export | ownership rules and semantic attachment | OCR adapters, storage repository, export service |
| External | browser APIs, local service, IndexedDB/Dexie, downloads | domain policy | existing infrastructure |

## Canonical flow

```text
SourceAsset
 -> RecognitionCandidate
 -> NormalizedCandidate
 -> StructuredQuestionDraft
 -> ValidatedQuestionDraft
 -> controlled-write decision
 -> ReviewDraft
 -> Manual Confirmation
 -> Repository
```

Every boundary carries provenance and warnings. Missing evidence produces rejection or manual review, never fabricated values.

## Single owners

- Controlled-write: existing PDF controlled-write truth gate and future generic facade, with no duplicate policy.
- JSON repair: one repair service; callers consume results.
- Storage: `qisi-storage-repository.js`.
- OCR registry: `qisi-ocr-engine-registry.js`.
- Canonical schema: `qisi-recognition-contracts.js`.
- Review lifecycle: `qisi-review-controller.js`.
- Export mapping: `qisi-export-service.js`.
- Runtime dependency truth: derived from `main.html` and module declarations.

## Migration constraints

1. Tests link to production behavior before extraction.
2. A call site and its old owner migrate atomically.
3. Frozen PDF owners change only under the high-risk protocol.
4. DOCX stable, known-bad, controlled-write, no-real-AI, runtime, and browser gates protect migrations.
5. app.js keeps reactive state until a dedicated proof shows state can move safely.
