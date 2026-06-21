# PDF Support P8B Answer Rejection Fixture

## Stage

P8B — fixture-first reproduction of P7 answer 2/8/9 rejection

## Objective

把 P7 中 answer 2/8/9 被 controlled-write rejected 的问题固化为脱敏 fixture 和测试。

P8B 不修业务代码，不 real-run，不调用 AI/OCR/API。

---

## P7 Exposed Problem

P7 真实双 PDF run 产生了 `pass-safe-partial` 结果：

| Field | P7 Result |
| --- | --- |
| Answer coverage | 10/12 (missing 8, 9) |
| Solution coverage | 12/12 |
| Rejected answers | 2, 8, 9 |
| Rejected solutions | none |
| Warning code | `parser-objective-answer-rejected` |
| Parser gate | full |
| Runner ledger | fail-closed |

### Answer 2

- Rejection reason: `option-value-not-matched`
- Question type: single-choice (单选题)
- Path: objective answer normalization → value does not match any option text
- Controlled-write rejects, but runner draft snapshot may still include it from other sources (review/repair path)
- This creates a runner summary consistency issue (P8D will address)

### Answers 8 and 9

- Rejection reason: `multiple-option-value-rejected`
- Question type: multiple-choice (multiple)
- Path: structural label shell detected (`}` or `_` prefix) → compaction yields `non-label-payload` → `normalizeStructuralObjectiveLabelAnswer` returns null → multi-choice path → single segment (not comma-separated) → `multiple-option-value-rejected`
- Answers 8 and 9 are NOT written to draft
- Solutions 8 and 9 are still written (independent field-level decision)

---

## p7AnswerRejectionFixture

### Location

`tests/fixtures/pdf-real-case-minimal.js`

### Fields

| Field | Value |
| --- | --- |
| `id` | `p7-answer-rejection-2-8-9` |
| `expectedQuestionNumbers` | `[1,2,3,4,5,6,7,8,9,10,13,15]` |
| `questionItems` | 12 items: Q2 is 单选题 with options, Q8/Q9 are multiple with options, others are subjective |
| `rawTextPages` | 4 sanitized pages based on `attempt7ResidualMarkerFixture` with modified answer content |

### Modified answer content

| Question | Original | Replaced with | Effect |
| --- | --- | --- | --- |
| Q2 | `A2` | `P7_MISMATCHED_ANSWER_2` | Non-matching option value → `option-value-not-matched` |
| Q8 | `A8` | `}X_\A{Y}` | Structural shell, non-label-payload → `multiple-option-value-rejected` |
| Q9 | `A9` | `}P_\A{Q}` | Structural shell, non-label-payload → `multiple-option-value-rejected` |

### Expected behavior

| Expectation | Value |
| --- | --- |
| Parser gate mode | `full` |
| Parser blocks | 12 |
| Answer items detected | 12 |
| Solution items detected | 12 |
| Controlled-write accepted answers | `[1, 3, 4, 5, 6, 7, 10, 13, 15]` (9) |
| Controlled-write accepted solutions | `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15]` (12) |
| Rejected answers | `[2, 8, 9]` |
| Answer 2 reason | `option-value-not-matched` |
| Answer 8 reason | `multiple-option-value-rejected` |
| Answer 9 reason | `multiple-option-value-rejected` |
| Warning code | `parser-objective-answer-rejected` |
| Solution 8/9 | Accepted (independent of answer rejection) |
| Result classification | `pass-safe-partial` |

---

## How Answer 2/8/9 Rejection is Covered by Tests

### `tests/pdf-support-controlled-write-answer-ownership.test.js` (NEW)

10 focused tests:

1. **P7 controlled-write rejects answers 2, 8, 9 and records diagnosable reasons** — verifies parser gate full, controlled-write rejects correct answers, warnings have correct codes and reasons
2. **P7 rejected answers 8 and 9 are not written to draft** — verifies answers 8/9 absent from effective items, solutions still present
3. **P7 answer 2 rejection reason is diagnosable** — verifies warning has code, reason, originalAnswer, structuralCandidate
4. **P7 solution 12/12 does not unlock answer 8/9** — verifies independent field-level decisions
5. **P7 parserGate full does not mean controlled-write complete** — verifies parser full ∧ controlled-write incomplete
6. **P7 pass-safe-partial is not treated as complete baseline** — verifies missing answers + rejected warnings → not complete
7. **known-bad still rejects unsafe wrong answers alongside P7 fixture** — verifies no regression
8. **Attempt 12 unsafe solution ownership is not expanded** — verifies Attempt 12 remains prefix
9. **answer and solution field-level write independence** — generic independence assertion
10. **normalizeObjectiveAnswerToLabels rejects non-label-payload structural shells** — direct unit test of the rejection path

