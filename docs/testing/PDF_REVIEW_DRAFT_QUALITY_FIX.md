# PDF Review Draft Quality Fix — Raw JSON Guard + Formula Fallback

## Stage

POST-BMR10 PRODUCT SMOKE — PDF review draft quality fix

## Current HEAD Before Fix

8ce524e fix PDF latex second pass cleanup

## Symptom

Three issues identified on PDF review page:

### 1. Raw JSON payload leakage (HIGHEST PRIORITY — fixed)

AI structured-output JSON leaks into stem field when extraction fails:

```json
{"questions":[{"questionNumber":"1","stem":"已知...","options":{"A":"...","B":"..."},"answer":"D","analysis":"..."}]}
```

This raw JSON was displayed as the question stem text.

### 2. Formula syntax error fallback (fixed)

KaTeX render errors showed only `[公式语法错误]` with no context. Users couldn't see what formula failed or manually fix it.

### 3. Unfilled answers (AUDIT ONLY — not fixed)

Answers missing on some questions. This round only diagnoses, does not attempt repair.

## Root Cause

### Raw JSON leakage

- **Source stage**: AI returns structured output JSON → text extraction fails → raw JSON treated as page text → parsed as question block → `stem` field contains raw JSON
- **Missing guard**: No detection of raw JSON payload in display text path
- **Affected fields**: `stem` (primary), potentially `answer`, `solution`

### Formula error fallback

- **Source stage**: `renderMathSegmentForPreview` in `qisi-components.js` catches KaTeX error
- **Missing info**: Only showed `[公式语法错误]` without preserving the original LaTeX expression

## Fix

### Changed files

| File | Change | Why not a catch-all |
|------|--------|---------------------|
| `qisi-utils.js` | Added `isRawJsonPayloadText()` + guard in `sanitizeLatexWrapperArtifacts` | Only fires on ≥3 known AI JSON field patterns — normal math/Chinese text never matches |
| `qisi-components.js` | Formula error fallback now shows original expression | One-line change in existing error handler — no render pipeline rewrite |
| `tests/qisi-app-display-cleaners-fixtures.test.js` | 11 new tests | — |
| `docs/testing/PDF_REVIEW_DRAFT_QUALITY_FIX.md` | This document | — |

### Fix A: Raw JSON leakage guard

**Insertion point**: Step 9 in `sanitizeLatexWrapperArtifacts` (after all other cleanup)

**Detection**: `isRawJsonPayloadText(text)` — requires ALL of:
1. JSON structural characters present (`{`, `}`, `"`, `[`, `]`, `:`, `,`)
2. ≥3 distinct AI JSON field patterns matched from: `"questions":[`, `"questionNumber":`, `"options":{`, `"stem":"`, `"answer":"`, `"analysis":"`, `"correctAnswer":`, `"type":"`

**Action when detected**: Return `【结构化输出解析失败，需人工复核】` instead of the raw JSON text

**Why fail-closed**:
- Raw JSON is never valid display text — replacing it with a warning is always safer
- Normal text (math, Chinese, answer letters) will match 0 AI field patterns
- The guard does NOT parse JSON, does NOT extract fields, does NOT guess content
- Raw evidence (`cleanRecognizedText`) is not modified — audit trail preserved

**Not triggered by**:
- Normal math: `\frac{\sqrt{2}+1}{2}` — 0 patterns matched
- Chinese text: `由正弦定理得` — 0 patterns matched
- Answer letters: `D` — 0 patterns matched
- JSON with only 1-2 patterns: `{"questionNumber":"1","stem":"已知"}` — only 2 patterns, needs 3

### Fix B: Formula error fallback

**Before**:
```html
<span class="latex-render-error">[公式语法错误]</span>
```

**After**:
```html
<span class="latex-render-error">[公式语法错误：原文已保留] \frac{1}{2</span>
```

**Why this is only a fallback**:
- No change to formula parsing or rendering logic
- No change to how expressions are tokenized or passed to KaTeX
- Original expression was already in scope — just append it to the error message
- Users can now see what formula failed and potentially fix it manually

