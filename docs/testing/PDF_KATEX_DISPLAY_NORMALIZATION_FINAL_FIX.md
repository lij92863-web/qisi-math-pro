# PDF KaTeX Display Normalization Final Fix

## Stage

POST-BMR10 PRODUCT SMOKE — final KaTeX display normalization

## Current HEAD Before Fix

0bb32a1 fix PDF vision JSON latex escape repair — generalize to all invalid escapes

## Symptom

| Issue | Example |
|-------|---------|
| dollar wrapped formula | `[公式语法错误：原文已保留] $\therefore \frac{...}{...}=...$` |
| mixed text | Chinese + `$...$` formula sent to KaTeX as one expression |
| malformed `\text{中文$}` | OCR produces `\text{则$} \overline{CP}=...` which confuses the tokenizer |

## Root Cause

| Item | Detail |
|------|--------|
| renderer | `qisi-components.js` → `normalizeMathExpressionForPreview` → `renderMathSegmentForPreview` |
| missing normalization | (1) No fix for `\text{中文$}` malformed OCR wrappers; (2) No leading `}` / trailing `{` strip at expression boundaries |
| mixed text segmentation gap | Previous pass added Chinese + `$` segmentation but edge cases like `\text{则$}` still leaked through |

## Fix

### Changed files

| File | Change | Lines |
|------|--------|-------|
| `qisi-components.js` | 3 targeted additions to `normalizeMathExpressionForPreview` | +8 |
| `docs/testing/PDF_KATEX_DISPLAY_NORMALIZATION_FINAL_FIX.md` | This document | — |

### Normalization rules (additions only)

Existing rule: strip outer `$`/`$$` delimiters

**New rule 1**: Fix OCR malformed `\text{中文$}` wrapper
```
\text{则$}  →  则
\text{故$}  →  故
\text{所以$} → 所以
```
Pattern: `\\text\{([一-龥]+)\$\}` → `$1`
Only matches when the content before `$` is purely CJK characters — safe against normal `\text{...}` usage.

**New rule 2**: Strip leading `}` at expression start
```
} -\frac{19}{13}  →  -\frac{19}{13}
} \overline{CP}=...  →  \overline{CP}=...
```
These are orphaned braces from partial wrapper cleanup — never valid at expression start.

**New rule 3**: Strip trailing `{` at expression end
```
\frac{1}{2}{  →  \frac{1}{2}
```
Orphaned opening brace at expression end — never valid LaTeX.

### Fallback behavior

Unchanged — all existing paths preserved:
- Mixed Chinese + `$` segmentation (from previous pass)
- Chinese-only → plain text (from previous pass)
- Pure math → KaTeX (existing path)
- KaTeX failure → `[公式语法错误：原文已保留] <expression>` (from previous passes)

## Tests

### Gate results

| Gate | Result |
|------|--------|
| tests/qisi-app-display-cleaners-fixtures.test.js | 144 passed |
| tests/review-draft-state.test.js | 12 passed |
| tests/support-repair.test.js | 19 passed |
| tests/ui-events.test.js | 7 passed |
| tests/pdf-safe-partial-pipeline.test.js | 10 passed |
| tests/docx-pipeline.test.js | 16 passed |
| tests/base-migration-execution-gate.test.js | 15 passed |
| tests/pdf-route-b-hold.test.js | 6 passed |
| smoke:batch:mock | 20 passed |
| pdf-support-controlled-write-answer-ownership | 21 passed |
| preflight | passed, realApiCalled=false |
| dry-run | passed, realApiCalled=false |
| verify:diff-scope | passed |
| verify:no-real-ai | passed |

## Browser Verification

### PDF + PDF

- `$\therefore \frac{...}{...}=...$` — outer `$` stripped, formula rendered (or fallback with original text)
- Mixed Chinese + `$...$` — segmented, Chinese as text, math as KaTeX
- `\text{则$} \overline{CP}=...` — malformed wrapper removed, math rendered
- `} \overline{CP}=...` — leading `}` stripped
- No white screen
- No console runtime errors
- Raw JSON guard preserved
- Unfilled answers not forcibly filled
- Answer ownership unchanged

## Safety

| Aspect | Touched? |
|--------|----------|
| controlled-write | No |
| parser | No |
| aligner | No |
| runner | No |
| Route B | No |
| real-run | No |
| AI/OCR | No |
| answer ownership | No |
| question alignment | No |
| raw JSON guard | No — preserved |
| missing answers forced | No |
| A4 | No |

## Decision

**PDF_KATEX_DISPLAY_NORMALIZATION_ACCEPTED**

Not allowed to enter BMR11.
