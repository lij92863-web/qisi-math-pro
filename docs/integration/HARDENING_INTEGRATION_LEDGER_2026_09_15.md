# Hardening integration ledger — `codex/app-refactor-master-plan-r1` against `origin/main` (2026-09-15)

This ledger answers one question for every hardening behaviour fix: **what does `main` do today?**
It is not a merge plan and it is not a per-file merge. The hardening branch
`codex/app-refactor-master-plan-r1` (`68b7e5b`) was read as evidence only; nothing was merged from
it, `main`'s `app.js` was never overwritten, and the closure/post-R2 owners
(`Qisi.StorageRepository`, `Qisi.FormalAdmissionPolicy`, `Qisi.BatchFormalSubmit`,
`ProductionReviewValidator`, QuestionV2 admission, draft version / idempotency / provenance /
controlled-write) were left in place.

Work happens on `codex/integration-main-hardening`, branched from `origin/main` = `b15e6fb`.
`origin/main` is untouched.

## Classification key

| class | meaning | action |
| --- | --- | --- |
| **A** | `main` already behaves correctly | record the evidence, port nothing |
| **B** | `main` still has the defect | regression first, then the smallest fix that fits main's architecture |
| **C** | `main`'s architecture differs and the old patch does not apply | re-decide on the current architecture; never copy the old patch |
| **D** | test / diagnostic / report asset only | judge whether it still earns its place |

Every row below was established by probing the running product or reading main's own source, not by
reading the hardening patch.

## 1. Migration matrix

| # | hardening behaviour | class | `main`'s current behaviour (evidence) | action on this branch |
| --- | --- | --- | --- | --- |
| 1 | DOCX single-formula failure is isolated to the affected question | **C** | `qisi-docx-mtef-reader.js`, `qisi-docx-rich-content.js`, `qisi-mathtype-native-guard.js`, `tools/translate-mathtype-mtef.ps1` and the `mathtype` server endpoint are **absent from main**; only `qisi-docx-pipeline.js` exists. There is no per-formula conversion step that can fail | not ported; see §5 |
| 2 | MathType native crash guard | **C** | no native MathType invoker exists on main (`/api/convert/*` only serves `self-test` and `docx-to-pdf`) | not ported; see §5 |
| 3 | MTEF TeX-source + typeset-line double consumption | **C** | no MTEF reader on main, so the duplication cannot occur and no wrong formula can be produced | not ported; see §5 |
| 4 | `$$…$$` display math fidelity (`restoreLatexMathSegments`) | **B** | **defect confirmed.** The restored segment was passed to `String.replace` as a *replacement pattern*, so `$$…$$` collapsed to `$…$` in the body/display path | **fixed** in `qisi-utils.js` (function replacer) + 2 regressions |
| 5 | `\left…\right.` fidelity | **A** | main's display normalizer never strips trailing punctuation after `\right`, so the corruption the hardening branch fixed does not exist (`a bare piecewise formula keeps its \right. delimiter intact` passes) | nothing to port; kept as a guard test |
| 6 | mojibake repair (`鈭?` → `\sqrt{2}`) | **A** | main already repairs legacy encoded glyphs | nothing to port; kept as a guard test |
| 7 | startup saved-view race overwrites a fresh navigation | **B** | **defect confirmed in the browser:** with a slow first startup step the remembered view clobbered a view the teacher had just clicked (`actual: ['library']`, `expected: ['entry']`) | **fixed** in `app.js` (restore before the first `await`) + e2e regression |
| 8 | handout autosave / insert race | **D** | `handout.html`, `handout.css`, `qisi-handout-*.js` do not exist on main | not portable; recorded |
| 9 | undo/redo stale revision | **D** | `qisi-handout-editor-state.js` does not exist on main | not portable; recorded |
| 10 | card edit write failure leaves the page disagreeing with the database | **B** | **defect confirmed in the browser:** with the write faulted, no warning was shown and the card kept showing an edit that was never stored | **fixed** in `app.js` (`try`/`catch` → warning + reload stored truth) + e2e regression |
| 11 | notice overlay pointer interception | **D** | `handout.css` does not exist on main | not portable; recorded |
| 12 | PDF dry-run process does not exit | **A** | measured: main's `scripts/pdf-master-browser-runner.js` dry-run finishes on its own and reports `"ok": true` (`artifacts/audit-baseline/dryrun3-*.txt`) | nothing to port |
| 13 | PDF/full-width question-number normalization + zero | **B** | **defect confirmed:** `"１２"` → `[]` (marker not recognised) and `"0"` → `["0"]` (zero could own an answer) | **fixed** in `qisi-pdf-support-controlled-write.js` + 3 regressions |
| 14 | async browser wait false positive | **B** | **defect confirmed:** `waitForFunction(async …)` resolves immediately because a Promise is truthy, so the wait in `tests/e2e/seeded-export-delete.test.js` proved nothing | **fixed:** `tests/helpers/page-waits.js`, the call site converted, and a repo-wide guard test |
| 15 | H6 test snapshot artifact | **D** | the H6 test does not exist on main | no long-term value on main; recorded |
| 16 | launcher port fallback | **D** | main's `open-app.cmd` is a different legacy launcher: it depends on `tmp\start-qisi-server.cmd`, waits `timeout 2`, and hard-codes port 3000 with no fallback, no build-id check and no foreign-process detection | would be a re-implementation, not a port; deferred |
| 17 | accuracy measurement harness | **D** | the harness scripts do not exist on main | kept as a candidate for the next phase |
| 18 | teacher daily flow | **D** | the test does not exist on main | see §7 |
| 19 | test discovery scope | **A** | main's `package.json` runs `node --test`, whose default discovery already matches `tests/**/*.test.js` (the hardening branch merely pinned the same glob explicitly) | nothing to port |
| 20 | final gate auto-picks an answer/solution between candidates | **B** | fixed in the previous commit `eaa94d0` (`qisi-batch-candidate-merge.js`); conflicts now clear the field, record `answerConflict`, and block formal admission | done before this ledger; kept |

