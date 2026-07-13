# OCR Quality R1 Code Audit

## Decision

```text
OCR_QUALITY_CODE_AUDIT_R1_ACCEPTED_WITH_LIMITATIONS
```

Audit date: 2026-07-13 Asia/Shanghai. Scope: Program B commits from the Program A
seal through Phase 3. Real OCR calls: 0. Model downloads: 0.
Production promotion: none.

## Required review areas

| Review area | Evidence | Result |
| --- | --- | --- |
| adapter domain logic | `qisi-ocr-qwen-adapter.js`, `qisi-ocr-local-adapter.js`, and the shared boundary contain transport, input/response validation, error mapping, cancellation and candidate formatting only; static scan found no ownership, controlled-write, FormalAdmission, or persistence markers | PASS |
| preprocessing duplication | no preprocessing implementation/module exists; B2-4 evidence gate fixes all steps disabled without baseline | PASS |
| engine-specific branching in app.js | static scan found legacy `qwen-vl-plus` model-list/default-selection references at the existing UI configuration area; no Paddle/local model implementation or new Program B engine branch was added | LIMITATION — Program C shell debt |
| shadow log privacy | logger allowlist contains only engine ids, requestId, status/code and duration; reports sanitize metric keys and omit candidate raw text/evidence | PASS |
| config diagnostics | benchmark requires pinned purpose/split, engine/version, hardware, timeout, seed, iterations and paths; local service provides health/diagnostics with stable codes | PASS |
| timeout/cancel consistency | registry timeout calls engine cancel; adapters map cancellation; local service timeout aborts and cleans managed temp before response | PASS |
| benchmark rerun | run id is derived from canonical fixed config and input hashes; seeded document-level bootstrap and JSON/Markdown generation are deterministic | PASS |
| scorer data leakage | scorer reads truth/result in memory, emits metrics and sanitized ids/codes only; output excludes full text, raw responses, paths and failure messages | PASS |
| calibration/holdout leakage | audit found purpose/split was documentary only; Phase 4 now requires `runPurpose` + matching `evaluationSplit`, rejects truth split mismatch before output, and rejects duplicate ids | FOUND_AND_FIXED |
| best-sample cherry-picking | every truth document already produced a row and missing/timeout remained explicit; audit found extra result documents were ignored, so Phase 4 now reports them as `unexpected-result-document` failures | FOUND_AND_FIXED |

## Module size and responsibility

At audit time the OCR root modules range from 73 to 229 lines. Reading order,
structure extraction, selection, shadow, adapters and shared validation remain
separate owners. The local service is isolated under `local-ocr/`. No Program B
logic was added to `app.js`.

No preprocessing stack exists, so there is no duplicate orientation/deskew/etc.
The larger pure modules are covered by behavior tests and have no DOM/storage
dependency. Candidate selection and structure extraction explicitly retain false
formal-write authority.

## Benchmark integrity repair

The Phase 4 repair adds two mandatory config fields:

```text
runPurpose = calibration | development | final-holdout
evaluationSplit = calibration | development | holdout
```

Only the matching pairs are accepted. Every truth document must declare the same
split. A mismatch stops before JSON/Markdown write. Duplicate truth/result document
ids fail. Result ids absent from truth are retained as explicit failures, making
promotion ineligible rather than disappearing from the report.

## Test evidence

- Static/module audit targets: passed.
- Benchmark runner/scorer audit targets: passed after the failure-first repair.
- Phase 3 attack suite and affected regressions: passed before this audit.
- Mandatory 11-gate result: PASS; browser preflight/dry-run reported no real API
  call and DOCX/PDF safety gates remained green.
- Skipped tests used as evidence: none.

## Limitations

1. Eligible private corpus remains 0; no quality/human-efficiency claim exists.
2. Legacy app model selection still names `qwen-vl-plus`. It is current-engine UI
   configuration, not local-engine domain logic, but remains app-shell debt for
   Program C.
3. Corpus grouping/near-duplicate review remains a private manifest annotation
   responsibility; code can enforce the declared split but cannot prove two files
   are not variants without approved source evidence.
4. Local engine remains unavailable and canary remains disabled.

## Handoff

Phase 5 must verify manifest direction, pluggability, unique promotion owner,
shadow no-write, unchanged controlled-write/FormalAdmission, frozen Route B, and
traceable benchmark-versus-production configuration. This audit does not promote
an engine or authorize a real call.
