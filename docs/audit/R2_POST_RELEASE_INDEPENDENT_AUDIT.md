# R2 Post-Release Independent Audit

## Audit basis

- Audited commit: `6ab88d0551be5af24d134f17906ba0c42631b2ea`.
- Audited tag: `v1.1.0-rc1-engineering-closure-r2`.
- Live start check on 2026-07-13 confirmed local main, `origin/main`, and the
  live remote main ref all pointed to that commit.
- This audit reads production code and tests. It does not treat an R2 report as
  proof of production wiring.

## Executive finding

R2 created useful, tested modules and preserved the safety gates, but its formal
question admission path remained legacy-owned. The central correction for
Program A is therefore necessary: a source-aware Formal Admission Policy and a
repository-owned confirmation transaction must become the only batch formal
write path.

## Verified facts

### Release and measured improvement

- The R2 release commit/tag are real and immutable at the audited baseline.
- The reproducible metadata aggregation benchmark improved from 449.721 ms to
  310.307 ms for the recorded workload.
- No authorized real OCR baseline/final exists. R2 correctly cannot claim a
  measured OCR quality improvement or reduced real correction cost.

### app.js reality

- `app.js` has 21,779 physical lines (`base-migration-inventory.js` reports a
  21,780 split count including the terminal line).
- `processDraftImportBatch` spans inventory lines 15,984–21,117: 5,134 lines.
- It remains the legacy batch business/persistence coordinator and contains AI,
  OCR, controlled-write, draft construction, and persistence responsibilities.

### ImportOrchestrator production wiring

- `qisi-import-orchestrator.js:createImportOrchestrator` defaults `validate` to
  `result => ({ valid: true, value: result })`.
- `app.js:setup` creates the production orchestrator with a batch handler that
  calls `processDraftImportBatch(source.batchId)`.
- The production validator at `app.js:38` also unconditionally returns
  `{ valid: true, value: result, errors: [] }`.
- The handler already performs the legacy workflow. Consequently the current
  orchestrator is production-loaded and used as a run coordinator, but it is
  not a truthful validation boundary.

### ReviewController production wiring

- `qisi-review-controller.js:createReviewController` defaults `validateDraft`
  to a successful result.
- Production injects `validateDraftForReview`, so the current app instance is
  not using that default; however the validator checks display/content quality,
  not a source-aware admission policy or field provenance.
- `ReviewController.confirm` sets `userEdited`, `manualEdited`, and
  `manualConfirmed` to true after validation even when the user only clicks
  confirm. It cannot prove which fields were actually rewritten.
- The unit test with an injected `controlledWriteAccepted` condition proves
  controller behavior under that injected rule, not the production validator.

### Formal question write path

- `app.js:submitDraftQuestion` performs the batch formal write.
- At `app.js:19220` it opens a direct Dexie transaction over questions, images,
  drafts, and batches; at `app.js:19228` it calls
  `db.questions.put(questionRecord)`.
- The same function constructs the formal record in the UI shell and does not
  call `StorageRepository.saveQuestion`, a formal-admission policy, or a v2
  schema validator.
- There are seven static `db.questions.put` call sites in `app.js`; only the
  batch formal-submit site is in scope for Program A. Other library/package
  paths require separate owner classification, not blind replacement.

### RecognitionContracts production use

- `qisi-recognition-contracts.js` implements the v1 candidate, structured draft,
  confirmed-question validators, and legacy adapter.
- Qwen and local OCR adapters call the candidate factory.
- No non-test production call to `validateConfirmedQuestion` exists.
- The batch formal record does not carry `qisi.question.v1`, controlled-write
  evidence, or the confirmed-question contract required fields. The confirmed
  validator is implemented and unit-tested, but not production-wired.

### Browser E2E classification

- Existing Playwright tests start the real page, exercise upload UI, review,
  edit, confirm, persistence, export, and delete.
- `product-acceptance.mock.test.js`, `persistence.test.js`, and
  `export-delete.test.js` call `seedReviewBatch`.
- `seedReviewBatch` writes batch/files/drafts directly to IndexedDB. The uploaded
  mock bytes do not travel through recognition, contract, parser/validator, or
  draft-building production paths before review.
- These tests are valuable `seeded-review-ui-lifecycle` tests. They are not true
  deterministic import/recognition E2E.

### Architecture guard coverage

- `tests/architecture-consistency.test.js` checks eight selected lower-layer
  files for reverse dependencies, eight critical implementation symbols for a
  single owner, OCR/review persistence exclusions, and runtime order.
- The guard does not describe every production module, public API, allowed edge,
  forbidden edge, status, or a complete cycle graph.
- No checked-in `architecture/layers.json` or `architecture/owners.json` exists.
  R2 therefore has useful partial guards, not a complete architecture manifest.

### R2 state/report consistency

- The R2 state header says Phase 8 sealing is authorized, but its Pending section
  still says WP2P and Phase 3–8 are pending.
- Its Next exact action still requests the already completed final report,
  fast-forward, tag, and verification.
- The final report uses prospective wording for push/equality instead of the
  final verified commit hash, although Git history proves the release succeeded.
- These are stale ledger/report defects. They do not move the R2 tag, but they
  demonstrate why Program A must distinguish implemented, production-wired,
  browser-verified, and benchmark-measured claims.

## Required correction boundary

Program A must:

1. add a source-aware Formal Admission Policy;
2. add question schema v2 with per-field provenance;
3. make a repository transaction own draft-to-formal confirmation;
4. route batch formal submission through policy plus repository;
5. make import/review controllers fail closed;
6. add true deterministic import E2E without seeded drafts;
7. add a complete checked-in architecture ownership manifest;
8. correct status/report terminology without rewriting R2 history.

Real OCR quality work and broad app-shell slimming remain out of Program A.
