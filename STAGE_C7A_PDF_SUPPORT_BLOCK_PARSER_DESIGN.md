# Stage C7A PDF Support Block Parser Design

This document defines the proposed deterministic PDF support block parser.
C7A is design only: no code, no prompt changes, no model changes, and no real
AI/OCR calls.

## 1. Goals

- AI or vision models only provide raw text.
- Program logic splits support text by question number, answer marker, and
  solution marker.
- Program logic validates `sourceOrder`, `expectedQuestionNumbers`, and
  answer/solution pairing.
- Only safe blocks are attached to draft questions.
- Unreliable blocks remain empty.
- Misaligned answers must never enter the draft.

## 2. Non-Goals

- Do not change prompts.
- Do not change models.
- Do not change OCR.
- Do not change PDF rendering.
- Do not aim for fully automatic dual-PDF recognition.
- Do not rely on semantic similarity.
- Do not add special cases for specific question numbers.
- Do not continue piling complex logic into `app.js`.

## 3. Suggested Module Boundaries

- Add `qisi-pdf-support-block-parser.js` for deterministic PDF support block
  parsing.
- Add `tests/pdf-support-block-parser.test.js` for parser unit tests.
- Keep `qisi-pdf-support-aligner.js` responsible for `full`, `prefix`, and
  `fail-closed` alignment.
- Keep `qisi-support-parser.js` responsible for answer/solution text parsing.
- Keep `app.js` as a thin caller that wires parser output into the existing
  batch flow.

## 4. Core Input And Output Design

Input fields:

- `rawTextPages`: ordered page text from AI/OCR or a mock fixture.
- `expectedQuestionNumbers`: the trusted question-number contract from the
  question source.
- `sourceFileId`: stable identifier for diagnostics and traceability.
- `sourceOrder`: original page/block order used to detect jumps and merges.
- `mode`: `answer`, `solution`, or `support`.

Output fields:

- `blocks`: normalized support blocks with source trace and detected markers.
- `answerItems`: answer rows safe enough to pass into the aligner.
- `solutionItems`: solution rows safe enough to pass into the aligner.
- `warnings`: parser-level warnings.
- `coverageReport`: expected-number coverage and missing-field report.
- `sequenceReport`: monotonicity, duplicate, jump-back, and mismatch report.

## 5. Block Splitting Rules

- Explicit question numbers are the primary block boundary. Supported markers
  should include common forms such as `1.`, `第1题`, `(1)`, and OCR-lightly
  wrapped variants when they are unambiguous.
- Answer labels such as `【答案】`, `答案`, and equivalent normalized labels mark
  the answer section inside the current question block.
- Solution labels such as `【解析】`, `解析`, and equivalent normalized labels
  mark the solution section inside the current question block.
- A block may continue across pages when no new explicit question number is
  detected and `sourceOrder` remains increasing.
- Answer and solution text for the same detected question number should be
  merged into one logical block before producing `answerItems` and
  `solutionItems`.
- Unknown question numbers should be kept as unsafe blocks and reported, not
  attached to drafts.
- Duplicate question numbers should stop safe suffix mounting and emit a
  duplicate warning.
- Jump-back question numbers should stop safe suffix mounting and emit a
  jump-back warning.
- Missing question numbers may be inferred from `expectedQuestionNumbers` only
  when the surrounding order, source continuity, and marker structure make the
  inference deterministic.
- Fail closed when the parser cannot prove monotonic order, unique question
  ownership, or answer/solution pairing.

## 6. Safety Rules

- Prefer empty fields over wrong fields.
- Never trust the AI `question` field as the source of truth.
- Do not attach answer and solution rows whose question numbers disagree.
- After a gap, do not continue attaching the suffix.
- After a jump-back, do not continue attaching the suffix.
- After a duplicate question number, do not continue attaching the suffix.
- Everything outside the reliable prefix must be fused.
- DOCX+DOCX must not be affected by PDF support safety logic.

## 7. Test Plan

Mock tests should cover:

- Normal sequence `1-12`.
- Known bad sequence `1,3,4,5,6,7,8,9,10,11,2`.
- Duplicate question numbers.
- Jump-back question numbers.
- Answer/solution question-number mismatch.
- Cross-page solution continuation.
- Missing solution.
- Answer-only support.
- DOCX+DOCX main-chain flow not being harmed by PDF support logic.

## 8. Integration Plan

- C7B: create only the parser module and unit tests.
- C7C: connect mock smoke coverage to parser output.
- C7D: add thin `app.js` caller integration.
- C7E: run minimum browser regression.
- C7F: consider real PDF+PDF validation only after asking the user first.

## 9. Real AI/OCR Cost Control

- C7A through C7D must not call real AI/OCR by default.
- Real PDF+PDF tests require explicit user approval.
- Before any real test, explain the expected API call count, whether cost may
  be incurred, and why real testing is necessary.
