# Stage R9C — DOCX generalization and print acceptance

Date: 2026-07-22

## Scope and boundaries

- Preserve the stable DOCX+DOCX chain and keep DOCX imports local (no AI/OCR).
- Generalize from source structure; no filename-specific parsing branches.
- Keep uncertain answer ownership unresolved instead of shifting later answers.
- Keep new parsing and layout policy in `qisi-*.js` modules; `app.js` receives only bounded orchestration wiring.

## Implemented behavior

- Word figures immediately before a question, option group, or answer marker remain visible to the structural parser.
- Multiple inline figures preserve their source row; figure-plus-copy paragraphs preserve their relative layout.
- Compact and Word-numbered answer sections are keyed by explicit question numbers.
- Recoverable missing/duplicate answer markers use safe partial alignment: duplicates, unknown keys, and empty answers are rejected and later answers are not shifted.
- The secondary full-text support fallback is skipped when the DOCX importer already handled an embedded answer section.
- Bounded MathType repairs normalize evidenced private style wrappers, delimiter defects, duplicated superscripts, set complement/builder notation, and a bracket typo without accepting arbitrary malformed LaTeX.
- Review-page save/submit is single-flight. Submitting the active draft always persists current stem, answer, and solution first.
- Printed A4 output preserves table structure, option columns, image rows, bounded math scaling, and content-driven pagination.

## Real-material acceptance

All 13 DOCX files under `C:\Users\Administrator\Desktop\题目与答案` were exercised through either the normal browser import path, the real rich-content extractor, or both.

- Separate `题目.docx` + `答案.docx`: 14 questions, 14 answers, 14 solutions, 330 rendered formulas.
- Combined `2026年7月9日高中数学作业.docx`: 14/14/14, 330 rendered formulas.
- `周二晚测.docx`: 12 questions, images bound to questions 5/9/11, 92 rendered formulas.
- `高二.docx`: 56 questions, 54 safely bound answers, image on question 19, 222 rendered formulas.
- Five full exam DOCX files: 19 sequential questions each, 774 rendered formulas total, all tables and source option-column evidence retained.
- Simplified dual DOCX: 6/6 answers and solutions, 97 rendered formulas, persistence round trip passed.
- Full dual DOCX: 12/12 answers and solutions, 231 rendered formulas, persistence round trip passed.
- Normal UI print: 2 rendered tables, two horizontal two-image rows, two 2-column option grids, zero render errors, A4 page used ratio 0.7633.
- Real DOCX browser calls to `/api/ai/*` and `/api/ocr/*`: 0.

The source of `高二.docx` contains no unambiguous answer marker for question 48 and contains a duplicate marker for question 49. The accepted result deliberately leaves questions 48 and 49 unresolved while preserving question 50 onward; inventing or positionally shifting those answers is outside the safety contract.

## Verification gates

- Focused DOCX/review behavior tests: 66 passed.
- `npm run verify:docx-stable`: 20 passed.
- `npm run check`: 51 production files passed syntax checks.
- Real general DOCX browser matrix: passed.
- Five-document real layout browser matrix: passed.
- Simplified and full normal-UI dual DOCX browser tests: passed.
- Real rich-content tests: 2 passed.
- Normal-UI print acceptance: passed.
- `npm run verify:safe`: 1,232 tests, 1,224 passed, 0 failed, 8 skipped; mock smoke and no-real-AI guard passed.
