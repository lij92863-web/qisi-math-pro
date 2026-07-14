# Program C Independent Audit Evidence R1

## Scope

This record contains independently collected evidence for the fixed snapshot:

```text
branch: stage/app-shell-slimming-r3
commit: 79fea1e1cad0c682c42539dd575370f3919f1d05
tag: v1.2.0-rc2-app-shell-slimming-r3
program start: b15e6fbe24c525c95a573b51a0c7ab68e77f4790
```

No production/test files were edited. No real AI/OCR endpoint was invoked. The
PDF master runner was invoked only in the authorized `preflight` and `dry-run`
modes.

## Environment

```text
OS: Microsoft Windows NT 10.0.19045.0
architecture: AMD64
Node: v24.16.0
npm: 11.13.0
browser: Playwright Chromium 149.0.7827.55, headless
audit date: 2026-07-14 Asia/Shanghai
repository: C:\Users\Administrator\Desktop\题库系统
```

## Git seal evidence

Initial and final pre-report checks:

```text
git branch --show-current
stage/app-shell-slimming-r3

git rev-parse HEAD
79fea1e1cad0c682c42539dd575370f3919f1d05

git rev-parse @{u}
79fea1e1cad0c682c42539dd575370f3919f1d05

git rev-parse origin/stage/app-shell-slimming-r3
79fea1e1cad0c682c42539dd575370f3919f1d05

git status --porcelain=v2 --branch
# branch.oid 79fea1e1cad0c682c42539dd575370f3919f1d05
# branch.head stage/app-shell-slimming-r3
# branch.upstream origin/stage/app-shell-slimming-r3
# branch.ab +0 -0
```

Live remote evidence:

```text
79fea1e1cad0c682c42539dd575370f3919f1d05
  refs/heads/stage/app-shell-slimming-r3
91c757c0c2d5d77d990e34de5f4bc93840363f58
  refs/tags/v1.2.0-rc2-app-shell-slimming-r3
79fea1e1cad0c682c42539dd575370f3919f1d05
  refs/tags/v1.2.0-rc2-app-shell-slimming-r3^{}
```

Seal commit file inventory:

```text
M ai/APP_SHELL_SLIMMING_R3_STATE.md
A docs/release/PROGRAM_C_APP_SHELL_SLIMMING_R3_FINAL_REPORT.md
A docs/release/PROGRAM_C_FINAL_EVIDENCE_INDEX_R3.md
A docs/release/PROGRAM_C_PHASE8_GIT_SEAL_REPORT.md
```

The program-start ancestor check returned exit 0. Commit count for
`start..seal` is 68.

## Production entry and call-graph evidence

### Visible entries and runtime load

`main.html` evidence:

- retry batch: `main.html:457`, `runBatchRecognition(batch.id)`;
- rerun active batch: `main.html:570`;
- save/review/formal submit: `main.html:669-672`;
- batch submit: `main.html:858`;
- production modules load before `app.js`: `main.html:1561-1587`;
- no test path, legacy coordinator, injected path, or Route B script is loaded.

### Ordinary production recognition

Key implementation evidence:

- repository/Formal Admission/validation/persistence/controller composition:
  `app.js:5-67`;
- Bridge composition with production DOCX/PDF ports, projection, validation,
  ReviewDraft builder, persistence and readback: `app.js:1932-2012`;
- normal controller uses literal `mode: 'production'`:
  `qisi-normal-ui-import-controller.js:69-77`;
- route/classifier/state transitions and producer commands:
  `qisi-production-import-bridge.js:470-566`;
- validation/build/persist/readback result:
  `qisi-production-import-bridge.js:568-831`.

### Formal write boundary

- UI invokes only `batchFormalSubmit.submit`: `app.js:2714-2718`.
- policy evaluation precedes repository commit:
  `qisi-batch-formal-submit.js:59-68`.
- unique formal repository command:
  `qisi-storage-repository.js:539-815`.
- repository re-evaluates and validates the admission decision:
  `qisi-storage-repository.js:682-714`.
- repository builds and validates QuestionV2 before its atomic write:
  `qisi-storage-repository.js:725-780`.
