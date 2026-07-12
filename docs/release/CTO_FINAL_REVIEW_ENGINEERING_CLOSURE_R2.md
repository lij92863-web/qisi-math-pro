# CTO Final Review — Engineering Closure R2

## Executive decision

R2 is suitable for release under its declared product boundary: DOCX remains the
stable main chain; PDF remains safe-partial plus mandatory manual review; OCR
outputs are candidates only; controlled-write and explicit confirmation remain
the only path to formal data.

R2 is not accepted as proof of real OCR improvement, complete app-shell
decomposition, hostile-archive hardening, or full browser performance coverage.

## Product review

- DOCX stability gates and the DOCX+DOCX mock chain pass.
- Known-bad PDF tests reject unsafe ownership expansion and preserve safe
  partial/manual-review behavior.
- Playwright E2E starts the real browser app and covers mock DOCX/PDF upload,
  review, field edit, confirmation, formal insertion, refresh persistence,
  export download, and recent-task deletion without deleting formal questions.
- Runtime and review warnings expose safe-partial/manual-review state. The E2E
  proves the path is visible and actionable, not a final teacher-language study.

## Recognition review

- Real OCR improvement: not demonstrated; no authorized real corpus or engine
  benchmark was run.
- Structural improvement: contract, scoring, ownership, and safe-partial
  enforcement improved; real recognition structural accuracy is unmeasured.
- Manual correction cost: scorer exists; real baseline/final cost is unmeasured.
- Dangerous false attachment: zero in known-bad deterministic safety fixtures;
  no claim is made for an unrun real corpus.
- Local OCR and shadow comparison remain research/shadow boundaries and cannot
  enter review, merge fields, select winners, or write formal data.

This absence of real quality evidence is not a release blocker because R2 made
no production quality promotion and preserved the existing main chain.

## Architecture review

- Canonical question contract, storage repository, library service, review
  controller, export mapping, import orchestration, OCR registry/adapters/shadow,
  and performance monitoring are genuine production owners with tests.
- Source guards find no reverse UI dependency in the audited lower layers and no
  critical owner conflict.
- Runtime script order is deterministic, duplicate owners/missing namespaces are
  rejected, and browser startup has no project error.
- `app.js` shrank only 264 lines (1.20%) and retains a 5,134-line legacy batch
  workflow plus high-risk residual responsibilities. This is real technical
  debt; the result is partial decoupling, not a completed shell architecture.

## Test review

- Production-linked tests import canonical repair, aligner, controlled-write,
  contract, repository, controller, and service owners.
- Browser E2E validates startup and a complete mock product lifecycle.
- Phase 3 counterfactual attacks cover runtime, JSON/LaTeX, ownership, synthetic
  OCR isolation, storage, security, and performance boundaries.
- Known-bad PDF, Route-B hold, DOCX stable, controlled-write ownership, and
  no-real-AI gates remain mandatory.
- Blind spots: real OCR accuracy, extension-specific console formats, complete
  ZIP-bomb detection, teacher usability study, and long-running browser/memory
  soak are not covered.
- Final Phase 8 must again show zero failed/skipped required tests and zero real
  AI/OCR calls.

## Performance review

- The metadata benchmark is reproducible on the same fixture/runtime: 449.721 ms
  baseline versus 310.307 ms Phase 6 median for 1,000 aggregations (-31.00%).
- The improvement comes from one pass instead of five and does not disable
  behavior.
- Cold start, upload-to-review, first render, switch p50/p95, save, reload,
  export, memory, and image-storage footprint remain unmeasured.

## Security review

- controlled-write plus manual confirmation is required for confirmed data;
  answer ownership remains field-level and fail-closed.
- Route B remains research-only and absent from app/controlled-write production
  imports.
- raw JSON/fenced wrappers fail schema validation; narrow LaTeX repair is tested
  and raw evidence is preserved.
- preview/runtime HTML is escaped and KaTeX uses `trust:false`; a comprehensive
  browser security penetration test is not claimed.
- local OCR is loopback-only, rejects paths, illegal MIME, and oversize input,
  and does not disclose the submitted path in its stable error.
- no tracked `.env`, credential/private-material path, model weight, local test
  material, local artifact, or `node_modules` file was found in the Phase 7
  tracked-file audit.
- no local model weights were added, so no new model-license acceptance is
  implied.

## Operations review

- startup: static dependency gate plus browser startup and visible fatal panel;
- diagnostics: stable extracted-owner error codes, sanitized runner reports, and
  privacy-safe timing samples, with legacy error-model debt disclosed;
- rollback: baseline commit/tag and atomic pushed work-package commits;
- OCR switching: registry default/health/capability/timeout/cancel boundaries;
- model/cache cleanup: no model or cache is tracked; private/local paths are
  ignored;
- data recovery: versioned backup validation and storage backup/restore tests;
  corrupt/version-mismatch data fails closed.

## Technical-debt classification

### Release blockers

None found, provided the Phase 8 final matrix and remote-main check pass.

### Next release

- ordered extraction of the 5,134-line legacy batch workflow and residual direct
  DB/OCR/parser/export effects from `app.js`;
- shared structured error model and classification of 352 console call sites;
- hostile ZIP expansion limits and a complete archive-bomb detector;
- controlled browser benchmark for all required UX/memory/storage metrics;
- security penetration tests and teacher-facing usability review.

### Accepted limitations

- real OCR baseline/final, structural accuracy, and correction cost are unmeasured;
- app shell line reduction is 1.20%, below the suggested 20%;
- only one performance bottleneck has a controlled baseline/final result;
- synthetic image transforms prove isolation, not OCR accuracy.

### Research-only

- Route B answer-only AI pass;
- local OCR quality experiments and OCR shadow comparison;
- any preprocessing or engine promotion without the authorized real benchmark.

## Verdict

```text
ENGINEERING_CLOSURE_ACCEPTED_WITH_LIMITATIONS
```
