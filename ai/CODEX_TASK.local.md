# CODEX_TASK.local.md

## Current program

R9 — Final release hardening and exhaustive real-material acceptance.

The user explicitly requested continuous execution across R9A through R9H with one
bounded commit per stage. A later stage may start only after the current stage's
scope gate and required tests pass. Any failing gate stops progression until the
failure is fixed within scope or reported as an external blocker.

## Objective

Produce a release candidate that is demonstrably safe across every file currently
in `C:\Users\Administrator\Desktop\题目与答案`, including combined
question+answer documents such as `高二.docx`, without file-specific branches or
semantic guessing. Verify recognition, question order, answers, solutions, formulas,
images, tables, layout, printing, question-bank workflows, and interactive controls.

## Global invariants

- Work only on `codex/*`; never modify `main` directly.
- DOCX+DOCX remains the stable baseline.
- PDF support remains `full`, safe `prefix`, or `fail-closed` only.
- Missing support is safer than incorrectly attached support.
- Preserve raw evidence, source trace, warnings, and unmatched blocks.
- No filename hashes, exact document titles, exact question text, or fixed expected
  answer lists may enter production algorithms.
- New complex logic belongs in focused `qisi-*.js` modules with Node/browser exports.
- `app.js` changes are limited to explicit module wiring and small UI orchestration.
- Do not change database schema or user source files.
- Test question-bank writes must occur only through the normal UI in the isolated
  in-app-browser profile; never write IndexedDB directly.
- No real `/api/ai/chat`, `/api/ai/ocr`, DashScope, or paid vision call until a
  dedicated stage records model, endpoint, maximum calls, cost risk, success and
  abort criteria. Local DOCX conversion and deterministic parsing are allowed.
- Every bug fix requires a generalized fixture or invariant proving the class of
  failure, not the named source document.
- Every performance change requires before/after timing or complexity evidence.

## R9 stages

### R9A — Release contract and inventory

Objective: freeze the material inventory, acceptance schema, stage boundaries, and
evidence rules. Documentation only.

Allowed files:

- `ai/CODEX_TASK.local.md`
- `docs/stages/STAGE_R9A_RELEASE_CONTRACT.md`

Required gate: `npm.cmd run verify:safe`.

### R9B — Deterministic real-material audit harness

Objective: build a local-only, no-AI harness that runs all current DOCX/PDF files,
records per-file/per-question structural evidence, timings, warnings, formula/image/
table counts, and creates an auditable result without modifying source materials.

Allowed files are limited to focused scripts, tests, fixtures derived from generalized
minimal cases, package scripts when necessary, the stage document, and this task file.
Production recognition code is read-only in R9B.

Required gates: focused harness tests, `verify:batch-safety`, `verify:safe`.

### R9C — DOCX recognition integrity

Objective: fix generalized DOCX failures proven by R9B, including answer-at-end
documents, question skeletons, MathType/OMML/LaTeX preservation, tables, images,
options, and mixed question/answer/solution sections.

Forbidden: PDF support modules, AI/OCR endpoints, DB schema, file-specific rules.

Required gates: new generalized fixtures, `verify:docx-stable`,
`verify:batch-safety`, `verify:safe`, then real-material rerun.

### R9D — PDF integrity and safe alignment

Objective: fix generalized PDF failures while preserving fail-closed alignment.

Forbidden: DOCX stable behavior changes, semantic answer attachment, DB schema.

Required gates: full/prefix/missing/duplicate/jump-back/unknown/mismatch/objective
fixtures, `verify:pdf-known-bad`, `verify:batch-safety`, `verify:safe`, then real PDFs.

Real-test authorization recorded on 2026-07-22:

- Purpose: exercise the question-PDF + answer-PDF workflow up to five complete runs.
- Inputs: `完整版题目.pdf` and `完整版答案.pdf` only.
- Endpoints: local `/api/ai/chat` and `/api/ai/ocr` proxy routes only; direct
  DashScope browser requests remain forbidden.
- Models: the production standard-mode choices currently configured by the app
  (`qwen-vl-plus`, `qwen-plus`, and `qwen-vl-ocr-latest` only when the structured
  OCR fallback is actually required).
- Maximum: five complete dual-PDF runs and at most 60 total upstream calls across
  those runs. Stop before another run if the observed cumulative count would exceed
  the cap; never start an accurate-mode fallback.
- Cost risk: paid DashScope usage proportional to rendered PDF pages; use standard
  mode and record actual text/vision call counts after every run.
- Success: expected question sequence is reliable, answers/solutions align without
  shift, previews contain no raw LaTeX leakage/mojibake, and PDF safety gates pass.
- Abort: any authentication, balance, quota, rate-limit, model-validation, sequence
  jump-back/duplicate, answer/solution mismatch, or unexpected model fallback error.
- Business code may be modified only after the failing evidence is captured and only
  inside the bounded R9D PDF stage.

### R9E — Review and print visual integrity

Objective: browser-verify every produced draft for readable math, correct image/table
placement, option layout, page breaking, and source-vs-question image separation.
Fix only generalized layout policies with visual or DOM evidence.

Required gates: focused visual/layout tests, zero browser page errors,
`verify:batch-safety`, `verify:safe`.

### R9F — Interaction and question-bank acceptance

Objective: exercise all 117 recorded click expressions and every visible question-bank
control using isolated test data inserted through the normal reviewed UI. Each action
must have automated evidence or a captured manual acceptance result; dead controls fail.

Forbidden: direct IndexedDB writes, weakening the action manifest, production data.

Required gates: UI action contract, browser smoke, `verify:safe`.

### R9G — Measured performance and architecture hardening

Objective: profile DOCX/PDF paths, remove measured bottlenecks and verified redundancy,
and re-audit the earlier Kimi findings. Changes must be split by subsystem and keep
stable-chain semantics unchanged.

Required evidence: before/after timings or complexity proof, architecture manifest,
focused tests, `verify:batch-safety`, `verify:safe`.

### R9H — Final release acceptance

Objective: rerun all current real materials and automated gates, inspect browser logs,
verify the remote branch, and produce a per-file/per-question/per-action report.

Acceptance requires:

- zero unexplained recognition or rendering error;
- zero incorrectly attached answer, solution, image, table, or question block;
- zero raw LaTeX leakage outside explicitly supported raw-source views;
- zero mojibake or formula syntax error in preview and print;
- zero dead or misleading button;
- zero real AI/OCR calls unless separately authorized and budgeted;
- clean working tree and one scoped commit per completed stage.

## Stop conditions

Stop the affected stage, not the whole program, when:

- the working tree is unexpectedly dirty;
- a required change falls outside the stage allowlist;
- a real AI/OCR call becomes necessary without the explicit budget contract;
- answer/solution ownership is uncertain;
- a test failure is outside scope;
- a requested claim cannot be supported by actual evidence.
