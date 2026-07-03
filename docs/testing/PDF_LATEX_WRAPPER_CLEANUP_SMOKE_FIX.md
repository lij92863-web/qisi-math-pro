# PDF LaTeX Wrapper Cleanup Smoke Fix

## Stage

POST-BMR10 PRODUCT SMOKE — PDF answer/solution wrapper cleanup

## Current HEAD Before Fix

000d23b fix final draft option repair script dependency

## Symptom

### Affected flow

PDF + PDF 双 PDF 导入 → 审核页 answer/solution 字段

### Examples

```
\end{description}
```latex
\begin{enumerate}
\begin{itemize}
\end{itemize}
\item 故选：D
```

## Root Cause

### Source stage

OCR/AI raw output → `cleanRecognizedText` → `cleanDisplayTextForBatchSave` → review draft display

### Missing cleanup

`cleanRecognizedText` (qisi-utils.js:190-232) strips HTML/OOXML tags but does not strip:

- LaTeX list/description environment wrappers (`\begin{description}`, `\end{description}`, `\begin{enumerate}`, `\end{enumerate}`, `\begin{itemize}`, `\end{itemize}`)
- Markdown code fences (` ```latex `, ` ``` `)
- Line-start `\item` LaTeX commands

These wrappers flow through `cleanDisplayTextForBatchSave` → `cleanDisplayFieldsOnly` → review draft display unchanged.

### Affected fields

- `answer`
- `solution`
- `stem` (if wrappers present)

## Fix

### Changed files

| File | Change |
|------|--------|
| `qisi-utils.js` | Added `sanitizeLatexWrapperArtifacts` helper; wired into `cleanDisplayTextForBatchSave`; exported in API |
| `tests/qisi-app-display-cleaners-fixtures.test.js` | Added 26 new test cases covering all sample scenarios |
| `docs/testing/PDF_LATEX_WRAPPER_CLEANUP_SMOKE_FIX.md` | This document |

### Helper added

`sanitizeLatexWrapperArtifacts(text)` in `qisi-utils.js`

### Insertion point

Inside `cleanDisplayTextForBatchSave`:

```
cleanDisplayTextForBatchSave(text) =
    sanitizeLatexWrapperArtifacts(stripBatchImagePlaceholders(cleanRecognizedText(text)))
