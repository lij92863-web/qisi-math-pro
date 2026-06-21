# PDF Support Sequence Validator Spec

Stage P4.2 makes PDF support sequence validation explicit through `validatePdfSupportSequence`.

## Input

```js
validatePdfSupportSequence({
  answerItems,
  solutionItems,
  expectedQuestionNumbers
})
```

Inputs are structural only:

- normalized answer items,
- normalized solution items,
- expected question-number contract.

The validator does not inspect answer or solution semantic content.

## Output

The validator returns:

| Field | Meaning |
| --- | --- |
| `mode` | `full`, `prefix`, or `fail-closed`. |
| `reliable` | `true` only for `full`. |
| `empty` | No answer or solution sequence exists. |
| `invalidQuestions` | Invalid question markers from either sequence. |
| `duplicateQuestions` | Duplicate normalized question numbers. |
| `jumpBacks` | Structural jump-back rows. |
| `gaps` | Expected numbers missing from either answer or solution sequence. |
| `outOfRangeNumbers` | Numbers present in support but absent from `expectedQuestionNumbers`. |
| `answerSolutionSetMismatch` | Answer and solution sets differ. |
| `prefixCutoffIndex` | Count of shared safe prefix items. |
| `safeQuestionNumbers` | Shared safe prefix, or full sequence for `full`. |
| `fusedQuestionNumbers` | Expected or observed unsafe tail. |
| `report.reasons` | Machine-readable reason list. |

## Mode Rules

`full` requires:

- valid answer and solution question markers,
- no duplicates,
- strictly increasing answer and solution sequences,
- answer and solution sets match,
- if `expectedQuestionNumbers` is provided, both sequences match it.

`prefix` requires:

- the complete sequence is not reliable,
- a shared safe prefix can be proven from answer, solution, and expected order.

`fail-closed` is used when no shared safe prefix can be proven.

## Expected Question Numbers

`expectedQuestionNumbers` is the contract. Numbers such as `13` and `15` are safe only when:

- they are explicitly present in the expected list,
- their order is reliable,
- both answer and solution fields are structurally safe for them.

If `13` or `15` appear when the expected list is `1,2,3,4`, they are reported as out-of-range and do not enter `safeQuestionNumbers`.

## Duplicate, Jump-Back, And Out-Of-Range

- Duplicate markers force `prefix` or `fail-closed`.
- Jump-back markers force `prefix` or `fail-closed`.
- Out-of-range markers force `prefix` or `fail-closed`.
- No item after the unsafe point is allowed to become safe by semantic similarity or content.

## Attempt 12

Attempt 12 has answer coverage for all expected numbers but solution sequence `1,2,4,5,6,7,8,9,10,13,15`.

The validator must return:

- `mode: "prefix"`,
- `safeQuestionNumbers: ["1","2"]`,
- `fusedQuestionNumbers: ["3","4","5","6","7","8","9","10","13","15"]`,
- reason including solution discontinuity.

This is why solution ownership remains withheld after `2`.

## Known-Bad Boundary

Known-bad jump-back sequences remain blocked. The validator may preserve a safe prefix, but it must not allow unsafe answer or solution writes after duplicate, jump-back, gap, or out-of-range evidence.
