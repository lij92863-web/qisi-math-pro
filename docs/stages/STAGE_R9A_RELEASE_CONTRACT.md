# STAGE R9A — Final Release Contract

## Objective

Freeze a bounded, evidence-driven release-hardening program for every current test
material without combining DOCX, PDF, UI, performance, and architecture changes in a
single unsafe patch.

## Material inventory at stage start

- 13 DOCX files and 3 PDF files under
  `C:\Users\Administrator\Desktop\题目与答案`.
- Includes three previously external Guangdong/Hebei/Hubei exams, two additional
  Guangdong exams, and `高二.docx` with questions plus trailing answers.
- Source files are read-only and remain outside Git.

## Evidence model

Each real-material run records:

- source filename and content hash in test output only;
- conversion/parser timings and failure stage;
- source and draft question sequence;
- per-question stem/options/answer/solution presence;
- formula, image, table, warning, and source-trace evidence;
- browser preview and print defects;
- console errors and forbidden AI/OCR request count.

Production decisions may not depend on a filename, hash, exact question string, or
the expected answer of a named material.

## Stage boundaries

- R9B: harness only; production recognition is read-only.
- R9C: DOCX only.
- R9D: PDF only.
- R9E: review/print layout only.
- R9F: UI actions and isolated question-bank workflow only.
- R9G: measured performance/architecture changes only.
- R9H: verification and reporting only.

## Real AI/OCR boundary

R9A authorizes no paid AI/OCR call. Real calls require a later explicit contract with
model, endpoint, maximum calls, cost risk, success criteria, and abort conditions.

## Acceptance

- The program is staged, bounded, and reversible.
- Stable DOCX and fail-closed PDF invariants remain non-negotiable.
- Each stage has tests and a separate commit.
- Final claims require per-file/per-question/per-action evidence.