```

This ensures all display/draft paths are cleaned without touching raw evidence (`cleanRecognizedText` is also used for diagnostics, which should preserve raw text).

### Why safe

- Only strips known wrapper env names: `description`, `enumerate`, `itemize`
- Preserves all math environments: `aligned`, `cases`, `matrix`, `bmatrix`, `pmatrix`, etc.
- Preserves all math commands: `\frac`, `\sqrt`, `\angle`, `\triangle`, `\sin`, `\cos`, etc.
- Only removes `\item` at line start (with backslash), not the English word "item"
- Operates on display text only; raw evidence is preserved for audit
- Does not modify answer ownership, question alignment, or controlled-write rules

## Cleanup Rules

### Removed

| Pattern | Example |
|---------|---------|
| Markdown code fences | ` ```latex `, ` ``` ` |
| Standalone `\begin{env}` / `\end{env}` | `\begin{description}`, `\end{enumerate}` |
| Inline `\begin{env}` / `\end{env}` fragments | `text\end{description}` → `text` |
| Line-start `\item` | `\item 故选：D` → `故选：D` |
| Line-start `\item[...]` | `\item[步骤一] 解` → `解` |

Wrapper env names removed: `description`, `enumerate`, `itemize`

### Preserved

| Category | Examples |
|----------|----------|
| Math environments | `\begin{aligned}`, `\end{aligned}`, `\begin{cases}`, `\end{cases}`, `\begin{matrix}`, `\end{matrix}` |
| Math commands | `\frac`, `\sqrt`, `\angle`, `\triangle`, `\sin`, `\cos`, `\tan`, `\overrightarrow`, `\vec`, `\cdot`, `\le`, `\ge`, `\neq`, `\in`, `\mathbb`, `\left`, `\right` |
| Display math delimiters | `$$`, `\[`, `\(`, `$` |
| Image/formula tokens | `[[IMAGE:...]]`, `[[FORMULA_IMAGE:...]]` |
| Plain English "item" | "The item difficulty is moderate." — not touched |

## Tests

### New tests added

26 test cases in `tests/qisi-app-display-cleaners-fixtures.test.js`:

- [LATEX_WRAPPER:empty] — empty string returns empty
- [LATEX_WRAPPER:null] — null returns empty
- [LATEX_WRAPPER:plain-text] — plain text preserved
- [LATEX_WRAPPER:sample-1:trailing-description] — strips trailing `\end{description}`
- [LATEX_WRAPPER:sample-2:fence-enumerate] — strips markdown fence + enumerate
- [LATEX_WRAPPER:sample-3:itemize] — strips itemize, preserves math
- [LATEX_WRAPPER:sample-4:preserve-math-env] — preserves aligned/cases/matrix
- [LATEX_WRAPPER:sample-5:preserve-formula] — preserves normal math LaTeX
- [LATEX_WRAPPER:sample-6:answer-trailing] — strips trailing wrapper from answer
- [LATEX_WRAPPER:sample-7:repeated-wrappers] — strips repeated wrappers
- [LATEX_WRAPPER:preserve-frac] — preserves `\frac`
- [LATEX_WRAPPER:preserve-sqrt] — preserves `\sqrt`
- [LATEX_WRAPPER:preserve-angle] — preserves `\angle`
- [LATEX_WRAPPER:preserve-triangle] — preserves `\triangle`
- [LATEX_WRAPPER:preserve-math-begin-end] — preserves `\begin{cases}...\end{cases}`
- [LATEX_WRAPPER:preserve-matrix] — preserves `\begin{matrix}...\end{matrix}`
- [LATEX_WRAPPER:item-with-brackets] — strips `\item[...]` at line start
- [LATEX_WRAPPER:plain-item-word] — does not strip plain "item"
- [LATEX_WRAPPER:answer-letter-preserved] — answer letter preserved
- [LATEX_WRAPPER:idempotent] — repeated cleaning is idempotent
- [LATEX_WRAPPER:all-wrapper] — all-wrapper text returns empty
- [LATEX_WRAPPER:inline-wrapper] — strips inline wrapper tags
- [LATEX_WRAPPER:integration:pdf-answer] — PDF answer wrapper cleaned through batch save
- [LATEX_WRAPPER:integration:pdf-solution] — PDF solution wrappers cleaned through fields path
- [LATEX_WRAPPER:integration:math-preserved] — math preserved through full pipeline
- [LATEX_WRAPPER:integration:empty-not-accepted] — empty after cleanup stays empty

### Gate results

| Gate | Result |
|------|--------|
| tests/qisi-app-display-cleaners-fixtures.test.js | 111 passed (incl. 26 new) |
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

- 解析末尾不再出现 `\end{description}`
- 不再出现 ` ```latex `
- 不再出现 `\begin{enumerate}` / `\begin{itemize}`
- 不再出现裸 `\item`
- 数学公式仍能正常显示
- 答案字母不丢
- 不确定题目仍按原安全策略处理
- 没有错挂答案

### DOCX + DOCX

- DOCX 数学公式未被破坏
- 选项 token 正常保留
- answer/solution 字段不受影响

### Formulas preserved

All math LaTeX commands and environments preserved through the cleanup pipeline.

### Answer letters preserved

Answer letters (A/B/C/D) are not modified by wrapper cleanup.

### No unsafe acceptance

Empty answers after cleanup remain empty — not accepted.

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

**PDF_LATEX_WRAPPER_CLEANUP_ACCEPTED**

Not allowed to enter BMR11.
