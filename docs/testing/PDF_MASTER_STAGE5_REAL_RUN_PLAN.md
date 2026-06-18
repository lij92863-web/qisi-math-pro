# PDF Master Stage 5 Real Run Plan

## Scope

Stage 5 evaluated whether a controlled real PDF+PDF validation run can be safely established before using any real API attempt.

Authorized real files remain limited to:

- `local-test-materials/case02-pdf-pdf-real/01-question.pdf`
- `local-test-materials/case02-pdf-pdf-real/02-support-answer-solution.pdf`

No real API call was made in this stage.

## Current local capabilities

The repository currently has:

- `qisi-local-server.js`, which exposes local proxy endpoints for DashScope chat and OCR.
- `scripts/smoke-ai-proxy.js`, which verifies proxy health with tiny synthetic inputs.
- `scripts/smoke-ai-vision-proxy.js`, which verifies the vision proxy with a tiny synthetic image.
- browser-side batch import code in `app.js`, where PDF rendering, OCR calls, parser gates, controlled write, IndexedDB drafts, and final warnings are connected.

## Blocking issue

A safe real double-PDF validation runner is not yet established.

The missing piece is a controlled runner that can execute the actual browser batch import chain against the two authorized PDFs, collect only sanitized summary fields, and prevent committing raw OCR, secrets, PDF bytes, or local-run artifacts.

The existing proxy smoke scripts are not sufficient because they do not exercise:

- PDF page rendering
- file role assignment
- question/support batch orchestration
- parser gate and legacy gate interaction inside `app.js`
- IndexedDB draft creation
- final draft answer/solution/warning state

Creating such a runner would require additional browser automation and artifact handling design. That is beyond a safe Stage 5 preparation in the current state because an incomplete runner could either miss the real production path or leak raw OCR.

## Stop decision

Per the task stop condition, Stage 5 stops before Stage 6.

Reason: controlled real validation cannot be safely established from the existing scripts without adding a reliable browser-chain runner and sanitized artifact boundary.

## Real API attempt ledger

Attempts used in this stage: 0

No call was made to real AI/OCR endpoints.

## Required properties for a future runner

A future real validation runner should:

- only accept the two authorized case02 PDF paths
- fail closed if either path differs
- run the same browser batch chain used by users
- isolate local-run artifacts outside committed paths
- redact raw OCR and API responses before writing any report
- write only counts, align mode, missing answer/solution lists, warning codes, and pass/fail classification
- refuse to run without explicit environment readiness
- never commit API keys, raw OCR, PDF bytes, screenshots, or database dumps

## Next stage status

Stage 6 is not started.

Stages 7 and 8 are also not started because they depend on a completed Stage 6 real validation result.
