# OCR Quality R1 Architecture Audit

## Decision

```text
OCR_QUALITY_ARCHITECTURE_AUDIT_R1_ACCEPTED_WITH_LIMITATIONS
```

Audit date: 2026-07-13 Asia/Shanghai. Production-promoted engines: 0. Real OCR/API
calls: 0. Model downloads: 0.

## Required invariants

| Invariant | Evidence | Result |
| --- | --- | --- |
| adapter pluggability | registry requires `healthCheck`, `getCapabilities`, `recognizePage`, `recognizeDocument`, and `cancel`; both Qwen/local adapters pass the same contract tests | PASS |
| engine-specific domain isolation | adapters contain transport/format/input-response handling only; reading order, structure, selection and ownership are separate owners; no adapter contains answer ownership or persistence | PASS |
| shadow no-write | Shadow fixes UI/review/controlled-write/FormalAdmission/merge/supplement permissions false and logs allowlisted metadata only | PASS |
| unique promotion owner | `qisi-ocr-candidate-selection-policy.js` is the only promotion/selection owner; exact promoted engine+version is required; registry is currently empty | PASS |
| controlled-write unchanged | `git diff 1361d7e..HEAD -- qisi-pdf-support-controlled-write.js` is empty; production ownership tests pass | PASS |
| FormalAdmission unchanged | `git diff 1361d7e..HEAD -- qisi-formal-admission-policy.js` is empty; source-aware policy tests pass | PASS |
| Route B frozen | Route B production-reference tests pass and its file/app/controlled-write diff from the Program A seal is empty | PASS |
| app local-model isolation | app has no PaddleOCR, PaddleOCR-VL, olmOCR, Unlimited-OCR, local service, model-path, or engine-specific local implementation | PASS |
| config traceability | `architecture/ocr-engine-config-r1.json` links legacy production current engine and R1 benchmark config; it distinguishes unpinned current config from pinned benchmark versions and empty promotion registry | PASS_WITH_LIMITATION |

## Dependency and ownership evidence

The architecture manifest contains unique owners for adapter contract, reading
order, structure extraction, candidate selection, Qwen/local adapters, local
service, registry and Shadow Mode. Dependencies are acyclic and point toward equal
or lower layers. No OCR owner declares app-shell, storage repository, or
FormalAdmission as an allowed dependency.

The adapter contract is browser-loaded before adapters. Reading order, structure
and selection remain non-loaded scaffolds. The optional local service remains a
separate process boundary with an unavailable default engine. Shadow is
browser-loaded as an existing scaffold but cannot become the default UI result.

## Program A invariant preservation

The following files have zero diff from Program A seal
`1361d7e7f81d2f23819a995a0f9d1808adf19982`:

- `qisi-pdf-support-controlled-write.js`
- `qisi-formal-admission-policy.js`
- `qisi-answer-only-ai-pass.js`
- `app.js`

Thus Program B did not weaken controlled-write, FormalAdmission, Route B freeze,
or the app shell. Mandatory DOCX/PDF gates independently revalidate behavior.

## Configuration trace

The current production engine remains the historical `qwen-vl-plus` entry in the
legacy app model list. Its exact service alias/version is not pinned by Program B,
so the manifest records `legacy-unpinned` and
`productionPromotedByProgramB=false`.

Every R1 benchmark must pin purpose/split, engine/version, hardware, timeout, seed,
bootstrap iterations and input hashes. Benchmark metadata cannot mutate the legacy
production selection. Promotion requires a separate exact-version registry entry;
there are none. Canary remains disabled.

## Limitations

1. Production current engine version is legacy/unpinned and was not migrated by
   Program B because no real benchmark supports a promotion or wiring change.
2. Candidate scaffolds are implemented/unit-tested but not real-measured.
3. app.js still names the cloud current model in legacy UI configuration; this is
   not a local model implementation, but remains Program C shell debt.
4. No architecture evidence can substitute for the absent private Holdout.

## Test evidence and handoff

- Architecture audit failure-first gate: report/config absent, core source/Git
  invariants already passed.
- Architecture manifest, Route B, FormalAdmission and ownership targets: passed.
- Mandatory 11-gate result: PASS; browser preflight/dry-run made no real API call,
  and DOCX/PDF/controlled-write/Route B gates remained green.

Phase 6 may run only synthetic/report-integrity evidence while real OCR authority
and private corpus remain absent. It must not turn scaffold status into a quality
or promotion claim.
