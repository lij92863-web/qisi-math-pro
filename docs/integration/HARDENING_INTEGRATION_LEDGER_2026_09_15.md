# Hardening integration ledger — `codex/app-refactor-master-plan-r1` against `origin/main` (2026-09-15)

## 2026-09-16 PDF inspection stage

`main` still enters rendering/vision before assessing PDF text. The integration adds
`PdfInspection` and `PdfIngestion`: proved native numbers, usable-text parsing, bounded single-page
visual requests, existing support sequence/field gates, retained raw evidence and a zero-draft
withheld-page review state. app.js changes are orchestration and evidence persistence only.
`verify:safe`, `verify:batch-safety`, and real-PDF-byte browser regression pass.
No real paid model request was executed. Real visual quality is **not accepted yet**.
See `PDF_INSPECTION_STAGE_2026_09_16.md` for limitations and newly discovered DOCX image loss.

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

The seal was therefore **kept, not deleted**, and turned into an exact-content register:

```text
tests/ocr-quality-architecture-audit.test.js
  => architecture/post-seal-approved-blobs.json
       programASeal: 1361d7e
       approvedFiles["app.js"].gitBlob            + .contentSha256
       approvedFiles["qisi-pdf-support-controlled-write.js"].gitBlob + .contentSha256
```

A file-level allow-list is not a seal: it would keep waving through every later edit to `app.js`.
The register pins the reviewed content itself, so the gate now checks three things per sealed file:

1. a sealed file that is **not** registered must still have the same git blob as the Program A seal;
2. a registered file's git blob at `HEAD` must equal the approved blob **and** its content hash
   (sha256 with line endings normalised to LF) must equal the approved content hash, so an
   uncommitted edit is red too;
3. every registered entry must carry a reason, an authorisation date and a ledger path, and the
   ledger must actually mention the file.

Authorising a further change therefore means: review it, update the register **and** the ledger in
the same commit, or the gate stays red. `qisi-formal-admission-policy.js` and
`qisi-answer-only-ai-pass.js` remain byte-identical to the seal (the latter was never tracked, which
the old file-list test silently tolerated).

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

## 11. Integration final-fix round (2026-09-15, second pass)

Four defects were closed and the real-DOCX precondition was measured. Every regression below was
first run against the inherited code and failed there.

### 11.1 A conflict must be sticky across three or more candidates

`qisi-batch-candidate-merge.js` resolved `answer`/`solution` pairwise. The final gate *folds*
candidates into a running best item, so a conflict produced by `B + C` left `answer: ''` and the
next candidate `D` was then treated as "the only value" and filled the field back in — dissolving the
conflict and restoring an accepted provenance. Reproduced: `D must not fill an answer that is empty
only because of a conflict` failed on the inherited code.

Now a field that already carries a conflict is sticky:

- `carriedConflictOf` recognises either an existing `fieldConflicts[field]` record or a
  `rejected`/`candidate-conflict` provenance;
- the merge keeps the field empty, keeps `status: 'rejected'`, keeps `duplicateStatus:
  'answerConflict'`, and **accumulates** every disagreeing value (B, C, D …) with its identity and
  source trace instead of replacing the pair;
- only a teacher's `manual` provenance releases it, and a *new* disagreement afterwards still
  conflicts;
- when a teacher does resolve a field, that field's stale conflict record is dropped and
  `answerConflict` is cleared, so `fieldConflicts`, `duplicateStatus` and the provenance always tell
  the same story.

Evidence: `tests/batch-candidate-merge-sticky-conflict.test.js` (7 cases), including B+C+D blocked at
formal admission and released only by a manual edit.

### 11.2 Answer equivalence no longer deletes mathematics

The old comparison deleted `[.。、，,:：；;()（）]` from every answer, so `(0,1)` and `01` were "the
same answer". Reproduced: `"(0,1)" and "01" are different mathematical answers and must conflict`
failed on the inherited code.

The rule is now:

- option-label canonicalisation happens **only when both sides are strictly pure option answers**
  (`B`, `(B)`, `B.`, `C`, `[C]`, `AB`, `A,B`, `A、B`); case folding is allowed only there;
- every other answer is compared after presentation-only normalisation: whitespace removal and
  fullwidth→halfwidth mapping. Nothing is deleted, so `(0,1)` vs `01`, `1,2` vs `12`, `[0,1]` vs
  `01` and `{1,2}` vs `12` are conflicts;
- solutions keep their previous comparison, which is untouched.

Evidence: `tests/batch-candidate-answer-canonicalization.test.js` (5 cases).

### 11.3 The seal is now a blob/hash register (see §4)

### 11.4 `QISI_HOST` can no longer expose the service

`normalizeServerHost` returned any host it was given, so `QISI_HOST=0.0.0.0` (or the machine's own
LAN address) put the AI proxy and the file APIs on the network. Reproduced on the inherited code:
`QISI_HOST=0.0.0.0 must not expose the service on the network address 192.168.178.101` failed,
i.e. the LAN address really was reachable.

Now only `127.0.0.1`, `localhost`, `::1` (with or without brackets) are accepted; anything else
falls back to loopback and reports the structured code `HOST_NOT_LOOPBACK` (the secure logger keeps
only structured fields, so free text would have been swallowed).

Evidence: `tests/local-server-host-guard.test.js` — the wildcard and the real LAN address are both
refused off-loopback, the teacher is still served on loopback, and the fallback is reported.

### 11.5 The real DOCX baseline: measured, and it does not match

`verify:docx-stable` runs `tests/batch-smoke-mock.test.js`, a mock, so it says nothing about real
materials. The real pair the hardening baseline used
(`简略版题目（只有一页）.docx` + `完整版答案.docx`, hardening result: 5 complete, 1 withheld,
WRONG MATCH 0) was re-run on this branch with `scripts/measure-real-docx-baseline.js`.

Result on the integration branch: **the batch fails, 0 drafts.** The reason is *not* a MathType
crash and not a code regression in the merge path:

```text
DOCX 已成功转为 PDF，但页面视觉识别未完成：Failed to fetch
stage: visual-recognition      (server route /api/ai/chat, refused by the harness)
```

Main's DOCX question-file path is `DOCX → PDF → strict visual recognition`
(`processStrictVisualQuestionFile`). There is no deterministic recogniser for the question file, so
the real path needs a vision model. On this machine that means the paid DashScope API (a key is
configured in `.env`); no local engine is installed (`local-ocr/models`, `local-ocr/runtime` are
absent and nothing is listening). Calling it is a real paid external API call, which the project
rules forbid without authorisation, so the end-to-end measurement stops here rather than being
silently faked.

What the same files *do* show, offline and deterministically
(`artifacts/audit-baseline/mtef-capability-probe.js`):

```text
question.docx   35 MathType OLE objects (ProgID Equation.DSMT4), 0 native OMML equations
answer.docx    146 MathType OLE objects,                    0 native OMML equations
```

They are 100% MathType. Main has no MTEF reader, and its deterministic text extraction turned every
one of those equations into the literal word `false` — the Word control flag inside
`<o:LockedField>false</o:LockedField>`, once per formula:

```text
before: 已知集合false，false则下列命题正确的是（ ）A. false B. false …
after:  已知集合 ， 则下列命题正确的是（ ）A. B. …
```

That contamination was fixed in main's own pipeline (`stripXmlTagsForDocxText` now drops the
`<w:object>` subtree, whose text is never content — the visible form is its preview image), with
`tests/docx-mtef-locked-field-text.test.js` proving the inherited behaviour leaked `false`.

**Difference from the hardening baseline, stated plainly:** the hardening branch read those
MathType objects deterministically and produced LaTeX (`$\frac{1}{2}$`,
`$A\cap B=\left\{0,-1\right\}$`), which is where the baseline's 5 complete drafts came from. The
integration branch cannot do that; it recovers the surrounding Chinese text and delegates every
formula to the vision model. Deterministic results are therefore **not** comparable, and the
baseline's numbers cannot be reproduced here without a real vision call.

Minimal design suggestion (not implemented in this round, per the no-MTEF-port instruction):

1. port the *reader only* — `qisi-docx-mtef-reader.js`, converting `word/embeddings/oleObject*.bin`
   MTEF into LaTeX, with the "one MTEF equation, one formula" rule built in so the TeX source and the
   typeset line are never both consumed;
2. feed it into the merge hook main already has (`docxVisualTextIsBetterForV2` /
   `mergeDocxVisualOptionsForV2`), so formulas come from the DOCX and vision is only needed for
   layout, images and question-flow verification;
3. keep the existing fail-closed rule: a formula that cannot be read stays empty and blocks
   admission rather than being guessed.

That is one new module plus one merge hook, not an `app.js` rewrite and not a merge of the hardening
branch.

### 11.6 The offline browser cache is now a repository recipe

The browser suite had been running against a cache that only existed on this machine. The recipe now
lives in `scripts/populate-e2e-cdn-cache.js` and one command builds it on a fresh clone:

```text
node scripts/populate-e2e-cdn-cache.js
```

