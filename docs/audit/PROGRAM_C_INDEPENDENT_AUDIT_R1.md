# Program C Independent Audit R1

## Identity

```text
Audit:
Program C Independent Audit R1

Audited branch:
stage/app-shell-slimming-r3

Audited commit:
79fea1e1cad0c682c42539dd575370f3919f1d05

Audited tag:
v1.2.0-rc2-app-shell-slimming-r3

Audit date:
2026-07-14 Asia/Shanghai
```

The audit was performed as an independent read-only review of the sealed
production tree. No production code, test, tag, branch history, or `main` was
changed. The only audit outputs are this report, the R1 evidence record, and the
required corrective work package.

## Git Seal

- Local branch, `HEAD`, tracking branch, and local `origin` ref all resolved to
  `79fea1e1cad0c682c42539dd575370f3919f1d05`.
- A fresh live `git ls-remote` resolved the remote branch to the same commit.
- The annotated tag object is
  `91c757c0c2d5d77d990e34de5f4bc93840363f58`; its peeled local and live remote
  target is the audited commit.
- The working tree was clean before the audit. Gate-generated local-run
  artifacts are ignored. Before report creation, the tree remained clean and
  was `+0/-0` against its upstream.
- The seal commit changes only four declared state/release records:
  `ai/APP_SHELL_SLIMMING_R3_STATE.md` and three `docs/release` reports. It does
  not change production code or tests.
- Program start commit
  `b15e6fbe24c525c95a573b51a0c7ab68e77f4790` is an ancestor of the seal; the
  range contains 68 commits.

Git seal result: **PASS**.

## Production Call Graph

The graph was rebuilt from `main.html` event bindings and script order, then
traced through live production factories rather than accepted from release
reports.

Normal recognition chain:

```text
main.html visible batch/retry events
  -> AppProxy.runBatchRecognition
  -> app.js runBatchRecognition
  -> NormalUiImportController.run
  -> ProductionImportBridge.run(mode="production")
  -> ImportStateMachine
  -> source-role classifier
  -> DOCX deterministic / DOCX vision / PDF production source port
  -> PDF projection where applicable
  -> CandidateNormalizer
  -> ImportValidationService
  -> ReviewDraftBuilder
  -> DraftPersistenceService
  -> StorageRepository ReviewDraft transaction
  -> verified reload/readback
  -> review UI
```

Manual review and formal admission chain:

```text
main.html edit/review/submit events
  -> ReviewController explicit field edits
  -> DraftPersistenceService / StorageRepository ReviewDraft transaction
  -> app.js submitDraftQuestion command
  -> BatchFormalSubmit state machine
  -> FormalAdmissionPolicy.evaluateDraftAdmission
  -> StorageRepository.confirmDraftToQuestion
  -> re-evaluate and validate admission against fresh draft
  -> build and validate QuestionV2
  -> atomic formal transaction
```

The ordinary route has a single visible entry and Bridge is invoked with the
literal mode `production`. Bridge does not import Formal Admission, mutate the
formal question table, or auto-admit a draft. Repository readback and formal
transaction boundaries are real.

However, there is also a dynamic normal-UI branch:

```text
ImportAdapterRegistry.getAdapter("fixture") present
  -> app.js sets testFixture=true
  -> NormalUiImportController changes producerRoute to "fixture"
  -> Bridge still runs with mode="production"
  -> Bridge calls runFixtureImport
  -> fixture transport returns already-constructed candidates
  -> real DOCX/PDF source, parser, aligner and PDF projection are bypassed
```

That branch is production-selectable code and is central to Finding
`PC-IA-R1-001`.

## Legacy Retirement

- `processDraftImportBatch`: absent from production `app.js` and production
  runtime entry points.
- `processDraftImportBatchV2`: absent.
- legacy coordinator/injected path scripts: not loaded by `main.html`.
- normal-UI legacy callers: zero.
- catch/fallback to a legacy importer: zero.
- Route B: research-only and absent from production runtime.
- dynamic call review found no reflective or registry path back to the retired
  giant owner.

Legacy retirement result: **PASS**, except that the production-selectable
fixture route is a separate alternate producer path, not a retired-legacy
fallback.

## app.js

Independent measurements:

| Metric | Result |
| --- | ---: |
| physical lines | 5,246 |
| split/inventory lines, including trailing empty record | 5,247 |
| detected app-level functions | 172 |
| largest function | `startExamPointerDrag`, 164 lines |
| largest Program C/domain function | `buildSupportLeadingMissingBlockEvidence`, 121 lines (E diagnostics) |
| largest Program C UI function | `saveManualCropToDraft`, 116 lines |
| direct `fetch()` calls | 4 |
| direct AI/OCR transport calls | 0 |
| direct `/api/ai/` calls | 0 |
| direct PDF parser/aligner calls | 0 |
| controlled-write implementations/calls | 0 |
| provenance builders | 0 |
| `supportLevel` policy | 0 |
| `manualReviewRequired` policy | 0 |
| validation owner delegations | present |
| ReviewDraft builder delegations | present |
| draft persistence service calls | present |
| direct formal question mutations | 0 |
| direct formal question reads | 2 |

