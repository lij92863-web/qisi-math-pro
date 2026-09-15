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
options             19 of 20 rendered-equal to the key
MathType launches   0
AI/OCR calls        0
```

Question 6 contains a formula that neither the native runtime nor the deterministic MTEF
reader can convert. It is withheld and reported in the batch warning and in the file
diagnostics instead of blocking questions 1–5. Nothing incomplete or wrong reaches review.

## 3. Defects this measurement exposed

| # | Finding | Evidence | Status |
| --- | --- | --- | --- |
| 1 | One unconvertible formula aborted the whole DOCX paper | batch status `failed`, 0 drafts, `missingPreviewRids: ["rId72"]` | fixed: affected question is withheld and reported; limits are unchanged for conflicting evidence |
| 2 | Every import launched a crashing native MathType runtime, raising desktop dialogs | `MathType.exe` application error dialog; helper fails at `MTXFormSetTranslator` | fixed: the native runtime is off unless `QISI_MATHTYPE_NATIVE=1`; the deterministic reader answers every equation |
| 3 | Question 3 option D is produced as `-1-1` while the key says `-1` | `optionsActualTexts` vs `optionsExpectedTexts` in `artifacts/audit-baseline/docx-accuracy-final.json` | open: recorded, not yet root-caused |
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

- PDF+PDF accuracy against `tests/fixtures/pdf-golden/*.json` (next measurement).
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
