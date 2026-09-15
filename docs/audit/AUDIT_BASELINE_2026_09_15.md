# AUDIT BASELINE — TEX题库 (2026-09-15)

Takeover audit of an inherited dirty working tree, followed by continuous stabilization.
Everything below is based on the actual code, the actual gates, and real browser runs.
Historical documents were used only as leads.

## 1. Starting point

```text
branch              codex/app-refactor-master-plan-r1
HEAD before work    b9a9d69 stage H9 complete reference editor parity
working tree        dirty: 14 modified files + 6 untracked entries
verify:safe         1373 tests, 1363 passed, 2 failed, 8 skipped
```

Every inherited change was attributed before it was touched, and a full patch snapshot
plus copies of the untracked files were saved under
`artifacts/audit-baseline/inherited-tree/` (HEAD, diff, and file copies).

| Inherited change | Attributed to |
| --- | --- |
| `open-app.cmd`, `qisi-server.cmd`, `scripts/start-qisi.ps1`, launcher tests, README | H10 launcher work |
| `qisi-local-server.js` service build id, `/api/health` buildId | H10 launcher work |
| `app.js` review-storage lines (`shallowRef`, `reviewRecordForStorage`) | H10 UI action acceptance |
| `tests/app-ui-navigation-browser.test.js` (750 new lines) | H10 UI action acceptance |
| `qisi-docx-rich-content.js`, `qisi-docx-mtef-reader.js`, `qisi-mathtype-native-guard.js`, `tools/translate-mathtype-mtef.ps1`, AI proxy and MathType-breaker lines in `qisi-local-server.js`, `tests/import-failure-recovery.test.js` | import reliability |
| `docs/debug/IMPORT_RELIABILITY_2026_09_15.md`, `artifacts/import-reliability/**` | import reliability evidence (local only) |
| nothing | uncertain |

## 2. Real architecture map

```text
main.html  → qisi-runtime.js → qisi-*.js modules → app.js (Vue options coordinator, ~22.9k lines)
handout.html → qisi-handout-*.js + qisi-handout-app.js (isolated handout product)
qisi-local-server.js (Express, loopback only) → /api/convert/*, /api/ai/chat, /api/ai/ocr proxies
```

| Chain | Modules actually walked |
| --- | --- |
| DOCX+DOCX (stable) | `qisi-batch-importer.js`, `qisi-docx-pipeline.js`, `qisi-docx-rich-content.js`, `qisi-docx-layout.js`, `qisi-docx-mtef-reader.js`, `qisi-docx-table-latex.js`, `qisi-batch-engine-v2.js`, `qisi-batch-final-gate.js`, `qisi-mathtype-native-guard.js`, local server `/api/convert/mathtype-mtef` |
| PDF+PDF (fail-closed) | `qisi-support-parser.js`, `qisi-pdf-support-block-parser.js`, `qisi-pdf-support-aligner.js`, `qisi-pdf-content-integrity.js`, `qisi-pdf-answer-extraction-quality.js`, `qisi-pdf-support-controlled-write.js`, `qisi-pdf-safe-partial-pipeline.js` |
| Review → formal bank | `qisi-review-draft-state.js`, `qisi-review-composable.js`, formal admission in `app.js`, `qisi-batch-final-gate.js` |
| Exam / print | `qisi-exam-composable.js`, `qisi-exam-print-renderer.js`, `qisi-a4-exam-template.js` |
| Handout | `qisi-handout-*.js` (model, repository, editor-state, document, edition-policy, compiler client, pdf-session, app) |

Shared between the two import chains: `qisi-utils.js` (display normalization, text
cleaning, media tokens, answer/solution splitting), `qisi-docx-latex-content.js`,
`qisi-support-repair.js`, and `qisi-db.js`. `qisi-utils.js` is the single most
cross-cutting module and therefore the most likely carrier of "fix A breaks B".

Truth gate for formal insertion: draft review state plus the controlled-write /
final-gate modules. No path writes the formal question bank without them.

## 3. Defects found and fixed in this session

