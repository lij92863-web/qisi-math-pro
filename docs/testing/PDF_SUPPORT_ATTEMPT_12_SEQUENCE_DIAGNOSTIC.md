# PDF Support Attempt 12 Sequence Diagnostic

Stage P2 adds a sanitized fixture and tests for the Attempt 12 failure shape.

## Observed Shape

Attempt 12 reached apparent answer coverage but did not reach safe solution coverage:

| Field | Result |
| --- | --- |
| Expected question numbers | `1,2,3,4,5,6,7,8,9,10,13,15` |
| Answer coverage | `12/12` in the sanitized fixture |
| Solution coverage | Safe only for `1,2` |
| Unsafe/missing solution ownership | `3,4,5,6,7,8,9,10,13,15` |
| Safe status | `prefix` / `pass-safe-partial` |

## Fixture

The fixture is `attempt12SequenceDiscontinuityFixture` in `tests/fixtures/pdf-real-case-minimal.js`.

It is fully sanitized:

- Uses synthetic answer and solution strings.
- Preserves the structural expected sequence, including `13` and `15`.
- Includes all answer markers.
- Omits solution ownership for question `3`, then continues later solution markers.

This forces the parser/aligner path to prove a prefix only, rather than treating later solution markers as safe.

## Required Safety Assertions

The tests assert:

- `parserGate.mode !== "full"`.
- `parserGate.solutions` is exactly `["1", "2"]`.
- `fusedQuestionNumbers` is exactly `["3","4","5","6","7","8","9","10","13","15"]`.
- Field-level controlled write keeps full safe answer coverage from legacy-safe answer evidence.
- Field-level controlled write does not write unsafe solutions for `3,4,5,6,7,8,9,10,13,15`.
- The batch mock still blocks real AI/OCR calls.
- DOCX+DOCX stable mock remains covered by the same smoke suite.

## Files

| File | Role |
| --- | --- |
| `tests/fixtures/pdf-real-case-minimal.js` | Adds the sanitized Attempt 12 structural fixture. |
| `tests/pdf-real-case.test.js` | Checks parser gate and controlled-write safety. |
| `tests/pdf-support-block-parser.test.js` | Checks parsed answer/solution coverage and missing solution `3`. |
| `tests/batch-smoke-mock.test.js` | Checks draft-like output keeps unsafe solutions empty while answers remain complete. |

## Boundary

No business code changed in this stage. This fixture documents current safety behavior and must not be used to add special-case question-number fallbacks.
