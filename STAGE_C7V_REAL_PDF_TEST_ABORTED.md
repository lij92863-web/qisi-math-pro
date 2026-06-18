# Stage C7V Real PDF Test Aborted

## 1. Current Status

- Branch: `stage-c7t-next-safe-work`
- Latest commit before test: `b4a6388 stage C7U add real PDF test gate`
- Working tree was clean before this documentation task.
- No code changes were made during the C7V real PDF test.
- No DB submit was performed.
- Browser was navigated to `about:blank`.
- Do not continue a second real PDF test.

## 2. C7V Result

- A valid real PDF+PDF test was not completed.
- The review page was not entered.
- No database submission was performed.
- The automation script mistakenly triggered a recognition task with only the question PDF.
- The answer PDF remained in the purpose confirmation modal and was not mounted into the task.
- The page showed the task at `37%` and `识别中`, indicating the recognition flow had been triggered.
- Captured diagnostics did not reliably record `/api` AI/OCR requests; only PDF `data:` reads were captured.
- No JavaScript exception was captured.
- Only external CDN / favicon network errors were observed.
- `wrong mount found`: yes.
- Stop reason: the answer/solution file purpose was not confirmed, but the task had already started, hitting the C7U stop condition.

## 3. Conclusion

This is not a valid real PDF verification result for C7T controlled write.

This run cannot be used to determine whether PDF+PDF answer/solution mounting is correct.

The issue belongs to the test flow / UI preflight gate / automation click-order risk, not to parser, aligner, or controlled-write behavior.

## 4. Forbidden Follow-up Actions

- Do not continue the real PDF test.
- Do not repeat AI/OCR calls.
- Do not modify parser based on this result.
- Do not modify aligner.
- Do not modify controlled write.
- Do not add semantic patching.
- Do not add question-number special casing.

## 5. Next Stage Suggestion

Move to C7W: fix the batch-task startup preflight gate.

Goal: when `pendingPurposeFile` or `pendingPurposeQueue` still exists, or when any uploaded file purpose has not been confirmed, creating or starting the recognition task must be blocked with a clear prompt.

Also add mock/unit tests to avoid the next real test entering the state where the question file has already started recognition while the answer file is not mounted.
