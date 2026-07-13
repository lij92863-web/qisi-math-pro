# Post-R2 Architecture Audit R1

Status: completed after the Phase 4 code-quality audit.

| Required proof | Production evidence | Executable gate | Result |
| --- | --- | --- | --- |
| controlled-write owner | `qisi-pdf-support-controlled-write.js` is the field-level PDF answer/solution owner. OCR adapters and Route B cannot write formal fields. | answer-ownership gate; architecture consistency and manifest guards | PASS |
| FormalAdmissionPolicy | `qisi-formal-admission-policy.js` evaluates every batch formal draft and builds question v2. | formal admission, production review validator, batch formal submit tests | PASS |
| Repository transaction owner | `qisi-storage-repository.js#confirmDraftToQuestion` atomically writes the formal question, images, draft state, and batch counters. | transaction, concurrency, storage-failure tests | PASS |
| app.js formal DB bypass | The batch submit segment delegates to `batchFormalSubmit.submit` and contains no `db.questions.put/add/bulkPut`. | Phase 3 bypass attack; architecture manifest gate | PASS |
| controller fail-closed | Import and review controllers reject missing, throwing, malformed, and explicit-invalid validators before handoff/confirm. | both controller fail-closed suites | PASS |
| recognition candidate E2E | Marked transport output is validated as candidates before repository review persistence; true DOCX/PDF tests use UI entry, review/admission, reload, and export. | `tests/e2e/true-import-*.test.js` | PASS |
| architecture manifest coverage | Layer and owner manifests cover required and correction modules with unique owners, valid direction, acyclic dependencies, and production/scaffold/research status. | `tests/architecture-manifest.test.js` | PASS |
| Route B frozen | Route B remains `research-only`, is absent from production HTML/app, and cannot alter controlled-write. | `tests/pdf-route-b-hold.test.js` | PASS |
| DOCX stable | Deterministic DOCX import and the established DOCX+DOCX chain remain accepted without fabricated AI ownership. | `npm run verify:docx-stable`; true DOCX E2E | PASS |
| PDF safe partial | Rejected or uncertain PDF answer/solution ownership remains excluded; safe prefix behavior is retained. | PDF known-bad, controlled-write ownership, true PDF safe-partial E2E | PASS |

Production status summary:

- Production-wired: Formal Admission, storage repository transaction, batch
  formal submit, production review validator, legacy batch coordinator, true
  injected import path, controlled-write, support parser/aligner, library/export,
  archive security, and private-safe logging.
- Scaffold: OCR adapters/registry/shadow mode, performance monitor, and the
  aspirational import orchestrator remain explicitly classified as scaffold.
- Research-only: Route B answer-only pass remains frozen and unloaded.

No architecture inconsistency requiring a production change was found.

Decision: PASS
