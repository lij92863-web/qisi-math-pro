# Post-R2 Code Quality Audit R1

Status: completed against the production tree after Phase 3.

| Audit dimension | Evidence | Finding / disposition | Result |
| --- | --- | --- | --- |
| permissive defaults | Import and review fail-closed suites; architecture source guard | Missing, throwing, malformed, and invalid validators all block progress. No default `valid:true` remains in a production controller. | PASS |
| duplicate owner | `architecture/layers.json`, `architecture/owners.json`, runtime dependency audit | Owner keys are unique, the graph is acyclic, and duplicate namespace owners fail startup analysis. | PASS |
| direct DB formal writes | Submit-segment guard and `qisi-batch-formal-submit.js` | Batch formal submit has zero direct `db.questions.put/add/bulkPut` calls. Remaining app writes are manual entry, legacy external-bank merge/undo, or explicit metadata migration and are not claimed as the batch formal owner. | PASS |
| broad catch | Source scan plus secure-log boundary | Recognition and conversion paths contain broad catches with explicit fallback or hard-stop behavior. They remain app-shell debt; secure logging prevents payload disclosure. No low-risk mass rewrite was attempted. | PASS WITH LIMITATION |
| swallowed error | Empty-catch scan | One entry-draft restore catch swallowed its error. It now emits only stable code `ENTRY_DRAFT_RESTORE_FAILED`; no empty production catch remains. | PASS |
| hidden global state | Window/global assignment inventory | Remaining globals are diagnostic self-tests and explicit backup/support commands. They do not own Formal Admission, controlled-write, or repository transactions. Retained as visible legacy shell debt. | PASS WITH LIMITATION |
| duplicated schema | Recognition contracts, question-v2, Formal Admission tests | Formal schema validation is owned by recognition contracts and admission policy; app does not define a second formal question-v2 validator. | PASS |
| manual/provenance mutation | Production review validator and formal-admission counterfactuals | UI edit handlers may set display-level manual flags, but field provenance is built by the formal-submit owner and click-only/fake flags cannot admit rejected fields. | PASS |
| test-created production rules | Production-link audit, true-import E2E, architecture guards | Acceptance tests invoke production validator, policy, repository, and marked transport paths. Research-only Route B and injected fixtures are not reported as production owners. | PASS |
| seeded E2E terminology | `tests/e2e/seeded-*` and `tests/e2e/true-import-*` | Seeded lifecycle tests are named seeded; true deterministic tests enter through UI/transport and persist through production repository/admission. | PASS |
| stale state/report | Active state and historical-document classification | `ai/POST_R2_CORRECTION_R1_STATE.md` is the active ledger. R2 reports are historical evidence and are not used as current correction acceptance. | PASS |

Low-risk remediation:

- Replaced the sole empty entry-draft restore catch with a private-safe stable
  error-code event.
- No broad refactor, owner movement, or formal-data behavior change was made.

Residual limitations:

- `app.js` retains broad fallback orchestration and diagnostic globals.
- Non-batch manual-entry and external-bank workflows still own their historical
  direct question writes; the Phase 4 claim is specifically zero direct writes
  in the batch formal-submit boundary.

Decision: PASS
