# PDF KaTeX Dollar Delimiter Normalization Fix

## Stage

POST-BMR10 PRODUCT SMOKE — KaTeX dollar delimiter normalization and mixed text formula segmentation

## Current HEAD Before Fix

2af6351 fix PDF review draft quality — raw JSON guard and formula fallback

## Symptom

Formula render errors still appear on PDF review page as:

```
[公式语法错误：原文已保留] $\therefore \angle A = 30^\circ$
[公式语法错误：原文已保留] \text{则$}\overline{CP}=...$, $\overline{DP}=...
```

Three distinct issues:

| # | Issue | Example |
|---|-------|---------|
| 1 | `$` delimiters leaked into KaTeX expression | `$\therefore ...$` — KaTeX doesn't accept `$` in expressions |
| 2 | Mixed Chinese + `$` formulas treated as single expression | `则$\overline{CP}=...$，$\overline{DP}=...` |
| 3 | Pure Chinese text passed to KaTeX | Chinese chars cause KaTeX parse failures |

## Root Cause

**Source stage**: `tokenizeLatexSource` → `renderMathSegmentForPreview` → KaTeX

**Mechanism**: When the tokenizer encounters nested or ambiguous `$` boundaries (e.g. `$` inside `\text{...}`), it can produce math segments where:
- The `expression` still contains outer `$` delimiters
- Chinese text gets included in a math segment alongside `$...$` formulas

**Affected function**: `renderMathSegmentForPreview` in `qisi-components.js` — no pre-KaTeX validation of expression content.

## Fix

### Changed files

| File | Change | Lines |
|------|--------|-------|
| `qisi-components.js` | Dollar stripping in normalizer + Chinese/mixed detection in renderer | +59 |
| `docs/testing/PDF_KATEX_DELIMITER_NORMALIZATION_FIX.md` | This document | — |

### Fix 1: Strip outer `$`/`$$` delimiters

**Insertion point**: `normalizeMathExpressionForPreview` — before existing normalization

```javascript
.replace(/^\$\$?\s*/, '')   // strip leading $ or $$
.replace(/\s*\$\$?$/, '')   // strip trailing $ or $$
```

This handles case #1 where the tokenizer didn't properly strip delimiters.

### Fix 2: Mixed Chinese + `$...$` re-segmentation

**Insertion point**: `renderMathSegmentForPreview` — before KaTeX call

If the expression contains BOTH Chinese characters AND `$` delimiters:
1. Split on `$$...$$` and `$...$` boundaries
2. Render each `$...$` span as inline KaTeX
3. Render non-math spans as plain text
4. Failed `$...$` spans get the existing fallback: `[公式语法错误：原文已保留] <original>`

### Fix 3: Chinese-only text bypass

**Insertion point**: `renderMathSegmentForPreview` — before KaTeX call

If the expression contains Chinese characters but NO `$` delimiters:
- Render as plain text (don't pass to KaTeX)

## Cleanup Rules

These are render-layer changes — no effect on text storage or controlled-write.

| Check | Action |
|-------|--------|
| Expression has outer `$`/`$$` | Strip before normalization |
| Expression has Chinese + `$` | Split on `$`, render math segments |
| Expression has Chinese only | Render as plain text |
| Expression is pure LaTeX | Pass to KaTeX (existing behavior) |
| KaTeX fails | Fallback: `[公式语法错误：原文已保留] <expression>` (existing) |

## Preserved Content

| Aspect | Preserved? |
|--------|-----------|
| Raw evidence (`cleanRecognizedText`) | Yes — not modified |
| Text storage fields | Yes — render-only change |
| Fallback behavior | Yes — still shows original expression |
| Existing KaTeX behavior for pure math | Yes — unchanged path |

## Tests

### Gate results

| Gate | Result |
|------|--------|
| tests/qisi-app-display-cleaners-fixtures.test.js | 144 passed |
| tests/review-draft-state.test.js | 12 passed |
| tests/support-repair.test.js | 11 passed |
| tests/ui-events.test.js | 7 passed |
| tests/pdf-safe-partial-pipeline.test.js | 10 passed |
| tests/docx-pipeline.test.js | 16 passed |
| tests/base-migration-execution-gate.test.js | 15 passed |
| tests/pdf-route-b-hold.test.js | 6 passed |
| npm run smoke:batch:mock | 20 passed |
| tests/pdf-support-controlled-write-answer-ownership.test.js | 21 passed |
| preflight | passed, realApiCalled=false |
| dry-run | passed, realApiCalled=false |
| verify:diff-scope | passed |
| verify:no-real-ai | passed |

### Browser verification (manual smoke)

- `$\therefore \angle A = 30^\circ$` → KaTeX renders `\therefore \angle A = 30^\circ` (dollars stripped)
- `\text{则$}\overline{CP}=...$，$\overline{DP}=...` → re-segmented, formulas rendered
- Pure Chinese text → rendered as plain text, no KaTeX error
- Normal formulas (`\frac`, `\sqrt`, etc.) → rendered correctly (unchanged path)
- KaTeX errors → fallback preserved with original expression

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
| Renderer rewritten | No — 3 targeted insertions |
| Existing KaTeX path | No — pure math path unchanged |

## Decision

**PDF_KATEX_DELIMITER_NORMALIZATION_FIX_ACCEPTED**

Not allowed to enter BMR11.
