# Program C Phase 5 — Real Browser Shadow Equivalence R3

## Stage

`PHASE 5 — REAL BROWSER SHADOW EQUIVALENCE`

## Baseline and scope

- start commit: `84e1b8a70f8a927345b8b3f55189585ec61d37ec`
- production/test end commit:
  `bba2fc48840fb8d11968b5fa86a820f51a6464f4`
- branch: `stage/app-shell-slimming-r3`
- normal UI owner: legacy `processDraftImportBatch` (unchanged)
- Bridge: shadow-only; not the normal UI owner
- C2-11: not entered
- real-run / AI proxy / real AI: not used

This resumed Phase 5 after the accepted DOCX producer-identity correction. It
compares only candidates produced by the same truthful producer contract.
DOCX vision and DOCX deterministic outputs are never declared equivalent.

## True-browser scenarios

| Scenario | Real entry/result | Decision |
| --- | --- | --- |
| DOCX vision | normal `AppProxy.runBatchRecognition`, actual DOCX conversion, legacy vision producer, Bridge vision shadow | exact, 0 differences |
| DOCX deterministic | real independent deterministic source port exists, but no normal-UI deterministic production route exists | non-applicable; different producer |
| PDF normal-UI full | normal `AppProxy.runBatchRecognition`, legacy coordinator and `processDraftImportBatch`; captured at the shared projection boundary and replayed through isolated Bridge shadow | exact, 0 differences |
| PDF full | production projection + Bridge in Chromium | exact, 0 differences |
| PDF safe-partial | production projection + Bridge in Chromium | exact, 0 differences |
| PDF missing answer | rejected/missing field remains explicit | exact, 0 differences |
| PDF formula fallback | full candidate with mandatory manual review and stable warning | exact, 0 differences |
| PDF ownership failure | legacy projection rejected; Bridge validation rejected; no persistence | fail closed on both paths |
| raw JSON candidate | rejected before projection/persistence | fail closed |
| multiple support ambiguity | rejected before parser/controlled-write | fail closed |
| conflicting controlled-write decisions | rejected with `controlled-write-conflict` | fail closed |
| cancellation | `IMPORT_CANCELLED`; late result discarded; no persistence | fail closed |

The browser tests use deterministic network fixtures. Every `/api/ai/chat` or
`/api/ai/ocr` request used by the normal UI is intercepted in-browser; no
underlying AI request is permitted.

## Production call graphs

DOCX vision legacy and shadow:

```text
AppProxy.runBatchRecognition
  -> LegacyBatchRunCoordinator
  -> processDraftImportBatch
  -> processDocxByLocalConvertAndStrictVision
  -> processStrictVisualQuestionFile
  -> DocxProducerIdentityContract producer-time projection
  -> legacy review persistence (user-visible)

ProductionImportBridge.runDocxVisionShadow
  -> ProductionDocxVisionSourcePort
  -> same DocxProducerIdentityContract
  -> isolated shadow result only
  -> canonical deep comparator
```

PDF legacy and shadow:

```text
AppProxy.runBatchRecognition
  -> LegacyBatchRunCoordinator
  -> processDraftImportBatch
  -> processStrictVisualQuestionFile / support parser / aligner
  -> PdfSupportControlledWrite
  -> PdfCandidateProjection.projectPdfCandidates
  -> legacy review persistence (user-visible)

ProductionImportBridge.run
  -> isolated runPdfImport fixture at the engine boundary
  -> same PdfCandidateProjection.projectPdfCandidates
  -> validation and isolated shadow sink
  -> canonical deep comparator
```

The normal-UI PDF test instruments the immutable production module by replacing
only the browser namespace reference with a delegating wrapper. The wrapper
calls the exact production owner, records its real input/output, and implements
no parser, aligner, controlled-write, provenance, support-level, or validation
rule.

## Comparator coverage

The PDF comparator now protects all stable safety identity:

- `source.format`, `sourceId`, page and source order;
- producer mode, route ID/reason, engine and deterministic flag;
- route identity/reason and ordered transitions;
- question number and every field value;
- every field's provenance kind, source, format, producer, route, engine,
  boundary, controlled-write decision, acceptance and stable contract version;
