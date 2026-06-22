# BM-AUTO Chain A Manual Audit Map

Stage: BM-AUTO-CHAIN-A-MANUAL-AUDIT-MAP
Branch: main
Audit base commit: `b0513e6`

---

## Section 1: Function Inventory

Based on comprehensive app.js scanning around the batch media token + display cleaning pipeline (lines 1920-2050, plus related helpers at lines 10009-10060, 2447-2580, 5210).

### Core Chain A functions

| # | Function | Location | Body Lines | Call Sites* | Pure | Mutation | Deps In-App | Deps Qisi | Risk |
|---|----------|----------|------------|-------------|------|----------|-------------|-----------|------|
| 1 | BATCH_MEDIA_TOKEN_RE | 1929 | 2 | — | const | no | — | — | LOW |
| 2 | BATCH_BAD_PLACEHOLDER_RE | 1933 | 2 | — | const | no | — | — | LOW |
| 3 | INLINE_FORMULA_IMAGE_TOKEN | 1926 | 1 | — | const | no | — | — | LOW |
| 4 | BLOCK_IMAGE_TOKEN | 1927 | 1 | — | const | no | — | — | LOW |
| 5 | protectBatchMediaTokens | 1936 | 9 | 3 | yes | no | #1 | — | LOW |
| 6 | restoreBatchMediaTokens | 1946 | 5 | 2 | yes | no | — | — | LOW |
| 7 | hasBatchMediaToken | 1952 | 4 | 4 | yes | no | #1 | — | LOW |
| 8 | hasBatchImagePlaceholder | 1957 | 4 | 0 | yes | no | #2, #7 | — | LOW |
| 9 | stripBatchImagePlaceholders | 1963 | 13 | 1 | yes | no | #5, #6, #2 | — | LOW |
| 10 | cleanDisplayTextForBatchSave | 1977 | 5 | **46** | yes | no | #9 | cleanRecognizedText | HIGH-calls |
| 11 | cleanDisplayOptionsForBatchSave | 1983 | 18 | **43** | yes | no | #7, #10 | cleanRecognizedText | HIGH-calls |
| 12 | optionTextHasContent | 2018 | 15 | 4 | yes | no | #7, #10 | — | MED |
| 13 | countValidOptions | 2034 | 4 | 4 | yes | no | #11, #12 | — | LOW |
| 14 | addWarningOnce | 2013 | 4 | 23 | yes | yes | — | — | MED-mut |
| 15 | cleanDisplayFieldsOnly | 2002 | 10 | 4 | yes | **YES** | #10, #11 | — | HIGH-mut |
| 16 | optionCountOf | 2447,3159 | 4+3 | 6 | yes | no | #11 | — | LOW |
| 17 | choiceOptionIssue | 2578 | ~15 | 4 | yes | no | #16 | — | MED |
| 18 | choiceQuestionMissingOptions | 2043 | 3 | 6 | yes | no | #13 | — | LOW |

*Call sites = grep count of `functionName(` in app.js (includes definition)

### Extended Chain A functions (image placeholder helpers, lines 10009-10060)

| # | Function | Location | Body Lines | Call Sites | Pure | Mutation | Deps In-App | Risk |
|---|----------|----------|------------|------------|------|----------|-------------|------|
| 19 | hasUnconvertedImagePlaceholder | 10009 | 12 | 3 | yes | no | #5 | LOW |
| 20 | hasUnconvertedOptionPlaceholder | 10021 | 10 | 2 | yes | no | #19 | LOW |
| 21 | itemHasUnconvertedImagePlaceholder | 10032 | 6 | 1 | yes | no | #19 | LOW |

---

## Section 2: Call Site Map Summary

### High-call-volume functions (>10 call sites)

