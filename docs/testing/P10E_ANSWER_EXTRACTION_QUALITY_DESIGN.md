# P10E Answer Extraction Quality Design

## Stage

P10E — design safe answer extraction quality improvement boundaries (design + mock only, no business code, no real-run)

## P10D Evidence Summary

| Question | ocrRawShape | originalAnswerShape | Drop Stage | Root Cause |
| --- | --- | --- | --- | --- |
| 2 | label-shell | `\A{A}` (LaTeX command wrapping) | controlled-write | Label A present inside `\cmd{A}`, normalization can't unwrap |
| 8 | label-shell | `}A_\A{A}` (structural, non-label-payload) | controlled-write | Structural shell captured but inner letters not A-F |
| 9 | label-shell | `}A_\A{A}` (structural, non-label-payload) | controlled-write | Same as Q8 |

## Why This Is an Extraction Quality Gap, Not a Controlled-Write Bug

P8E0 proved `normalizeObjectiveAnswerToLabels` is correct:
- Accepts structural shells with valid A-F labels
- Rejects structural shells with non-A-F payload
- Rejects non-matching values
- Rejects unsafe math commands

The gap is UPSTREAM: the OCR/AI produces formatted text (LaTeX commands, structural wrappers) that the normalization cannot safely parse. The controlled-write is correctly rejecting content it cannot verify.

## Why `}A_\A{A}` Cannot Be Directly Accepted

The fingerprint `}A_\A{A}` represents any structural shell with two letters:
- `}B_\A{D}` → `BD` → valid labels → accepted ✓
- `}X_\A{Y}` → `XY` → non-labels → rejected ✓

The actual content determines whether it's valid. Accepting all `}A_\A{A}`-shaped answers would accept non-label content, which violates "宁可空，不能错挂." Dirty structural shells must remain rejected by controlled-write.

## Design: Two-Category Classification

### Type A: Safe Wrapper Unwrap Candidates

Patterns where the answer label IS present inside a knowably-safe formatting wrapper.

**Allowed wrappers:**

| Pattern | Example | Unwrapped | Condition |
| --- | --- | --- | --- |
| Plain A-F | `A`, `B` | `A`, `B` | Single letter |
| Parenthesized | `(A)`, `（B）` | `A`, `B` | Single letter |
| Braced | `{A}`, `{C}` | `A`, `C` | Single letter |
| Prefixed | `答案：A`, `选D`, `答:A` | `A`, `D` | Single letter |
| Dot-suffixed | `A.`, `B。` | `A`, `B` | Single letter |
| `\text{A}` | `\text{A}` | `A` | Safe command |
| `\mathrm{A}` | `\mathrm{B}` | `B` | Safe command |
| `\textbf{A}` | `\textbf{C}` | `C` | Safe command |
| `\A{A}` | `\A{A}` | `A` | Single-letter command, A-F inside |

**Allowed LaTeX commands (whitelist):**
`text`, `mathrm`, `mathbf`, `mathit`, `mathsf`, `texttt`, `textrm`, `textsf`, `textup`, `textnormal`, `textbf`, `textit`, `emph`, plus single-letter commands A-D.

**Conditions for unwrap:**
1. Wrapper command is in whitelist
2. Inner content is a single A-F letter
3. No subscripts, superscripts, fractions, roots, operators
4. No multiple candidate labels
5. No math expressions inside

### Type B: Dirty Structural Shell — Must Remain Rejected

Patterns that look structural but contain unsafe content.

**Blacklist patterns:**
- `}X_\cmd{Y}` — structural shells with LaTeX payload
- `X_\cmd{Y}` — underscore with LaTeX
- `x_A`, `A_1` — letter+underscore+suffix
- `\frac{X}{Y}` — fractions
- `\sqrt{X}` — roots
- `\angle X` — math operators with letters
- `\sin X`, `\cos X` — trig functions
- `A+B`, `A-B` — math expressions
- `AB`, `ACD` — multi-letter groups (could be multi-choice labels, need context)
- Text > 40 chars — likely mixed answer+solution content

**Verdict:** `dirty-structural-shell` → not eligible for simple unwrap → requires answer-only extraction (OCR/prompt-level improvement, not code-level unwrap).

## Labels-Only Answer Extraction Target Schema

The ideal upstream answer evidence:

```json
{
  "questionNumber": "8",
  "sourceOrder": 8,
  "label": "A",
  "evidenceType": "clean-label",
  "confidence": "high",
  "sourceTrace": { "pageIndex": 2, "blockIndex": 7 }
}
```

Requirements:
1. Labels-only — no solution text, no math, no explanations
2. sourceOrder + expectedQuestionNumbers aligned by sequence (not by AI `question` field)
3. Duplicate / jumpBack / outOfRange → fail-closed
4. Final acceptance STILL decided by controlled-write truth gate
5. Cleaner upstream evidence = more answers pass controlled-write

## Sequence Safety (Unchanged)

Same invariants as existing pipeline:
- Duplicate question markers → fail-closed
- Jump-back → fail-closed
- Out-of-range → fail-closed (unless in expectedQuestionNumbers)
- Draft snapshot ≠ baseline candidate
- Controlled-write = only truth gate

## Implementation Path (NOT IN P10E)

P10E is design only. If the design is approved, implementation would follow:

1. **P10F** — implement `classifyAnswerExtractionQuality` as a pure function in a new or existing module
2. **P10G** — wire it as upstream evidence enrichment (NOT as controlled-write replacement)
3. **P10H** — pre-real-run gate
4. **P10I** — controlled diagnostic real-run

## P10E Tests (11 mock tests)

| # | Test | Boundary |
| --- | --- | --- |
| 1 | Clean labels A-F | Accepted as candidates |
| 2 | Parenthesized/prefixed | Accepted as candidates |
| 3 | Safe LaTeX wrappers | Accepted as candidates |
| 4 | Dirty structural shell | Rejected |
| 5 | Unsafe LaTeX commands | Rejected |
| 6 | Mixed/long content | Rejected |
| 7 | Empty | Rejected |
| 8 | Candidate ≠ accepted | Design boundary respected |
| 9 | Q2 vs Q8/Q9 classification | Correctly separated |
| 10 | Duplicate labels | Not clean |
| 11 | Dirty shell never in baseline | Truth gate respected |

All tests are mock/design — no business code invoked.