- controlled-write evaluated state, decision ID, accepted/rejected fields,
  errors and warning/rejection codes;
- support level, manual-review requirement, schema/sequence/ownership validity;
- warning codes and stable evidence identities.

Only request IDs, timestamps, durations, temporary paths and random diagnostic
IDs are volatile. Producer, route, provenance, controlled-write, validation and
warning differences cannot be suppressed. A counterfactual vision-versus-
deterministic comparison is required to produce producer and field-provenance
differences.

## Safety counters

- same-producer accepted canonical differences: `0`
- different-producer false equivalence: `0`
- wrong attachments: `0`
- raw JSON leakage: `0`
- placeholder leakage: `0`
- controlled-write bypass: `0`
- Formal Admission bypass: `0`
- Bridge production review writes: `0`
- Bridge formal writes: `0`
- normal UI formal writes during shadow runs: `0`
- real API called: `false`
- underlying real API calls: `0`

The Bridge test-local sink records accepted shadow output for comparison. It is
an isolated in-memory diagnostic sink, not production review or formal storage.

## Tests and gates

- failure-first comparator contract: initially `1/5` passed, with four expected
  failures proving missing PDF producer/source identity was observable; after
  correction `5/5` passed
- final Phase 5 targeted matrix: `135/135`
- true-browser suites: `2/2`, covering all scenarios listed above
- Phase 5 acceptance gate: `6/6`
- final `verify:safe` after the acceptance gate: `1484/1484` across 54 suites
- Base Migration: `15/15`
- Route B hold: `6/6`
- batch smoke: `20/20`
- PDF known-bad: `65/65`
- controlled-write answer ownership: `21/21`
- DOCX stable: `20/20`
- runtime dependency + architecture owner audit: `9/9`
- preflight: passed, `realApiCalled=false`, `underlyingApiCallCount=0`
- dry-run: passed in a real browser, `realApiCalled=false`,
  `underlyingApiCallCount=0`
- batch safety and no-real-AI: passed
- failed / cancelled / skipped / todo / timeout: `0 / 0 / 0 / 0 / 0`

All 11 mandatory gates passed. The first full-suite attempt exposed one stale
historical byte-freeze assertion for Formal Admission. The bounded audit-only
correction retained byte freezes for controlled-write and Route B and replaced
the stale assertion with positive fail-closed checks for both truthful PDF
producer boundaries. The corrected full suite passed.

## Changed files

Production contract and validation:

- `qisi-docx-producer-identity-contract.js`
- `qisi-pdf-candidate-projection.js`
- `qisi-formal-admission-policy.js`
- `qisi-recognition-contracts.js`

Tests and browser evidence:

- `tests/phase5-canonical-producer-comparator.test.js`
- `tests/e2e/docx-producer-identity-browser.test.js`
- `tests/e2e/pdf-projection-browser-shadow.test.js`
- `tests/pdf-candidate-projection.test.js`
- `tests/pdf-candidate-projection-known-bad.test.js`
- `tests/ocr-quality-architecture-audit.test.js`

No normal UI owner, parser, aligner, controlled-write algorithm, persistence
owner, or application shell was moved or deleted.

## Frozen files and ownership

Relative to the start commit, `app.js` and all six frozen PDF high-risk files
are unchanged:

- `qisi-pdf-support-controlled-write.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-answer-only-extraction.js`
- `qisi-pdf-answer-extraction-quality.js`
- `scripts/pdf-master-browser-runner.js`

The existing unique PDF candidate projection owner remains the only production
owner. Legacy normal UI and Bridge both delegate to it. Bridge remains shadow-
only, and legacy remains user-visible.

## Remaining limitations

- The normal UI has no deterministic DOCX production route. Deterministic DOCX
  browser equivalence is therefore truthfully non-applicable in Phase 5.
- Phase 5 does not migrate the production entry or delete the legacy owner.
  Those are C2-11 concerns and were not started.
- Performance baselines belong to later phases and are not claimed here.
- This review is an internal CTO review, not an independent external review.

## Decision

`PHASE_5_ACCEPTED`

Next exact action: stop this task. C2-11 may be considered only in a separate
subsequent task; it was not entered or mixed into the Phase 5 commits.