| Function | Call Count | Call Context Summary |
|----------|------------|---------------------|
| cleanDisplayTextForBatchSave | 46 | spread across batch save pipeline (DOCX parser L16801-16937, PDF support L18693-18694, various option repair L2835-5517, final draft write L22773-22775, solution patching L13265-13706) |
| cleanDisplayOptionsForBatchSave | 43 | same contexts as above, tightly coupled with cleanDisplayTextForBatchSave |
| addWarningOnce | 23 | scattered across draft write path (DOCX pipeline L17538-19122, PDF support L19324-20441), mutates `q.warnings` |
| optionCountOf | 6 | option comparison in DOCX/text repair paths |
| choiceQuestionMissingOptions | 6 | guard conditions before option repair warnings |
| countValidOptions | 4 | final draft validation (L19465, 20133-20135) |
| optionTextHasContent | 4 | used as filter callback + direct calls |
| choiceOptionIssue | 4 | draft quality diagnostics |

### Risk call sites (draft write, save path)

- `cleanDisplayFieldsOnly` call sites (L19125, 19688, 20115, 20441): ALL in final draft write path — mutates `q.stem`, `q.options`, `q.answer`, `q.solution`
- `addWarningOnce` call sites (L19012-20154): modifies `q.warnings` array — side effect on draft object
- `cleanDisplayOptionsForBatchSave` at L3495: WRITES `draft.options` = return value — save-path mutation

---

## Section 3: Dependency Graph

```mermaid
graph TD
  subgraph "Constants"
    BMR[BATCH_MEDIA_TOKEN_RE]
    BBR[BATCH_BAD_PLACEHOLDER_RE]
    IFIT[INLINE_FORMULA_IMAGE_TOKEN]
    BIT[BLOCK_IMAGE_TOKEN]
  end

  subgraph "Tier 1 — Token Helpers"
    PBM[protectBatchMediaTokens]
    RBM[restoreBatchMediaTokens]
  end

  subgraph "Tier 2 — Check Helpers"
    HBM[hasBatchMediaToken]
    HBI[hasBatchImagePlaceholder]
    SBI[stripBatchImagePlaceholders]
    HUI[hasUnconvertedImagePlaceholder]
    HUO[hasUnconvertedOptionPlaceholder]
    IHU[itemHasUnconvertedImagePlaceholder]
  end

  subgraph "Tier 3 — Display Cleaners"
    CDT[cleanDisplayTextForBatchSave]
    CDO[cleanDisplayOptionsForBatchSave]
    OTH[optionTextHasContent]
    CVO[countValidOptions]
    OCO[optionCountOf]
    AWO[addWarningOnce]
    CDF[cleanDisplayFieldsOnly]
    CIO[choiceOptionIssue]
    CQO[choiceQuestionMissingOptions]
  end

  BMR --> PBM
  BMR --> HBM
  BMR --> RBM
  BBR --> HBI
  BBR --> SBI

  PBM --> SBI
  RBM --> SBI
  HBM --> HBI
  HBM --> CDO
  HBM --> OTH
  PBM --> HUI

  SBI --> CDT
  CDT --> CDO
  CDT --> OTH
  CDT --> CDF
  HUI --> HUO
  HUI --> IHU

  CDO --> OTH
  CDO --> CVO
  CDO --> OCO
  CDO --> CDF
  CDO --> CIO

  OTH --> CVO
  AWO -.-> "q.warnings (mutation)"
  CDF -.-> "q.stem/options/answer/solution (mutation)"
  CVO --> CQO
```

---

## Section 4: Risk Classification

### ACCEPT_CANDIDATE (can migrate individually or in small groups)

| # | Function | Reason |
|---|----------|--------|
| 5 | protectBatchMediaTokens | pure, 9 lines, 3 call sites, only dep is BATCH_MEDIA_TOKEN_RE |
| 6 | restoreBatchMediaTokens | pure, 5 lines, 2 call sites |
| 7 | hasBatchMediaToken | pure, 4 lines, 4 call sites |
| 8 | hasBatchImagePlaceholder | pure, 4 lines, 0 direct calls (used as helper) |
| 9 | stripBatchImagePlaceholders | pure, 13 lines, 1 call site, deps are #5+#6+#2 |
| 19 | hasUnconvertedImagePlaceholder | pure, 12 lines, 3 call sites |
| 20 | hasUnconvertedOptionPlaceholder | pure, 10 lines, 2 call sites |
| 21 | itemHasUnconvertedImagePlaceholder | pure, 6 lines, 1 call site |

