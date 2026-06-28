# BM-AUTO Grouped Helper Gate

Stage: BM-AUTO-GROUPED-HELPER-GATE
Branch: main
Latest HEAD: `d2b5ef5`
app.js: 22921 lines, 367 functions (inventory), 92 eligible (score)

---

## Chain A: Batch Media Token + Display Clean Pipeline

### Functions

| # | Name | Lines | Call Sites* | Pure | Deps (internal) | Deps (external) |
|---|------|-------|-------------|------|-----------------|-----------------|
| 1 | BATCH_MEDIA_TOKEN_RE | 2 | — | const | — | — |
| 2 | BATCH_BAD_PLACEHOLDER_RE | 2 | — | const | — | — |
| 3 | protectBatchMediaTokens | 9 | 1+2(1def) | yes | BATCH_MEDIA_TOKEN_RE | — |
| 4 | restoreBatchMediaTokens | 5 | 1+1(1def) | yes | — | — |
| 5 | hasBatchMediaToken | 4 | 3+1(1def) | yes | BATCH_MEDIA_TOKEN_RE | — |
| 6 | hasBatchImagePlaceholder | 4 | 0+1(1def) | yes | BATCH_BAD_PLACEHOLDER_RE, #5 | — |
| 7 | stripBatchImagePlaceholders | 13 | 1+1(1def) | yes | #3, #4, BATCH_BAD_PLACEHOLDER_RE | — |
| 8 | cleanDisplayTextForBatchSave | 5 | 45+1(1def) | yes | #7 | cleanRecognizedText (qisi-utils) |
| 9 | cleanDisplayOptionsForBatchSave | 18 | 42+1(1def) | yes | #5, #8 | cleanRecognizedText (qisi-utils) |
| 10 | optionTextHasContent | 15 | 1+1(1def) | yes | #5, #8 | — |
| 11 | countValidOptions | 4 | 1+1(1def) | yes | #9, #10 | — |
| 12 | cleanDisplayFieldsOnly | 10 | 4+1(1def) | **NO** (mutates q) | #8, #9 | — |

*Call sites format: (direct calls + definition). optionTextHasContent used as filter callback.

### Audit

- **DOM:** no
- **DB:** no
- **async:** no
- **AI/OCR:** no
- **PDF safety:** no
- **controlled-write:** no
- **Route B:** no
- **purity:** 11 of 12 functions are pure. cleanDisplayFieldsOnly **mutates** the input question object (writes `q.stem`, `q.options`, `q.answer`, `q.solution`). This matches existing behavior; migration would preserve the mutation.
- **Total function lines:** ~87 (excluding constants/comments)
- **Estimated delta:** ~ -90 lines
- **Total call sites to replace:** ~100 (45+42+3+1+1+4+1 = ~97 call sites across the subsystem)

### Testability

All functions are individually testable (pure string → string/bool/object). cleanDisplayFieldsOnly's mutation behavior is testable.

### Verifiability

Strict verifier with `--old-names` of all 10 function names would classify as REAL_MIGRATION if delta <= -10, old defs removed, app calls new module.

### Risk assessment

1. **HIGH:** 97 call sites spread across app.js batch save pipeline. A single missed replacement would break batch save.
2. **MEDIUM:** cleanDisplayFieldsOnly mutates input — must preserve exact mutation pattern.
3. **MEDIUM:** BATCH_MEDIA_TOKEN_RE / BATCH_BAD_PLACEHOLDER_RE are regex constants used by multiple functions. Must be exported or inlined.
4. **LOW:** All functions are pure text helpers, no external side effects.

### Recommendation: NEEDS MANUAL

Too large for automated one-shot migration (100+ call sites). Recommend:
- Migrate in 2 subgroups: Subgroup 1 (functions 1-7: media token core) then Subgroup 2 (functions 8-12: display cleaning). This would be 2 rounds.
- Or: accept as single round with extra verification.

---

## Chain B: Answer/Solution Splitting

### Functions

| # | Name | Lines | Call Sites* | Pure | Deps (internal) | Deps (external) |
|---|------|-------|-------------|------|-----------------|-----------------|
| 1 | normalizeAnswerSolutionSource | 7 | 4+1(1def) | yes | — | cleanRecognizedText (qisi-utils) |
| 2 | splitAnswerSolutionSections | 17 | 1+1(1def) | yes | #1 | — |

### Audit

- **DOM:** no
- **DB:** no
- **async:** no
- **AI/OCR:** no
- **PDF safety:** no
- **controlled-write:** no
- **Route B:** no
- **purity:** both pure
- **Total function lines:** ~24
- **Estimated delta:** ~ -24 lines
- **Total call sites to replace:** 5 (4 calls to normalizeAnswerSolutionSource + 1 call to splitAnswerSolutionSections)

### Delta concern

normalizeAnswerSolutionSource is only 7 lines. Individually it would be too small (delta ≈ -7 < 10). But together with splitAnswerSolutionSections (17 lines), the combined delta ≈ -24, well above 10.

### Testability

Both are pure string → string/object functions. Easy to test:
- normalizeAnswerSolutionSource: normal text, empty, null, whitespace
- splitAnswerSolutionSections: text with/without solution header, various header formats
- Integration: normalize → split pipeline

### Verifiability

Strict verifier with `--old-names normalizeAnswerSolutionSource,splitAnswerSolutionSections` would classify as REAL_MIGRATION:
- delta ≈ -24 (<= -10) ✅
- old definitions removed ✅
- app calls new module ✅
- module exports both functions ✅

### Risk assessment: LOW

- Only 2 functions, 5 call sites, well-understood behavior
- Both pure, both depend only on already-migrated cleanRecognizedText
- Call sites are localized (line 5246 internal, + 3 external for normalizeAnswerSolutionSource)

### Recommendation: ✅ ACCEPT

Small, well-defined group. Pure helpers. Already uses qisi-utils dependency. 5 call sites are manageable. Combined delta well above threshold.

---

## Chain C: cleanDisplayFieldsOnly standalone

### Analysis

cleanDisplayFieldsOnly depends on cleanDisplayTextForBatchSave + cleanDisplayOptionsForBatchSave (both in Chain A). It cannot be migrated independently until Chain A's upstream functions are migrated. After Chain A is migrated (Subgroup 2), cleanDisplayFieldsOnly becomes eligible as a downstream.

However, cleanDisplayFieldsOnly mutates its input. This is acceptable since it preserves existing behavior.

### Recommendation: DEFERRED not-completed Chain A resolution.

---

## Summary

| Chain | Functions | Delta | Recommendation | Reason |
|-------|-----------|-------|----------------|--------|
| A (Batch media) | 12 | ~-90 | NEEDS MANUAL | 100+ call sites, mutation risk, too big for one-shot |
| B (Answer split) | 2 | ~-24 | **ACCEPT** | Small, pure, 5 call sites, clean dependencies |
| C (cleanDisplay) | 1 | ~-10 | DEFERRED | Depends on Chain A upstream |

## Decision

- Chains accepting grouped migration: 1 (Chain B)
- Chains needing manual assessment: 1 (Chain A)
- Chains deferred: 1 (Chain C)
- At least 1 chain ACCEPT → grouped helper migration phase can proceed with Chain B first.