- Bridge contains no `FormalAdmission`, `confirmDraftToQuestion`, or
  `db.questions` reference.
- `app.js` has zero `db.questions.put/add/bulkPut/delete/bulkDelete/update`
  call; it has two read-only `toArray` calls at `app.js:3265` and `:3358`.

### ReviewDraft persistence and manual provenance

- manual provenance is written only for explicit changed fields, with
  `manuallyEdited=true` and an incremented revision:
  `qisi-review-controller.js:47-87`.
- persistence command owner:
  `qisi-draft-persistence-service.js:247-415`.
- ReviewDraft atomic repository transaction:
  `qisi-storage-repository.js:447-516`.
- formal atomic repository transaction:
  `qisi-storage-repository.js:593-780`.

### Dynamic fixture route

The independent trace that invalidates the claimed browser authenticity is:

```text
tests/e2e/production-normal-ui-import-cutover.test.js:72-75
  installs ImportAdapterRegistry -> fixture transport

app.js:2055-2062
  discovers fixture adapter -> testFixture=true

qisi-normal-ui-import-controller.js:46-57
  testFixture -> producerRoute="fixture"

qisi-normal-ui-import-controller.js:69-77
  Bridge still receives mode="production"

qisi-production-import-bridge.js:159-166
  production input accepts fixture route when testFixture=true

qisi-production-import-bridge.js:504-526
  calls runFixtureImport instead of DOCX/PDF producer

tests/e2e/production-normal-ui-import-cutover.test.js:202-209
  fixture envelope returns prebuilt final candidate
```

The Bridge result itself exposes `producerRoute` at
`qisi-production-import-bridge.js:797-803` and `:825-831`, but the cutover suite
logs only `bridgeMode="production"`, not the producer route.

## Legacy and owner evidence

Static/runtime checks showed:

```text
processDraftImportBatch definitions/references in app.js: 0
processDraftImportBatchV2 definitions/references in app.js: 0
legacy batch scripts loaded by main.html: 0
legacy fallback calls in normal UI: 0
Route B production script/reference: 0
Bridge formal write references: 0
app formal question mutations: 0
```

The owner/architecture replay passed 95 focused tests, including detailed
owner-manifest uniqueness and runtime load order. The independent dynamic trace
nevertheless found one undeclared alternate producer route: the fixture path
above. The manifest/static gates do not reject it because it lives inside the
declared Bridge/app/controller production modules.

## app.js independent measurements

The repository scanner was executed and its output independently cross-checked
against physical-file counts and direct searches.

```text
physical lines: 5246
split/inventory lines: 5247
app-level functions: 172
largest function: startExamPointerDrag, app.js:4226-4389, 164 lines
largest Program C/domain function:
  buildSupportLeadingMissingBlockEvidence, app.js:1165-1285, 121 lines
largest Program C UI function:
  saveManualCropToDraft, app.js:2383-2498, 116 lines
submitDraftQuestion: app.js:2640-2736, 97 lines
```

Owner file physical sizes:

| File | Lines |
| --- | ---: |
| `qisi-production-import-bridge.js` | 891 |
| `qisi-import-state-machine.js` | 167 |
| `qisi-production-docx-source-port.js` | 141 |
| `qisi-production-docx-vision-source-port.js` | 839 |
| `qisi-pdf-import-coordinator.js` | 130 |
| `qisi-production-pdf-sources-port.js` | 226 |
| `qisi-batch-engine-v2.js` | 2,049 |
| `qisi-import-validation-service.js` | 359 |
| `qisi-review-draft-builder.js` | 78 |
| `qisi-draft-persistence-service.js` | 638 |
| `qisi-formal-admission-policy.js` | 583 |
| `qisi-storage-repository.js` | 852 |
| `qisi-pdf-candidate-projection.js` | 1,330 |

Direct `fetch()` sites:

```text
app.js:1068 data URL -> blob
app.js:1079 local conversion self-test
app.js:4119 data/image URL -> blob
app.js:4422 data/image URL -> blob
```

No direct AI/OCR route, proxy execution, PDF parser/aligner implementation,
controlled-write implementation, provenance builder, `supportLevel`, or
`manualReviewRequired` policy occurs in `app.js`.