### SMALL_HELPER_EXCEPTION_CANDIDATE (delta < 10 but unlocks downstream)

| # | Function | Body Lines | Reason |
|---|----------|------------|--------|
| 7 | hasBatchMediaToken | 4 | unlocks #8, #14, #15, #16 |
| 8 | hasBatchImagePlaceholder | 4 | small but upstream |
| 6 | restoreBatchMediaTokens | 5 | unlocks #9 |
| 14 | countValidOptions | 4 | used in final draft validation |
| 16 | optionCountOf | 4+3 | used in option comparison |
| 18 | choiceQuestionMissingOptions | 3 | used as guard in draft path |

### NEEDS_MANUAL

| # | Function | Reason |
|---|----------|--------|
| 10 | cleanDisplayTextForBatchSave | **46 call sites** across parsed text, DOCX, PDF paths — too many to safely replace in one round |
| 11 | cleanDisplayOptionsForBatchSave | **43 call sites** — same as above |
| 14 | addWarningOnce | **23 call sites**, mutates `q.warnings` — widely used, side-effect risk |
| 15 | cleanDisplayFieldsOnly | **mutates 4 fields on draft object**, all 4 call sites in final draft write path |
| 17 | choiceOptionIssue | ~15 lines, used in draft quality diagnostics — needs fixture before migration |

### REJECT (must not auto-migrate)

None in Chain A core — all functions are pure or have known mutations. No DOM/DB/async/AI/OCR/Route B hits.

---

## Section 5: Recommended Split Batches

### Batch A1 — Token core (ACCEPT, ~50 lines, ~12 call sites)

Functions: #5 protectBatchMediaTokens, #6 restoreBatchMediaTokens, #7 hasBatchMediaToken, #8 hasBatchImagePlaceholder, #9 stripBatchImagePlaceholders, #1 BATCH_MEDIA_TOKEN_RE, #2 BATCH_BAD_PLACEHOLDER_RE

- **Total function body lines:** ~39
- **Estimated delta:** ~-50 (including constants and blank lines)
- **Call sites to replace:** ~12
- **Dependencies resolved:** all internal to the group
- **Risk:** LOW — all pure helpers, no mutations, no draft-write path
- **Tests needed:** normal text, media token protect/restore roundtrip, has token positive/negative, strip bad placeholders

**Decision: ✅ ACCEPT for grouped migration in one round**

### Batch A2 — Image placeholder checks (ACCEPT, ~28 lines, ~6 call sites)

Functions: #19 hasUnconvertedImagePlaceholder, #20 hasUnconvertedOptionPlaceholder, #21 itemHasUnconvertedImagePlaceholder

- **Total function body lines:** ~28
- **Estimated delta:** ~-35
- **Call sites to replace:** ~6
- **Dependency:** hasUnconvertedImagePlaceholder uses protectBatchMediaTokens (from Batch A1)
- **Risk:** LOW — pure boolean checks, used in guard conditions
- **Precondition:** Batch A1 must be migrated first

**Decision: ✅ ACCEPT — migrate after Batch A1**

### Batch A3 — Option text helpers (ACCEPT, ~46 lines, ~14 call sites)

Functions: #12 optionTextHasContent, #13 countValidOptions, #16 optionCountOf, #18 choiceQuestionMissingOptions, #17 choiceOptionIssue

- **Total function body lines:** ~42
- **Estimated delta:** ~-60
- **Call sites to replace:** ~20
- **Dependencies:** optionTextHasContent uses cleanDisplayTextForBatchSave + hasBatchMediaToken. After Batch A1 (hasBatchMediaToken migrated), cleanDisplayTextForBatchSave still blocks. Must be evaluated after Batch A4 decision.
- **Risk:** MED — choiceOptionIssue has ~15 lines, needs behavior fixture

**Decision: ⚠️ CONDITIONAL — requires Batch A1 + A4 resolved first**

### Batch A4 — Display cleaners (NEEDS MANUAL, ~37 lines, ~116 call sites)

