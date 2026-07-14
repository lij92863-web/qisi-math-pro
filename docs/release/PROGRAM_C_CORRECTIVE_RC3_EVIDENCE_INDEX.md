# Program C Corrective RC3 Evidence Index

## Release identity

```text
fixed base: 79fea1e1cad0c682c42539dd575370f3919f1d05
corrective branch: stage/program-c-corrective-r1
RC3 seal resolver: v1.2.0-rc3-program-c-corrective^{}
old RC2 tag: v1.2.0-rc2-app-shell-slimming-r3
old RC2 tag object: 91c757c0c2d5d77d990e34de5f4bc93840363f58
old RC2 peeled commit: 79fea1e1cad0c682c42539dd575370f3919f1d05
```

The peeled annotated RC3 tag is the authoritative seal commit. A commit cannot
embed its own final SHA in a file belonging to that same commit, so the tag
resolver avoids a circular and unverifiable identity claim.

## Independent blocker record

- `docs/audit/PROGRAM_C_INDEPENDENT_AUDIT_R1.md` — fixed RC2 audit and decision
  `PROGRAM_C_INDEPENDENT_AUDIT_BLOCKED`.
- `docs/audit/PROGRAM_C_INDEPENDENT_AUDIT_EVIDENCE_R1.md` — original audit
  command and boundary evidence.
- `docs/audit/PROGRAM_C_CORRECTIVE_WORK_PACKAGE_R1.md` — exact B-01/B-02 scope,
  prohibited shortcuts, owners, and corrective sequence.
- `docs/corrective/PROGRAM_C_CORRECTIVE_BASELINE_R1.md` — fixed base, red-first
  reproduction, frozen hashes, and old-tag identity.

## B-01 closure: authentic producer chain

Production isolation and routing:

- `qisi-production-import-route-policy.js`
- `qisi-normal-ui-import-controller.js`
- `qisi-production-import-bridge.js`
- `tests/production-graph-no-fixture-route.test.js`
- `tests/production-import-fixture-port.test.js`
- `tests/test-harness-production-isolation.test.js`
- `tests/corrective-production-reachability.test.js`
- `tests/normal-ui-no-route-selection.test.js`
- `tests/route-policy-single-owner.test.js`

True-file browser harness and evidence:

- `tests/e2e/production-normal-ui-import-cutover.test.js` — 17-scenario normal-
  UI production matrix, safety counters, real persistence/readback, manual edit,
  formal confirmation, and parser/PDF safety counterfactuals.
- `tests/e2e/browser-harness.js` — visible UI import, browser database readback,
  network blocking, and failure injection at declared owner boundaries.
- `tests/harness/browser-engine-injection.js` — outer engine mock only.
- `tests/harness/import-stage-trace.js` — ordered observation without candidate
  production authority.
- `tests/e2e/true-producer-chain-smoke.test.js`
- `tests/e2e/docx-producer-identity-browser.test.js`
- `tests/e2e/pdf-projection-browser-shadow.test.js`
- `tests/e2e/true-import-docx.test.js`
- `tests/e2e/true-import-pdf-safe-partial.test.js`
- `tests/e2e/true-import-admission.test.js`
- `tests/true-producer-browser-authenticity.test.js`
- `tests/fixtures/true-import/` — actual DOCX/PDF inputs used by the browser.

The former `tests/e2e/production-cutover-fixtures.js` and
`tests/e2e/true-import-fixtures.js` final-candidate builders are deleted.

## B-02 closure: unique owners and shell exit

- `qisi-question-duplicate-policy.js` — pure duplicate, similarity, and answer-
  conflict decision owner.
- `qisi-storage-repository.js` — fresh-row duplicate and request/idempotency
  recheck within the formal atomic transaction.
- `qisi-review-workflow-service.js` — confirm and reviewed-batch workflow.
- `qisi-draft-maintenance-service.js` — review statistics, dedupe, cleanup, and
  deletion lifecycle.
- `docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json` — nine
  bounded Program C shell wrappers and their owners.
- `architecture/owners.json`, `architecture/layers.json`,
  `docs/architecture/owners.json`, and `docs/architecture/layers.json` — runtime
  owner/layer contracts.
- `scripts/verify-app-shell-architecture.js` — AST ranges, callsites, forbidden
  ownership calls, wrapper size, database mutation, and manifest checks.
- `tests/app-corrective-boundary.test.js`
- `tests/app-no-duplicate-policy.test.js`
- `tests/app-no-review-persistence-lifecycle.test.js`
- `tests/corrective-single-owner.test.js`
- `tests/question-duplicate-policy.test.js`
- `tests/formal-submit-duplicate-race.test.js`
- `tests/formal-submit-duplicate-transaction.test.js`
- `tests/review-workflow-service.test.js`
- `tests/reviewed-batch-submit-idempotency.test.js`
- `tests/draft-maintenance-service.test.js`