| # | Defect | Root cause | Evidence | Fix |
| --- | --- | --- | --- | --- |
| 1 | Launcher aborted the whole startup when one candidate port failed | The first exit-code check threw instead of trying the next port | `tests/portable-launcher.test.js` failed with "service exited during startup (1)"; reproduced whenever a sibling test claimed the port first | `scripts/start-qisi.ps1` records the failed candidate and continues; commit `cf9d9f3` |
| 2 | The remembered view silently took back a navigation click | `app.js` restored `qisi_last_view` after `await loadData()`, so a slow startup overwrote a click already made | Deterministic probe: view flipped `entry` → `library` 3.2 s after the click | Restore moved before the first `await`; `tests/startup-view-restore.test.js` proves both the fix and that the memory still works; commit `cf9d9f3` |
| 3 | Inserting a bank question into a handout failed with a false conflict, or the pending edit was lost instead | `flushSave()` returned immediately while a save cycle was running, so the insertion used a stale `updatedAt` | `tests/handout-insert-autosave-race.test.js` fails on the old behaviour and passes on the new one; this was the real cause of the intermittent H3 timeout | `flushSave()` waits for the running cycle; commit `ad5d0a0` |
| 4 | `$$…$$` display math collapsed to inline `$…$` | `restoreLatexMathSegments` passed the LaTeX chunk as a `String.replace` *replacement string*, where `$$` is a pattern, not literal text | `normalizeBareLatexForDisplayText('$$x^2$$')` returned `$x^2$` | Function replacer; commit *latex display fixes* |
| 5 | `\left…\right.` produced unbalanced LaTeX such as `$\right$` | Trailing-punctuation stripping removed the `.` that belongs to the `\right.` command | `\left\{…\right.` → `$…\right$.` | Punctuation that completes a delimiter command stays inside the island |
| 6 | Legacy encoded square roots (`鈭?` = √2) stayed on screen | The `?` of the repair token was stripped as sentence punctuation | The application's own `window.__qisiLatexDisplayNormalizeSelfTest()` returned `ok:false` for `sqrt-glyph-safe`; it now returns `ok:true` | Punctuation belonging to the repair token is preserved |
| 7 | The UI acceptance test consumed the wrong modal | The `重新计算` action ends with an `alert` that the test never consumed, so the following delete confirmation could be dismissed or accepted by the wrong dialog — making the delete assertion meaningless | `external-batch-item.failed` stayed visible for 30 s after the accepted delete | The stray alert is consumed explicitly; 5/5 focused reruns pass |

## 4. Baseline the work now starts from

```text
npm run verify:safe           1383 tests, 1375 passed, 0 failed, 8 skipped
npm run verify:docx-stable    20/20 passed
npm run verify:pdf-known-bad  65/65 passed
npm run verify:batch-safety   passed
npm run verify:no-real-ai     passed
real AI/OCR calls             none
```

Handout H3 browser flow passes standalone 3/3 and 5/5 in repeated focused runs.
Launcher tests pass 2/2 five times in a row. The launcher + navigation + startup
restore + insert-race group passes 9/9 twice.

## 5. UI action acceptance status

`tests/app-ui-navigation-browser.test.js` drives an isolated browser and disposable
IndexedDB through: sidebar navigation for all six views, entry controls, knowledge
cascaders, entry tabs, batch task creation and return, library filters and reset,
exam template/edition controls, personal knowledge management, template saving,
external library recalculation, delete-cancel and delete-confirm, paging, selection,
next steps, draft editing, and the duplicate-import prompt.

Not yet covered by an automated action: the browser print popup (blocked by the in-app
browser security boundary) and every modal of the handout page beyond the flows already
covered in `handout-h3/h5/h6/h7` tests.

## 6. LaTeX status

- One normalization implementation (`qisi-utils.js`) and one preview renderer
  (`qisi-components.js`) for the main app, plus a separate handout renderer
  (`qisi-handout-preview.js`) and the print renderer in `app.js`.
- `tests/latex-display-corpus.test.js` (8 cases) now locks the corpus from the task
  brief: inline and display delimiters, `\frac`, `\sqrt`, `\sum`, `\int`, `\lim`,
  `\vec`, `\overline`, `\binom`, sub/superscripts, `cases`, `aligned`, `array`,
  `pmatrix`, `bmatrix`, `vmatrix`, `\mathbb`, `\because`, `\therefore`, `\angle`,
  set operators and comparisons, mixed Chinese and math, option labels in every
  supported style, and the legacy encoded square root.
