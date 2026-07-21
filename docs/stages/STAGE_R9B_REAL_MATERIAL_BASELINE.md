# Stage R9B — Real-material no-AI baseline

## Scope

- Root: `C:\Users\Administrator\Desktop\题目与答案`
- Material count: 16 files (13 DOCX and 3 PDF).
- Original files were opened read-only and were not modified.
- No AI or OCR endpoint was called.
- Full SHA-256, byte size, structural counts and timings are stored in the ignored
  local artifact `local-run-artifacts/r9/real-material-source-audit.json`.

## Reproducible audit

The new `scripts/audit-real-material-sources.js` tool:

- enumerates all supported files without filename-specific parsing rules;
- verifies every DOCX ZIP package and reads `word/document.xml`;
- invokes the production DOCX question-skeleton implementation;
- records paragraphs, tables, drawings, OMML, OLE, media and embedding counts;
- records PDF page count, page geometry, encryption state and PDF version;
- contains no HTTP URL or AI/OCR endpoint.

Command:

```powershell
npm run audit:real-materials -- "C:\Users\Administrator\Desktop\题目与答案" `
  --out "local-run-artifacts/r9/real-material-source-audit.json"
```

Result: 16/16 readable, 13 DOCX, 3 PDF, zero structural-read failures, 265 ms
aggregate audit time on this machine.

## Production-skeleton evidence

| Material class | Source skeleton evidence |
| --- | --- |
| Separate question DOCX | `题目.docx`: continuous 1–14 |
| Combined 14-question DOCX | continuous 1–14 |
| Full question DOCX | continuous 1–12 |
| Brief question DOCX | continuous 1–6 |
| Five full exam DOCX files | each continuous 1–19 |
| Weekly question DOCX | source skeleton continuous 1–12 |
| New long combined DOCX | question run 1–56 followed by repeated answer markers; current skeleton rejects it as duplicate-question-numbers |
| Answer-only DOCX files | no question skeleton, which is expected for their support role |

The weekly source skeleton being complete while the real browser import loses questions
9 and 11 proves the defect is downstream of skeleton discovery, in rich-content question
assembly or merge coverage. The long combined document proves the current question/end-of-
support boundary is not general enough for a trailing answer section.

## Real browser baseline

`QISI_REAL_DOCX_GENERAL=1 node --test tests/docx-general-real-browser.test.js`
ran with `/api/ai/**` forcibly intercepted:

- separate question + answer DOCX: 14 questions, 14 answers, 14 analyses, 330
  rendered math nodes, zero AI calls;
- combined question + answer + analysis DOCX: same complete result, zero AI calls;
- question-only weekly DOCX: failed closed because rich-content output contained
  1–8, 10 and 12, missing 9 and 11. No unsafe partial batch reached review.

## Visual source baseline

The three source PDFs rendered successfully with Poppler at 144 DPI:

- brief question PDF: 1 page;
- full answer PDF: 4 pages;
- full question PDF: 2 pages.

All seven rendered A4 pages were inspected. Source question numbers, formulas, diagrams,
option layouts and answer/analysis ownership are visibly legible with no clipping,
overlap or mojibake.

The canonical LibreOffice renderer and a Word COM read-only export both stalled on the
first MathType/OLE-heavy DOCX without producing a page. Those paths were terminated and
are not counted as visual passes. DOCX output will instead be validated through the
application's isolated browser preview and print surfaces after parser repairs.

## Acceptance decision

R9B passes as a deterministic evidence stage. It intentionally does not declare the
product correct: it identifies two reproducible generalized DOCX defects for R9C and
establishes the source truth needed to distinguish parser regressions from bad fixtures.