## 2. Regressions added, and the inherited failure they catch

Each row was run twice: once with the fix shelved (inherited behaviour) and once with the fix in
place. The middle column is the observed failure on the inherited code.

| behaviour | inherited behaviour fails with | test |
| --- | --- | --- |
| `$$…$$` survives display normalization | `display math keeps its $$ delimiters instead of collapsing to inline math` fails | `tests/latex-display-corpus.test.js` |
| `$$…$$` really renders as display math on every surface | `library / entry preview / print document: display math did not render as display math` | `tests/e2e/latex-render-surfaces.test.js` |
| fullwidth question number | `"１２"` → `[]` instead of `['12']` | `tests/question-number-normalization-contract.test.js` |
| zero is not a question number | `"0"` → `['0']` instead of `[]` | `tests/question-number-normalization-contract.test.js` |
| saved view never overwrites a fresh navigation | `a startup restore must not take away the view the teacher just opened` (`['library']` vs `['entry']`) | `tests/e2e/startup-view-restore.test.js` |
| failed card edit is reported and rolled back | `the failed edit must be reported, saw: []` | `tests/e2e/library-edit-failure.test.js` |
| no test awaits an async predicate Playwright will not await | repo-wide guard finds offenders | `tests/page-wait-helper.test.js` |

The e2e regressions deliberately drive the real product: they start `qisi-local-server.js`, load
`main.html` in Chromium, seed IndexedDB, and assert on what a teacher would see. The edit-failure
test faults `Dexie.prototype.transaction`, which is the call main's `StorageRepository` really makes
when it writes a question (`app.js` → `storageRepository.saveQuestion` → `db.transaction`), so the
failure is injected into the production write path rather than a private helper.

## 3. `main`-only mechanisms that were preserved

The ported files were edited **in place** at their existing call sites; no owner was bypassed:

```text
app.js                        storageRepository.saveQuestion(toRaw(q), { allowUpdate, expectedUpdatedAt, imageRecords })
qisi-pdf-support-controlled-write.js   normalizeQuestionNumber inside the controlled-write owner
qisi-utils.js                 restoreLatexMathSegments inside the display normalizer
```

`Qisi.StorageRepository`, `Qisi.FormalAdmissionPolicy`, `Qisi.BatchFormalSubmit`,
`ProductionReviewValidator`, the QuestionV2 admission transaction, draft versioning, idempotency,
provenance and controlled-write were not touched, weakened or re-routed.

## 4. Gate re-baselining (needs owner awareness)

Two gates on `main` pin `app.js` and the controlled-write file to the Program A seal
`1361d7e` (`docs/audit/OCR_QUALITY_ARCHITECTURE_AUDIT_R1.md`). The owner's instructions for this
integration authorise changes to exactly those files (the fail-closed candidate merge plus these
behaviour fixes), and the earlier commit `eaa94d0` had already changed `app.js`, so the seal could
not stay literally "zero diff" without reverting an authorised fix.

The seal was therefore **kept, not deleted**, and turned into an explicit register:

```text
tests/ocr-quality-architecture-audit.test.js
  AUTHORIZED_POST_SEAL_CHANGES = { app.js, qisi-pdf-support-controlled-write.js }
```

The test now requires every sealed file that differs from the seal to be listed with the ledger
entry that authorises it, and still fails on any unregistered drift. `qisi-formal-admission-policy.js`
and `qisi-answer-only-ai-pass.js` remain byte-identical to the seal.