Functions: #10 cleanDisplayTextForBatchSave, #11 cleanDisplayOptionsForBatchSave, #14 addWarningOnce, #15 cleanDisplayFieldsOnly

- **Total function body lines:** ~37
- **Estimated delta:** ~-50
- **Call sites to replace:** ~116 (46+43+23+4)
- **Mutation:** addWarningOnce mutates `q.warnings`; cleanDisplayFieldsOnly mutates stem/options/answer/solution
- **Risk: HIGH** — 116 call sites across DOCX, PDF, batch save, visual repair, draft validation paths

**Decision: ❌ DO NOT AUTO MIGRATE — needs phased manual approach**

Sub-strategy for Batch A4:
1. Replace in phases by context: DOCX path first, then PDF, then visual repair
2. OR: keep as app.js wrappers that delegate to qisi-utils internally
3. Batch A4 is the final gatekeeper before Chain C (cleanDisplayFieldsOnly standalone)

---

## Section 6: Test Fixture Needs

### Batch A1 (Token core)
```
Tests needed (≥12):
1. protectBatchMediaTokens: normal text with media tokens
2. protectBatchMediaTokens: text without tokens
3. protectBatchMediaTokens: empty/null/undefined
4. restoreBatchMediaTokens: roundtrip protect→restore
5. restoreBatchMediaTokens: empty tokens array
6. restoreBatchMediaTokens: null tokens
7. hasBatchMediaToken: text with IMAGE token → true
8. hasBatchMediaToken: text with FORMULA_IMAGE token → true
9. hasBatchMediaToken: plain text → false
10. stripBatchImagePlaceholders: removes bad placeholders, keeps good tokens
11. stripBatchImagePlaceholders: empty/null
12. app.js explicit calls + no naked calls
```
**Status: ✅ Testable with current fixtures — no additional fixture needed**

### Batch A2 (Image placeholder checks)
```
13. hasUnconvertedImagePlaceholder: text with unconverted placeholder → true
14. hasUnconvertedImagePlaceholder: clean text → false
15. hasUnconvertedImagePlaceholder: media token text → false
16. hasUnconvertedOptionPlaceholder: question with placeholder in options
17. itemHasUnconvertedImagePlaceholder: item with placeholder fields
```
**Status: ✅ Testable**

### Batch A3/B4 (Option text + Display cleaners)
```
18. optionTextHasContent: text with A-label prefix only → false
19. optionTextHasContent: text with substantive content → true
20. cleanDisplayTextForBatchSave: normal text
21. cleanDisplayTextForBatchSave: text with bad placeholders removed
22. cleanDisplayOptionsForBatchSave: 4-option array
23. cleanDisplayFieldsOnly: mutation test (q.stem/options/answer/solution changed)
24. addWarningOnce: warning added, no duplicate
25. representative batch save case: full question object fields
```
**Status: NEEDS FIXTURE for representative batch save cases (#25)**

---

## Section 7: Conclusion

### Chain A overall decision

| Question | Answer |
|----------|--------|
| Automatic migration allowed now | **No** — Batch A4 (116 call sites, mutation) blocks |
| Can migrate in phases | **Yes** — Batch A1 (token core) and Batch A2 (image checks) are independent, pure, and low-risk |
| First allowed batch | **Batch A1**: protect/restore/has/strip batch media token helpers |
| Blocker for full Chain A | **Batch A4**: 116 call sites across multiple save pipelines, mutation risk, cannot safely auto-replace |

### Recommended next task

**BM-AUTO-CHAIN-A-BATCH-A1-MIGRATION** — migrate five token helpers (protectBatchMediaTokens, restoreBatchMediaTokens, hasBatchMediaToken, hasBatchImagePlaceholder, stripBatchImagePlaceholders) plus two regex constants as one grouped round.

### Preconditions for Batch A1
- All current gates pass (verified below in Section 8)
- Working tree clean
- Combined delta ≈ -50, well above -10
- 12 call sites replaceable via `replace_all`
- No new module needed (all go to qisi-utils.js)
- Tests are writable with current fixtures