- Confirmed contract: display normalization never rewrites already-legal LaTeX and
  never absorbs an `A.`/`B．`/`C、` label into a math island.

## 7. Test suite assessment (first pass)

### 7.0 Inventory

`scripts/audit-test-suite-inventory.js` writes `docs/audit/TEST_SUITE_INVENTORY.md`: 142 test
files, 1376 declared tests, 21 browser-based, 5 server-based, 0 files that only check that a
function exists. New real-path coverage added during this work:
`tests/teacher-daily-flow.test.js` (enter → save → search → edit → reload → exam → print),
`tests/latex-render-surfaces.test.js`, `tests/startup-view-restore.test.js`,
`tests/handout-insert-autosave-race.test.js`,
`tests/handout-undo-keeps-storage-revision.test.js`,
`tests/question-number-normalization-contract.test.js`,
`tests/docx-math-integrity-partition.test.js`, `tests/latex-display-corpus.test.js`.

### 7.0.1 One structural test hazard, recorded not deleted

`tests/qisi-app-display-cleaners-fixtures.test.js` (144 tests, about a tenth of the suite)
does not load the application. `scripts/bm-a4-helper-extract.js` finds the helpers in
`app.js` **by text pattern** (`const name = ... => { ... }`), extracts their source and runs
the copies in a VM with a stubbed `window.Qisi.Utils`. The logic is genuinely covered, but the
coverage is decoupled from the real page: how the application registers or calls those helpers
is not exercised. The same behaviour is reachable through `qisi-utils`, which is where the
helpers delegate. Recommendation recorded for the next pass: move the cases to a
`qisi-utils`-level table and cover the real path through the browser flows already added, then
retire the extraction suite. It is **not deleted now**, because removal has to be proven safe
first.

### 7.1 Duplicate-rule sweep

`scripts/audit-duplicate-and-dead-code.js` reports every name defined in more than one
file (117 at the time of writing) and every export nothing else references. The risky area
— question numbers, options, answers, solutions, roles, images — was reviewed name by name:

| Candidate | Finding |
| --- | --- |
| `normalizeQuestionNumber` in six modules | **real divergence**, see below |
| `cleanOptions` in the batch engine and the final gate | delegate-first: the engine calls the injected `cleanDisplayOptionsForBatchSave` with a local fallback, the gate requires the policy and throws if it is missing. One rule, two call styles. |
| `batchHasQuestionRole` / `batchIsFullRole` in the pipeline and the file dispatcher | delegate-first: the pipeline calls the dispatcher when it is loaded and keeps a local fallback otherwise |
| `cleanDisplayTextForBatchSave`, `cleanDisplayOptionsForBatchSave` in `app.js` | thin delegates to `qisi-utils`, which owns the rule |
| the `*ForV2` helpers in `app.js` | thin delegates to `qisi-docx-pipeline` |

The one real divergence was in the PDF ownership gate: it did not normalise fullwidth
digits, so an answer read from fullwidth PDF text was silently not attached, and it accepted
`0` as a question number while the other implementations reject it. Both are fixed and pinned
by `tests/question-number-normalization-contract.test.js`. A probe also confirmed the parser
already handled fullwidth digits, so the parser was deliberately left unchanged rather than
carrying a redundant edit.

Kept as high-value contracts: `import-failure-recovery`, `handout-insert-autosave-race`,
`startup-view-restore`, `latex-display-corpus`, PDF known-bad suite, DOCX stable suite,
`handout-h3/h5/h6/h7` real-browser flows, `app-ui-navigation-browser`.

Not yet classified: the large `docs/refactor/*` history and the BM-AUTO scaffolding
tests. No test was deleted in this session; deletions must follow the rule that
removal is proven safe first.

## 8. Open items and known limits

### 8.1 Write-safety and resource-handle audits (this pass)

`scripts/audit-app-write-safety.js` lists every async handler in `app.js` that awaits a
database write and reports the ones without `try`/`catch`. It started at two, and both are
now guarded:

- `updateBatchProgress` — a failed progress write used to reject inside the running
  recognition loop; progress is cosmetic, so a failure now logs and continues.
