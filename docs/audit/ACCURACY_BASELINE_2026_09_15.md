# ACCURACY BASELINE — DOCX+DOCX on real material (2026-09-15)

Measured with `scripts/measure-docx-accuracy.js`, which drives the real import UI in an
isolated browser and compares the produced drafts with the manually verified key in
`tests/fixtures/docx-golden/brief-docx-truth.json`.

```text
question file: 简略版题目（只有一页）.docx
answer file:   完整版答案.docx
manual key:    6 questions, answers B C B C D C, with option and image expectations
AI/OCR calls:  0 (every AI route is answered locally and counted)
```

Options are compared by **rendered math**, not by LaTeX spelling, because Word emits
equivalent but differently spelled LaTeX (`C{A}_{}B` for `C_A B`).

## 1. Before this session

```text
batch status        failed
drafts produced     0
error               DOCX MathType content integrity failed: 1 formula(s) unresolved
diagnostics         missingPreviewRids: ["rId72"]
classification      FAILED 6
WRONG MATCH         0 (nothing was produced)
```

One unconvertible MathType formula in the question file aborted the whole paper. On this
machine the native MathType runtime also crashed, so every attempt also raised a Windows
application-error dialog on the teacher's desktop.

## 2. After the fix

```text
batch status        review
drafts produced     5 (questions 1,2,3,4,5)
classification      COMPLETE 4, SAFE PARTIAL 1, FAILED 1 (question 6 withheld on purpose)
WRONG MATCH         0
answers             1=B, 2=C, 3=B, 4=C, 5=D  — every produced answer matches the key
options             19 of 20 rendered-equal to the key (option D of question 3 read `-1-1`)
MathType launches   0
AI/OCR calls        0
```

After the TeX-input record fix (finding 3 below) the same measurement reads:

```text
classification      COMPLETE 5, FAILED 1 (question 6 withheld on purpose)
WRONG MATCH         0
options             20 of 20 rendered-equal to the key
```

Question 6 contains a formula that neither the native runtime nor the deterministic MTEF
reader can convert. It is withheld and reported in the batch warning and in the file
diagnostics instead of blocking questions 1–5. Nothing incomplete or wrong reaches review.

## 3. Defects this measurement exposed

| # | Finding | Evidence | Status |
| --- | --- | --- | --- |
| 1 | One unconvertible formula aborted the whole DOCX paper | batch status `failed`, 0 drafts, `missingPreviewRids: ["rId72"]` | fixed: affected question is withheld and reported; limits are unchanged for conflicting evidence |
| 2 | Every import launched a crashing native MathType runtime, raising desktop dialogs | `MathType.exe` application error dialog; helper fails at `MTXFormSetTranslator` | fixed: the native runtime is off unless `QISI_MATHTYPE_NATIVE=1`; the deterministic reader answers every equation |
| 3 | Question 3 option D was produced as `-1-1` while the key says `-1` | the raw object `word/embeddings/oleObject19.bin` converted to `-1-1` by itself | fixed: MathType stored a "TeX Input Language" record carrying `-1` *and* the rendered line for the same equation, and the reader concatenated both; that record is now a fallback for empty structural content, locked by a regression fixture using the real bytes |
| 4 | Question 6 is unrecoverable | `scripts/measure-mtef-fidelity.js`: 59/61 equations readable, `rId72` and `rId76` unresolved | open: two real equations need either a working MathType runtime or verified parser work; not guessed |

## 4. MTEF fallback fidelity (same corpus)

```text
equations            61
local reader ok      59 (96.7%)
display-safe LaTeX   59
failure codes        MTEF_FALLBACK_FAILED 2
unresolved ids       rId76 (truncated record list), rId72 (structure the reader cannot decode)
```

Neither unresolved equation could be matched against the verified key, so no parser change
was made: without a verified target, a change there would be guessing.

## 5. What is still not measured

- PDF+PDF accuracy against `tests/fixtures/pdf-golden/*.json` (see section 7).
- Image binding accuracy against the key's `stemImageCount` / `analysisImageCount`.
- Formula preservation rate per paper (only the brief paper is measured so far).
- Solution/analysis text similarity beyond presence.

## 6. Reproduce

```powershell
node scripts/measure-docx-accuracy.js --expected 6 --json artifacts/audit-baseline/docx-accuracy-final.json
node scripts/measure-mtef-fidelity.js
```

Both read local material only. They never call a paid endpoint and never write to the
formal question bank.

## 7. PDF+PDF baseline — plan and first evidence

The PDF question side needs the paid vision stage, so it cannot be measured without an
explicitly authorized real run. The support side — the part where wrong attachment would
happen — can be measured from the recorded replay without any paid call.

Available pieces:

```text
tests/fixtures/pdf-golden/brief-pdf-truth.json      confirmed key: answers B C B C D C,
                                                   formula fragments and figure expectations
tests/fixtures/pdf-replay/brief-engine-replay.json  recorded question response plus recorded
                                                   support pages and structured support response
tests/pdf-math-region-browser.test.js               already replays the fixture in a browser
scripts/pdf-master-browser-runner.js dry-run        reports without calling the real API
```

First evidence from reading the replay against the confirmed key:

**The replay encodes answer 6 as `B` while the confirmed key says `C`.** Its own solution for
question 6 ends with `1:26`, which matches option C, so the recorded answer contradicts the
recorded solution. That makes this fixture a ready-made wrong-attachment probe: the support
chain must either withhold the answer or flag the conflict, and must never attach `B` while
claiming a complete result. That measurement is the next step.

Also observed while preparing this: `pdf-master-browser-runner.js dry-run` writes its report
correctly (`ok: true`, `realApiCalled: false`, zero underlying API calls) but the process does
not exit afterwards, so it has to be stopped by hand. That is a tooling defect to fix before
the PDF measurement can run unattended.
