# app.js Manual Refactor Master Plan R1

## 1. Goal

Gradually turn `app.js` into a thin Vue coordinator without changing observable
behavior, recognition ownership, draft schemas, storage semantics, or print output.

This is not a big-bang rewrite. Every stage is independently testable, committed,
and reversible. “Successful once” means every stage crosses the same frozen gates;
it does not mean merging all responsibilities into one unreviewable change.

## 2. Measured baseline (2026-07-20)

| Item | Measured value |
| --- | ---: |
| `app.js` physical lines | 22,694 |
| `const` tokens in `app.js` | 2,948 |
| Vue `ref(...)` calls in `app.js` | 77 |
| Vue `computed(...)` calls in `app.js` | 42 |
| root `qisi-*.js` modules | 37 |
| `tests/*.test.js` files | 88 |
| all `<script src>` tags in `main.html` | 37 |
| local `<script src>` tags in `main.html` | 28 |
| template click bindings | 137 |
| distinct click expressions | 117 |

The external audit figures of 5,092 `app.js` lines, 75 script tags, and 14 orphan
modules are not current repository facts.

### Confirmed hygiene findings

- `.bm_a4_app_before.js` is an ignored 22,813-line local snapshot. Production does
  not load it, but four historical migration tools still assume its default path.
- Five tracked scaffold-only modules are not loaded by production:
  `qisi-app-facade.js`, `qisi-batch-orchestrator.js`,
  `qisi-review-view-model.js`, `qisi-storage-facade.js`, and
  `qisi-ui-renderer.js`. Together they are about 104 lines, not 2,600 lines.
- `qisi-batch-engine-v2.js` and `qisi-pdf-answer-only-extraction.js` are frozen or
  unreachable research paths, not ordinary orphan files. They must not be removed
  during a view refactor.
- `qisi-pdf-answer-extraction-quality.js` is required by Node controlled-write code
  but is not loaded in the browser. That browser/Node asymmetry is a separate PDF
  safety task, not cleanup work.
- Existing script-order and scaffold tests are weaker than their names imply.

## 3. Non-negotiable invariants

Every refactor stage must preserve all of the following:

1. DOCX+DOCX question, answer, solution, table, MathType, and image behavior.
2. PDF support `full` / `prefix` / `fail-closed` ownership and known-bad rejection.
3. No semantic guessing for answer or solution attachment.
4. Draft record fields and raw evidence: question number, stem, options, answer,
   solution, images, warnings, source trace, raw OCR/PDF evidence, and status.
5. Formal question-bank writes still require the existing review boundary.
6. IndexedDB schema, database name, transaction boundaries, and backup format.
7. A4 pagination, option layout, image placement, formulas, answer sheets, and print
   window lifecycle unless a dedicated print stage explicitly changes them.
8. Existing button labels and observable actions unless a dedicated UI task says
   otherwise.
9. No direct or paid AI/OCR calls in ordinary verification.
10. `app.js` may receive only module-loading/calling glue; new business algorithms
    belong in focused `qisi-*.js` modules.

## 4. Architecture rules for every extracted module

- Browser + Node UMD export under `window.Qisi.<Module>` and `module.exports`.
- Pure functions receive dependencies and data explicitly; they do not read Vue
  refs, DOM, `window`, IndexedDB, localStorage, clocks, or random values.
- Input objects and arrays are not mutated unless the existing contract explicitly
  requires mutation and the stage is designed around it.
- Public result shapes and Chinese UI text are byte-for-byte compatible where they
  are observable.
- `main.html` loads each new module exactly once and before `app.js`.
- `app.js` must have a net line/complexity reduction, not just wrappers around copied
  code.
- A migration is rejected if the old definition remains or the new module is not
  reached by a production callsite.

## 5. Behavior-freeze programme before production migration

### 5.1 Static production contract

Build a machine-readable production module manifest and tests that assert:

- local scripts are unique and ordered;
- `app.js` is the final local application script;
- every non-inline template handler resolves to setup state or a component contract;
- scaffold/research modules are classified rather than silently treated as live;
- new modules are included by `npm run check` or explicitly syntax-checked.

### 5.2 Button contract

The 137 click bindings are grouped into these test suites:

