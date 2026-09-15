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

- The remaining groups of item 4 (`高二.docx`, `2026年7月9日高中数学作业.docx`, the five exam papers)
  have not been run yet.
- Group 3's pages have not been looked at yet (that material ships no PDF and the local LibreOffice
  conversion timed out during this session), so group 3 is batch-verified but not visually verified.
- The reader gap above: `MTEF_EMPTY_EQUATION` / `MTEF_UNREADABLE` on real equations whose payload is
  present (rId71 and rId75 of group 2, and 13 more formulas in group 3). Until it is closed, those
  questions stay withheld, which is fail-closed but costs the teacher manual work.

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
