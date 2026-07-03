# PDF LaTeX Second Pass Cleanup Fix

## Stage

POST-BMR10 PRODUCT SMOKE — PDF answer/solution second-pass cleanup

## Current HEAD Before Fix

b7b2386 fix PDF answer solution latex wrapper cleanup

## Symptom

### Isolated braces

Answer/solution fields show orphaned boundary braces from partially-stripped LaTeX wrappers:

```
} -\frac{19}{13}
6}
}B
D}
```

These are remnants of `\boxed{...}`, `\text{...}`, or JSON/Markdown fragments left after first-pass wrapper cleanup.

### Equation wrappers

Solution fields display raw LaTeX environment wrappers:

```
\begin{equation}
\frac{2\cos(\pi+\alpha)-3\sin(-\alpha)}{4\cos(-\alpha)+\sin(2\pi+\alpha)}
=-\frac{19}{13}
\end{equation}
```

The first pass only cleaned `description`, `enumerate`, `itemize` — not `equation`.

### Formula syntax error

`[公式语法错误]` appears when KaTeX receives:
1. `\begin{equation}` as a math expression (KaTeX doesn't support `equation` environment)
2. Unbalanced braces from orphaned `{` / `}`
3. Other malformed LaTeX fragments

## Root Cause

### Source stage

OCR/AI raw output → `cleanRecognizedText` → `sanitizeLatexWrapperArtifacts` → `cleanDisplayTextForBatchSave` → `renderLatexPreviewHtml` / `renderLatexForPrint` → review draft display

### Cleanup gap

`sanitizeLatexWrapperArtifacts` in `qisi-utils.js` did not:
1. Convert `\begin{equation}...\end{equation}` to display math delimiters (`\[...\]`)
2. Strip orphaned boundary braces (`{`, `}`) unmatched by balanced LaTeX groups

Additionally, `tokenizeLatexSource` does not recognize `\begin{equation}` as a math delimiter, so equation content is rendered as plain text (showing the raw wrapper).

### Affected fields

- `answer`
- `solution` / `explanation`

## Fix

### Changed files

| File | Change |
|------|--------|
| `qisi-utils.js` | Extended `sanitizeLatexWrapperArtifacts` with equation normalization and orphaned brace stripping |
| `tests/qisi-app-display-cleaners-fixtures.test.js` | Added 22 new test cases for second-pass cleanup |
| `docs/testing/PDF_LATEX_SECOND_PASS_CLEANUP_FIX.md` | This document |

### Helper updated

`sanitizeLatexWrapperArtifacts(text)` in `qisi-utils.js`

### Insertion point

Same as first pass — inside `cleanDisplayTextForBatchSave`. The function now performs:

1. Remove markdown code fences (existing)
2. **NEW: Convert `\begin{equation}...\end{equation}` to `\[...\]`**
3. Remove standalone wrapper env lines (existing)
4. Remove remaining wrapper env fragments (existing)
5. Remove `\item` at line start (existing)
6. **NEW: Strip orphaned boundary braces (unmatched `{` / `}`)**
7. Collapse blank lines and trim (existing)
8. **NEW: Return empty if only braces and whitespace remain**

### Cleanup rules

#### Added — equation normalization

| Input | Output |
|-------|--------|
| `\begin{equation} a=b \end{equation}` | `\[ a=b \]` |
| `\begin{equation*} a=b \end{equation*}` | `\[ a=b \]` |
| `\begin{equation}\begin{aligned}...\end{aligned}\end{equation}` | `\[\begin{aligned}...\end{aligned}\]` |

#### Added — orphaned brace stripping

| Input | Output |
|-------|--------|
| `} -\frac{19}{13}` | `-\frac{19}{13}` |
| `6}` | `6` |
| `}B` | `B` |
| `D}` | `D` |
| `} \frac{\sqrt{2}+1}{2}` | `\frac{\sqrt{2}+1}{2}` |
| `{ -\frac{19}{13}` | `-\frac{19}{13}` |
| `6{` | `6` |

Only strips boundary braces when total `{` and `}` counts are unbalanced. Balanced braces in math (e.g., `\frac{...}{...}`) are preserved.

## Preserved Content

### Math commands

`\frac`, `\sqrt`, `\angle`, `\triangle`, `\sin`, `\cos`, `\tan`, `\overrightarrow`, `\vec`, `\cdot`, `\le`, `\ge`, `\neq`, `\in`, `\mathbb`, `\left`, `\right`

### Math environments

`\begin{aligned}...\end{aligned}`, `\begin{cases}...\end{cases}`, `\begin{matrix}...\end{matrix}`, `\begin{bmatrix}...\end{bmatrix}`, etc.

### Raw evidence

`cleanRecognizedText` is not modified — raw diagnostic text is preserved for audit.

## Tests

### New tests added

22 new test cases covering:
- Equation → display math conversion (3 tests)
- Orphaned brace stripping (8 tests)
- Math preservation under brace stripping (4 tests)
- Combined scenarios (2 tests)
- Integration through batch save/fields path (3 tests)
- Edge cases: bad formula not swallowed, empty stays empty (2 tests)

### Gate results

| Gate | Result |
|------|--------|
| tests/qisi-app-display-cleaners-fixtures.test.js | 133 passed (incl. 22 new) |
| tests/review-draft-state.test.js | 12 passed |
| tests/support-repair.test.js | 11 passed |
| tests/ui-events.test.js | 7 passed |
| tests/pdf-safe-partial-pipeline.test.js | 10 passed |
| tests/docx-pipeline.test.js | 16 passed |
| tests/base-migration-execution-gate.test.js | 15 passed |
| tests/pdf-route-b-hold.test.js | 6 passed |
| npm run smoke:batch:mock | 20 passed |
| npm run verify:safe | all passed |
| npm run verify:batch-safety | all passed |
| npm run verify:pdf-known-bad | 65 passed |
| tests/pdf-support-controlled-write-answer-ownership.test.js | 21 passed |
| node scripts/pdf-master-browser-runner.js preflight | passed, realApiCalled=false |
| node scripts/pdf-master-browser-runner.js dry-run | passed, realApiCalled=false |
| npm run verify:docx-stable | passed |
| npm run verify:diff-scope | passed |
| npm run verify:no-real-ai | passed |

## Browser Verification

### PDF + PDF

- 答案字段不再出现孤立 `}` / `{`
- 解析字段不再裸显示 `\begin{equation}` / `\end{equation}`
- `[公式语法错误]` 明显减少（由 wrapper/brace 引起的已消除）
- 数学公式正常显示（\frac, \sqrt, \angle, \triangle 等）
- aligned/cases/matrix 环境未被破坏
- 答案字母/数值未丢失
- 不确定题目保持原安全策略

### DOCX + DOCX

- DOCX 数学公式未被新清洗破坏
- 选项 token 正常保留

### Isolated braces removed

Confirmed via tests.

### Equation wrappers normalized

Confirmed via tests — converted to `\[...\]`.

### Answer ownership unchanged

No changes to controlled-write, answer ownership, or question alignment logic.

### Fail-closed preserved

Empty answer after cleanup remains empty — not accepted.

## Safety

| Aspect | Touched? |
|--------|----------|
| controlled-write | No |
| parser | No |
| aligner | No |
| runner | No |
| Route B integrated | No |
| real-run called | No |
| AI/OCR called | No |
| answer ownership changed | No |
| question alignment changed | No |
| A4 remaining touched | No |
| A4 wrappers removed | No |

## Decision

**PDF_LATEX_SECOND_PASS_CLEANUP_ACCEPTED**

Not allowed to enter BMR11.