- `createDraftImportBatch` — the batch creation writes are already one Dexie transaction (so
  no partial batch is possible), but a rejection was silent; it now reports through the create
  screen's own warning line and reloads the list.

`scripts/audit-resource-handles.js` scans 109 files for timers, object URLs, listeners and
child processes without a matching release. It flags three files, all benign on inspection:
the handout compiler client attaches `message`/`error` listeners to the Worker it creates and
terminates, `qisi-ui-events.js` exposes a `bindClick` helper that nothing calls, and the Typst
worker attaches one module-level listener. No unrevoked object URL and no unreleased interval
exists in the codebase.

The suite gained two product tests for the areas this pass targeted:

- `tests/review-submit-flow.test.js` — review, edit, submit one draft, and field-by-field
  comparison of the formal row against the draft (options, answer, solution, grade, type,
  difficulty), plus a second test proving a double click cannot create two formal questions.
- `tests/library-edit-failure.test.js` — fault injection: the next `questions.put` rejects, and
  the test asserts the teacher is told, the store keeps the original, and the card returns to
  the stored value instead of showing an edit that was never saved.

### 8.2 One UI defect fixed this pass

The handout notice is `position: fixed; top: 86px; right: 24px`, which puts an error notice
directly over the top bar and the inspector header. In a full-suite run the H6 test could not
click 讲义设置 because "`<div role=\"status\" class=\"notice error\">` intercepts pointer
events" — the same thing a teacher would experience as "the button does nothing". The notice
container now has `pointer-events: none` with `pointer-events: auto` on its close button, so it
stays dismissable without blocking anything behind it.

### 8.3 H6 intermittent failure — root-caused, and it was a test artifact

`handout-h6-browser.test.js` failed roughly once in four full-suite runs with a handout save
conflict (`HANDOUT_CONFLICT`, editor one revision behind the stored record). What the recorded
evidence showed, step by step:

```text
store reached revision 4 and the editor adopted it (acknowledgeSave 3 -> 4)
the editor's own revision then moved back to 3 with no store write
wrapping the editor-state module showed the transition came from createEditorState with a
revision-3 handout, called from page.evaluate - that is, from the test itself
```

The H6 test installs a 50-question performance fixture by replacing `app.editor`; the autosave
persists that fixture, and the test later restores the pre-fixture editor snapshot, whose
revision is older than the store. The application then correctly rejected the next save as a
conflict. **This was not a product defect.** The test now suspends autosave while the fixture is
installed and, on restore, adopts the stored revision so the snapshot lines up with the store.

Result: 7 consecutive full-suite runs green after the change, against 4 failures in the 14 runs
before it. This also demonstrates the value of the write/revision instrumentation: the same
method that root-caused H3 root-caused this, and it distinguished "the product lost a revision"
from "the test installed a stale one".

1. **MathType native runtime still crashes** (`AccessViolation` in
   `MTXFormSetTranslator`) on this machine. Recovery is now bounded and per-formula,
   and the deterministic MTEF reader covers most equations, but full fidelity for the
   affected file is not proven.
2. **H3 residual flake**: after fix #3 the H3 browser flow failed once more in five
   full-suite runs, always at the same insertion wait. The test now reports the handout
   page's own notice, save state and block counts on failure; the next occurrence will
   be diagnosable instead of a bare locator timeout. Root cause not yet proven.
3. **Cross-surface math rendering** is not yet verified end to end by an automated
   check (library list, question detail, exam builder, print HTML). This is the next
   priority because it is the owner's stated top concern.
4. **Real-material accuracy baseline** (DOCX and PDF question/option/answer/solution/
   image/formula rates, wrong-match counted separately) has not been measured yet.
5. **Duplicate business logic inventory** (question-number parsing, option splitting,
   answer attachment, image binding) is only partially mapped.

## 9. Commits

```text
f580f73 adopt continuous execution mode for authorized tasks
95ceebb harden MathType/MTEF recovery and AI proxy failure reporting
ad5d0a0 fix handout question insertion racing an in-flight autosave
cf9d9f3 stage H10 fast startup recovery and UI action acceptance
```

Next commit: the LaTeX display fixes and the UI test dialog hygiene fix.
