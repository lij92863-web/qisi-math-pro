# PDF Bare LaTeX Inline Display Fix

## Stage

POST-BMR10 PRODUCT SMOKE — bare LaTeX inline display

## Current HEAD Before Fix

d24b5a9 fix PDF katex display normalization

## Symptom

| Issue | Example |
|-------|---------|
| bare `\overline` | `\overline{CP}` displayed as raw text instead of rendered |
| bare `\sqrt` | `\sqrt{3}` not rendered |
| bare `\therefore` | `\therefore` displayed as raw text |
| mixed Chinese/math text | `则 \overline{CP} = (x-2,\sqrt{3}),` — math not rendered |

## Root Cause

| Item | Detail |
|------|--------|
| renderer | `qisi-components.js` → main segment loop |
| missing bare LaTeX island detection | Text segments passed directly to `renderPlainText` which HTML-escapes everything — bare LaTeX commands like `\overline` are treated as literal text, not math |
| affected fields | All text segments without `$...$` delimiters that contain LaTeX math commands |

`tokenizeLatexSource` only recognizes `$`, `$$`, `\[`, `\(` as math delimiters. Text without these delimiters is classified as plain text, even if it contains LaTeX math commands.

## Fix

### Changed files

| File | Change | Lines |
|------|--------|-------|
| `qisi-components.js` | Added bare LaTeX math island detection + rendering in text segments | +135/-1 |
| `docs/testing/PDF_BARE_LATEX_INLINE_DISPLAY_FIX.md` | This document | — |

### Segmentation rules

1. **Fast path**: If text contains no `\<letter>` patterns, use existing `renderPlainText` — no overhead
2. **Command check**: Scan text for known LaTeX math commands against a curated set of ~100 commands
3. **Island extraction**: For each `\<command>`, read the command name and any following `{...}` brace groups (with balanced-nesting support)
4. **Rendering**: Each math island rendered with KaTeX (inline `displayMode: false`); non-math text with `renderPlainText`
5. **Fallback**: If KaTeX fails on a math island, show `[公式语法错误：原文已保留] <original>` — never swallow content

### Curated command set

Includes all common LaTeX math commands: `\overline`, `\overrightarrow`, `\vec`, `\sqrt`, `\frac`, `\therefore`, `\because`, `\cdot`, `\times`, `\sin`, `\cos`, `\tan`, `\angle`, `\triangle`, `\alpha`, `\beta`, `\gamma`, `\pi`, `\theta`, `\le`, `\ge`, `\neq`, `\in`, `\notin`, `\infty`, `\partial`, `\sum`, `\prod`, `\int`, `\left`, `\right`, `\mathbb`, `\mathbf`, `\bar`, `\hat`, `\tilde`, `\implies`, `\iff`, `\underset`, `\overset`, and many more (~100 total).

NOT included (to avoid false positives): `\text`, `\begin`, `\end`, `\item`, `\label`, `\ref`, `\cite`, `\emph`, `\textbf`, `\textit` — these are text-mode or structural commands, not math.

### Fallback behavior

- Math island KaTeX failure → `[公式语法错误：原文已保留] <expression>` (same as existing math segment fallback)
- Non-math text → existing `renderPlainText` (HTML-escaped, newlines → `<br>`)
- Existing `$...$` / `$$...$$` math segments → unchanged path
- Mixed Chinese + `$` segmentation → unchanged path
- Chinese-only bypass → unchanged path

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

- `\overline{CP}`, `\overline{DP}` — rendered as math, not raw text
- `\sqrt{3}` — rendered as math
- `\therefore`, `\cdot` — rendered as math
- Mixed Chinese + bare LaTeX — math rendered inline, Chinese as text
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

**PDF_BARE_LATEX_INLINE_DISPLAY_ACCEPTED**

Not allowed to enter BMR11.
