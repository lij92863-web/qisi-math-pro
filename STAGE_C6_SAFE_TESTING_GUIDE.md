# Stage C6 Safe Testing Guide

This guide defines the low-cost test commands that are safe to run by default,
and the tests that must not be run without explicit user approval.

## Default Free Checks

The following commands are allowed by default:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run smoke:batch:mock
npm.cmd run verify:safe
```

## verify:safe

`verify:safe` is the one-command baseline safety check for ordinary code
changes. It runs syntax checks, the Node test suite, and the batch mock smoke
test in sequence.

It is intended to be low cost:

- It does not call real AI/OCR.
- It does not upload real PDF/DOCX files.
- It is suitable after normal code changes before any higher-cost manual or
  browser validation.

## Mock Smoke Coverage

`smoke:batch:mock` covers the current batch import safety cases with fixed
fixtures:

- PDF+PDF known bad sequence: `1,3,4,5,6,7,8,9,10,11,2`.
- Misaligned answers for questions 8, 9, 10, and 11 must not enter the draft.
- Unreliable suffix questions are routed to fused handling.
- DOCX+DOCX main-chain data is not incorrectly marked with
  `pdf-support-sequence-unreliable`.

## Tests Not Allowed By Default

Do not run these tests by default:

- Real PDF+PDF recognition.
- Real DOCX+DOCX upload recognition.
- Real OCR.
- Real AI chat or vision.
- Playwright browser tests that do not intercept AI endpoints.
- Any test that may consume API quota.

## Required Approval For Real Tests

If a real test is necessary, stop first and explain:

- What will be tested.
- Whether AI/OCR will be called.
- Whether the test may produce cost.
- Approximately how many API calls may be made.
- Why a real test is necessary.

Only run the real test after the user gives explicit approval.