The four fetches are two data/blob conversions, one local conversion self-test,
and one additional data/blob conversion; none is an AI/OCR proxy request.

Independent A/B/C/D/E/F/G review found:

- A: visible upload, editor, crop, navigation, toasts, and command/view mapping.
- B: `runBatchRecognition` retains producer-route selection for the injected
  fixture (`app.js:2046-2062`), rather than pure command delegation.
- C: `detectDraftDuplicate` implements exact/similar/answer-conflict policy
  (`app.js:2621-2631`) and controls formal-submit eligibility.
- D: `refreshBatchStats` computes persisted lifecycle counts/status and issues a
  ReviewDraft persistence command (`app.js:2738-2767`).
- E: support/parser diagnostic projection remains, including the 121-line
  `buildSupportLeadingMissingBlockEvidence`.
- F: no reachable or unreachable Program C giant/V2 owner was found.
- G: exam, print, library, package, manual-entry, knowledge-tree and other
  unrelated application features remain.

Required `B=0`, `C=0` except command delegation, and `D=0` transaction/business
logic are therefore not met. See Finding `PC-IA-R1-002`.

## Safety

- Wrong attachment: fail-closed unit/counterfactual gates pass; no observed
  unsafe persisted answer in the reruns.
- Raw JSON: validation rejects raw JSON candidates before ReviewDraft
  persistence.
- Placeholder: production validation and browser assertions are green.
- Controlled-write: PDF ownership, conflict, safe-partial, and known-bad gates
  are green; Route B cannot promote a rejected field.
- Formal Admission: Bridge formal writes are zero. `BatchFormalSubmit` calls
  policy before repository, and repository revalidates against the fresh draft
  before its atomic write.
- Manual provenance: only explicitly changed fields are rewritten to manual
  provenance with an incremented manual-edit revision.
- ReviewDraft persistence: the service/repository transaction, version,
  idempotency, rollback, cancellation and verified-readback tests pass.
- Source/provenance: DOCX and PDF unit/owner gates pass, but the required broad
  browser suite does not authenticate the upstream source/projection chain.
- Real API calls: none. `realApiCalled=false` in browser and benchmark output.

Safety implementation boundaries pass statically and in focused tests. The
browser evidence is insufficient to admit the sealed release because its core
producer path is bypassed.

## Test Authenticity

The full runner and all focused commands pass numerically, but the required
normal-UI proof is not production-path authentic:

1. `tests/e2e/production-normal-ui-import-cutover.test.js:33-75` installs an
   `ImportAdapterRegistry` whose fixture transport exposes
   `produceCandidates`.
2. Its common success helper accepts a final `candidate` and returns it in a
   transport envelope (`:202-209`).
3. `tests/e2e/production-cutover-fixtures.js:9-171` constructs DOCX identities
   and complete PDF candidates, including controlled-write and PDF projection,
   in Node test code before the browser run.
4. The conflict scenario injects an error code directly (`production-normal-ui-
   import-cutover.test.js:294-305`) rather than exercising the production
   controlled-write conflict path.
5. `app.js:2055-2062`, `qisi-normal-ui-import-controller.js:46-77`, and
   `qisi-production-import-bridge.js:159-166,504-526` dynamically select the
   fixture route while retaining `mode="production"`.
6. The separate “true import” DOCX/PDF/admission tests use the same
   `installImportTransport` helper (`tests/e2e/browser-harness.js:418-426`) and
   prebuilt candidates. Their review/edit/formal stages are real, but their
   source/parser/projection stages are not.

This violates the audit rules that final candidates must not be manually
constructed to bypass parser/validator, mocks may replace only external AI, and
a test-only fixture port must not be production-selectable. It also means the
claimed 15-scenario normal-UI matrix does not prove DOCX+DOCX, PDF full,
safe-partial, known-bad, conflict, formula fallback, and ownership behavior on
the actual production source chain.

Test authenticity result: **FAIL / BLOCKER**.

## Browser

- Independent rerun: all `tests/e2e/*.test.js`.
- Result: 17 tests, 17 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo.
- Duration reported by Node: 10,041.7753 ms.
- Chromium: Playwright headless Chromium 149.0.7827.55.
- White screen: 0. Unexpected console error: 0. Forbidden/real API request: 0.
- ReviewDraft/formal counts asserted by the suites are green.

