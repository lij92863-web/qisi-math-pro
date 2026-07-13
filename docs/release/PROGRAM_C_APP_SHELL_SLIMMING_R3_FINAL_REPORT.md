# Program C App Shell Slimming R3 Final Report

## Final decision

`APP_SHELL_SLIMMING_R3_ACCEPTED`

Program C recovered the lost session without losing or inventing work,
completed C2-12 and C2-13, passed the Phase 6 engineering closure and Phase 7
internal CTO review, and is sealed without a production-logic change in Phase
8.

## Release identity

```text
Program start: b15e6fbe24c525c95a573b51a0c7ab68e77f4790
Baseline tag: pre-app-shell-slimming-r3-b15e6fb
Recovery checkpoint: 2ebe00b390caae556fdb8ed0e03087ad0965cb24
Phase 7 commit: 0d34084adefb897302aeb82cea570067f642cbec
Seal tag: v1.2.0-rc2-app-shell-slimming-r3
Seal commit: v1.2.0-rc2-app-shell-slimming-r3^{}
Branch: stage/app-shell-slimming-r3
```

The peeled annotated tag is the authoritative final seal SHA. A Git commit
cannot contain its own SHA in a file that participates in that commit, so this
report uses the immutable tag resolver and the external local/remote Git
verification instead of a false self-reference.

## Lost-session recovery

Recovery began with local, tracking, and live remote equal at
`7a4b945a3c0c50c33166c5c63689b7fca4e0c797`, the proven Wave 11 commit. The
working tree held one coherent, externally backed-up Wave 12 support-producer
package. Reflog and every unreachable commit were audited; none held a later
Program C wave. Repository/process/index/untracked evidence was protected
before inspection.

The separate `E:\备份\题库系统` main checkout was not used. The correct Program
C repository remained `C:\Users\Administrator\Desktop\题库系统`. Recovery was
accepted as Case B2 and recorded by `2ebe00b`; work then continued from the
preserved tree without copying a legacy owner or weakening a gate.

## C2-12 waves

| Wave | Commit | Closure |
| ---: | --- | --- |
| 1 | `b7f65c5` | formal lifecycle on Import State Machine |
| 2 | `5f9303a` | unreachable deterministic precursor removed |
| 3 | `54a84df` | import validation policy owner |
| 4 | `41433e7` | DOCX vision production source adapter |
| 5 | `acc42a5` | PDF production source adapter |
| 6 | `95fd74a` | isolated fixture import adapter |
| 7 | `da766a0` | formal table mutation delegation |
| 8 | `3c4c098` | Qwen proxy transport owner |
| 9 | `b4ebb31` | strict visual producer |
| 10 | `d02a251` | prepared-page recognition |
| 11 | `7a4b945` | DOCX question producer |
| 12 | `0e8532d` | recovered DOCX support producer |
| 13 | `7bd0185` | converter/reconciler owner closure |
| 14 | `f54981f` | ReviewDraft command/persistence boundary |
| 15 | `32e7967` | manual provenance/formal lifecycle |
| 16 | `70083ef` | OCR transport/producer ownership |
| 17 | `6deadf8` | storage/formal repository boundary |
| 18 | `576b477` | final app-shell convergence and C2-12 acceptance |

C2-12 finished with the normal UI on Bridge production mode, no giant legacy
owner or V2 precursor, no direct ReviewDraft/formal transaction ownership in
the shell, and explicit producer/persistence/formal boundaries.

## C2-13 closure

Commit `6b1dcc8` closed runtime owners and dead paths. Detailed 68-owner and
layer manifests now agree with the compatibility manifests, actual
`main.html` order, runtime namespaces, and production call graph. Missing
dependencies execute fail-closed. Retired, deprecated, test-only, and Route B
owners have no production reachability.

Direct Qwen adapter execution left the shell and Formal Submit dependency
failures gained stable codes. Duplicate production responsibility, forbidden
cross-layer implementation edges, and legacy fallback callers are all zero.

## Phase 6 engineering closure

Commit `e6c14c5` records decision
`PROGRAM_C_PHASE6_ENGINEERING_CLOSURE_ACCEPTED`:

- 43/43 counterfactual attacks passed;
- code-quality and architecture consistency audits passed;
- selected benchmark used 10 measured runs with p50/p95;
- full root Node suite passed 1,614/1,614 across 54 suites;
- browser E2E passed 17/17;
- combined total passed 1,631/1,631;
- mandatory gates passed 11/11 in prescribed order;
- failed/cancelled/skipped/todo/timeout and real API calls were zero.

## Phase 7 internal CTO review

Commit `0d34084` records decision `PROGRAM_C_PHASE7_CTO_ACCEPTED`. The review
explicitly acknowledges that implementer and reviewer may share one execution
environment and therefore does not replace a fresh-session audit.

It answered 42/42 required questions and independently reran `verify:safe`, all
11 mandatory gates, the 15-scenario normal-UI browser, owner/runtime/
architecture/formal/persistence tests, and all four benchmark smoke modes. It
did not reuse Phase 6 numbers as its acceptance basis.

## Architecture before and after

| Boundary | Phase 0 | Final |
| --- | --- | --- |
| normal UI import | giant app-local owner | controller -> ProductionImportBridge production mode |
| import state | implicit giant flow | explicit ImportStateMachine |
| source routing | shell/content-adjacent decisions | deterministic role classifier + coordinators |
| DOCX production | shell converter/vision/reconcile mix | explicit DOCX coordinator/source/converter/reconciler owners |
| PDF production | shell projection coupling | coordinator/source/projection; frozen controlled-write truth gate |
| ReviewDraft | direct shell table/transaction work | builder + DraftPersistenceService + repository transaction |
| formal submit | app/formal DB ownership mixed | BatchFormalSubmit -> FormalAdmissionPolicy -> repository |
| OCR/proxy | shell endpoint/model/payload execution | Qwen transport/adapter/source ports |
| architecture proof | 28-module baseline graph | detailed 68-owner runtime/dependency graph plus compatibility gates |
| fallback | legacy production path | zero legacy caller/fallback |

Dependency direction is lower-layer to higher-layer composition only. UI does
not implement database, OCR, PDF parser/aligner/controlled-write, validation,
Formal Admission, or repository transactions.

## app.js metrics

| Metric | Phase 0 | Final | Change |
| --- | ---: | ---: | ---: |
| inventory lines | 21,778 | 5,247 | -16,531 (-75.9%) |
| detected functions | 318 | 172 | -146 (-45.9%) |
| largest function | `processDraftImportBatch`, 5,132 lines | unrelated exam drag UI, 164 lines | giant owner absent |
| largest Program C UI function | giant import owner | manual crop command, 116 lines | bounded UI command |
| direct formal `questions.put` sites | 6 | 0 | -6 |
| direct OCR/vision owner invocations | 11 | 0 | -11 |
| direct parser/repair/align invocation lines | 69 | 0 Program C shell ownership | owner boundary closed |

The remaining 2,046-line batch engine and 1,330-line frozen PDF projection are
disclosed single-domain maintenance hotspots. They are not copied shell logic
or duplicate owners.

## Production owner matrix

| Responsibility | Final production owner |
| --- | --- |
| normal UI command | `NormalUiImportController` |
| production import workflow | `ProductionImportBridge` |
| lifecycle/cancel/retry | `ImportStateMachine` |
| source role classification | `BatchSourceRoleClassifier` |
| DOCX route/source | DOCX coordinator and production DOCX source ports |
| DOCX conversion/reconciliation | `DocxConverter` / `DocxVisionReconciler` |
| PDF route/source | PDF coordinator and production PDF source port |
| PDF canonical projection | `PdfCandidateProjection` |
| PDF field truth | frozen controlled-write owner |
| import validation | `ImportValidationService` |
| review construction | `ReviewDraftBuilder` |
| review command/persistence | `DraftPersistenceService` |
| database transactions | `StorageRepository` |
| formal admission | `FormalAdmissionPolicy` |
| formal command | `BatchFormalSubmit` |
| AI proxy/task/adapter | Qwen proxy transport, task client, and adapter/source ports |
| diagnostics | `ImportDiagnostics` / secure logger |

## Browser and safety evidence

The production browser begins at `AppProxy.runBatchRecognition`, loads the real
production module graph, records Bridge `mode=production`, persists ReviewDraft
state, and checks visible final UI state. The 15 normal-UI cases cover DOCX
vision, reachable DOCX+DOCX, PDF full, PDF safe-partial, known-bad ownership,
controlled-write conflict, ambiguous support, raw JSON, formula fallback,
cancellation, persistence failure, duplicate click, reload, error recovery, and
formal-write isolation.