| Surface | Required behavior |
| --- | --- |
| Navigation | every top-level view opens and remains interactive |
| Manual entry | tabs, knowledge selectors, images, submit validation |
| Library | search/filter/reset, pagination, cart add/remove |
| External library | batch selection, filters, confirmation and cancellation |
| Batch creation | picker/drop, role modal, remove/edit/cancel/create |
| Review | tab switching, source viewing, editor save/discard, image placement |
| Submission | cancel path and disposable-context success path |
| Exam builder | selection, ordering, group config, reset, template and print |
| Settings | template overrides and personal knowledge CRUD |
| Destructive actions | cancellation first; success only in an isolated browser context |

An event-binding source guard is not accepted as proof that a button works. Critical
actions require Playwright behavior assertions in a fresh browser context so the
user's real IndexedDB is never touched.

### 5.3 Real material matrix

At refactor milestones, explicitly run (they are skipped by default):

- `tests/docx-layout-real-browser.test.js` for the Guangdong, Hebei, and Hubei exams;
- `tests/docx-general-real-browser.test.js` for all supported DOCX roles under
  `C:\Users\Administrator\Desktop\题目与答案`;
- separate PDF real-material tasks for PDF inputs, preserving fail-closed behavior.

The browser harness must block `/api/ai/**` and `/api/ocr/**` unless a separate task
explicitly authorizes costed calls. Pre/post structural equality ignores only
generated IDs and timestamps; it compares question order, text, options, answer,
solution, images, warnings, and render errors.

Pre/post equality proves the refactor did not regress existing recognition. It does
not by itself prove that an existing recognition result is semantically perfect;
content-truth audits remain a separate acceptance layer.

## 6. Staged migration sequence

### P0 — Master plan and measured baseline (this stage)

- Documentation/read-only verification only.
- No runtime changes.
- Output: this plan and an explicit next-stage task.

### H1 — Production manifest and legacy quarantine

- Replace scaffold-existence tests with a real production-entry manifest.
- Quarantine the five proven scaffold-only modules only after every script/test/tool
  reference is classified.
- Move the ignored BM snapshot outside the production root only after historical
  tools require an explicit `--before` path or are formally retired.
- Do not touch `app.js`, DOCX, PDF, database, or UI behavior.

Rollback: restore the H1 commit; the product runtime is unchanged either way.

### T1 — UI and script-order behavior freeze

- Strengthen script-order assertions to parse `src` values and require uniqueness.
- Add navigation and safe button smoke coverage in isolated browser contexts.
- Record unsupported/unautomated button cases explicitly; do not label source guards
  as behavioral coverage.
- No production behavior changes.

Rollback: tests only.

### R1 — Extract exam grouping policy (first production migration)

Target module: `qisi-exam-grouping.js`.

Move only:

- current `getExamGroupsForQuestions` policy;
- current `groupSummaryText` formatting.

Proposed exports:

```text
buildExamGroups(sourceQuestions, policy)
formatExamGroupSummary(group)
```

All order/config/label/score dependencies are passed in `policy`. The module cannot
read Vue refs, DOM, database, storage, DOCX/PDF, AI/OCR, or global mutable state.

Characterization cases:

- known types follow current order;
- unknown types sort last using current text order;
- missing type maps to the current fallback group;
- custom group title/score/text overrides defaults;
- per-question score overrides group score;
- total score and generated summary are exactly equal to current output;
- empty/missing/zero values;
- no input mutation.

Expected result: about 22 net lines removed from `app.js`, with only dependency
assembly and module calls left there.

### R2 — Extract library selectors

Target module: `qisi-library-view-state.js`.

- knowledge descendant collection;
- knowledge tree flattening;
- question filtering projection;
- fingerprint index construction returning maps rather than writing Vue refs.

Do not move pagination refs, event handlers, database reads, external merge/write, or
formal question writes in this stage.

### R3 — Extract manual-entry projections

Target module: `qisi-entry-view-state.js`.

- preview projection;
- option normalization for the manual form;
- validation result construction.

Keep file input, OCR, database writes, alerts, and view refs in the coordinator.

### R4 — Extract personal-knowledge tree transformations