## Safety, counterfactual, and performance evidence

- `docs/corrective/PROGRAM_C_CORRECTIVE_COUNTERFACTUAL_R1.md` — 80/80 attacks,
  including fixture isolation, route attacks, transaction races, persistence
  failures, raw content, ownership, controlled-write, and formal boundaries.
- `docs/corrective/PROGRAM_C_CORRECTIVE_CODE_QUALITY_R1.md` — owner sizes,
  responsibility separation, transaction behavior, error propagation, and
  test/production isolation.
- `docs/corrective/PROGRAM_C_CORRECTIVE_BENCHMARK_R1.md` — exact fixed-base
  comparison, 5 warmups, 20 measured samples per profile, 11 scenarios, and
  zero failures/timeouts/real API calls.
- `scripts/benchmark/measure-program-c-closure.js`
- `tests/program-c-corrective-benchmark.test.js`
- `tests/counterfactual-attack-suite.test.js`
- `tests/import-validation-service.test.js`
- `tests/import-cutover-formal-write-isolation.test.js`
- `tests/manual-review-provenance-formal-lifecycle.test.js`

## Internal CTO and stable runner

- `docs/corrective/PROGRAM_C_CORRECTIVE_INTERNAL_CTO_R1.md` — all 20 mandatory
  production-entry questions and decision
  `PROGRAM_C_CORRECTIVE_INTERNAL_CTO_ACCEPTED`.
- `scripts/verify-personal-stable.js` — fixed 16-suite order, timeout handling,
  TAP aggregation, real-API prohibition, and mandatory safety counters.
- `tests/verify-personal-stable-runner.test.js` — runner contract and no-real-
  endpoint enforcement.

Executed result:

```text
decision = VERIFY_PERSONAL_STABLE_ACCEPTED
suites = 16/16
tests = 1848/1848
failed/cancelled/skipped/todo/timeout = 0/0/0/0/0
wrongAttachment/rawJsonLeakage/placeholderLeakage = 0/0/0
controlledWriteBypass/formalAdmissionBypass = 0/0
bridgeFormalWrites/legacyFallback/fixtureProductionReachability = 0/0/0
realApiCalled = false
```

## Mandatory gate results

| Gate | Result |
| --- | --- |
| base migration execution | 15/15 |
| Route B hold | 6/6 through stable runner |
| batch mock smoke | 20/20 |
| `verify:safe` | 1,692/1,692 plus smoke 20/20; no-real-ai passed |
| `verify:batch-safety` | DOCX 20/20; PDF 65/65; smoke/no-real-ai passed |
| PDF known-bad | 65/65 through stable runner |
| controlled-write answer ownership | 21/21 through stable runner |
| PDF runner preflight and dry-run | passed; `realApiCalled=false` |
| DOCX stable | 20/20 |
| no-real-ai | passed |
| true producer-chain browser | 17/17 |
| counterfactual suite | 80/80 |

No `real-run`, AI proxy gate, or real AI/OCR endpoint was invoked.

## Frozen files

The diff from the fixed base is empty and the SHA-256 values remain:

```text
d50b59b8f0738aaf6ffdae10da414f6c3f0a55f780b9bd7e5a80c2affd78ea22  qisi-pdf-support-controlled-write.js
b640f9a475202617a320644b600b08a3c5569a6e2e637fa69edf0bb26a840155  qisi-pdf-support-aligner.js
2eecb7b941b51e844a1e960655d5456f2fb089887093b9946896ab82fba877ae  qisi-pdf-support-block-parser.js
a7cbfa7d78e2e370ef75212402e2ce1f9b2b9f9cdd3a00d2ae40ccc1e5eaf6f9  qisi-pdf-answer-only-extraction.js
eaed30b036936ef2ab2be601e3c65e8596d9280c7d9015f1a22b546f1b188f37  qisi-pdf-answer-extraction-quality.js
cc4849382c53036a243e07ac558c5287b3050c0f0557fe2642301d3b9fbe9a24  scripts/pdf-master-browser-runner.js
```

## Independent audit handoff

The fresh session receives the corrective master task, RC3 commit resolved from
the annotated tag, RC3 tag, Independent Audit R1 specification, and this index.
It must rebuild the production graph and rerun the gates; this implementation
evidence is an index, not a substitute for independent execution.

Final release records:

- `docs/release/PROGRAM_C_CORRECTIVE_RC3_REPORT.md`
- `docs/release/PROGRAM_C_CORRECTIVE_RC3_EVIDENCE_INDEX.md`
- `docs/release/PROGRAM_C_CORRECTIVE_RC3_GIT_SEAL.md`
- annotated tag `v1.2.0-rc3-program-c-corrective`