```text
wrong attachment = 0
raw JSON leakage = 0
placeholder leakage = 0
controlled-write bypass = 0
Formal Admission bypass = 0
legacy fallback = 0
Bridge formal writes = 0
app direct formal DB writes = 0
unexpected browser console errors = 0
realApiCalled = false
```

Seeded persistence/lifecycle tests are supplemental and do not substitute for
the normal-UI import canary.

## Tests and mandatory gates

Final Phase 6 content verification and the later independent Phase 7 review
both passed the prescribed 11 gates in exact order. Phase 7 `verify:safe`
passed 1,631/1,631 across 54 suites with failed, cancelled, skipped, and todo
all zero. DOCX stable passed 20/20, PDF known-bad 65/65, controlled-write
ownership 21/21, Route B hold 6/6, and the focused owner/runtime/architecture/
formal/persistence set 63/63.

PDF master preflight and dry-run used Chromium, made zero underlying API calls,
and stopped before the prohibited real-run boundary.

## Counterfactual and benchmark evidence

The 43 machine-readable attacks cover missing/throwing dependencies, wrong
source/provenance, discontinuity/duplicate/jump-back, raw JSON, placeholders,
formula fallback, malformed validators, transaction abort, cancellation,
duplicate/idempotent retry, concurrency, refresh, response loss, shadow writes,
and legacy fallback. All passed with safety counters zero.

The selected 10-run benchmark records p50/p95 for owner chains, 50/100/300
ReviewDraft validation/build, persistence/readback, reload, cancellation,
duplicate retry, browser startup/heap, and first ReviewDraft render. Cold-start
p50 improved 18.2% versus the Phase 0 median. First review render was p50
18.842 ms / p95 30.695 ms. The disclosed 100-draft validation p50 was +14.0%
but 2.274 ms absolute and below the 25% default blocker; no safety gate was
weakened.

## Frozen files and prohibited operations

All six frozen files are unchanged:

```text
qisi-pdf-support-controlled-write.js
qisi-pdf-support-aligner.js
qisi-pdf-support-block-parser.js
qisi-pdf-answer-only-extraction.js
qisi-pdf-answer-extraction-quality.js
scripts/pdf-master-browser-runner.js
```

No PDF `real-run`, real AI/OCR endpoint, AI proxy test, model download/switch,
private paper/key/temp OCR submission, production-data mutation, force push,
amend, pull, rebase, hard reset, clean, or broad Git add was used.

## Commit and remote seal

Major acceptance commits are:

```text
b15e6fb Program start
bba2fc4 Phase 5 production/browser work
c77523c Phase 5 accepted checkpoint
3a26001 C2-11 cutover and legacy owner retirement
f92f8e9 C2-11 evidence seal
7a4b945 last proven pre-recovery Wave 11
2ebe00b lost-session recovery checkpoint
0e8532d..576b477 recovered Waves 12-18 / C2-12 closure
6b1dcc8 C2-13 closure
e6c14c5 Phase 6 accepted
0d34084 Phase 7 accepted
v1.2.0-rc2-app-shell-slimming-r3^{} Phase 8 seal commit
```

Final acceptance requires and was completed only after Git proved:

```text
local HEAD = tracking remote = live remote
local tag object = remote tag object
local peeled tag = remote peeled tag = seal commit
working tree = clean
staged = none
untracked release evidence = none
```

The branch is not merged to `main`; no such authorization was given.

## Non-core limitations

- the existing batch engine, frozen PDF projection, and Bridge command table
  remain disclosed maintenance-size hotspots with unique owners and behavior
  gates;
- historical Phase 0 data did not contain p95 or first-review-render metrics,
  so Phase 6 establishes those reproducible future baselines;
- the 100-draft validation microbenchmark is +14.0% versus the old median but
  remains a low-absolute-cost, non-safety result.

These limitations do not restore a legacy path, duplicate an owner, weaken
fail-closed behavior, or block the Program C core objective.

## Acceptance

`APP_SHELL_SLIMMING_R3_ACCEPTED`

Program C completed. Ready for fresh-session independent audit.
