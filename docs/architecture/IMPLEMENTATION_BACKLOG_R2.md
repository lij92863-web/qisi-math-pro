# Implementation Backlog R2

All items use atomic commits and the R2 mandatory gate. "Rollback" means revert the single work-package commit on the stage branch, not destructive reset.

## 1. Test authenticity (WP2A)

- Goal: inventory and remove copied/equivalent test logic.
- Files: test audit, focused tests, only production helper needed for a proven case.
- Forbidden: frozen PDF owners unless high-risk protocol; test-only algorithm.
- Preconditions: clean branch and Phase 1 committed.
- Tests: new guard, targeted production module, mandatory gate.
- Acceptance: controlled-write is real and copies are documented/fixed.
- Rollback: revert WP2A commit.
- Commit: `stage closure r2 link tests to production code`.
- Stop: production behavior cannot be tested without broad app rewrite.

## 2. Runtime dependency gate (WP2B)

- Goal: deterministic script/namespace validation.
- Files: verifier and its tests.
- Forbidden: changing runtime script order to make test easier.
- Preconditions: runtime strategy ADR.
- Tests: seven negative fixtures and current main.html.
- Acceptance: current runtime passes; mutations fail.
- Rollback: revert verifier commit.
- Commit: `stage closure r2 add runtime dependency gate`.
- Stop: duplicate owner in current production requires multi-owner change.

## 3. Browser E2E (WP2C)

- Goal: real UI mock acceptance.
- Files: tests/e2e and minimal existing runner support.
- Forbidden: real AI, production data, dependency change without ADR commit.
- Preconditions: runtime gate.
- Tests: startup/product/persistence/export-delete.
- Acceptance: 17-step flow and no project console errors.
- Rollback: revert E2E commit.
- Commit: `stage closure r2 add browser product e2e`.
- Stop: white screen or unisolated persistent data.

## 4. Contracts (WP2D)

- Goal: canonical candidate/draft/confirmed schemas.
- Files: contract module and two tests; main.html only when browser consumer is added.
- Forbidden: defaults that alter content/answers/numbers.
- Preconditions: ADR-002.
- Tests: contract and legacy compatibility.
- Acceptance: immutable factories, provenance, stable errors.
- Rollback: revert consumers and contract atomically.
- Commit: `stage closure r2 add recognition contracts`.
- Stop: validator bypass required.

## 5. Storage repository (WP2E)

- Goal: one persistence owner.
- Files: repository, storage tests, minimal app glue.
- Forbidden: schema content rewrite and UI storage implementation.
- Preconditions: contracts and characterized current persistence.
- Tests: repository/migration/failure plus browser persistence.
- Acceptance: app no longer implements migrated operations.
- Rollback: legacy adapter path within atomic commit.
- Commit: `stage closure r2 extract storage repository`.
- Stop: unrecoverable migration/data risk.

## 6. Library service (WP2F)

- Goal: deterministic query/pagination domain.
- Files: service and dataset tests; minimal app glue.
- Forbidden: DOM, OCR, parser, storage backend.
- Preconditions: repository metadata API.
- Tests: 100/1000/5000 datasets.
- Acceptance: stable sort and indexed/filterable metadata.
- Rollback: revert service migration.
- Commit: `stage closure r2 extract library service`.
- Stop: behavior requires reactive-state duplication.

## 7. Review controller (WP2G)

- Goal: review lifecycle owner.
- Files: controller/tests/minimal app glue.
- Forbidden: direct repository writes, ownership changes.
- Preconditions: contracts and repository boundary.
- Tests: edit/dirty/warning/confirm safety and E2E.
- Acceptance: confirmation still crosses controlled-write.
- Rollback: revert controller commit.
- Commit: `stage closure r2 extract review controller`.
- Stop: controlled-write bypass or lost evidence.

## 8. Export service (WP2H)

- Goal: pure mapping plus adapter effects.
- Files: export service/tests/minimal glue.
- Forbidden: Vue reactive dependency.
- Preconditions: canonical confirmed contract.
- Tests: mapping, filenames, images, cancellation/failure.
- Acceptance: output matches existing behavior.
- Rollback: revert export commit.
- Commit: `stage closure r2 extract export service`.
- Stop: browser export cannot be tested safely.

## 9. Import orchestrator (WP2I)

- Goal: candidate pipeline sequencing.
- Files: orchestrator/tests/minimal glue.
- Forbidden: OCR implementation, ownership, repository write.
- Preconditions: contracts/controllers/adapters.
- Tests: DOCX/PDF selection, progress, cancellation, errors.
- Acceptance: validator and review handoff always run.
- Rollback: revert orchestrator commit.
- Commit: `stage closure r2 extract import orchestrator`.
- Stop: DOCX stable regression.

## 10. OCR benchmark (WP2J)

- Goal: reproducible scorer and corpus schema.
- Files: benchmarks, scorer, scoring tests, gitignore only for private benchmark path.
- Forbidden: private originals and fabricated results.
- Preconditions: benchmark spec.
- Tests: CER/formula/structure/safety fixtures.
- Acceptance: deterministic JSON result and incomplete-real-data disclosure.
- Rollback: revert harness commit.
- Commit: `stage closure r2 add OCR benchmark harness`.
- Stop: result cannot reproduce.

## 11. OCR adapters (WP2K/WP2L)

- Goal: registry, Qwen/local contracts, shadow-only new engines.
- Files: registry/adapters/local docs/tests.
- Forbidden: prompt change, ownership, real calls, auto-selection.
- Preconditions: contracts and benchmark harness.
- Tests: health/timeout/cancel/malformed/no-write/shadow.
- Acceptance: adapters only create candidates.
- Rollback: disable registry wiring/revert commit.
- Commit: adapters then shadow as two commits.
- Stop: unauthorized external call or validator bypass.

## 12. Recognition quality (WP2M)

- Goal: fix only benchmark-proven weaknesses.
- Files: one owner/subdomain plus failing test.
- Forbidden: multiple frozen owners, semantic attachment.
- Preconditions: baseline metric and high-risk protocol where needed.
- Tests: targeted corpus, known-bad, browser, mandatory.
- Acceptance: zero wrong attachment and measured improvement.
- Rollback: revert subdomain commit.
- Commit: one message per proven weakness.
- Stop: no reproducible improvement or safety regression.

## 13. app.js slimming and performance (WP2N/WP2O)

- Goal: migrate proven domains and improve measured bottleneck.
- Files: one domain module, tests, minimal app/main wiring; performance monitor.
- Forbidden: copied logic, broad state move, unmeasured worker.
- Preconditions: services/controllers/E2E/baseline.
- Tests: production-linked, runtime, browser, mandatory, performance.
- Acceptance: unique owner; no >10% regression; one 20% improvement when optimizing.
- Rollback: revert each domain/bottleneck separately.
- Commit: separate domain and performance commits.
- Stop: only possible via duplication or unsafe reactive migration.

## 14. Repository cleanup (WP2P)

- Goal: classify, index, and delete only proven temporary artifacts.
- Files: doc indexes, gitignore when proven, explicit manifest.
- Forbidden: git clean, unknown tracked deletion, evidence-chain deletion.
- Preconditions: asset audit.
- Tests: mandatory gates after any deletion.
- Acceptance: no private/model/temp commit and navigable docs.
- Rollback: restore exact audited paths.
- Commit: `stage closure r2 clean repository and index docs`.
- Stop: any path purpose is uncertain.
