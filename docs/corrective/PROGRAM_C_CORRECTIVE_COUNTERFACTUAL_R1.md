# Program C Corrective Counterfactual Evidence R1

Date: 2026-07-14
Branch: `stage/program-c-corrective-r1`
Base: `79fea1e1cad0c682c42539dd575370f3919f1d05`

## Decision

`PROGRAM_C_CORRECTIVE_COUNTERFACTUAL_ACCEPTED`

The corrective attack suite executed 80 tests. All 80 passed with no skipped,
todo, cancelled, or timed-out test. The browser portion entered through the
normal UI with real DOCX/PDF files and mocked only the outer engine boundary.

## Attack coverage

| Boundary | Counterfactuals | Executable evidence | Result |
| --- | --- | --- | --- |
| Fixture isolation | `testFixture`, `producerRoute='fixture'`, fixture transport, prebuilt candidates, UI fixture selection, harness misload | `production-import-fixture-port.test.js`, `test-harness-production-isolation.test.js`, `corrective-production-reachability.test.js` | PASS: rejected or unreachable |
| Route policy | missing identity, source mismatch, mixed/unsupported source, stale source version, unavailable producer, dynamic caller route injection | `production-import-route-policy.test.js`, `batch-context-service.test.js`, `corrective-production-reachability.test.js` | PASS: fail closed; caller route ignored |
| Duplicate transaction | concurrent equal fingerprint, stale UI view, retry, one request ID across drafts, similar stem, answer conflict | `formal-submit-duplicate-race.test.js`, `formal-submit-duplicate-transaction.test.js` | PASS: one transaction winner; stable rejection codes |
| Persistence | version conflict, association/readback mismatch, partial write, cancellation, duplicate click/idempotent replay, partial batch submit, cleanup/write failure, stats/readback failure | `draft-persistence-service.test.js`, `review-draft-command-persistence-boundary.test.js`, `draft-maintenance-service.test.js`, `review-workflow-service.test.js`, `reviewed-batch-submit-idempotency.test.js` | PASS: rollback, conflict, or retry semantics preserved |
| Safety | raw JSON, placeholder/wrapper content, wrong ownership, answer/solution sequence attacks, missing controlled-write, missing projection/validation, Formal Admission rejection, Bridge formal-write attempt | `counterfactual-attack-suite.test.js`, `import-validation-service.test.js`, `formal-admission-policy.test.js`, `import-cutover-formal-write-isolation.test.js`, `e2e/production-normal-ui-import-cutover.test.js` | PASS: no unsafe write or attachment |

## Discovered and closed attack

The first run exposed that different drafts could reuse the same formal
`requestId`: the repository checked `question.admission.requestId`, but the
formal Question v2 envelope did not persist that field. The corrective change:

- persists `requestId` in the admission envelope;
- rejects a transaction when either the request ID or idempotency key is
  already bound to a different draft;
- keeps the losing draft reviewed and creates no second formal question.

Targeted formal and recognition verification passed 35/35 after the change.
The complete counterfactual suite then passed 80/80.

## Safety counters

```text
wrongAttachment = 0
rawJsonLeakage = 0
placeholderLeakage = 0
controlledWriteBypass = 0
formalAdmissionBypass = 0
bridgeFormalWrites = 0
legacyFallback = 0
fixtureProductionReachability = 0
realApiCalled = false
```

No frozen PDF owner file was modified. No real AI/OCR endpoint was called.