Required category exceptions found:

- B: fixture producer selection, `app.js:2046-2062`.
- C: duplicate/answer-conflict policy, `app.js:2621-2631`.
- D: persisted review lifecycle aggregation/status write,
  `app.js:2738-2767`.
- E: support-leading parser diagnostics, `app.js:1165-1285`.
- F: zero Program C giant/V2 owner.

## Test authenticity evidence

### Final-candidate construction

`tests/e2e/production-cutover-fixtures.js` imports production identity,
projection and controlled-write modules, then constructs the final objects in
test code:

- DOCX candidate identity and accepted field decisions: lines 9-43;
- DOCX support answer and accepted support decision: lines 46-91;
- PDF parsed question: lines 94-118;
- PDF controlled-write result: lines 119-139;
- PDF final projection with hand-authored alignment/evidence/validation:
  lines 140-171.

The browser receives those objects through
`production-normal-ui-import-cutover.test.js:202-209`. Therefore validation,
ReviewDraft construction, persistence and reload are exercised, but the actual
DOCX/PDF producer/parser/aligner/projection work is not.

The named conflict case injects `PDF_CONTROLLED_WRITE_CONFLICT` directly at
`production-normal-ui-import-cutover.test.js:294-305`. Formula fallback and
known-bad ownership are flags/fields on preconstructed candidates at
`:258-291` and `:348-356`.

### “True import” suite

`tests/e2e/browser-harness.js:418-426` implements `installImportTransport` by
registering the same fixture adapter. It is used by:

- `tests/e2e/true-import-docx.test.js:17-18`;
- `tests/e2e/true-import-pdf-safe-partial.test.js:16-27`;
- `tests/e2e/true-import-admission.test.js:15-16,40-41,63-68,104-106`.

These tests do exercise visible UI interactions and real review/formal
persistence. They do not authenticate upstream production source ownership.

### Authentic focused browser evidence that does exist

`docx-producer-identity-browser.test.js` and
`pdf-projection-browser-shadow.test.js` replace external AI/OCR/render inputs
and exercise an actual normal-UI DOCX/PDF production path for focused cases.
They do not cover the complete required 15-scenario production-path matrix.
Most additional PDF cases in the shadow suite directly instantiate a shadow
Bridge, and the logged `legacyCallGraph` at
`pdf-projection-browser-shadow.test.js:603-612` is a hard-coded string array,
not a measurement of the now-retired runtime graph.

## Mandatory gate transcript summary

Commands were executed sequentially in the audit-mandated order.

| # | Command | Exit/result |
| ---: | --- | --- |
| 1 | `node --test tests/base-migration-execution-gate.test.js` | 0; 15 pass |
| 2 | `node --test tests/pdf-route-b-hold.test.js` | 0; 6 pass |
| 3 | `npm.cmd run smoke:batch:mock` | 0; 20 pass |
| 4 | `npm.cmd run verify:safe` | 0 |
| 5 | `npm.cmd run verify:batch-safety` | 0 |
| 6 | `npm.cmd run verify:pdf-known-bad` | 0; 65 pass |
| 7 | controlled-write answer ownership test | 0; 21 pass |
| 8 | `node scripts/pdf-master-browser-runner.js preflight` | 0; ok true |
| 9 | `node scripts/pdf-master-browser-runner.js dry-run` | 0; ok true |
| 10 | `npm.cmd run verify:docx-stable` | 0; 20 pass |
| 11 | `npm.cmd run verify:no-real-ai` | 0; passed |

`verify:safe` transcript totals:

```text
suites 54
tests 1631
pass 1631
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 13462.4099
smoke:batch:mock 20/20
verify-no-real-ai passed
```

PDF preflight evidence:

```text
ok=true
project root=true
two fixed input PDFs present
Playwright available
realApiCalled=false
underlyingApiCallCount=0
```

PDF dry-run evidence:

```text
ok=true
serverStarted=true
health status=200
main page status=200
browser opened=true
batch entry present=true
realApiCalled=false
underlyingApiCallCount=0
nextAction="Stop before P7 until a separate explicit real-run task is authorized"
```

