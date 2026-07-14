# Program C Corrective Code Quality R1

Date: 2026-07-14  
Base: `79fea1e1cad0c682c42539dd575370f3919f1d05`

## Decision

`PROGRAM_C_CORRECTIVE_CODE_QUALITY_ACCEPTED`

## Ownership and size checks

| Owner | File | Lines | Result |
| --- | --- | ---: | --- |
| Production route policy | `qisi-production-import-route-policy.js` | 165 | focused, fail-closed policy |
| Duplicate policy | `qisi-question-duplicate-policy.js` | 105 | pure immutable decision owner |
| Review workflow | `qisi-review-workflow-service.js` | 358 | confirmation/formal workflow only |
| Draft maintenance | `qisi-draft-maintenance-service.js` | 284 | stats/dedupe/cleanup/delete only |
| AST shell gate | `scripts/verify-app-shell-architecture.js` | 250 | development verification only |

No new 1,000+ line mixed owner was introduced. Workflow and maintenance remain
separate modules and have separate owner-manifest responsibilities.

The machine-readable app-shell matrix contains nine Program C wrappers. Their
largest wrapper is 38 lines, below both the 40-line recommendation and 60-line
hard limit. The AST gate validates definitions, exact ranges, direct callsites,
forbidden ownership calls, composition-only route/duplicate/persistence use,
Program C database mutations, fixture tokens, wrapper length, and owner
manifest presence.

## Transaction and error checks

- Primary persistence and formal transaction errors are propagated or mapped
  to stable codes; none are caught and ignored.
- Validator exceptions become `REVIEW_WORKFLOW_VALIDATOR_FAILED`.
- Batch partial failures are returned per draft and remain retryable; aborts are
  rethrown.
- Delete readback catches only `DRAFT_BATCH_NOT_FOUND`; every other error is
  rethrown.
- Route, duplicate, workflow, maintenance, persistence, and formal owners use
  stable error codes exercised by tests.
- The formal transaction checks duplicate state and request/idempotency
  collisions using fresh rows inside the repository transaction.

## Security and authenticity checks

- The new production owners contain no private source logging.
- No dynamic fixture route or final-candidate production transport exists.
- Test harness modules are absent from `main.html` and all production imports.
- The browser harness mocks only `/api/ai/**` at the outer engine boundary.
- Route selection, duplicate admission, review workflow, and draft maintenance
  each have exactly one production owner.
- Frozen PDF owner files remain unchanged.

Executable evidence:

```text
scripts/verify-app-shell-architecture.js
tests/corrective-production-reachability.test.js
tests/test-harness-production-isolation.test.js
tests/corrective-single-owner.test.js
tests/app-shell-c2-12-final-convergence.test.js
tests/formal-submit-duplicate-race.test.js
tests/formal-submit-duplicate-transaction.test.js
tests/review-workflow-service.test.js
tests/draft-maintenance-service.test.js
```