The asset list follows the application (every `script`/`link` in `main.html` except `preconnect`
hints, plus nested stylesheet `url()` references and the two assets the app only asks for at
runtime: the print document's stylesheet and the pdf.js worker). The bytes are pinned in
`scripts/e2e-cdn-assets.lock.json`, so a later fetch that serves a different Vue or Tailwind build
fails loudly instead of silently testing something else; `--update-lock` re-pins deliberately. The
harness now fails with the exact command when an asset is missing.

Evidence: `tests/e2e-cdn-cache-bootstrap.test.js` (recipe covers the entry points, the KaTeX fonts
and the pdf.js worker; every cached asset matches its pinned hash).

### 11.7 Gates for this round

```text
npm test                     1290 tests, 1290 passed, 0 failed, 0 skipped   (1269 before)
npm run verify:safe          passed
npm run verify:docx-stable   passed
npm run verify:pdf-known-bad passed
npm run verify:batch-safety  passed
npm run verify:no-real-ai    passed
```

`origin/main` was not modified and the hardening branch was not merged.

## 12. DOCX MTEF capability restoration (2026-09-15, third pass)

Main's DOCX question path had no deterministic formula reader: both real files are MathType
(35 and 146 `Equation.DSMT4` OLE objects, zero native OMML), so every formula was delegated to the
vision model and the deterministic text dropped them. The capability was restored **without** merging
the hardening branch and **without** restoring its DOCX pipeline: two self-contained reader modules
plus one hook in main's own extraction path.

### 12.1 What was added

```text
qisi-docx-ole-reader.js     OLE/CFB container -> "Equation Native" -> MTEF bytes (bytes only)
qisi-docx-mtef-reader.js    MTEF -> LaTeX, with the import contract below
qisi-docx-pipeline.js       resolveDocxMathTypeObjectForV2 / expandDocxMathTypeFormulasForV2
app.js                      buildDocxOleBytesMap + the hook inside extractDocxTextWithMath
main.html                   loads the two modules before app.js
```

`app.js` was changed only at its existing extension point (`extractDocxTextWithMath` already had a
`<w:object>` branch); the seal register records the new blob/hash of `app.js`, and the bloat guard
moved by exactly those 54 lines.

### 12.2 The import contract, and where it is enforced

| rule | enforcement |
| --- | --- |
| 1. one OLE object, at most one formula | `expandDocxMathTypeFormulasForV2` visits each `<w:object>` once and pushes one record |
| 2. TeX source and typeset line never both consumed | `parseMtef` returns the two representations separately and `classifyMtef` uses exactly one |
| 3. a reliable TeX source wins | `isReliableTexSource` + `origin: 'tex-source'` |
| 4. reconstruction only without one | `origin: 'reconstruction'`, chosen only when the structural rows stand alone |
| 5. undeterminable means unresolved | `status: 'unresolved'` with a code; nothing is guessed |
| 6. one bad formula cannot sink other questions | the object becomes an inline `[[MTEF_UNRESOLVED:rId…]]` token, so only its own question is withheld |
| 7. control fields are never text | `stripXmlTagsForDocxText` drops the `<w:object>` subtree; `false` never reaches the text |
| 8. provenance says DOCX deterministic / MTEF | every record carries `source: 'docx-mtef'`, `evidenceRef: 'ole:<rId>'`, `status: 'deterministic-source'` |
| 9. vision only for what the DOCX cannot give | formulas now come from the DOCX; vision is not used in this round's acceptance at all |
| 10. MTEF against visual evidence is a conflict, not a preference | the formula records are kept per file (and per question) so a disagreement can be raised through the existing conflict path instead of silently picking one — see §12.5 |

### 12.3 Deterministic acceptance on the same two real DOCX

`node scripts/measure-docx-mtef-acceptance.js` runs the product's own pipeline module in the product
runtime (a real browser page with JSZip), on the same pair the hardening baseline used.

| metric | hardening baseline | integration, this round |
| --- | --- | --- |
| batch status | `review` | deterministic acceptance ran to completion (the vision batch is still blocked, §12.5) |
| COMPLETE | 5 | 5 |
| SAFE PARTIAL | 0 | 0 |
| WITHHELD | 1 | 1 (question 6: unresolved formula `rId71`) |
| WRONG MATCH | 0 | 0 |
| answers | B C B C D C | B C B C D C |
| options per question | 4 4 4 4 4, sixth question empty | 4 4 4 4 4, question 6 has one unresolved option |
| formulas (181 OLE objects) | not measured | 180 extracted / 1 unresolved / 0 conflict |
| MathType.exe spawned | no | no (the readers are pure JS) |
| paid API calls | 0 | 0 |
| `false` control text | present before §11.5 | absent |

Question 3 option D is `-1` again, not `-1-1`: the TeX-source rule consumes one representation only.
Question 2's answer is inferred from the answer file's own `故选：C` text and is reported as such —
the answer file stores no letter for it.

### 12.4 The 61 real MTEF samples

`node scripts/measure-mtef-fidelity.js` over `artifacts/import-reliability` (real material, not
committed):

```text
total 61     recovered 59  (58 reconstruction + 1 TeX source)     unresolved 2 (rId76, rId72)
display-unsafe 0        matches the recorded summary: yes
```

`tests/docx-mtef-reader.test.js` keeps the original `-1-1` sample as a regression, plus the TeX-source
preference, the reconstruction fallback, the unresolved path and the OLE container path.

### 12.5 Residual risk (not closed in this round)

The batch still routes a DOCX *question* file through DOCX → PDF → strict visual recognition, and that
step throws before the deterministic text layer is prepared, so a vision failure still fails the whole
batch (`DOCX 已成功转为 PDF，但页面视觉识别未完成`, 0 drafts). The restored reader is therefore
exercised by the answer/solution DOCX and by the text-layer path, but it does not yet rescue a failed
vision run.

Aligning the order with rule 9 — prepare the deterministic DOCX text (stem, options, formulas) first
and let vision add only layout, figures and question order — is the natural next step. It changes the
import order of the stable DOCX chain, which this round was told not to touch, so it is deliberately
left as a design step: the deterministic question set already passes acceptance, so the change is
about *when* it is preferred, not about whether it is correct.

## 13. DOCX wrong content on the wrong question (2026-09-16, fourth pass)

This closes section 4 of `docs/integration/HANDOFF_2026_09_16.md`: the
`DOCX SILENT WRONG CONTENT > 0` defect on the real `周二晚测.docx`, where question 7's option set was
attached to seven other questions and questions 1 and 9 were missing from an authoritative 12
question contract. `app.js` was changed only inside the DOCX text path and the two evidence checks it
feeds; the seal register moved with it (§4).

### 13.1 The three mechanisms, each measured

| mechanism | evidence on the real file | fix |
| --- | --- | --- |
| the paragraph reader mistook structural elements for text elements | `<w:tabs>`, `<w:tab w:val=…/>`, `<w:textAlignment …/>` and `<w:tcW …/>` all start with `w:t`, so the unanchored `[^>]*>` alternative matched them and swallowed everything up to the next real `</w:t>` — including a drawing's `<wp:posOffset>` values, which reached the paper text as 13–15 digit runs (`4071620147320A.外心`, `409130527749511. 在正方体`) and swallowed option labels such as `A. ` | the text alternative is anchored (`w:t(?=[\s/>])`) in `extractDocxTextWithMath` and in the option-map reader, which is the same rule `qisi-docx-pipeline.js` already applied in §11.5 |
| the flat splitter trusted a mark-sheet numbering row as a question | the text layer starts with `11. 12.` (the mark sheet's numbering row before the section header), so the splitter produced a bogus question 11 whose stem was the section header, and the following `1.` was dropped by its "no jump-back" filter | `splitFlatTextIntoQuestionBlocks` (now in `qisi-utils.js`) skips a marker whose line is nothing but question numbers, and accepts a marker that sits behind an inline image token (`[[IMAGE:…]] 9. 如图…`), which is how questions 1 and 9 were lost |
| options were extracted from the whole document as "current question" evidence | every draft's `pageText` is the whole file, so `extractOptionsFromCurrentBlockOnly` parsed it and took the first A.–D. run of the paper for whichever question had no options of its own | `isQuestionScopedEvidenceText` rejects any evidence text that carries another question's marker; it is applied in `extractOptionsFromCurrentBlockOnly`, in `getCurrentQuestionBlockFromPageText` and in the review page's `draftRawOptionSourceCandidates` |

One further defect surfaced by the fixes above: `splitOptionsFromStem` treated the `A` of
`$\triangle ABC$` as option A, so question 3's stem was cut inside the formula and the rest of the
question was filed as option A. Option labels must now be a standalone letter
(`([A-D])(?=[^A-Za-z0-9_])`), in `qisi-utils.js` and in both `app.js` option readers.

The file-wide DOCX table text (`【DOCX表格文本兜底】`) is appended to the text layer as one blob and
used to land in the last question's stem. Per-question blocks now end at that marker; the blob stays
in `pageText` as evidence.

### 13.2 Measured result on the same real file

`node artifacts/audit-baseline/docx-run-trace.js "<周二晚测.docx>"` (local evidence, not committed):

| metric | at HEAD (`0038d6e`) | this round |
| --- | --- | --- |
| batch status | `review` | `review` |
| drafts | 10 | 12 |
| question numbers | 2,3,4,5,6,7,8,10,11,12 (question 11 = the section header) | 1,2,3,4,5,6,7,8,9,10,11,12 |
| drafts sharing one option set | 7 (question 7's options) | 0 (only the empty set is shared — missing, not wrong) |
| stems that are the whole document | 7 × 1260 characters | 0 |
| leaked `<wp:posOffset>` digit runs | present (`4071620147320`, `37611055556259`, `409130527749511`) | none |
| questions with their own 4 options | 3 | 6 (1, 2, 3, 5, 7, 8) |
| questions with no options (fail closed, manual review) | 0 recorded | 6 (4, 6, 9, 10, 11, 12) — the paper keeps those labels inside its MathType equations, so nothing is guessed |
| paid API calls / MathType launches | 0 / 0 | 0 / 0 |

### 13.3 Regressions

| behaviour | inherited failure | test |
| --- | --- | --- |
| a mark-sheet numbering row is not a question, and an image-token-prefixed marker still is | `openBatchReview` on the fixture paper produced 2 drafts instead of 3 (question 1 lost) | `tests/qisi-utils-question-evidence-scope.test.js` |
| a whole document is never one question's evidence | `isQuestionScopedEvidenceText(wholePage, '1')` was not even expressible before; the real run attached question 7's options to seven questions | `tests/qisi-utils-question-evidence-scope.test.js` |
| every draft keeps its own stem and options through the real create flow | the same fixture DOCX through the real UI failed with `expected the paper's three questions, saw 2` | `tests/e2e/docx-question-scope.test.js` |
| a letter inside a formula is not an option label | not expressible before: `$\triangle ABC$` became stem + option A | `tests/qisi-utils-question-evidence-scope.test.js` |

The inherited run was produced by `artifacts/audit-baseline/run-test-against-inherited-app.js`, which
swaps in `git show HEAD:app.js`, runs the test file, restores the working copy and verifies the
restore by hash.

### 13.4 Gates for this round

```text
npm test                    1336 tests, 1335 passed, 1 failed before the seal register was moved
                            (the seal entry is expected to fail until the change is committed)
npm run check               passed
```

`app.js` shrank (the flat splitter moved into `qisi-utils.js`), so the bloat ceilings in
`tests/code-quality-boundaries.test.js` did not need to move.

## 14. Support-file active anchor and the missing explicit answer (2026-09-16, fifth pass)

This closes item 1 of section 5 in `docs/integration/HANDOFF_2026_09_16.md`, measured on the real
group 1 (`简略版题目（只有一页）.docx` + `完整版答案.docx`).

### 14.1 What was wrong

| mechanism | evidence on the real pair | fix |
| --- | --- | --- |
| the answer file's marker regex demanded a line start directly before the number | question 2's figure is anchored **in front of** its own marker, so the answer text layer reads `[[IMAGE:…]] 2【答案】` and the whole block — its `【答案】` line **and** its `【详解】` — was never parsed. Question 2 was the only question whose solution was missing, and it is exactly the question the handoff calls out | the marker rule now allows an inline image token before the marker, in `parseInlineAnswerSolutionBlocks` and in `parseNumberedSolutionBlocks` — the same active-anchor rule the flat splitter got in §13 |
| a `详解` conclusion was written into the answer | `reconcileAnswerWithSolution` filled an empty answer from `故选：C`, and *replaced* an explicit answer when the file's letter disagreed with the solution's prose | the conclusion is now only reported to the teacher. An empty answer stays empty (`mergeWarnings: missing_explicit_answer` plus a warning naming the letter), and an explicit answer is kept on disagreement (`answerConflict`, `请人工核对`) |

The rule the project already applies to candidates is unchanged: a missing answer is acceptable, a
wrongly attached answer is not, and the two trusted repair paths (`repairDraftAnswersByOrder`, the
Qwen alignment) clear both the `missing_answer` and the new `missing_explicit_answer` token when
they fill the field from the answer file itself.

### 14.2 Measured result on group 1

`node artifacts/audit-baseline/docx-batch-acceptance.js --id G1 --question "<简略版题目>.docx"
--support "<完整版答案>.docx"` (local evidence, not committed):

| metric | at `f861202` | this round |
| --- | --- | --- |
| drafts | 6 | 6 |
| answers | 1:B, 2:空, 3:B, 4:C, 5:D, 6:C | 1:B, 2:空, 3:B, 4:C, 5:D, 6:C |
| question 2 solution | empty — the whole block was lost | its own `详解` (137 characters, ending `故选：C`) |
| question 2 answer | empty (no block, so nothing to promote) | empty, with `missing_explicit_answer` and a warning that names `故选C` |
| question 3 option D | `-1` (never `-1-1`) | `-1`, unchanged |
| paid API calls / MathType launches | 0 / 0 | 0 / 0 |

Question 6 still carries `[[MTEF_UNRESOLVED. rId71]]` in option D and is still produced as a draft;
withholding it is item 2 of the handoff, not this round.

### 14.3 Regressions

| behaviour | inherited failure | test |
| --- | --- | --- |
| the `详解` behind an image-anchored marker is kept | `question 2 must keep the 详解 that follows its image-anchored marker, saw ""` | `tests/e2e/docx-support-active-anchor.test.js` |
| a `详解` conclusion never becomes the answer | `故选D must never be promoted to the answer, saw "D"` | `tests/e2e/docx-support-active-anchor.test.js` |

The fixture (`tests/fixtures/docx-support-anchor.js`) is the real group 1 shape in miniature: an
explicit answer, an empty `【答案】` whose `详解` ends in `故选：C` behind an anchored figure, and a
second empty `【答案】` with a plain marker so the no-promotion rule is proven on its own rather than
through the marker fix. The inherited run was produced by
`artifacts/audit-baseline/run-test-against-inherited-app.js`, which swaps in `git show HEAD:app.js`,
runs the file, restores the working copy and verifies the restore by hash.

### 14.4 Gates for this round

```text
npm test                    1338 tests, 1337 passed, 1 failed before the seal register was moved
                            (the seal entry is expected to fail until the change is committed)
npm run verify:safe         passed
npm run verify:docx-stable  passed
npm run verify:pdf-known-bad passed
npm run verify:batch-safety passed
```

## 16. Group 2 verified, two group 3 defects closed (2026-09-16, seventh pass)

Part of item 4 of section 5 in `docs/integration/HANDOFF_2026_09_16.md`: the remaining real groups are
being run through the real batch and compared with the original pages.

### 16.1 Group 2 (`完整版题目.docx` + `完整版答案.docx`): verified

```text
drafts        12, order 1..12, types 单选 1-6 / 多选 7-9 / 填空 10-12
answers       1B 2空 3B 4C 5D 6C 7ABD 8AC 9ABD 10 -19/13 11 6 12 (√2+1)/2
withheld      6 (option D = the unresolvable rId71) and 7 (stem = the unresolvable rId75)
pages         question pages 1-2 and answer pages 1-4 were rendered and looked at
```

Every stem, option set and solution matches the rendered page. Question 2's answer is empty because
the answer page prints `2【答案】` with no letter. The two withheld questions are correct behaviour,
and the pages show what the missing formulas are: question 6 option D is `1:27` and question 7's stem
is `已知复数 z，w 均不为 0`. The record is
`docs/integration/DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md`.

The same pass found that both values **are** present in the DOCX: the OLE objects (rId71 → 258 MTEF
bytes, rId75 → 216 bytes) extract fine but the reader reports `MTEF_EMPTY_EQUATION` and
`MTEF_UNREADABLE` (`Unterminated MTEF record list`). That is a reader gap, not a data gap, and it is
recorded below as the next capability task rather than guessed at.

### 16.2 Group 3 (`题目.docx` + `答案.docx`): two defects found and closed

| mechanism | evidence | fix |
| --- | --- | --- |
| a section header without a colon did not type its questions | the question file writes `一、单选题` / `二、多选题` / `三、填空题` as bare lines. The type rule required a colon, so questions 9-11 (answers BD, BD, BC) came out as 单选题/… and the fill-in questions as 解答题 | the header rule is anchored to a line and accepts a colon, an opening bracket **or** the line end, so `二、多选题` names its section; the whole header line is consumed so it cannot leak into a stem |
| an answer written without a label was dropped | the answer file writes `12．$…$` and `13．$…$` with no `【答案】` label, then `【分析】`/`【详解】`. The reader only accepted a bare A-D letter or a labelled value, so the answers of questions 12-14 arrived empty | the text before the solution label **is** the answer slot, so a short value there is taken as the file's own answer. The rule only fires when the block really has a solution label, so a label-less solution list can never turn its first line into an answer, and a block whose answer slot holds only a label (`2【答案】`) still yields an empty answer |

Measured on the real pair after the fix:

```text
types   9/10/11 = 多选题, 12/13/14 = 填空题   (before: 单选题 and 解答题)
answers 12 = √2/2, 13 = -49/16, 14 = (-∞,0)∪(0,1]   (before: all empty)
other   answers 1-11 unchanged, order 1..14, 14 drafts
```

Question 3 of group 1 (`2=空`), the withheld question of group 1 and the group 2 results were re-run
afterwards and are unchanged.

### 16.3 Regressions

| behaviour | inherited failure | test |
| --- | --- | --- |
| a colon-less section header types its questions | `the colon-less 多选题 header must still type question 2` (`单选题 !== 多选题`) | `tests/e2e/docx-header-and-answer-value.test.js` |
| an unlabelled answer value is kept | the same run also fails `an unlabelled answer value must be kept` | `tests/e2e/docx-header-and-answer-value.test.js` |

`app.js` grew by 22 lines for this round; the ceilings moved with it (22109 → 22131, and the
`app-shell-boundary` ceiling with it).

### 16.4 Still open

- The remaining groups of item 4 are covered in §17.
- Group 3's pages have not been looked at yet (that material ships no PDF and the local LibreOffice
  conversion timed out during this session), so group 3 is batch-verified but not visually verified.
- The reader gap above: `MTEF_EMPTY_EQUATION` / `MTEF_UNREADABLE` on real equations whose payload is
  present (rId71 and rId75 of group 2, and 13 more formulas in group 3). Until it is closed, those
  questions stay withheld, which is fail-closed but costs the teacher manual work.

## 17. The archive policy blocked seven real papers (2026-09-16, eighth pass)

### 17.1 The defect

Running the rest of item 4 showed that seven of the thirteen real DOCX files produced **zero drafts**
with no AI request at all: `高二.docx`, `题目+答案.docx`, all five exam papers
(`广东佛山市第一中学…`, `广东深圳高级中学…`, `广东省十二所重点中学校…`, `河北昌黎第一中学…`,
`湖北省武汉市…`) and, as it turned out, every file written by the same exporter.

The cause is in the archive policy: Word and those exporters write the standard OOXML
`customXml/item1.xml`, `customXml/itemProps1.xml` and `customXml/_rels/item1.xml.rels` parts, and
`office-document`'s entry allow-list only knew `[Content_Types].xml`, `_rels/.rels` and
`word|xl|docProps/…`. The whole document was therefore rejected (`ARCHIVE_ENTRY_NOT_ALLOWED`), the
text layer came back empty, the DOCX importer had the same rejection, and the batch ended in
`识别流程最终没有生成题目` after 85 ms.

Evidence: a scan of the real files' zip entries (431-1288 entries each, all within the 5000 entry
ceiling) found the three `customXml` parts in exactly the seven files that failed; the batch log of
`高二.docx` showed `questionItems=0, fullItems=0, answerItems=0, solutionItems=0` and
`totalDurationMs=83`.

### 17.2 The fix

`qisi-archive-security.js` `office-document` now allows `customXml/…` (xml, rels, bin, txt). Nothing
else moved: traversal, nested archives, the entry-count ceiling, the size ceilings and the
compression-ratio ceiling are untouched, and the new `ARCHIVE_PATH_TRAVERSAL` /
`ARCHIVE_NESTED_ARCHIVE` / `ARCHIVE_ENTRY_NOT_ALLOWED` cases are asserted again in
`tests/archive-security.test.js` so the allowance cannot widen the other rules.

### 17.3 Measured result

```text
file                                   status   drafts  answers  withheld
高二.docx (full)                        review   51      0        5
河北昌黎第一中学…数学试卷.docx           review   19      19       4
广东佛山市第一中学…数学试题.docx         review   19      19       7
广东深圳高级中学…数学试卷 (1).docx       review   19      18       4
广东省十二所重点中学校…数学试题.docx     review   19      18       10
湖北省武汉市…数学试题.docx               review   19      18       5
题目+答案.docx                          review   14      14       4
```

Every one of these produced 0 drafts before the fix. The questions, types and options now come from
the papers themselves; the `withheld` questions are the MTEF reader gap of §16.1 (up to 16
unresolved formulas in one question of 佛山一模).

### 17.4 Findings that are not fixed here

- `高二.docx` gives 51 questions and **no answers**: its answer key is written several answers per
  line (`34．6 35．… 36．45 …`), and the answer marker rule requires a line start. Reading that shape
  safely (an answer key is the one place where a mid-line marker really is a marker) is its own task
  with its own regressions - it must never attach an answer to the wrong question.
- `2026年7月9日高中数学作业.docx`, which the handoff lists for this item, is **not in the materials
  folder** (`题目与答案`). The only similarly named file on disk is a 2025 paper from another folder.
  It has to be located by the owner or dropped from the list.
- The exam papers have not been compared page by page yet; only the batch-level survey above is
  recorded, so nothing of theirs is marked `VISUALLY_VERIFIED_*`.

## 18. Two class-level rules: later MTEF sections, and answer-key streams (2026-09-16, ninth pass)

Both fixes here were derived from the *shape* of the data, not from one file: the corpus of 1048 real
OLE equations under `artifacts/` was used to prove that the change moves only what it should.

### 18.1 MTEF: an empty section is not an empty equation

`parseMtef` stopped at the first terminator, so a stream that carries its content in a *later* section
was reported as `MTEF_EMPTY_EQUATION` even though the bytes were present. The rule is now: if the
first section produced no content, skip the terminators and read on; the extra section is used only
when the first one was empty, so an equation that already resolved can never change, and a section
that fails to walk still leaves the object unresolved.

Proof, corpus-wide (`artifacts/audit-baseline/mtef-corpus-scan.js` over all 1048 real streams):

```text
before sha256 0b5b45887dafa72668354360bdfaabe474d87aca6410122a383ef16e8893197b
after  sha256 2505f445de9f62559f3fbf1d2e97f63d3486e3c69c1dd99e4aa14004914af626
diff: exactly 3 lines, all the same equation in three copies of the file
      1:27  (简略版题目（只有一页）.docx / 完整版题目.docx option D of question 6)
      unresolved MTEF_EMPTY_EQUATION  ->  extracted reconstruction "1:27"
```

1045 of 1048 results are byte-identical, and the three that changed match the value on the page
(`1:27`, verified visually in the group 1/2 ground truth). On the real group 2 pair this removes the
withheld question: question 6 now has `$1:27$` in option D and is no longer withheld (withheld 2 → 1;
question 7 still carries the unresolvable `rId75`).

The remaining 20 `MTEF_UNREADABLE` streams are a *different* class and are deliberately not patched:
the record walk desynchronises inside their row section (traced byte by byte for `rId75`: the walk
reads a nested LINE/CHAR/FUTURE sequence where the content sits), so they need the row-layout work
described in §16.1, not another special case.

### 18.2 Answer key: a stream of entries, located by its heading

`高二.docx` writes its key as `1．2 2．3 3．2 …` with several answers per line, wrapped lines whose
*first* fragment is the previous entry's value, and (in one place) a lost marker. A line-shaped rule
cannot read that. The rule now lives in `qisi-utils.js` as `extractInlineAnswerKey`:

- the key starts at a heading line that is `答案` / `参考答案` (optionally with a short title in front,
  e.g. `高二答案`), so question text is never read as a key;
- the key is read as one sequence: each `number` + separator starts an entry that runs to the next
  marker, the fragment before the first marker belongs to no question;
- a value must be non-empty, at most 80 characters and on **one** line - a value that would continue
  on the next line is dropped instead of swallowing an orphan fragment whose marker the file lost, so
  no answer is ever attached to the wrong question;
- an unusable entry is skipped; its neighbours keep their own values.

Measured on `高二.docx`: answers 0 → 43 of 51 drafts (question 6 stays empty because its marker is
missing from the key text), 5 questions still withheld, batch still `review` with no contract failure.
Groups 1, 2 and the exam papers are unchanged (their keys use the labelled `【答案】` form).

### 18.3 Regressions

| behaviour | test |
| --- | --- |
| content in a later MTEF section is read; an empty stream stays unresolved | `tests/docx-mtef-reader.test.js` |
| the corpus-wide comparison above | `artifacts/audit-baseline/mtef-corpus-scan.js` (local evidence) |
| a key stream with several entries per line, wrapped lines and a heading | `tests/qisi-utils-inline-answer-key.test.js` |

`app.js` grew by 6 lines (the key stream is read in one call); the two bloat ceilings moved with it.

## 19. Image ownership at the question marker (2026-09-16, tenth pass)

The DOCX question splitter accepted an image token in front of a question marker (so questions whose
marker sits behind their own figure are found at all), but the block content started *after* the
marker, so that figure was silently dropped from the block: `完整版题目.docx` questions 8 and 11 kept
their token in the extracted text and lost it in the draft.

The rule is now structural, not positional:

- a token **on the same line, in front of the marker** is mechanically part of *that* question, so the
  marker carries it (as `leadingMedia`) into the block it opens;
- a token on its own line before the next number is **not** moved: it stays in the preceding block and
  is never guessed onto the following question;
- the marker's leading-token scan uses `[ \t\u3000]` rather than `\s`, so it can never reach across a
  line break and take the previous question's figure;
- `IMAGE_UNRESOLVED` (a Word WMF/EMF figure the browser cannot display) is recognised by the same
  rule, so a vector figure is carried as explicit evidence instead of disappearing.

Regressions: `tests/qisi-utils-question-evidence-scope.test.js` (same-line token stays with its own
question; a standalone token above the next number stays with the previous question) and
`tests/e2e/docx-question-scope.test.js` through the real importer (question 3's stem keeps its token,
question 2's stem must not receive it).

## 20. Takeover audit and final DOCX matrix at `34d618c` (2026-09-16, eleventh pass)

### 20.1 Work preserved and pushed

The working copy held three unpushed commits plus an uncommitted image-ownership fix. The uncommitted
diff was saved to `artifacts/audit-baseline/ds-takeover-working-tree.patch` (local evidence), audited,
tested and committed, and `4ced38e..34d618c` was pushed. Nothing was reset, cleaned, stashed or
checked out; `artifacts/` was never staged.

```text
34d618c keep a figure token with the question whose marker it precedes   (this pass)
7c363e3 stage ingestion inspect PDF evidence and retain unresolved pages for review
20bd59b stage ingestion make DOCX deterministic and preserve numbered evidence
```

### 20.2 DOCX matrix, all groups re-run at this one HEAD (zero AI requests)

`node artifacts/audit-baseline/astra-run-docx-matrix.cjs` → `artifacts/audit-baseline/astra-docx-final-matrix-34d618c.log`

| group | material | status | drafts | answers | withheld | AI calls | elapsed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | 简略版题目 + 完整版答案 | review | 6 | 5 | 0 | 0 | ~2 s |
| G2 | 完整版题目 + 完整版答案 | review | 12 | 11 | 1 | 0 | 3.1 s |
| G3 | 题目 + 答案 | review | 14 | 14 | 4 | 0 | ~3 s |
| G4 | 周二晚测 | review | 12 | 0 | 0 | 0 | ~2 s |
| G5 | 高二 | review | 56 | 54 | 5 | 0 | 4.6 s |
| G6 | 题目+答案 | review | 14 | 14 | 4 | 0 | ~3 s |
| G7–G11 | 五份高三试卷 | review | 19 each | 19 / 19 / 18 / 0 / 18 | 8 / 4 / 10 / 2 / 4 | 0 | 3–5 s each |

Every withheld question is withheld for an unresolved MathType formula in its own field (the
`MTEF_UNREADABLE` class of §18.1); the DOCX path issues no model request at all.

### 20.3 Image ownership verified on real material

`完整版题目.docx` after the fix: question 8's stem now begins with its own token
(`[[IMAGE:…]] 如图，一块半径为4的圆形铁片…`), and questions 4 and 11 carry theirs as well; no other
question's stem received a token. Before the fix the same two tokens were missing from the drafts.

### 20.4 PDF module state (audited, not re-implemented)

```text
main.html:1555-1558  qisi-ingestion-context.js, qisi-docx-ingestion.js,
                     qisi-pdf-inspection.js, qisi-pdf-ingestion.js
app.js:4274,4421     IngestionContext.getDocx (shared extraction context)
app.js:16831,16862   DocxIngestion.ingest / PdfIngestion.ingest
app.js:18080         DocxIngestion.markImageGaps
tests                pdf-ingestion.test.js, e2e/pdf-inspection-import.test.js (both pass)
docs/integration     PDF_INSPECTION_STAGE_2026_09_16.md, INGESTION_AUDIT_PLAN_2026_09_16.md
```

The PDF work is therefore already integrated, as the handoff's "latest entry" said. No paid visual
call has been made in this session, and none is made by the test suite.

### 20.5 Still open

- Per-question visual ground truth for the DOCX groups beyond 1–3 (the renders exist locally under
  `artifacts/audit-baseline/rendered*`), and the PDF real-material zero-cost run plus the per-region
  list of what would need paid vision.
- The 20 `MTEF_UNREADABLE` streams (§18.1) keep their questions withheld.

## 21. The answer key is not 解析 prose, and the PDF facts (2026-09-16, twelfth pass)

### 21.1 Fixed: a key line reached a solution field

`高二.docx` question 49's solution held `$\left(-3,0\right)$ 49．9 50． $3x-y=0$ 51． $4\sqrt{2}\pi$` —
another question's key line. The answer key was being read as ordinary document prose, so the key
stream reached the solution parser.

Rule now, in `qisi-utils.js`:

- the key section is split off first (`splitTextAtAnswerKeyHeading`) and only the key reader sees it,
  so the solution parser only ever sees document prose;
- a heading only counts when the section after it really *is* a bare key: at least two
  `number separator value` entries and no `【…】` label. A document whose 解析 section happens to start
  with the word 答案 therefore keeps all of its labelled content (the first, looser version of this
  rule cost six groups 3–8 answers each and was caught by the matrix, not by review);
- a number the key gives twice with two different values attaches **no** answer at all instead of
  letting the longer value win.

Real material after the fix: `高二.docx` q48 and q49 have an empty answer **and** an empty solution,
q47/q50 keep theirs, 56 drafts, 54 answers, 5 withheld, zero AI requests; the whole G1–G11 matrix is
back at its previous values in one run.

### 21.2 PDF zero-cost facts (inspection only, no paid call)

`artifacts/audit-baseline/astra-pdf-inspection.json` (Astra's inspector, re-read this pass):

| file | pages | page kind | reason | text chars | images | vector ops |
| --- | --- | --- | --- | --- | --- | --- |
| 完整版答案.pdf | 4 | mixed ×4 | unmapped-glyphs | 4556 | 3 | 379 |
| 完整版题目.pdf | 2 | mixed ×2 | unmapped-glyphs | 1900 | 3 | 83 |
| 简略版题目（只有一页）.pdf | 1 | mixed ×1 | unmapped-glyphs | 1004 | 1 | 22 |

Every page is `mixed`, not scanned: the Chinese prose and the layout are in the text layer, while the
mathematics uses a Symbol font whose glyphs do not map, so the text layer cannot be trusted for
formulas. That is the shape the ingestion is designed for (text + geometry + anchors, vision only for
the regions that need it), and it means any paid visual pass would be sized by region, not by page:
7 real pages in total carry 22 + 83 + 379 vector operations, and the unmapped-glyph spans are the
candidates. No paid call has been made; a cost proposal (model, call count, expected RMB, and why the
deterministic path cannot finish the job) is still owed before any such call.

## 15. Group 1 closed: the withheld question (2026-09-16, sixth pass)

This closes item 2 of section 5 in `docs/integration/HANDOFF_2026_09_16.md`.

### 15.1 What was wrong

Question 6 of `简略版题目（只有一页）.docx` has a MathType equation the reader cannot resolve
(`rId71`, in option D). §12.2 rule 6 promises that such a question is withheld instead of being
offered as a complete draft, but three things were missing:

| mechanism | evidence | fix |
| --- | --- | --- |
| nobody looked for the unresolved token | the token reached the draft as ordinary option text; `draftQuestionProblems` could not see it, and `app.js` only checked the token on the docx-importer path | `Qisi.DocxPipeline.collectUnresolvedFormulaFields()` reports which formal field still carries a token; the draft is marked `withheld: true`, `withheldReason: 'unresolved-formula'`, gets the `unresolved_formula` merge warning and a warning naming the formula |
| nothing blocked admission | the option value is not empty, so the admission policy saw a value | the affected field's provenance is `{ status: 'rejected', reasonCode: 'unresolved-formula' }`, the same rule the candidate-conflict path uses: `admission-field-rejected` blocks the question, and a teacher's own edit of that field replaces the provenance with `manual` and releases it |
| the token itself was rewritten | the option-label normalizer matched the "D:" at the end of `UNRESOLVED:` and rewrote it into "D. ", so the stored option was `[[MTEF_UNRESOLVED. rId71]]` and the collector could not recognise it | the label rule now requires a standalone letter (`(?<![A-Za-z])([A-D])…`) in all four places that rewrite option labels (`qisi-utils.js` stem splitter, both `app.js` option readers, the pipeline's own option-evidence normalizer). The collector still accepts the mangled form so an older draft is not silently trusted |

### 15.2 Measured result on group 1

`node artifacts/audit-baseline/docx-batch-acceptance.js --id G1 …` (local evidence, not committed):

```text
order        1..6 (the draft order field, not the storage row order)
answers      1=B  2=空  3=B  4=C  5=D  6=C
question 2   详解 kept, answer empty, missing_explicit_answer + warning naming 故选C
question 3   option D = -1, still never -1-1
question 6   withheld: true, reason unresolved-formula, options provenance rejected,
             option D = [[MTEF_UNRESOLVED:rId71]] (its own token, no longer rewritten),
             warning 本题有 1 个公式未能从 DOCX 中读出（rId71），已暂缓入库
other five   unchanged — one bad formula withholds its own question only
```

### 15.3 Regressions

| behaviour | inherited failure | test |
| --- | --- | --- |
| a question with an unreadable formula is withheld | `the question must be withheld` (`false !== true`); the inherited run also stored the mangled token | `tests/e2e/docx-unresolved-formula-withheld.test.js` |
| the collector still recognises a token a display cleaner already mangled | not expressible before | `tests/docx-mtef-pipeline.test.js` |
| the option-label rule cannot rewrite the token | not expressible before | `tests/docx-mtef-pipeline.test.js` |

The `app.js` bloat ceilings moved by exactly this round's growth (22070 → 22109 lines in
`tests/code-quality-boundaries.test.js`, 22078 → 22117 in `tests/app-shell-boundary.test.js`); the
`processDraftImportBatch` region is unchanged at 5362. The detection and the field mapping live in
`qisi-docx-pipeline.js`, so `app.js` only carries the warning text and the provenance entry.

### 15.4 Gates for this round

```text
npm test                    1341 tests, 1338 passed, 3 failed before the seal register and the two
                            bloat ceilings were moved (all three are expected to fail until the
                            change is committed)
npm run verify:safe         passed after the commit
npm run verify:docx-stable  passed
npm run verify:pdf-known-bad passed
npm run verify:batch-safety passed
```
# 2026-09-16 continuous ingestion audit (owner authorized)

See `INGESTION_AUDIT_PLAN_2026_09_16.md` for the independent baseline and scope. `app.js` now
delegates ordinary DOCX ingestion to a deterministic module, sharing a single archive context,
and no longer runs order-based or AI index-based support repair. Automatic Word numbering is
resolved from numbering.xml; ambiguous pictures and MTEF structures stay visible and withheld.
The seal regression now hashes the actual working file, so exact reviewed content can pass the
gate BEFORE a commit and uncommitted unauthorized edits cannot hide behind HEAD. No ceiling is
raised. Original materials and local evidence remain untracked; main and real data are untouched.

## 22. The takeover round: the conflict fixture, and what the MTEF failures really are
  (2026-09-16, thirteenth pass)

This is steps 3 and 4 of section 8 of `HANDOFF_DOCX_PDF_TAKEOVER_2026_09_16.md`, at
`615b7a5` → `abe0d12`. Step 2 was re-run first: the G1–G11 matrix reproduced section 3 of the
handoff exactly (all `review`, 6/12/14/12/56/14/19/19/19/19/19 drafts, withheld
0/1/4/0/5/4/8/4/10/4/2, AI requests 0, `blockedAi` 0), and the PDF inspection reproduced the same
three `mixed`/`unmapped-glyphs` files with the same page counts.

### 22.1 The answer-region conflict now has a stable fixture (`f4558cc`)

The conflict path had only real-material proof (高二.docx question 49). The shape the gate needs is a
*duplicate key marker*, so the fixture is that shape and not an easier one:

```text
question file   three single-choice questions
answer file     1【答案】B   3【答案】D   参考答案   2． $\left(-3,0\right)$ 2．9
```

`tests/fixtures/docx-answer-key-conflict.js` + `tests/e2e/docx-answer-key-conflict.test.js` run that
pair through the real batch path and assert, on the draft record *and* on the rendered review card
(`.batch-problem-card`): question 2's answer is empty, the notice names both values, and
`mergeWarnings` carries `answerConflict`; questions 1 and 3 keep `B` and `D`.

Sensitivity was checked, not assumed: the same fixture with a single-valued key (`2．9 4．1`) attaches
`9` to question 2 and shows no notice, so the test really distinguishes the two shapes.

### 22.2 The MTEF failures are not one class, and the biggest class was not a walk desync (`abe0d12`)

Section 5.2 of the handoff expected the 21 unresolved streams to be a row-zone (LINE/CHAR) walk
problem traced from `rId75`. Traced over the whole corpus, that is not what the data says: the walk
itself is fine in 11 of them, and the reader was rejecting a *readable* record.

| class | streams | reader's actual failure |
| --- | --- | --- |
| a coloured accent inside the character's modifier list | 11 | the list was read as "embellishment records only"; MathType writes the accent's COLOR record first, so the reader threw on the colour |
| accent code 5 | 3 | an accent code the reader does not know |
| unknown record type 48 | 2 | the walk stops on it |
| a type-104 record whose payload runs to the end of the stream | 2 | `Unterminated MTEF record list` |
| a private-use character (U+EF02) | 1 | fail-closed by design (no glyph guess) |
| a truncated record | 1 | the bytes end mid-record |
| an unsupported structure | 1 | reported `MTEF_UNSUPPORTED_STRUCTURE` |

The fixed rule is about the *modifier list*, not about one equation: a colour carries no content and
is skipped, an accent is applied, anything else — and any accent code the reader does not know — still
fails closed. Measured with `mtef-corpus-scan.js` over all 1048 real streams:

```text
before  extracted 1027  unresolved 21
after   extracted 1038  unresolved 10
diff    exactly 11 lines, every one unresolved -> extracted, every one a coherent formula:
        \vec{a}   \vec{b}   \vec{a}·\vec{b}=3   |\vec{a}|=3,|\vec{b}|=2
        \frac{\vec{a}}{3}-\frac{\vec{b}}{2}=(\frac{3}{5},\frac{4}{5})
        \left|\vec{a}-\vec{b}\right|=\sqrt{(\vec{a}-\vec{b})^{2}}=\sqrt{7}
        \left(\lambda \vec{a}-\vec{b}\right)⊥\vec{b}          (高二.docx, a vector question)
1037 of 1048 results are byte-identical.
```

The 11 recovered equations sit in the vector questions of 题目.docx / 答案.docx and in a vector
question of 高二.docx, which is what their neighbours are about. On the real G1–G11 matrix the
withheld questions fall and nothing else moves:

```text
            G2 G3 G4 G5 G6 G7 G8 G9 G10 G11   total
before §22  1  4  0  5  4  8  4 10   4   2      41
after 22.2  1  3  0  4  3  6  4  9   4   2      36
after 22.4  1  3  1  4  3  6  4  9   4   2      37
```

Answer counts, draft counts, batch statuses and the zero-AI-request property are unchanged.
`tests/docx-mtef-reader.test.js` carries the rule (a colour does not hide its accent; an unknown
accent or an unknown modifier still resolves to `unresolved`), so the fail-closed half is locked too.

### 22.3 Still open (deliberately)

- The streams left unresolved after §22.2 are listed above with their own cause each (ten of them, and
  one more after the guard of §22.4). Recovering the type-104 payload or the type-48 record would mean
  reading bytes whose meaning is not established by any other stream in the corpus (the two type-104
  payloads are not even the same shape), so they stay fail-closed rather than guessed. `rId75`
  (question 7 of `完整版题目.docx`) is one of them.
- Section 5.3 (per-question visual ground truth for G4–G11, see §22.4 for groups 3 and 4) is the
  next step.

## 23. The branch could not open the teacher's question bank at all (2026-09-16, fourteenth pass)

Opening the app from this branch produced, in the browser:

```text
题库数据加载失败：VersionError The requested version (80) is less than the existing version (90).
```

This is not a code defect in the app: Dexie encodes its decimal schema versions as integers, so the
message says "the page declares version 8, the bank on this origin is version 9", and IndexedDB
refuses to open a bank at a *lower* version than the one it already has. Version 9 is declared by
`codex/app-refactor-master-plan-r1` (`c59e4cb stage H2 add handout domain repository`), which adds
three stores to the version-8 schema:

```text
handouts:          id, title, status, createdAt, updatedAt
handoutAssets:     id, handoutId, sourceQuestionId, sourceImageId, createdAt
handoutRevisions:  id, handoutId, revision, createdAt
```

The teacher's browser (127.0.0.1:3000, Edge profile) was upgraded to 9 by a run of that build on
2026-09-15, so **every** build that stops at 8 — this branch and the `Desktop\题库系统` copy alike —
could not open the bank afterwards. The failure was fail-closed (nothing was written), but it made the
app unusable, which is why it is treated as an integration blocker rather than a cosmetic error.

### 23.1 Fix: declare the same version 9, store for store

`qisi-db.js` now declares `db.version(9).stores({...})` with the **identical** fourteen stores of the
declaration that created the bank, including the three the handout line uses and this line does not
yet. Two consequences, both deliberate:

- opening an existing bank of version 9 performs **no upgrade at all** (same version, same schema), so
  nothing is migrated, renamed or deleted, and the three stores keep whatever they hold;
- a bank created by this build is byte-for-byte the schema the handout build expects, so the two lines
  can keep sharing one profile instead of forking the teacher's data.

`main.html` bumps the script cache-buster for that module (`?v=foundation-01` → `?v=schema-v9-01`) so a
plain refresh really picks the new file up.

### 23.2 Proof

`artifacts/audit-baseline/probe-live-v9-bank.cjs` (local evidence, never committed) builds the bank at
version 9 from a hand-written copy of the handout declaration — not from the code under test — puts one
row in it, and then loads the app from the running server in that same browser profile:

```text
phase 1 (bank created at version 9): 14 tables including handouts/handoutAssets/handoutRevisions
phase 2 (app opened the version-9 bank): appBooted true, probe row survived, dialogs []
RESULT: OK
```

`npm run verify:safe` passes at 1368/1368 with the schema change in place.

## 24. The six defects the teacher found in 周二晚测.docx (2026-09-16, fifteenth pass)

The teacher reviewed the imported 周二晚测.docx in the review page and reported six concrete defects.
They are fixed one by one, each with its own evidence, because they belong to different owners.

### 24.1 A vector accent must cover its whole base (`c249e1b`)

Question 3's options render as `\vec{BC}`, and the arrow covered the first letter only. The equation is
not one character: MathType writes it as its *vector template* (selector 31) whose slot holds the whole
base ("BC", "DM", "ABA"), and `\vec` is a fixed-width accent while `\overrightarrow` stretches over
its content. The reader now writes a base wider than one atom as `\overrightarrow` and keeps `\vec`
for a single letter (corpus: 61 streams change, all of them exactly this accent, no status changes).

### 24.2 A Word superscript became a plainly wrong formula (this commit)

The page of question 10 reads `z₁` and `m²`; the draft read `z1` and `m2`. The exponent is not a
MathType object at all - the DOCX writes it as an ordinary run carrying
`<w:vertAlign w:val="superscript"/>` - and the shared extraction layer read `<w:t>` only, so the
formatting was flattened. The fix stays inside that one layer (`extractDocxTextWithMath` in
`app.js`), and adds no second reader:

- `markWordScriptRuns` marks an aligned run while the paragraph is still XML;
- `attachWordScriptsAsInlineMath` turns the marker into inline LaTeX together with the run of formula
  characters around it ("z" + sup "1" inside `z1=m+(4-m2)i(m` becomes `$z_{1}=m+(4-m^{2})i(m$`), so
  neighbouring scripts are merged into one span instead of being wrapped twice;
- a run too short to be a formula is left as plain text, a marker that never reached a base is dropped,
  and an inline run that lands flush against an existing `$…$` segment is merged instead of leaving
  `$$` (the latter also had to be handled in `normalizeMathTextForLatex`, which is the same layer).

Baseline before the change (`artifacts/audit-baseline/probe-vertalign-baseline.cjs`): only
`周二晚测.docx` uses aligned runs in the whole real-material set - **5 runs, all of them
"letter + one digit"** (`z₁`, `m²`, `z₂`, `z₁`, `z₂`), so the blast radius is exactly that document.
After the change: question 10's stem reads

```text
已知复数$z_{1}=m+(4-m^{2})i(m\in$ R)，$z_{2}=2cos$ θ+(λ+3sinθ)i(λ，θ$\in$ R）并且$z_{1}=z_{2}$，则λ的取值范围为_____.
```

and the G1–G11 matrix is unchanged (same draft counts, same answers, same 37 withheld), i.e. no other
material and no plain number was promoted to an exponent. The remaining plain letters of that stem are
the teacher's own unformatted Word text (no superscript, no MathType object); wrapping those would need
a formula-extent guess, which is deliberately not done here.

### 24.3 A figure above its question, and a figure on the wrong question (this commit)

Two of the teacher's reports are one mechanism. Word anchors a floating figure in a paragraph of its
own, and `extractDocxTextWithMath` writes its token where that anchor sits, so a figure can arrive as a
token at the *head* of the following question's stem:

```text
[[IMAGE:dimg_…]] 11. 在正方体 $ABCD-A_{1}B_{1}C_{1}D_{1}$ 中，…         (question 11, no 如图)
12.如图，已知 $OPQ$ 是半径为1，圆心角为 \frac{\pi}{3} 的扇形，…          (question 12, 如图)
```

Question 11's own text never mentions a figure; question 12 *begins* with 如图 and its page shows the
扇形 OPQ drawing beside it - but the token was attached to 11, so 12 showed no figure and 11 showed a
figure that is not its own. The same shape put 梯形 $ABCD$'s figure above question 9's text.

The rule lives in `qisi-review-draft-state.js` (`relocateFigureTokensForReview`) and app.js only calls
it, once, **before** the existing DOCX image binding (the binding follows the token, so the order is
what makes the ownership land in the right place). It is deliberately narrow, because moving a figure
is the wrong-content risk this project refuses:

- only a token that *leads* its stem is considered - that is the anchored shape;
- a token is handed to the next question only when all three hold: the owning question's own text has
  no figure cue at all, the next question's text *begins* with 如图/见图/下图/图中, and the next
  question has no figure yet;
- every other leading token simply moves from the head of its stem to the end, so a figure never sits
  above its own question text (that is the teacher's "图会在题目上方" report).

Measured on the real G1–G11 matrix:

```text
group  drafts      images      stems that lead with a token   withheld
G1     6 -> 6      1 -> 1      [] -> []                       0
G2    12 -> 12     3 -> 3      [8, 11] -> []                  1
G3    14 -> 14     0 -> 0      [] -> []                       3
G4    12 -> 12     3 -> 3      [] -> []                       1     (q11 -> q12 inside this group)
G5    56 -> 56     1 -> 1      [] -> []                       4
G6    14 -> 14     1 -> 1      [] -> []                       3
G7    19 -> 19     5 -> 5      [] -> []                       6
G8    19 -> 19     7 -> 7      [] -> []                       4
G9    19 -> 19     2 -> 2      [] -> []                       9
G10   19 -> 19     6 -> 6      [] -> []                       4
G11   19 -> 19     2 -> 2      [] -> []                       2
```

No group's figure *count* changed, so no figure moved to a different question anywhere except the one
the teacher reported; the only other change is that G2's questions 8 and 11 no longer show their own
figures above their text. `tests/review-draft-state.test.js` locks all three behaviours (hand-over,
keep-but-move, and "a question without a cue never receives a figure").

### 24.4 Options written as formulas stayed glued inside the stem (this commit)

The teacher's second report was the opposite problem: the options of 周二晚测 question 4 ran together on
one line. They were never *in* the option list - the paper writes them as maths whose label is inside
the formula:

```text
4. 在 $ΔABC$ 中，…则 $C$ 的大小为（ ）.
$A.\frac{\pi }{4}$ $B.\frac{\pi }{3}$ $C.\frac{2\pi }{3}$ $D.\frac{3\pi }{4}$
```

Every splitter in the product looks for a plain "A." as text, so all four stayed in the stem, the
question was typed 解答题, and the review preview showed one long line. `qisi-utils.js` now has
`extractFormulaLabelledOptions`: a run of two or more label-led maths segments, labels ascending and
starting at A, with nothing but whitespace between them, becomes the options. It is applied in
`parseQuestionItemsFromText` **only** when the question has no options at all, so a question that
already has an option list can never be restructured by it.

Real material after the change: question 4 and question 6 each get their four options back and are
typed 单选题 (they had been 解答题 with the options inside the stem). G1–G11 otherwise unchanged
(options per group, choice-typed counts, draft counts and the 37 withheld are identical before and
after). Locked by `tests/qisi-utils-formula-labelled-options.test.js`, which also pins the three
negative shapes (starting at B, out of order, interrupted) and an ordinary option list.

Not fixed by this rule, and reported as such: question 9's options are a *mixed* shape - its 梯形 stem
line keeps the maths of option A with the "A." label missing, and C's label is missing too, while B
and D keep theirs (lines 39-42 of the extracted text). That is the older "option label inside a formula
is dropped" defect of the text layer, not this one.

### 24.5 `[[MTEF_UNRESOLVED:rId99]]` is gone: the braced rows were right there (this commit)

The token was the fail-closed half of §22.4: before that guard the same equation was reported as
`MTEF_RECONSTRUCTED_OK` and the draft silently read `$f\left(x\right)=\left\{\right.$` - a piecewise
definition with both of its rows gone. The bytes
(`docx-raw/zhou2/q/word/embeddings/oleObject51.bin`) show why: the two rows live in a PILE record
*inside* the brace template, so the template's own slot list is empty while the template carried
content. The rows were therefore never lost - the reader simply refused to put them anywhere.

The fence templates now fall back to the pile they carry, and the braced structure renders as what the
page shows:

```text
已知函数 $f\left(x\right)=\left\{\begin{matrix}x^{2}+2x-3,x\le 0\\-2+lnx,x>0\end{matrix}\right.$，令 $h(x)=f(x)-k$，则下列说法正确的是（ ）
```

The exponent is right (`x^{2}`, the page's 二次项), the second row matches the page, and KaTeX renders
the expression (checked in the browser's own KaTeX). Corpus-wide exactly one stream changes - this one,
from `unresolved` back to `extracted` - and on the matrix 周二晚测 loses its only withheld question
(G4: 1 → 0, total 37 → 36). The empty-shell guard still holds for a template that has neither a slot
nor a pile, which is what `tests/docx-mtef-reader.test.js` now pins.

### 24.6 Every letter that means a symbol is now inline LaTeX (this commit)

The teacher's follow-up was that item 5 was not thorough: after the Word superscript fix, the *body
font* letters were still there - `sinθ`, `λ`, `a，b，c`, `ABD`, `PBC`, `PABCD` in 周二晚测, and the same
shapes in other papers. One rule now decides this, and it is one pure function rather than a document
patch: `Qisi.Utils.promoteMathRuns`.

```text
* a run is a maximal sequence of maths characters: Latin letters, digits, Greek letters, LaTeX
  commands and maths symbols, with an inner space kept inside the run ("2cos θ" is one formula);
* a run is maths when it holds a letter, or a digit beside an operator;
* an option label ("A." / "B、"), a bare year ("2026年") and an answer blank ("_____") stay text -
  the first belongs to the option reader, the last two are not formulas;
* [[IMAGE:…]] / [[MTEF_UNRESOLVED:…]] tokens and text that is already inside $…$ are never touched;
* inside a run the standard function names become their upright form (sin, cos, log, ln, ...), and
  fullwidth signs are normalised ("AP＝1" becomes $AP=1$).
```

It is wired into the *existing* field normaliser (`normalizeMathTextForLatex`), where it **replaced**
the narrower maths pattern together with the protect/restore machinery: that machinery existed only to
keep the narrower rule out of existing `$…$` segments, and the new rule handles segments itself, so the
same layer got smaller and there is exactly one place that decides what is maths in a field. Nothing
was added to the parser, the review model or the stores.

One defect the change exposed and fixed: a field that a split left with an odd number of `$$` (佛山一模
question 10, 武汉四调 question 18) was repaired by `Qisi.Utils.repairMathDelimiters`, which pairs the
broken delimiter and leaves a real display pair alone.

Real material after the change (G1–G11, same day):

```text
q2  已知函数 $f(x)=2^{x}+x,g(x)=log_{2}x+x,h(x)=x^{3}+x$ 的零点分别为$a$，$b$，$c$，则$a$，$b$，$c$的大小顺序为（ ）
q6  如图，四棱锥$P$-$ABCD$中，底面$ABCD$为矩形，$PA⊥$平面$ABCD$，$E$为$PD$的中点，设$AP=1$，$AD=$ $\sqrt{3}$…
q10 已知复数$z_{1}=m+(4-m^{2})i(m\in R)$，$z_{2}=2cos$ $θ+(λ+3\sin θ)i(λ$，$θ\in R$）…
q12 如图，已知 $OPQ$ 是半径为1，圆心角为 $\frac{\pi }{3}$ 的扇形，$C$是扇形弧上的动点， $ABCD$ 是扇形的内接矩形.记 $\angle POC=α$，
```

Draft counts, answer counts and the 36 withheld questions are unchanged in all eleven groups, and no
field contains a broken `$$` any more. Locked by `tests/qisi-utils-promote-math-runs.test.js`.

## 25. The visual-ground-truth round: a wrongly attached answer, and its fix

### 25.1 What the page-by-page pass has produced so far

The remaining originals were rendered (G5 22 pages, G6 11, G7–G11 12 each) and two new cheap checks
were built, both recorded in `DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md`:

```text
* the paper's own answer table is read out of the *rendered* page text, so every answer can be checked
  question by question without opening images;
* a draft-versus-rendered-text cross-check points at pages worth looking at (it is documented as *not*
  evidence: a maths text layer splits formulas into glyph runs).
```

Results: 高二 54/54, 题目+答案 11/11, 佛山一模 11/11, 深圳高级中学 11/11, 河北昌黎 11/11 answers match
the papers' own keys; 佛山一模 questions 1–6 and 16–17 were also looked at on the page. An earlier
claim in that file - that 佛山一模 question 3 held a wrong answer - was my misreading of a draft dump; it
was withdrawn in the same file and the question's real defect (0 of 4 options) recorded instead.

### 25.2 The one wrong answer, and the two rules that produced it (this commit)

十二校一模 question 2 held `$P$` while the paper's key says D. Traced to the byte level of the text
layer: the probability table of question 17 contributes the cells

```text
315: "${X}$"  316: "0"  317: "1"  318: "2"  319: "$P$"  320: "$\\frac{2}{5}$" …
```

and two *existing* rules turned that into an answer for question 2 - the index-based guess this project
forbids:

```text
* parseInlineAnswerSolutionBlocks accepted a bare number as a question marker. "2" therefore started a
  block, its first line "$P$" was read as the "answer slot before the 详解 label", and the symbol became
  question 2's answer. A marker must now be "2．" / "2、" / "第2题" / "2【答案】": a bare number is a
  table cell and starts nothing.
* shouldMatchByOrder attached support items to questions by position whenever *either* side looked
  un-numbered. It now requires *both* sides to be un-numbered - the only case where order carries
  identity - so a numbered question list can never receive positional answers again.
```

Measured on the real matrix: 十二校一模 question 2 reads **D** (the paper's own key), and both
深圳高级中学 and 十二校 recover the answer a hijacked block had swallowed (G8 18 → 19 answers,
G9 18 → 19). Draft counts, withheld counts (36), statuses and `verify:safe` (1385) are unchanged.

Still queued from the same list: G11's key shape (19 answers unread), 佛山一模 question 3's missing
options and question 17's three images, then the remaining per-question page pass.

### 25.3 Task 2 of that queue: the key rows of a table that has header cells too

武汉四调 states its key as a table whose rows are also split by header cells:

```text
83: "题号"   84: "1" … 93: "10"   94: "答案"   95: "C" … 104: "AD"
105: "题号"  106: "11"  107: "答案"  108: "BD"
…
375: "题号 1 2 3 4 5 6 7 8 9 10"   376: "答案 C D C A A B D C BCD AD"
377: "题号    11"                   378: "答案    BD"
```

The old rule took the *first* line starting with 题号 - the bare header cell `"题号"`, which carries no
numbers - so the real rows were never read. The reader now takes every 题号/答案 row pair whose 题号 line
actually carries the numbers, and looks for the table in the **whole document text** instead of only in
the answer part, because a paper states its key at the end, after pages of 详解.

Result: 十二校一模's key rows are read, and 武汉四调's table is now visible to the reader - the drafts
there are still empty, so the block that drops those answers sits later in the pipeline (the answers are
produced from a realised key table and then either filtered against the question contract or merged
away). That is the next step of this task, with the evidence above.

Further narrowed (same round): 武汉四调's drafts carry **neither answers nor solutions** (0/19 for both),
so the support parse itself produced nothing for that file - it is not an answer-filtering question. The
file text does contain everything the parser needs, in this shape:

```text
82:  "《湖北省武汉市…数学试题》参考答案"      (title longer than the 12 characters the heading rule allows)
83-108: "题号" / 1…10 / "答案" / C D C A A B D C BCD AD / "题号" / 11 / "答案" / BD   (cells, one per line)
109: "1．C"  110: "【分析】…"  111+: "【详解】…"  114: "故选：C."
115: "2．D"  …
```

so the next probe is a dump of `supportText`/`documentPart` as the ingest computes them for that file
(the heading/boundary split is the only place left that can empty the support side). The answer-table
reader of §25.3 is kept - it is what made 十二校一模's rows readable and it changes nothing else - and
the drafts of all eleven groups are unchanged apart from the two recovered answers.

The probe was run, and it moved the boundary one layer further out (all of it from the file's own text):

```text
* splitAnswerSolutionSections does not recognise the 【分析】/【详解】 label form, so it never splits
  this paper into an answer part and a solution part - answerPart and solutionPart are both the whole
  document. That is harmless by itself, but it means the answer-side rules all run over the full text.
* the ingest's support heading is found on the *table's own header cell* "答案" (line 94), not on the
  title line, because the title is longer than the 12 characters that rule allows. The support side
  therefore starts inside the key table: the numbers of that table (lines 84-93) are on the question
  side and only the letters onwards are on the support side.
* the inline block markers are still found (50 of them) and the normalised text keeps "1．C" / "2．D",
  so the block reader has everything it needs - which means the emptiness happens between those two
  facts and the drafts, and the next probe is the value of `supportText` itself for that file.
```

None of this is a behaviour change; it is the trace that the next step starts from.

### 22.4 The visual check found a silent content loss, and the reader now refuses it (`ecbf36c`)

Looking at group 4 (`周二晚测.docx`) page by page showed its question 8 as a piecewise definition

```text
f(x) = { x²+2x−3, x≤0
       { −2+ln x,  x>0
```

while the draft held `$f\left(x\right)=\left\{\right.$` — the two rows were gone and **nothing marked
the question**: it was not withheld, carried no `MTEF_UNRESOLVED` token, and read as a complete
question. Traced to `zhou2/q/word/embeddings/oleObject51.bin`: the two rows live in a PILE record
*inside* the brace template, so the template's own slot list is empty while the template clearly
carried content, and `MTEF_RECONSTRUCTED_OK` was reported for an empty shell.

The rule added is about the class, not the question: a template that carried content records but whose
content slot is empty is left unresolved, so the question is withheld and the teacher sees the gap
instead of a formula that silently lost its inside. The fence templates are guarded; the *optional*
slots are not (an absent square-root index, an absent sub/superscript and the arrow forms are
legitimate, and guarding the arrow template was measured to break the working
`\overrightarrow{CP}\cdot \overrightarrow{DP}` of 完整版题目.docx, so it was reverted).

Corpus proof (`mtef-corpus-scan.js`, 1048 real streams): exactly **one** line changes

```text
zhou2/q/word/embeddings/oleObject51.bin
  before  extracted  MTEF_RECONSTRUCTED_OK  f\left(x\right)=\left\{\right.
  after   unresolved MTEF_UNSUPPORTED_STRUCTURE   (empty-template-slot-2)
```

On the matrix this is group 4 question 8 becoming withheld (with the token in the stem); every other
group, answer count and withheld count is unchanged, and the total is 37. Every withheld question in
all eleven groups was checked to carry its `MTEF_UNRESOLVED` token, so no question is withheld without
a visible reason. Group 3's page-by-page record is in
`docs/integration/DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md` §4.

## 26. 武汉四调's answer key had nothing to do with the support heading (2026-09-16, sixteenth pass)

Section §25.3 left one hypothesis: the support side of 武汉四调 is emptied by the heading split inside
`qisi-docx-ingestion.js`, because the ingest's support heading lands on the key table's own header cell
`答案` instead of the (too long) title line. The probe that hypothesis asked for was written
(`artifacts/audit-baseline/probe-g11-ingest.cjs`) and it printed the real ingest values for that file.
The hypothesis is wrong, and the file was never losing its support text:

```text
supportHeading: line 94 ("答案"), supportText = 答案 / C D C A A B D C BCD AD / 题号 11 答案 BD / 1．C …
helpers.parseSupport(supportText) -> 18 answers, 19 solutions   (the support parse was fine)
ingest filter -> 0 answers, 0 solutions
unmatched       -> 37, every one of them "unproved-question-identity" (18 answers + 19 solutions)
skeleton        -> authoritative: false, 31 entries:
                   1 2 3 4 | 7 9 8 9 8 8 8 9 8 8 8 8 | 5 6 7 8 9 10 11 12 … 19
```

The twelve numbers between 4 and 5 are question 4's own score table. 武汉四调 prints the 评委 scores as
table cells ("7.0", "9.3", "8.3", "9.2", "8.9", "8.9"), each of them a paragraph of its own inside
`<w:tbl>`, and `7.0` starts exactly like the marker of question 7. The XML block reader behind the
skeleton had no rule against that, so it invented 7/8/9 a second time - the skeleton stopped being
continuous and unique, `registerAuthoritativeQuestionContract` declined it, the ingest's identity gate
then had an empty expected set, and **every** answer and solution of the paper was rejected as
unproven. No wrong content was attached - the opposite: the paper's own correct key was withheld whole.

### 26.1 The rule the block reader was missing (`qisi-batch-importer.js`)

The text-level question reader has always refused these cells: a marker whose line holds nothing but
numbers is the paper's numbering row (or the tail of a table value), never a question
(`QUESTION_NUMBERING_ROW_REST_RE` in `qisi-utils.js`). The block reader only had the weaker
"two or more markers on the line" form of that rule, so it read `7.0` as question 7. `isMarkerNumberTail`
adds the same rule to `getQuestionNoFromLine`, and nothing else in the block reader changes.

Skeleton after the change: `1 2 3 4 … 19`, `noDuplicates: true`, `contiguous: true`,
`authoritative: true`. The contract is registered, the support gate accepts the key, and 武汉四调's
answers attach.

A first attempt took the wider route - classify every paragraph inside `<w:tbl>` as a cell, so no cell
can ever start a question. It fixes this file too, and it was rejected for a measured reason: it makes
the skeleton *stricter* than the text-level reader. A table cell that carries more than a bare number
("8.9 乙") still produces a phantom question in the text reader but would no longer produce one in the
skeleton, and the explicit merge then fails the whole batch with `question-items-violate-contract` and
zero drafts - measured on this round's fixture, where the batch failed. The rule kept is the one both
readers share, so the two can never disagree about a cell.

### 26.2 What the paper states as an answer, and what only looks like one (`qisi-utils.js`, `app.js`)

With the gate open, the support parse's 18 answers were still not all answers. They are the first lines
of the 详解 blocks:

```text
12．3                          -> the paper's own answer "3"      (故答案为：3.)
13． $36$                      -> the paper's own answer "36"     (故答案为：36.)
14． $\frac{\sqrt{3}}{3}$      -> the paper's own answer          (故答案为：…)
15．(1)  …然后是本小题的详解  -> "(1)" is the first sub-question, not an answer
16．(1) $e$ / (2) …            -> part 1 only; the answer field must not carry half a multi-part answer
17．(1) …   18．(1) …          -> same shape
```

`Qisi.Utils.isSubQuestionMarkerValue` refuses an answer slot that begins with a bracketed sub-question
marker, and `normalizeAnswerValue` (the single funnel every answer of every path passes through) uses
it. A real bracketed answer keeps working: `(0,1)`, `(-∞,0)`, `(1,2)`, `（-1，2）`, `[0,1)` all carry
more than the bare marker inside the bracket and are left alone.

Result for 武汉四调, all nineteen drafts: `1:C 2:D 3:C 4:A 5:A 6:B 7:D 8:C 9:BCD 10:AD 11:BD 12:3
13:$36$ 14:$\frac{\sqrt{3}}{3}$`, `15-19` empty (the paper prints no answer line for those - the
详解 gives the parts), and 19 of 19 solutions attached for the first time.

### 26.3 The same rule removed wrong content from four other groups

The "(1) …" values were not only in 武汉四调 - the same shape had been attached as the *answer* of
questions 15-19 of four other real papers. Before/after over the whole matrix
(`astra-matrix-keyrow.log` -> `astra-docx-final-matrix-g11.log`):

```text
G7  q15 "(1) $B=\frac{\pi }{3}$"                      -> empty     (and q16-q19 likewise)
G8  q15 "(1) $h=8\sqrt{3}$" … q19 "(1)"               -> empty     (q15-q19)
G9  q15 "(1) $a_{n}=2n-1$； $b_{n}=3^{n-1}$" …        -> empty     (q15-q19)
G10 q15 "(1) $\frac{2}{3}$" …                         -> empty     (q15-q19)
G11 q1-q14 ""                                         -> the key above
G1  unchanged (6 drafts, 5 answers)   G2/G3/G4/G5/G6  unchanged, every count and every answer
```

Those twenty values were the first sub-question of a 解答题, never the answer of the question, so the
answer field is now empty and the question keeps its ordinary missing-answer warning. Per the project
rule a missing answer is acceptable and a half answer in the answer field is not.

### 26.4 Withheld count, and why it moved from 36 to 39

Attaching the solutions of 武汉四调 for the first time brings their unresolved MathType streams into the
drafts: questions 6, 7, 11, 16 and 19 now carry `MTEF_UNRESOLVED` tokens (in the stem or in the newly
attached solution) and are withheld with that visible reason instead of the two that were withheld
before. Nothing is resolved by guessing: the tokens stay in the field, the question cannot be admitted
until a teacher fills it in. Total across the eleven groups: 39 (was 36).

### 26.5 Tests

```text
tests/qisi-utils-subquestion-marker.test.js          the value rule, both directions
tests/e2e/docx-table-cell-question-marker.test.js    the real batch path:
  fixtures/docx-table-cell-question-marker.js          - a score table cell ("7.0") must not become a
                                                         question (skeleton stays 1..4, authoritative)
                                                       - the paper's key attaches, and "(1)" leaves the
                                                         answer empty while its 详解 still attaches
```

## 27. 佛山一模: the options a tab was holding, and the figures that belong to the 详解

Section §5.2 of the handoff left two defects in `广东佛山市第一中学2026届高三一模检测数学试题.docx`:
question 3 has no options, question 17 carries three figures where the page draws one.

### 27.1 Question 3's options were separated by a Word tab

The options are there, on one line, in the document itself:

```xml
<w:r><w:t>A．98</w:t></w:r><w:r><w:tab /></w:r>
<w:r><w:t>B．104</w:t></w:r><w:r><w:tab /></w:r>
<w:r><w:t>C．106</w:t></w:r><w:r><w:tab /></w:r>
<w:r><w:t>D．108</w:t></w:r>
```

The extraction reader knew the element as `<w:tab/>`, and Word writes it as `<w:tab />` - so the tab was
dropped, the four options reached the option reader glued together as `A．98B．104C．106D．108`, and no
reader can split that while keeping the stems intact. The tab and break elements are now matched with
optional whitespace before the slash (`app.js`, `extractDocxTextWithMath`, and the `xmlText` helper next
to it). The same line, read again:

```text
q3 单选题 ["98","104","106","108"]   (before: no options, "选择题仅识别到 0/4 个选项")
```

G7 has eleven four-option questions after this (ten before). It is the only group that changes; every
other group's answers, counts and withheld set are identical.

### 27.2 A figure drawn in the 详解 is not a figure of the question

Question 17 of the same paper draws one 四面体 in the question itself (document line 59-60) and two
坐标系 figures while solving it (lines 245, 263). The draft held all three and showed all three, because
the DOCX token binder collected every `[[IMAGE:…]]` token of the draft - stem, options, answer *and*
solution - and bound each one as `source: 'docx-inline-figure'` with the description
`题中图形：Word 内嵌选项图片`, which is exactly what the stem inliner looks for.

The pages say what the paper draws: pages 1 and 2 (the question pages) carry no figure at all for
questions 1-11, and the drawings appear only next to the 详解 that needed them. So a token found in the
answer/solution text is a *solution* illustration:

```text
question-owned token (stem/options) -> source 'docx-inline-figure',  description 题中图形：…
support-only token  (answer/solution) -> source 'docx-solution-figure', description 解析插图：…
```

Both stay rows of the draft - the 详解 token has to resolve when the solution is displayed and when the
question is exported - but only the question-owned ones are inlined into the stem, because
`shouldInlineDraftImageInStemForV2` accepts only sources and descriptions that mean 题图.

Measured over the whole matrix: every draft's figures are now exactly the tokens that draft carries, and
no draft's stem shows a 详解 drawing.

```text
G7  q17 stem figures 3 -> 1   (draft still holds its own figure + the two 详解 figures)
G7  q2 q8 q11 q14    stem figure removed (their drawings come from the 详解 alone)
G8  q18 / G10 q11 q13 q18 / G11 q14 / G6 q13   same shape
answers, question counts, option counts and the withheld total (39): unchanged
```

Test: `tests/e2e/docx-tab-options-and-solution-figures.test.js` with
`tests/fixtures/docx-tab-options-and-solution-figures.js` - one paper file, tab-separated options, one
figure of its own and two in the 详解; it asserts the four options, the single stem figure and that the
详解 keeps its two.

### 27.3 Found on the way, not fixed (next step)

The last question of six groups still carries the paper's answer-key header in its stem, e.g.
`G7 q19 … 《广东佛山市第一中学2026届高三一模检测数学试题》参考答案 题号 1 2 3 … 10`. The answer-key
heading rule only allows twelve characters before `参考答案`, and those titles are 20-43 characters long,
so the cut happens at the key table's `答案` cell instead of the title line and the header rows land in the
question text. The same three copies of that rule exist in `qisi-utils.js` (`ANSWER_KEY_HEADING_RE`),
`qisi-docx-ingestion.js` and `qisi-batch-importer.js`. This is visible content in the stem, and the next
step is to widen it (or to give the three call sites one shared rule) with the same kind of before/after
matrix evidence as above.

## 28. The key's own header rows were sitting in the last question's stem

That next step, taken. Six of the eleven groups ended their last question with the paper's answer table:

```text
G7 q19 … >ln\left(n+1\right)$.
        《广东佛山市第一中学2026届高三一模检测数学试题》参考答案
        题号
        1
        2
        …
        10
```

The heading rule allowed twelve characters in front of 参考答案, and the real titles are 20 to 43
characters long (the longest is 十二校一模's). The title line therefore never matched: the ingest's
support heading fell on the answer *table's* own header cell `答案`, the question text ran on into the
key's 题号 rows, and no marker stopped the last question there.

Evidence over the texts the acceptance run saved for all eleven groups
(`artifacts/audit-baseline/probe-answer-heading-lines.cjs`): the widened rule matches exactly these new
lines, every one of them a real title, and nothing else in any group:

```text
G3  line 0   《2026年7月9日高中数学作业》参考答案
G6  line 35  《2026年7月9日高中数学作业》参考答案
G7  line 72  《广东佛山市第一中学2026届高三一模检测数学试题》参考答案
G8  line 74  《广东深圳高级中学（集团）2026届高三适应性考试数学试卷》参考答案
G9  line 86  《广东省十二所重点中学校2026届高三年级第一次模拟考（十二校一模）数学试题》参考答案
G10 line 78  《河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷》参考答案
G11 line 82  《湖北省武汉市2025届高三下学期毕业生四月调研考试数学试题》参考答案
```

The rule is now one function, `Qisi.Utils.isAnswerKeyHeadingLine`, and the two copies that had drifted
are gone: `qisi-docx-ingestion.js` (where the question text and the support text are cut apart) and
`qisi-batch-importer.js` (where the question skeleton stops) both ask it, so the skeleton and the
question text cannot disagree about where the key begins. `app.js` is untouched this round.

Result on the whole matrix: no stem carries the key's header rows any more (**six before, zero now**), and
every group's question count, answer set and withheld set is identical to the run before the change
(withheld total 39). `splitTextAtAnswerKeyHeading` keeps its own safety valve - a heading with nothing
key-shaped after it opens no key section - and the new test pins both sides of it.

Test: `tests/qisi-utils-answer-key-heading.test.js` (the six real titles, the shapes that must not match,
the cut, and the valve).

## 29. 第一次授权的付费视觉：真实回复读不出来的原因，和它现在的结果

主人本轮授权原文："给你5次机会" → 随后"给你7次付费视觉调用机会吧"。预算 7 次，实际用掉 6 次，
留 1 次备用。每次调用都由 `artifacts/audit-baseline/astra-pdf-real-vision.cjs` 记录在案（该脚本把
文件级 `visualCalls` 当计数表，并且只允许事先批准的批次）。

### 29.1 六次呼叫的账

```text
1-2  batch A  简略版题目 p1 + 完整版答案 p1   → 0 草稿；题目页 MALFORMED_MODEL_RESPONSE
3    batch A2 简略版题目 p1（单独复现）       → 同样失败，且当时错误里没有任何模型原文
4    batch A2 补上证据之后重跑                → 拿到模型原文的前 1200 字
5-6  batch A  修好读取之后重跑                → 6 份草稿（题目页 success），答案页回复也读出来了
```

### 29.2 根因：模型给的是 LaTeX，而不是 JSON 的转义

第 4 次呼叫留下的原文（现已作为证据保存在批次记录里）长得完全正确：

```text
```json
{ "questions": [ { "questionNumber": "1",
  "stem": "已知集合 $A = \left\{ x \mid x = \sin \frac{n\pi}{2}, n \in \mathbb{Z} \right\}$…"
```

问题就在 `\left` `\{` `\frac` `\sin`：JSON 只允许 `\\ \" \/ \b \f \n \r \t \uXXXX` 这些转义，
`\l` 是**非法转义**，于是 `JSON.parse` 拒绝整份回复——内容其实一条不缺。之前的代码把这份原文连同
错误一起丢掉了，所以只能报告"未返回有效题目结构"。

两处改动（都在 `qisi-pdf-ingestion.js`，`app.js` 未动、封印未动）：

```text
1. 证据不再丢：解析失败时，模型原文的前 1200 字 + 长度 + 结尾 300 字 + finish_reason 跟着 withheld
   记录一起保存（规则 9：先留原始证据）。
2. 回复按模型实际会写的样子来读：
   * 允许 ```json 围栏、前后夹带一句话（取第一个 "{" 到最后一个 "}"）；
   * 把 LaTeX 的反斜杠补成 JSON 转义（只补非法转义，`\\` / `\"` / `\/` / `\uXXXX` 原样保留）；
   * 回复被 token 预算截断时，用一次性扫描（忽略字符串内部的括号）逐个取出**完整**的题目对象，
     不完整的那个不读——题号随后仍要过文本层证明与序列闸门，所以不可能挂到别的页上。
```

### 29.3 结果：一页扫描题变成了 6 道草稿

```text
简略版题目（只有一页）.pdf   parseStatus success   visualCalls 1 → 6 份草稿，全部 单选题、4 选项
                            每份：source pdf-vision、题号由文本层证明、带"PDF 视觉转录待人工逐题核对"提醒
                            正式题库 0 行（只进 review）
完整版答案.pdf p1           回复同样读出来了；q6 因跨页被判 cross-page-visual-block
                            支持闸门仍是 fail-closed：文本层给出的答案条目在 2 号处断档、7-9 号又不在
                            本题集契约（1-6）之内 → 答案与解析一律不挂
```

交叉验证（不额外花钱）：把 PDF 的 6 份草稿与**同一份卷子的 DOCX 文本**（G1 的
`简略版题目（只有一页）.docx`，确定性抽取）逐题比：

```text
q2 原文完全一致；q6 完全一致；q1/q3/q4/q5 数学与文字一致，
差别只在写法（模型写 \overrightarrow{a}/\mid/\sin/\mathbb{Z}，DOCX 里是 \vec{a}/sin/Z，
q2 的"棱台"模型写对、DOCX 里是"梭台"）→ 4 个选项逐题对齐
```

测试：`tests/pdf-ingestion.test.js` 增加三条——解析失败保留模型原文、围栏/截断回复取出完整条目、
LaTeX 转义修复后完整回复逐条读出（含截断与完整两种形状）。

### 29.4 第二批授权（"再给你五次机会"）：把扫描答案卷接上确定性题目

题目侧已经证明过（batch A：一页扫描题 → 6 份草稿）。还没跑过真实材料的是**支持侧**：扫描答案卷
挂到题目文件上。因此这批用**混合批次**——`完整版题目.docx`（确定性 12 题、0 次调用）提供契约与
草稿，`完整版答案.pdf` 的 4 页扫描件各 1 次调用：

```text
batch C  4 次调用（5 次授权里用掉 4 次，留 1 次）
  完整版题目.docx   question  success  12 份草稿（确定性）
  完整版答案.pdf    answer+solution    4 页全部调用；模型 qwen-vl-plus（证据里记了模型名）
  支持闸门 mode=prefix：只接受前缀第 1 题的解析（parser-safe-solution，219 字，内容正确）
  其余 2-12 题一律 pdf-support-field-withheld —— 因为答案卷自身的字母序列在 2 号处断档
  （文本层没有第 2 题的字母），aligner 的可靠前缀就停在 1
  q6 在答案卷第 1 页被判 cross-page-visual-block（跨页题块）
  正式题库 0 行
```

结果正是设计要的形状：**可靠的部分接上（第 1 题解析），不可靠的一律不挂**，而且这次是真实付费材料
上的证据，不再是 mock。owner 的答案卷扫描件第一次真正进入了支持链。

至此两次授权的 7 + 5 = 12 次里用掉 10 次（第 1 批 6 次、第 2 批 4 次），剩 2 次。剩下没做的是
`完整版题目.pdf` 的 2 页（12 题）——它需要一次 2 次调用的批次，正好等于剩余额度。
