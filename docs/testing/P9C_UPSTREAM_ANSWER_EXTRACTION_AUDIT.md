# P9C Upstream Answer Extraction Opportunity Audit

## Stage

P9C — upstream answer extraction improvement eligibility audit (read-only)

## Decision

**B — Upstream answer extraction improvement is NOT ELIGIBLE.**

## Audit Questions Answered

### 1. What is the raw shape of answer 8/9?

From P8G attempt 1: structural shells with `}_\A{...}` pattern. Controlled-write detects the structural shell (the `}_` prefix matches) but compaction yields non-A-F characters (`non-label-payload`). The sanitized shape is `}X_\A{Y}` / `}P_\A{Q}`. This means the OCR-extracted text has a LaTeX-like structural wrapper but the inner content is not valid option labels (A-F).

### 2. Where does non-label-payload come from?

The current pipeline:
```
PDF → DashScope OCR API → rawTextPages → block parser → support items → controlled-write
```

The `non-label-payload` results from the OCR API returning text that:
- Has the structural form of a wrapped answer (the `}_\A{...}` LaTeX-like pattern)
- But contains characters outside the A-F label range

This is an OCR extraction quality issue: the OCR model returned the visual structure of the formatted answer text but didn't produce clean option labels. The inner content was likely:
- LaTeX rendering artifacts from the PDF
- Mixed content from adjacent text
- Encoding artifacts

### 3. Does the current prompt/schema require answer-only clean labels?

The OCR/recognition prompt configuration is in `app.js` (forbidden from modification in this task). The current setup sends pages to DashScope and receives back markdown/text. There is no dedicated "answer-only clean label extraction" step — the block parser extracts answer text from the OCR output, and controlled-write validates it.

### 4. Is there already an answer-only extraction route?

Yes — `normalizeObjectiveAnswerToLabels` in `qisi-pdf-support-controlled-write.js`. This IS the answer-only extraction gate. It:
- Strips math shells
- Detects structural label shells
- Compacts to potential labels
- Validates against option set
- Returns ok/rejected

P8E0 confirmed this function is correct and not a mis-fire.

### 5. Can upstream extraction be improved without weakening controlled-write?

To improve upstream extraction, we would need one of:
- Modify OCR prompt/schema in `app.js` → **forbidden**
- Add post-processing in parser to clean answer text → **would duplicate controlled-write logic**
- Add re-extraction AI call for rejected answers → **requires app.js + new AI calls**
- Modify block parser to extract answer-only content → **parser doesn't know question type or options**

None of these can be done without touching forbidden files (`app.js`, `qisi-pdf-support-block-parser.js`, `qisi-pdf-support-aligner.js`).

### 6. How to guarantee not directly trusting AI `question` field?

The sequence validator already handles this: answers are aligned by `sourceOrder` + `expectedQuestionNumbers`, not by AI-reported `question` field. The current pipeline does NOT trust AI `question` fields for alignment. This protection is already in place and working.

### 7. Can alignment by expectedQuestionNumbers + sourceOrder + labels-only schema work?

It already works. The `validatePdfSupportSequence` function aligns by structural evidence (expected numbers, source order, continuity, duplicates, jump-backs). The controlled-write then validates each answer label independently. The issue is not alignment — it's that the raw answer text contains non-label content that no amount of alignment can fix.

### 8. How many additional AI/OCR calls would be needed?

Any improvement would require at minimum:
- Modifying the OCR prompt (requires app.js change)
- Or adding a new answer-specific OCR pass (additional 1-2 AI calls per page × 4 pages = 4-8 new calls)
- Or a per-question re-extraction (12 new AI calls)

This is either forbidden (app.js) or costly (new calls) with uncertain benefit.

### 9. Is it worth it, or accept safe partial?

**Accept safe partial.** Reasoning:

1. The current pipeline correctly identifies and rejects unsafe answers (proven by P8E0)
2. The remaining gap (answers 8, 9) is due to OCR extraction quality, not code defects
3. Improving OCR extraction requires modifying `app.js` (forbidden) or making new AI calls (costly, uncertain)
4. The system already provides draft review UI where the teacher can manually fill missing answers
5. The safety invariants (no wrong answers, DOCX stable, known-bad blocked) are all preserved
6. Forcing automatic 12/12 would risk introducing wrong answers

## Recommendation

**Do not pursue upstream answer extraction improvement.**

The correct path is **P9I**: productize safe partial — display missing answers clearly in review page, show rejection reasons, and rely on teacher review to fill the 2 missing answers.

This is consistent with the project's highest principle: "宁可空，不能错挂" (better empty than wrong).