### `tests/pdf-real-case.test.js`

Added test: "P7 answer rejection fixture reproduces controlled-write rejecting 2, 8, 9 while parser gate is full"

### `tests/batch-smoke-mock.test.js`

Added test: "P7 answer rejection mock rejects answers 2, 8, 9 while keeping solution 12/12"

### `tests/pdf-support-aligner.test.js`

Added tests:
- "P7 full parser alignment does not guarantee answer ownership is complete"
- "solution 12/12 with answer gap does not unlock answer ownership in aligner output"

---

## Why Solution 12/12 Cannot Unlock Answer 8/9

The `buildPdfSupportFieldLevelControlledWrite` function in `qisi-pdf-support-controlled-write.js` processes answers and solutions independently for each question number:

1. For each question, it evaluates answer safety separately from solution safety
2. If the answer is rejected (objective normalization fails), it records a warning and does NOT write the answer
3. The solution for the same question is evaluated independently
4. Having solution accepted does NOT retroactively accept a rejected answer

This is the correct fail-closed behavior: answer evidence and solution evidence are independent, and one complete side does not compensate for gaps in the other.

---

## Why ParserGate Full ≠ Controlled-Write Complete

Parser gate (block parser + aligner) validates **structural sequence**:
- All expected question numbers have answer and solution blocks
- Sequence is continuous, no duplicates, no jump-backs
- Answer and solution question sets match

Controlled-write validates **field-level content safety**:
- Each answer value is structurally safe to write
- Objective answers normalize to valid option labels
- Option values convert only when unambiguous
- Multiple-choice values are valid label sets

A parser that finds 12 answer blocks does not guarantee the answer TEXT in each block is safe. The controlled-write layer adds a content-level safety check that the parser/aligner cannot perform.

---

## Why P8B Does Not Fix Business Code

1. **The rejection chain is understood but not yet fully classified.** P7 shows three different rejection reasons sharing one warning code. P8C will create a finer taxonomy.

2. **The runner summary consistency issue (answer 2) is undiagnosed.** P8D will investigate why the draft snapshot includes answer 2 when controlled-write rejects it.

3. **Fixture-first is the governing principle.** Before any code change, the problem must be reproducible in tests. P8B establishes that baseline.

4. **It is not yet proven that answers 8/9 SHOULD be accepted.** The structural evidence may or may not be sufficient. P8C classification and P8E safe repair will determine this.

---

## Next Stage: P8C

P8C will classify controlled-write answer rejection reasons into a finer taxonomy:

- `structural label shell` — detected but payload is non-label
- `unsafe math command` — contains LaTeX math commands in structural shell
- `empty answer` — no answer content
- `untrusted evidence` — sourceTrace unreliable
- `normalization mismatch` — value cannot be normalized to option labels
- `option label ambiguity` — multiple options match the value
- `missing sourceTrace` — no diagnostic source trace
- `runner summary mismatch` — draft snapshot differs from controlled-write

P8C must be backward-compatible, preserve the existing `parser-objective-answer-rejected` code as a fallback, and must NOT weaken any safety policy.

---

## Files Changed in P8B

| File | Change |
| --- | --- |
| `tests/fixtures/pdf-real-case-minimal.js` | Added `p7AnswerRejectionFixture` and `p7AnswerRejectionQuestionItems` |
| `tests/pdf-real-case.test.js` | Added P7 rejection test |
| `tests/batch-smoke-mock.test.js` | Added P7 mock smoke test |
| `tests/pdf-support-aligner.test.js` | Added 2 boundary tests |
| `tests/pdf-support-controlled-write-answer-ownership.test.js` | **NEW** — 10 focused tests |
| `docs/testing/PDF_SUPPORT_P8B_ANSWER_REJECTION_FIXTURE.md` | **NEW** — this document |