## Cleanup Rules Summary

| Step | Rule | Added in |
|------|------|----------|
| 1 | Remove markdown code fences | Pass 1 |
| 2 | Convert `\begin{equation}` → `\[` | Pass 2 |
| 3 | Remove wrapper env lines | Pass 1 |
| 4 | Remove inline wrapper env fragments | Pass 1 |
| 5 | Remove `\item` at line start | Pass 1 |
| 6 | Strip orphaned boundary braces | Pass 2 |
| 7 | Collapse blank lines and trim | Pass 1 |
| 8 | Return empty if only braces remain | Pass 2 |
| 9 | **Block raw JSON payload → warning placeholder** | **Pass 3 (NEW)** |

## Unfilled Answers — Audit Classification Only

This round does NOT fix unfilled answers. Classification for diagnosis:

| Category | Meaning |
|----------|---------|
| safe partial expected missing | Controlled-write did not accept — expected behavior |
| raw JSON blocked | Stem was JSON payload — blocked by new guard |
| no support evidence | No answer/solution PDF provided or no extraction output |
| extraction failed | AI/OCR returned empty or error for this question |
| unknown manual review required | Default — requires human check |

## Tests

### New tests added (11)

| Test | Category |
|------|----------|
| AI structured output JSON detected | Detection |
| Normal math not flagged | Detection |
| Chinese text not flagged | Detection |
| Answer letter not flagged | Detection |
| 2-pattern JSON not flagged (threshold) | Detection |
| Empty/null not flagged | Detection |
| Raw JSON stem replaced with warning | Integration |
| JSON blocked through fields path | Integration |
| Normal stem with math passes | Integration |
| Answer letter passes | Integration |
| JSON guard is fail-closed | Safety |

### Gate results

| Gate | Result |
|------|--------|
| tests/qisi-app-display-cleaners-fixtures.test.js | 144 passed (11 new) |
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
| preflight | passed, realApiCalled=false |
| dry-run | passed, realApiCalled=false |
| verify:docx-stable | passed |
| verify:diff-scope | passed |
| verify:no-real-ai | passed |

## Browser Verification

### PDF + PDF

- Raw JSON no longer displayed as question stem — shows `【结构化输出解析失败，需人工复核】`
- Formula errors now show original LaTeX alongside error message
- Normal math/stem/answers unaffected by JSON guard
- Controlled-write behavior unchanged
- Answer ownership unchanged
- Question alignment unchanged

### DOCX + DOCX

- No regression — JSON guard never triggers on normal DOCX text
- Math formulas preserved

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
| Unfilled answers forcibly repaired | No — audit only |

## Design Justification

### Why the JSON guard is not a catch-all patch

1. **Specific detection**: Only fires on ≥3 known AI JSON field patterns — not general JSON detection
2. **Single insertion point**: Added as step 9 in `sanitizeLatexWrapperArtifacts`, which is already the centralized display text cleaning path
3. **Fail-closed**: Replaces dangerous content with a safe warning — never passes raw JSON through
4. **No new pipeline**: Uses existing `cleanDisplayTextForBatchSave` → `cleanDisplayFieldsOnly` path — no new code paths

### Why the formula fallback is only a fallback

1. **No renderer change**: Does not modify KaTeX call, tokenizer, or expression normalizer
2. **No swallowing**: Original expression is preserved and displayed
3. **Existing error path**: Only changes the error HTML string in the existing `catch` block
4. **Single line change**: Appends `expression` to existing error display

### Why unfilled answers are not fixed

1. **Safety**: Attempting to guess/extract answers could create wrong answer attachments
2. **Controlled-write integrity**: Answer ownership is determined by controlled-write, not by cleanup
3. **Diagnosis only**: Classification helps identify root causes without changing behavior

## Decision

**PDF_REVIEW_DRAFT_QUALITY_FIX_ACCEPTED**

- Raw JSON leakage: BLOCKED (fail-closed guard)
- Formula error fallback: IMPROVED (shows original text)
- Unfilled answers: AUDIT ONLY (not repaired)

Not allowed to enter BMR11.
