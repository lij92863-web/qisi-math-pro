# Stage C7D Block Parser App Integration Plan

This document defines the risk-controlled plan for integrating the PDF support
block parser into the app in a later stage. C7D is design only: no code changes,
no `app.js` wiring, no page wiring, and no real AI/OCR calls.

## 1. Current Foundation

- C7A completed the deterministic PDF support block parser design.
- C7B added `qisi-pdf-support-block-parser.js` and parser unit tests.
- C7C routed batch mock smoke through:
  `rawTextPages -> parsePdfSupportBlocks -> alignPdfSupport -> mock draft assertions`.
- Current `verify:safe` passes.
- Real AI/OCR has not been called.

## 2. Integration Goals

- Future PDF support recognition should prefer the deterministic block parser.
- AI or vision models should only provide `rawTextPages` or raw OCR text.
- The parser should split support text by question number, `【答案】`, and
  `【解析】`.
- The aligner should remain responsible for `full`, `prefix`, and
  `fail-closed` safety decisions.
- `app.js` should only perform thin calls and data passing.

## 3. Non-Goals

- Do not write large parser logic inside `app.js`.
- Do not change prompts.
- Do not change models.
- Do not change OCR.
- Do not change PDF rendering.
- Do not pursue fully automatic PDF+PDF recognition.
- Do not rely on semantic similarity.
- Do not add special cases for specific question numbers.
- Do not bypass the aligner's safety decision.

## 4. Suggested Integration Search Points

Before implementing the integration, locate these positions in the existing
flow:

- The point after PDF support file recognition completes and raw text or support
  text is available.
- The point before `answerItems` and `solutionItems` enter `alignPdfSupport`.
- The current legacy support merge point where support data enters draft items.
- The point where support warnings are written to draft items.

## 5. C7E Code Boundary

When code integration begins, keep the allowed surface narrow:

- `main.html` may add a script tag for `qisi-pdf-support-block-parser.js`.
- `app.js` may make only a very thin parser call.
- Do not add complex rules to `app.js`.
- If complex adaptation is needed, create an independent `qisi-*.js` adapter
  module.
- If `app.js` net growth exceeds 80 lines, explain why.
- If `app.js` net growth exceeds 150 lines, reject the approach by default.

## 6. Safety Switch Recommendation

The first integration should use shadow mode:

- Parser output should only be logged or used for mock comparison.
- Do not directly replace legacy behavior.
- Do not directly write parser output into drafts.
- Compare parser `answerItems` and `solutionItems` with legacy output.
- Only consider affecting real drafts after mock smoke and unit tests are
  stable.

## 7. Test Requirements

Before any behavior-changing integration, the following must remain true:

- `npm.cmd run verify:safe` passes.
- Batch mock smoke passes.
- Parser unit tests pass.
- DOCX+DOCX is not harmed by `pdf-support-sequence-unreliable`.
- Real AI/OCR is not called.

## 8. Real Test Gate

Real PDF+PDF or DOCX+DOCX browser tests require explicit user approval.

Before running them, explain:

- What will be tested.
- Whether AI/OCR will be called.
- Whether the test may produce cost.
- Approximately how many API calls may be made.
- Why real testing is necessary.

## 9. Recommended Later Stages

- C7E: add the parser script to `main.html` without changing behavior.
- C7F: add an `app.js` shadow call that records parser output but does not
  write drafts.
- C7G: compare parser output with legacy output in mocks.
- C7H: run minimum browser regression.
- C7I: after user approval, run a small real PDF+PDF validation sample.