The numerical browser result is **PASS**, but the required production-path
coverage result is **NOT PROVEN** for the reasons under Test Authenticity.
Scenario 15 in the named cutover suite is Bridge formal-write isolation, not
formal confirmation; manual edit/formal confirmation live in separate tests
that also use the same final-candidate fixture path.

## Gates

All mandatory commands were rerun in the specified order:

| # | Gate | Result |
| ---: | --- | --- |
| 1 | base migration execution gate | PASS, 15/15 |
| 2 | Route B hold | PASS, 6/6 |
| 3 | `smoke:batch:mock` | PASS, 20/20 |
| 4 | `verify:safe` | PASS |
| 5 | `verify:batch-safety` | PASS |
| 6 | `verify:pdf-known-bad` | PASS, 65/65 |
| 7 | controlled-write answer ownership | PASS, 21/21 |
| 8 | PDF browser runner `preflight` | PASS, `realApiCalled=false` |
| 9 | PDF browser runner `dry-run` | PASS, browser opened, `realApiCalled=false` |
| 10 | `verify:docx-stable` | PASS, 20/20 |
| 11 | `verify:no-real-ai` | PASS |

`verify:safe` reproduced 1,631 tests in 54 suites: 1,631 pass, 0 fail,
0 cancelled, 0 skipped, 0 todo. The focused targeted replay covered 95 tests:
95 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo. It included Bridge production
mode, normal-UI owner, no legacy fallback, single-owner/architecture, app formal
boundary, Bridge isolation, persistence transaction, cancellation, idempotency,
runtime dependency, PDF projection, Formal Admission/manual provenance,
counterfactual, and fixture-port gates.

Mandatory gate result: **11/11 PASS**. This does not override an independent
authenticity failure required by acceptance conditions 24-26.

## Benchmark

Four smoke commands were rerun:

- Program C closure, 12 scenarios, 1 run/0 warmup: no failures or timeouts,
  `realApiCalled=false`.
- review validation at 50/100/300 drafts, 1 run/0 warmup: completed.
- first review render, 1 measured run/2 warmups: p50/p95 24.891 ms, zero
  failures/timeouts, `realApiCalled=false`.
- app shell browser, 1 run: cold start 4,176.5183 ms, zero failures/timeouts.

The smoke harnesses are reproducible and execute. The closure benchmark imports
`tests/e2e/production-cutover-fixtures.js`, so its producer-chain timing uses
preconstructed candidates and must not be interpreted as real parser/source
performance. This is an evidence limitation, not a separate safety assertion.

## Frozen Files

Diff and history checks from program start to seal are empty for all six frozen
files:

- `qisi-pdf-support-controlled-write.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-answer-only-extraction.js`
- `qisi-pdf-answer-extraction-quality.js`
- `scripts/pdf-master-browser-runner.js`

No real-run, model-download, Route B promotion, or undeclared high-risk rewrite
commit was found. Frozen-file result: **PASS**.

## Findings

### PC-IA-R1-001

```text
severity: BLOCKER
evidence: The required normal-UI suites install a production-reachable fixture
          adapter and return prebuilt final candidates. Production mode then
          selects producerRoute="fixture", bypassing DOCX/PDF source parsing,
          alignment, controlled-write conflict production execution and PDF
          projection. See the exact files/lines under Test Authenticity.
production impact: The release evidence cannot prove the safety and ownership
                   claims on the real normal-UI production source chain. A test
                   registration can also activate the alternate producer route
                   in the production runtime graph.
required action: Remove production selection of the fixture producer and replace
                 the final-candidate browser matrix with production-path tests
                 whose mocks stop at external AI/OCR/conversion boundaries.
```

### PC-IA-R1-002

```text
severity: HIGH
evidence: app.js retains B route selection at 2046-2062, C duplicate/admission
          gating policy at 2621-2631, and D persisted lifecycle aggregation/write
          behavior at 2738-2767.
production impact: app.js has not fully exited Program C import/review domain
                   ownership, so acceptance conditions B=0, C=0 (except command
                   delegation), D=0 business/transaction logic, and "app exited
                   import domain owner" are false.
required action: Move these decisions to the already-declared route, policy,
                 and persistence owners; retain only explicit UI command and
                 view mapping in app.js.
```

### PC-IA-R1-003

```text
severity: INFO
evidence: The release quality report lists the batch engine at 2,046 lines, while
          the sealed file independently measures 2,049 physical lines. app.js is
          5,246 physical lines or 5,247 split/inventory records because it ends
          with a newline.
production impact: None established; this is a final-evidence precision issue.
required action: Recompute static metrics in the corrective evidence rather than
                 copying the prior report.
```

## Decision

The Git seal and mandatory gates pass, but acceptance conditions 9, 12, 24, 25,
26 and 31 are not all satisfied. A core BLOCKER and a core HIGH finding remain.

```text
PROGRAM_C_INDEPENDENT_AUDIT_BLOCKED
```
