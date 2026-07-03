# PDF Vision JSON LaTeX Escape Fix

## Stage

POST-BMR10 PRODUCT SMOKE — PDF vision JSON LaTeX escape fix

## Current HEAD Before Fix

880678d fix KaTeX dollar delimiter normalization and mixed text formula segmentation

## Symptom

| Item | Detail |
|------|--------|
| model | qwen-vl-plus |
| error | `invalid-json` — "JSON 字符串中检测到 LaTeX 单反斜杠命令，但修复后仍无法解析。" |
| raw failure type | `JSON.parse` throws on unescaped LaTeX backslashes in JSON strings |
| affected flow | strict vision whole-page question extraction → PDF review draft |

## Root Cause

### JSON string invalid escape

The visual model returns JSON with LaTeX commands containing single backslashes (e.g. `\alpha`, `\frac`, `\therefore`). JSON requires these to be double-escaped (`\\alpha`, `\\frac`).

### LaTeX commands

Known set existed for: `triangle`, `frac`, `sqrt`, `sin`, `cos`, `tan`, `overline`, `begin`, `end`, `left`, `right`, `angle`, `Delta`, `theta`, `alpha`, `beta`, `gamma`, `pi`, `circ`, `cdot`, `times`, `le`, `ge`, `neq`, `parallel`, `perp`, `vec`, `overrightarrow`, `ln`, `log`, `lim`, `text`, `mathrm`, `mathbf`, `mathbb`, `cases`.

But many common commands were missing: `\therefore`, `\because`, `\pm`, `\sum`, `\int`, `\infty`, `\partial`, etc.

### Parse path

`parseStrictQuestionPayload` (app.js:5684) → `hasUnescapedLatexCommandInJsonString` → `escapeLatexBackslashesInJsonCandidate` → `tryRepairedCandidate` (qisi-support-repair.js:536) → `JSON.parse`

### Two bugs found

1. **Known-commands-only detection**: `readLatexJsonCommandAt` only returned results for commands in the known set. Unknown commands (e.g. `\therefore`) were silently skipped, leaving the JSON invalid.

2. **`\t` prefix collision**: `\therefore` starts with `\t`. The old code treated `\t` as a valid JSON tab escape and skipped only the `t`, leaving "herefore" as plain text. The `\therefore` command was never detected or repaired.

## Fix

### Changed files

| File | Change | Lines |
|------|--------|-------|
| `app.js` | Generalized repair to handle ANY invalid JSON escape | +94/-15 |
| `tests/support-repair.test.js` | 8 new tests with inline repair function | +174 |
| `docs/testing/PDF_VISION_JSON_LATEX_ESCAPE_FIX.md` | This document | — |

### Helper updated

`readLatexJsonCommandAt` (app.js:5449) — now always returns command info for any letter sequence, with a `known` flag.

`hasUnescapedLatexCommandInJsonString` (app.js:5495) — new logic:
- Known command → needs repair
- Multi-letter unknown → needs repair (can't be a valid JSON escape)
- Single letter not in `{b,f,n,r,t}` → needs repair
- Single letter in `{b,f,n,r,t}` → valid JSON escape, pass through

`escapeLatexBackslashesInJsonCandidate` (app.js:5582) — new logic:
- `\uXXXX` checked BEFORE command reading (prevents `\u` from being read as a single-letter command)
- Known command → double backslash
- Multi-letter unknown → double backslash
- Single letter in `{b,f,n,r,t}` → pass through as valid JSON escape
- Single letter not in `{b,f,n,r,t}` → double backslash
- Non-letter sequences (`\{`, `\$`, etc.) → double backslash (generalized fallback)

### Repair rule

Only repairs JSON string contents. Preserves valid JSON escapes: `\\`, `\"`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, `\uXXXX`.

### Validation after repair

Unchanged — repair output still goes through:
- `JSON.parse`
- `extractQuestionArray` (schema validation)
- Question number / sequence validation
- Controlled-write safety checks
- Raw JSON leakage guard

## Safety

| Aspect | Value |
|--------|-------|
| no `eval` | ✅ Only uses `JSON.parse` |
| no regex field extraction | ✅ Full JSON parse required |
| no placeholder fallback | ✅ Fail-closed on parse failure |
| validator preserved | ✅ All existing checks after repair |
| fail-closed preserved | ✅ Invalid JSON → `invalid-json` error |
| raw JSON leakage guard preserved | ✅ `isRawJsonPayloadText` still active |

## Tests

### New tests (8)

| Test | Scenario |
|------|----------|
| repairs known LaTeX command | `\alpha` in known set → repaired |
| repairs UNKNOWN LaTeX command | `\therefore` not in known set → repaired (generalized fix) |
| repairs multiple unknown commands | `\because \therefore \pm` → all repaired |
| preserves valid JSON escapes | `\n`, `\"`, `中` → unchanged |
| preserves already-escaped LaTeX | `\\frac{1}{2}` → unchanged |
| handles structure error | `\alpha` repaired but trailing comma keeps JSON invalid → fail-closed |
| empty and null safe | Edge cases handled |
| tryRepairedCandidate integration | Full pipeline with generalized repair |

### Gate results

| Gate | Result |
|------|--------|
| tests/support-repair.test.js | 19 passed (8 new) |
| tests/qisi-app-display-cleaners-fixtures.test.js | 144 passed |
| tests/review-draft-state.test.js | 12 passed |
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

- `\therefore`, `\because`, `\pm` and other commonly missing LaTeX commands now repaired
- `invalid-json` errors from unknown LaTeX escapes resolved
- Validator still enforces all safety checks after repair
- No placeholder fallback — fail-closed on genuinely unrepairable JSON
- No raw JSON leakage
- No console runtime errors

## Decision

**PDF_VISION_JSON_LATEX_ESCAPE_FIX_ACCEPTED**

Not allowed to enter BMR11.
