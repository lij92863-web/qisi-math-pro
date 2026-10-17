# Stages 28–30: three authorized offline maintenance objectives
User explicitly selected other batch mutation safety, formal full-scan performance, and fingerprint collisions, postponing Shenzhen. No subagents.
Source baseline e522a7098e6fa3373c8fd4cb6c3851d528322d13; desktop baseline 21ac97fb005fd78c215a6fcd916acc4bf61f0493.
Allowed files: qisi-question-duplicate-policy.js, qisi-library-service.js, qisi-question-index-storage.js, qisi-db.js, qisi-storage-repository.js, qisi-draft-persistence-service.js, main.html, architecture/runtime-modules.json, architecture/layers.json, docs/architecture/owners.json, docs/architecture/layers.json, tests/question-duplicate-policy.test.js, tests/draft-stats-transaction.test.js, tests/question-index-transaction.test.js; final existing ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md and desktop mirror/evidence. main.html permits new module load and cache tokens only; qisi-db.js permits schema module glue only.
Forbidden: E runtime, app.js, dependencies/lock/vendor, production DB/profile/uploads/backups/.env, original audit and Qwen ledgers. v9 migration only exercised in isolated fixture DB. No real AI calls, no ledger resets.
Required: native race/rollback/index upgrade and mutation/legacy tests, verify:safe, batch-safety, scope/runtime/architecture, native full workflow comparison, write and upgrade cost, verified backed-up desktop sync and actual desktop acceptance.
Stop: unrelated diffs, unexplained gate failure, unauthorized data access, completed selected objectives. User's explicit three objectives override stale C8A and do-not-next-stage restriction within this scoped task.

Related registration/fixture additions allowed before edit: architecture/owners.json and tests/db-fingerprint-owner.test.js (required new module dependency, tuple format intentionally changes expected serialization).

Confirmed legacy ZIP compatibility bug: Vue proxy options cause DataCloneError in actual desktop import. Before edit, allow app.js one line in confirmImportBankPreview (toRaw outer preview), app cache token, and tests/e2e/legacy-fingerprint-package.test.js at isolated port32228. app-js-boundary read; no parsing/business algorithm added.