Target module: `qisi-knowledge-tree-state.js`.

Implement immutable create/rename/delete/flatten transformations first. Vue state
assignment and persistence stay in `app.js` until behavior equivalence is proven.

### R5 — Extract exam print rendering in bounded clusters

Target module: `qisi-exam-print-renderer.js`.

Split pure HTML/LaTeX assembly from window/blob/image hydration. Do not move print
window lifecycle and IndexedDB image lookup in the same commit. A4 pixel/page visual
snapshots are mandatory.

### R6 — Expand review view-model ownership

Target existing `qisi-review-draft-state.js` or a focused new review selector module.

Move only computed problem/preview projections with characterization fixtures.
Draft writes, cleanup evidence, submit-to-bank and image transactions remain frozen.

### R7 — Batch final-gate pure helper cluster

Only after direct characterization tests exist, consider moving counting/scoring,
meaningful-option, image merge, and candidate selection functions. Do not move the
mutating `batchFinalGateDedupeDrafts` function with them. Required fixtures include
garbled text penalties, LaTeX completeness, image-ID dedupe, raw/source/warning
preservation, source ownership, ID rebinding, and orphan rejection.

### R8 — View composables and coordinator reduction

Only after R1–R7 have removed pure policy can state/event glue be grouped into
`useLibrary`, `useEntry`, `useExam`, `useReview`, and `useSettings` composables.
Moving 81 refs or all views in one commit is forbidden. One view per stage, with the
same returned setup contract and a browser behavior suite.

### Deferred separate programmes

These must never be bundled with an `app.js` extraction:

- local-server CORS/origin protection;
- offline/vendor dependency pinning and a build pipeline;
- PDF browser/Node dependency asymmetry;
- Route B or V2 removal/integration;
- alert/confirm replacement;
- console/debug-log policy;
- print blob URL lifetime change;
- test-suite pruning or Markdown assertion cleanup.

## 7. Required gate ladder for every production stage

Run narrow characterization tests first, then all of:

```powershell
node --check <new-module>.js
node --check app.js
npm.cmd run check
npm.cmd test
npm.cmd run smoke:batch:mock
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:no-real-ai
npm.cmd run verify:safe
$env:QISI_ALLOWED_DIFF="<exact files>"
npm.cmd run verify:diff-scope
```

At R1, R5, R8, and release milestones, also run the relevant Playwright browser
matrix and explicit real-material tests. A default skip is reported as skipped, never
as passed.

## 8. Per-stage evidence and rollback

Before editing:

- clean working tree;
- current branch/HEAD recorded;
- exact allowed and forbidden files recorded;
- existing output fixture captured without generated IDs/timestamps.

Before commit:

- old and new outputs deep-equal for characterization fixtures;
- no forbidden diff;
- `app.js` old definitions removed and production module call proven;
- full gate ladder green;
- real AI/OCR count is zero;
- risk and untested cases listed.

Git policy:

- branch prefix `codex/`;
- one objective per commit;
- no amend, force push, hard reset, or mixed cleanup;
- any failed stage remains uncommitted and is restored with a scoped patch/revert;
- the next stage does not begin until the current stage report is accepted.

## 9. Global stop conditions

Stop immediately if:

- a stable DOCX/PDF result changes unexpectedly;
- a button action cannot be characterized before moving its handler;
- a module needs hidden Vue/global/database dependencies;
- a draft/formal-bank schema or transaction would change;
- real AI/OCR becomes necessary;
- an out-of-scope test fails;
- `app.js` does not shrink or only delegates through duplicate wrappers;
- a stage would touch recognition ownership and UI architecture together;
- pre/post real-material results differ without an explicitly approved bug fix.

## 10. Definition of completion

The refactor programme is complete only when:

- every live production module has a documented owner and explicit load path;
- all 117 distinct click expressions are either behavior-tested or explicitly listed
  with a justified manual acceptance procedure;
- `app.js` contains orchestration/glue rather than large pure algorithms;
- all stable-chain, button, print, and real-material milestone gates pass;
- research/scaffold files are outside the production dependency inventory;
- a fresh installation can start and exercise each primary view without relying on
  migration snapshots or hidden global load accidents.