## Additional targeted replay

One focused Node replay covered the required owners/boundaries:

```text
tests 95
pass 95
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 304.4681
```

It included:

- ProductionImportBridge production mode;
- normal-UI production owner and no legacy fallback;
- PDF projection single owner;
- app formal storage boundary and Bridge formal isolation;
- DraftPersistenceService transaction, cancellation and idempotency;
- runtime dependency, architecture consistency/manifest and C2-13 owner gate;
- PDF projection;
- Formal Admission and manual provenance lifecycle;
- Phase 6 counterfactual/engineering closure;
- production fixture-port behavior.

Controlled-write ownership, Route B hold and DOCX stable were additionally
replayed as mandatory gates.

## Browser replay

Command: all sorted `tests/e2e/*.test.js` files passed to `node --test`.

```text
tests 17
pass 17
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 10041.7753
white screen 0
unexpected console error 0
forbidden/real API request 0
```

The cutover suite logged 15 rows with zero formal writes, wrong attachments,
raw JSON leakage, placeholders, controlled-write bypass, legacy fallbacks, real
API calls and console errors. That output is numerically green. It also logs
`transportCalls=1` for nearly every producer scenario, corroborating that the
fixture producer rather than the real DOCX/PDF production producer supplied the
candidate.

## Counterfactual replay

`tests/counterfactual-attack-suite.test.js` was part of the focused replay and
passed all seven grouped attacks:

- runtime/startup;
- JSON/LaTeX;
- question-number/ownership;
- synthetic OCR image;
- storage rollback/conflict/idempotency;
- security/path disclosure;
- performance/cancellation.

The Phase 6 engineering closure test also passed. These tests support focused
fail-closed behavior but cannot replace missing real normal-UI producer-path
coverage.

## Benchmark smoke evidence

### Closure benchmark

```text
command: node scripts/benchmark/measure-program-c-closure.js --runs=1 --warmup=0
sampleRuns=1
warmupRuns=0
scenarios=12
failureCount=0 for every scenario
timeoutCount=0 for every scenario
realApiCalled=false
```

Evidence limitation: the script imports `docxVisionCandidate` and `pdfCandidate`
from `tests/e2e/production-cutover-fixtures.js`; source/parser work is not what
the reported producer-chain durations measure.

### Review validation

```text
command: node scripts/benchmark/measure-review-validation.js --runs=1 --warmup=0
50 drafts: p50/p95 4.7788 ms
100 drafts: p50/p95 4.0133 ms
300 drafts: p50/p95 9.8183 ms
```

### First review render

```text
command: node scripts/benchmark/measure-first-review-render.js --runs=1
sampleRuns=1
warmupRuns=2
p50/p95=24.891 ms
failureCount=0
timeoutCount=0
realApiCalled=false
```

### App shell browser

```text
purpose=program-c-independent-audit-r1-smoke
sampleRuns=1
coldStartMs=4176.5183
domContentLoadedMs=1994.4
loadEventMs=3637.9
failure/timeout=0
```

Single-run smoke data establishes executability only; it was not substituted for
the committed 10-run benchmark method.

## Frozen-file evidence

The following command produced no diff and no log entries for the range from
program start to seal:

```text
git diff --name-status <start> <seal> --
  qisi-pdf-support-controlled-write.js
  qisi-pdf-support-aligner.js
  qisi-pdf-support-block-parser.js
  qisi-pdf-answer-only-extraction.js
  qisi-pdf-answer-extraction-quality.js
  scripts/pdf-master-browser-runner.js
```

Commit-message/log review found no real-run, model download, Route B production
promotion, or undeclared high-risk rewrite.

## Evidence conclusion

```text
Git seal: PASS
legacy retirement: PASS
formal write isolation: PASS
persistence/fail-closed focused gates: PASS
mandatory gates: 11/11 PASS
browser numerical runner: 17/17 PASS
browser production-path authenticity: FAIL
app B/C/D zero boundary: FAIL
decision: PROGRAM_C_INDEPENDENT_AUDIT_BLOCKED
```
