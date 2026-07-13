# PDF Candidate Projection Owner Correction R3

Stage:
PDF CANDIDATE PROJECTION OWNER CORRECTION

## Baseline

- start commit: `7c854d9516f86cf030deed1c22df6229f002a15b`
- branch: `stage/app-shell-slimming-r3`
- legacy owner: `processDraftImportBatch` contained inline PDF fused/field-warning
  candidate projection after the existing parser, aligner, and controlled-write
  owners had run.
- Bridge status: `ProductionImportBridge` was and remains an overall layer-3
  scaffold. Before this correction its PDF result had no canonical projection
  port and lacked real `fieldProvenance`, `source.mode`, `supportLevel`,
  `manualReviewRequired`, and controlled-write evidence. This package
  production-wires only its projection port; it does not switch the normal UI
  entry or claim that the whole Bridge is production-active.

## Extraction

- moved line ranges: baseline `app.js` 16864-16909 (category-A warning/candidate
  projection only) and 17431-17507 (category-A fail-closed/fused/field warning
  projection only). Category-C diagnostics remained. Baseline parser/aligner/
  controlled-write ranges were reclassified as upstream evaluation and did not
  move. Strict field evidence is exposed near baseline 10359, and the final
  legacy delegation was added near baseline 17914.
- new owner: `qisi-pdf-candidate-projection.js`, registered as
  `pdfCandidateProjectionOwner` and `production-wired` in the architecture
  manifest.
- old owner removed: yes. `pdfSupportFieldWarningsByQuestion`,
  `pdfSupportFusedQuestionNumbers`, `pdfSupportFusedWarnings`, and the two
  post-merge projection loops are absent from `app.js`.
- duplicate implementation: none. The single-owner gate scans production files
  for duplicate PDF provenance, support-level, manual-review, comparator, and
  Bridge-local controlled-write fallback builders. The PDF-only engine adapter
  defers legacy support attachment before canonical projection.
- high-risk files modified: none. The parser, aligner, controlled-write,
  answer-only extraction, answer-extraction quality, and PDF master browser
  runner files remained unchanged.

## Production wiring

- legacy calls shared owner: yes. The normal `processDraftImportBatch` UI path
  retains real controlled-write/alignment results and calls
  `PdfCandidateProjection.projectPdfCandidates` immediately before existing
  review persistence.
- Bridge calls shared owner: yes. `ProductionImportBridge` requires the injected
  `projectPdfCandidates` port and rejects a missing/malformed projection context
  before normalization or shadow persistence.
- controlled-write source: the unchanged production
  `PdfSupportControlledWrite.buildPdfSupportFieldLevelControlledWrite` result.
  The legacy path retains that result directly; the PDF-only V2 port builds its
  context by injecting the unchanged parser, aligner, and controlled-write
  owners. Missing controlled-write or missing alignment fails closed.
- provenance source: actual source manifest/route context, selected engine
  source kind, strict engine field decision id, real controlled-write field
  decisions, page/block/image evidence, and ownership facts. No filename/UI
  guessing, confirmation-to-manual conversion, or default provenance exists.
- supportLevel source: the shared owner derives `full`, `prefix`,
  `safe-partial`, or `rejected` from real schema, sequence, ownership,
  alignment, and per-field decisions; it does not use completeness percentage.
- manualReviewRequired source: the shared owner derives it from support level,
  missing/rejected provenance, formula fallback, partial sequence, engine
  conflict, provenance completeness, and required user intervention. It is not
  an acceptance bypass.

## Equivalence

- fixtures: 12 required production-linked cases were covered: PDF full, stem-
  only safe partial, missing answer, rejected solution, answer/solution
  mismatch, question-number gap, sequence rewind, raw JSON, formula fallback,
  image evidence, missing source mode, and missing controlled-write decision.
  Unsafe legacy gaps were recorded as known-bad rejection tests rather than
  frozen as desired output.
- browser cases: DOCX deterministic, PDF full, PDF prefix/safe-partial, PDF
  missing answer, and PDF known-bad ownership failure.
- canonical differences: `0`
- wrong attachments: `0`
- raw JSON: `0`
- placeholders: `0`
- controlled-write bypass: `0`
- real AI called: `false`; forbidden browser requests `0`

The true Chromium test starts the normal `main.html`, loads the production state
machine module, runs the production Bridge/projector/controlled-write/review
policy modules with deterministic fixture output, keeps persistence in memory,
and never writes production drafts or formal questions.

## Gates

- targeted: new projection, characterization, known-bad, Node shadow,
  single-owner, and true-browser tests passed `32/32`; the broader production-
  linked target passed `107/107`.
- Phase 4: the original `1387/1387` Phase-4 baseline remained contained in the
  current full suite; final `verify:safe` passed `1419/1419` with no failure,
  timeout, skipped, or todo tests.
- mandatory: all 11 required gates passed on the final code shape.
- DOCX: `verify:docx-stable` passed `20/20`.
- PDF known-bad: `verify:pdf-known-bad` passed `65/65`; wrong attachment remained
  zero.
- Route B: hold gate passed `6/6`; Route B remains research-only/frozen.
- runtime: runtime/architecture/no-duplicate composite passed `8/8`; browser
  startup loaded the projection owner before `app.js`.
- architecture owner: PDF single-owner gate passed `3/3`; the manifest has one
  production-wired `pdfCandidateProjectionOwner`.
- controlled-write ownership: passed `21/21`.
- Base Migration: passed `15/15`.
- browser master: preflight and dry-run passed with `realApiCalled=false` and
  `underlyingApiCallCount=0`; no real-run was performed.

The first `verify:safe` attempt exposed a stale display-cleaner residual count:
five deleted inline warning callsites reduced the live count from 39 to 34. One
bounded audit-only correction froze the new count at 34 and added a regression
guard proving the deleted projection cannot return. Its complete R3 audit passed
`81/81`, after which the full mandatory matrix passed.

## Git

- start commit: `7c854d9516f86cf030deed1c22df6229f002a15b`
- characterization commit: `1ed14fcf9a5bef324ad3674392d8e575a18c13bc`
- owner extraction commit: `f07b0341b10c0292aaae82e996029bc340756d14`
- end implementation commit: `2a2b4043927c4583679d34613524e0538788861a`
- pushed: yes. Local HEAD, `origin/stage/app-shell-slimming-r3`, and live
  `ls-remote` were equal after the implementation push; both comparison logs
  were empty.
- working tree: clean after implementation tests and push; the only subsequent
  change is this required release report, which is sealed separately.

## Decision

`PDF_PROJECTION_OWNER_CORRECTION_ACCEPTED`

All 20 acceptance conditions for this bounded corrective package are satisfied.
The normal UI remains on `processDraftImportBatch`, while both that path and the
Bridge projection port now consume the same production owner and real
controlled-write result. No claim is made that the overall Bridge has replaced
the normal UI workflow.

## Next exact action

- Resume Phase 5 browser equivalence.
- Do not enter C2-11 until Phase 5 is accepted.
