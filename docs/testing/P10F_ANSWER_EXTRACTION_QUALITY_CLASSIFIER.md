# P10F Answer Extraction Quality Classifier

## Stage

P10F — implement `classifyAnswerExtractionQuality` as a pure function module

## Module

`qisi-pdf-answer-extraction-quality.js` — UMD module (browser + Node compatible)

### Exports

| Function | Purpose |
| --- | --- |
| `classifyAnswerExtractionQuality(rawAnswer, options)` | Main classifier |
| `isSafeLatexWrapper(value)` | Check if value is a safe LaTeX command wrapper |
| `isDirtyStructuralShell(value)` | Check if value is a dirty structural shell |
| `isCleanLabelCandidate(value)` | Check if value matches a clean label pattern |
| `unwrapSafeLatexWrapper(value)` | Unwrap a safe LaTeX wrapper to its inner label |
| `extractCleanLabel(value)` | Extract the A-F label from a clean label candidate |

### classifyAnswerExtractionQuality Output

```js
{
  original: string,           // the raw answer text
  status: "clean-label"       // status category
        | "safe-wrapper-candidate"
        | "dirty-structural-shell"
        | "rejected"
        | "empty",
  normalizedCandidate: string | null,  // extracted label or null
  reasonCode: string,         // machine-readable reason
  reasonDetail: string,       // human-readable explanation
  evidenceLevel: "candidate-only",  // always candidate-only
  canDirectlyAccept: false    // always false — never write permission
}
```

## Key Design Decision

```
canDirectlyAccept = false for ALL outputs, always.
evidenceLevel = "candidate-only" for ALL outputs, always.
```

This classifier provides **upstream evidence enrichment only.** It does NOT:
- Authorize answers for writing
- Change controlled-write decisions
- Generate baseline candidates
- Determine completeness

## Classification Rules

### clean-label

Matches when the answer is a single A-F letter, possibly with safe prefixes/parentheses:
`A`, `(A)`, `（B）`, `答案：C`, `选D`, `{A}`, `A.`

### safe-wrapper-candidate

Matches when a single A-F letter is wrapped in an allowed LaTeX command:
- Named commands: `\text{A}`, `\mathrm{B}`, `\textbf{C}`, etc.
- Single-letter commands: `\A{A}`, `\B{D}` (Q2 shape from P10C)

Conditions: command not in dirty list, inner is single A-F letter.

### dirty-structural-shell

Matches structural shells and unsafe patterns that must remain rejected:
`}A_\A{A}`, `A_\A{B}`, `x_A`, `A_1`, `\frac{A}{B}`, `\sqrt{A}`, `\angle A`, `A+B`, `AB`

### rejected

Matches content that doesn't fit any known pattern.

### empty

Matches empty string.

## Q2 and Q8/Q9 Classification

| Question | Input Shape | Status | normalizedCandidate |
| --- | --- | --- | --- |
| Q2 | `\A{A}` | `safe-wrapper-candidate` | `A` |
| Q8 | `}A_\A{A}` | `dirty-structural-shell` | `null` |
| Q9 | `}A_\A{A}` | `dirty-structural-shell` | `null` |

Q2 can potentially be recovered as evidence. Q8/Q9 cannot — they must remain rejected by controlled-write.

## Tests

15 tests (up from 11 in P10E design). All pass. Controlled-write/parser/aligner/runner untouched.
