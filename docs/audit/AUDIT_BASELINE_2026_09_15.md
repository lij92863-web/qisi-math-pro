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

Kept as high-value contracts: `import-failure-recovery`, `handout-insert-autosave-race`,
`startup-view-restore`, `latex-display-corpus`, PDF known-bad suite, DOCX stable suite,
`handout-h3/h5/h6/h7` real-browser flows, `app-ui-navigation-browser`.

Not yet classified: the large `docs/refactor/*` history and the BM-AUTO scaffolding
tests. No test was deleted in this session; deletions must follow the rule that
removal is proven safe first.

## 8. Open items and known limits

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
