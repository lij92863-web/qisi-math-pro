# P9B P8G Attempt 1 Failure Signature Fixture

## Stage

P9B — solidify P8G attempt 1 failure signature as sanitized fixture

## P8G Attempt 1 Result

| Field | Value |
| --- | --- |
| Result | `pass-safe-partial` |
| Answer coverage (draft) | 10/12 (missing 8, 9) |
| Solution coverage | 12/12 |
| Controlled-write accepted answers | [1, 7, 10, 13, 15] — 5/12 |
| Controlled-write rejected answers | [2, 3, 4, 5, 6, 8, 9] — 7/12 |
| Baseline candidate answers | [1, 7, 10, 13, 15] — 5/12 |
| AI/OCR calls | 9 |
| Parser gate mode | full |

## Fixture

`p8gAttempt1FailureSignatureFixture` in `tests/fixtures/pdf-real-case-minimal.js`

- Q2-6: 单选题 with options → `option-value-not-matched`
- Q8-9: multiple with options → `multiple-option-value-rejected`
- Q1, Q7, Q10, Q13, Q15: subjective → accepted

## Tests Added

| # | Test | What it verifies |
| --- | --- | --- |
| 1 | Only 5/12 answers accepted by controlled-write | Exact accepted/rejected match |
| 2 | Baseline candidate = controlled-write ∩ draft | Not draft alone |
| 3 | pass-safe-partial: 5/12 is not complete | Rejected + missing → not complete |
| 4 | Solution 12/12 does not determine baseline | Answer/solution independence |

## Safety

- No business code modified
- No real-run
- known-bad/DOCX/Attempt12 all pass