`tests/code-quality-boundaries.test.js` guards `app.js` against growth. The two behaviour fixes add
13 lines, so both ceilings moved by exactly that change (21780 → 21793 lines, and 5134 → 5146 for the
`processDraftImportBatch` region, whose inventory span reaches the library edit handler). No other
`app.js` change was made.

This is a deliberate, documented exception. The owner should confirm it is what they intended; if
the seal is meant to be absolute, the alternative is to move these two behaviours out of `app.js`
before they land.

## 5. `main` cannot express the DOCX/MathType items (1, 2, 3)

Main's DOCX recognition is a deterministic text pipeline (`qisi-docx-pipeline.js`). It counts
`m:oMath` runs and handles formula-image placeholders, but it has **no MathType OLE/MTEF reader and
no native conversion service**:

```text
qisi-docx-mtef-reader.js         absent
qisi-docx-rich-content.js        absent
qisi-mathtype-native-guard.js    absent
tools/translate-mathtype-mtef.ps1 absent
qisi-local-server.js endpoints   /api/ai/health, /api/ai/chat, /api/ai/ocr,
                                 /api/health, /api/convert/self-test, /api/convert/docx-to-pdf
```

So "single formula failure isolation", "native crash guard" and "MTEF double consumption" describe
failure modes of machinery main does not have. The correct action is **not** to copy the patches:
the reader would have to be re-implemented against main's pipeline, and the double-consumption rule
(one MTEF equation must contribute exactly one formula, from the TeX source *or* the typeset line,
never both) has to be built into that reader from the start. Until then main cannot emit a wrong
formula from an MTEF equation, because it does not convert them at all.

## 6. Two gaps found while porting, recorded and deliberately not fixed

1. A bare LaTeX fragment whose only signal is an operator (`x\in(0,+\infty)`) is not wrapped by the
   display normalizer on main; it stays source text. The corpus test records this as a known gap.
2. A bare piecewise `\left\{…\right.` is left as source text on main. Legal text is not damaged, so
   this is a cosmetic gap, not a correctness defect.

Fixing either means widening `BARE_LATEX_DISPLAY_SIGNAL_RE`, which risks re-wrapping already-legal
text. That is a product decision, not a port, so it is out of scope here.

## 7. Deferred test assets

The hardening branch also carries broad UI-flow tests. They were read, not copied:

| asset | judgement |
| --- | --- |
| `tests/review-submit-flow.test.js` | duplicates `tests/e2e/seeded-review-ui-lifecycle.test.js`, which already covers review → confirm → formal insertion through the harness. **No long-term value; not ported.** |
| `tests/teacher-daily-flow.test.js` | its coverage is largely the union of the three e2e tests now ported plus the existing seeded flows. **Deferred**, worth converting later only if it adds a step nothing else covers. |

They were written against a runtime API that main does not have (`window.Qisi.Database.getDatabase()`),
which is further evidence they are hardening-branch assets rather than main assets. Copies are kept
outside the test tree in `artifacts/audit-baseline/ledger-deferred-tests/*.deferred` so the default
`node --test` discovery cannot pick them up.

## 8. Environment precondition for the browser tests

The e2e harness blocks every `https://` request and serves it from
`local-run-artifacts/r2-e2e-cdn-cache`, so that cache has to be populated before any browser test
runs (this was already true before this ledger: nine e2e tests failed on an empty cache).

```text
node artifacts/audit-baseline/populate-e2e-cdn-cache.js
```

The script was extended to resolve stylesheet-relative `url()` references — KaTeX ships its fonts as
`fonts/KaTeX_*.woff2`, which the earlier version did not cache — and to include the Google Fonts
stylesheet the generated print document requests at runtime. The cache is an ignored local artefact;
no repository file depends on it.

## 9. Gates on `codex/integration-main-hardening`

```text
npm test                    1269 tests, 1269 passed, 0 failed, 0 skipped   (1253 before this ledger)
npm run verify:safe         passed  (check + tests + smoke:batch:mock + verify:no-real-ai)
npm run smoke:batch:mock    20/20
npm run verify:docx-stable  20/20 passed
npm run verify:pdf-known-bad 65/65 passed
npm run verify:batch-safety passed
npm run verify:no-real-ai   passed
```

`verify:diff-scope` is not part of `verify:safe` and requires `QISI_ALLOWED_DIFF`; it was not run.

## 10. Not done

- The hardening branch was not merged, not fast-forwarded and not cherry-picked as a whole.
- No handheld/handout work was imported, because main has no handout surface at all.
- The launcher work (port fallback, build-id health check, foreign-process detection) is not on
  main in any form; porting it is a re-implementation of `open-app.cmd`/`scripts/start-qisi.ps1`
  rather than a fix, and is left for the next phase.
