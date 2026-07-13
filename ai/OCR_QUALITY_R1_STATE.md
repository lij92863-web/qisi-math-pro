# OCR QUALITY R1 — State

- Start commit: `1361d7e7f81d2f23819a995a0f9d1808adf19982`
- Baseline tag: `pre-ocr-quality-r1-1361d7e`
- Current branch: `stage/ocr-quality-r1`
- Current phase: Program B / Phase 8
- Current work package: final report prepared; Git ff-only seal pending
- Status updated: 2026-07-13 Asia/Shanghai

## Entry conditions

- Program A decision: `POST_R2_CORRECTION_ACCEPTED_WITH_LIMITATIONS`.
- Formal Admission: production-wired.
- True deterministic E2E: passed.
- Controlled-write: unchanged and mandatory.
- Route B: frozen research-only.
- Program A main/tag: sealed at the start commit.
- Starting working tree: clean; local main, origin/main, and live main equal.

## Real benchmark authority

- `QISI_ALLOW_REAL_OCR_BENCH=1`: not present.
- `QISI_ALLOW_MODEL_DOWNLOAD=1`: not present.
- Real OCR/API calls: forbidden until the first flag is explicitly present.
- Model downloads: forbidden until the second flag is explicitly present.
- Private corpus directory `local-test-materials/ocr-quality-r1/`: absent.
- Eligible private documents: 0; production promotion is forbidden below 10.

## Completed

- Created and pushed annotated baseline tag `pre-ocr-quality-r1-1361d7e`.
- Created and pushed `stage/ocr-quality-r1` from the verified Program A seal.
- Phase 0 baseline completed with all 11 mandatory gates passing.
- Phase 1 defined the ten-layer OCR failure taxonomy and fail-closed evidence
  boundary.
- Phase 1 defined the private corpus split protocol, document-level leakage guard,
  double-review process, and the fewer-than-10 no-promotion rule.
- Added the R1 document/question ground-truth schema with annotator A, verifier B,
  and disagreement-resolution evidence.
- Audited five candidate classes from official sources. All remain research-only
  and unevaluated; no model was downloaded and no engine was promoted.
- Defined deterministic CER, formula, structure, safety, human-cost, and
  document-level stratified-bootstrap scoring.
- Phase 1 targeted tests passed 9/9; all 11 mandatory gates passed with browser
  preflight/dry-run `realApiCalled=false`.
- B2-1 implemented and unit-tested the offline reproducible Benchmark Runner and
  R1 document scorer. Fixed config, pinned engine/hardware metadata, seeded
  document-level bootstrap, JSON/Markdown parity, explicit timeout/failure status,
  and sanitized aggregate-only output are enforced.
- B2-1 targeted tests passed 12/12 including the existing R2 scorer regression;
  all 11 mandatory gates passed. No OCR engine or API was invoked.
- B2-2 hardened the shared adapter boundary and both existing adapters: the five
  methods remain transport/format-only; `RecognitionCandidate.rawEvidenceRef`,
  input/response validation, stable errors, duplicate active requestId rejection,
  cancellation, unavailable-engine mapping, and metadata-only logs are enforced.
- B2-2 added the browser-loaded adapter-contract owner and architecture manifest
  dependency. The first full gate run exposed its missing script order and stopped
  at `verify:safe`; one in-scope repair fixed the startup error. Targeted browser,
  architecture, contract, timeout, cancellation, malformed, unavailable, privacy,
  MIME, size, and duplicate-id tests passed; the complete 11-gate rerun passed.
- Adapter infrastructure is implemented/unit-tested and browser-loaded as an
  existing scaffold boundary. No candidate engine was benchmark-measured or
  production-promoted.
- B2-3 implemented and unit-tested a pure Node loopback Local OCR Service
  boundary. It enforces raw-body MIME/size limits, no client paths, managed temp
  cleanup, concurrency, timeout/abort, request-id uniqueness, health/engine
  metadata, response validation, and content-free logs.
- B2-3 added syntax-validated Windows install/start/stop/health/diagnostics/
  uninstall scripts. Install performs no network/model action; start is hidden;
  uninstall resolves managed paths and preserves models unless explicitly asked.
- The default local engine is `unavailable`; local models/runtime/tmp are ignored.
  Model count is 0, no service process was started, no model was downloaded, and
  no recognition was executed against a real engine.
- B2-3 failure-first tests passed 8/8 after two small lifecycle/script syntax
  repairs; architecture/adapter targeted coverage passed 20/20 and all 11
  mandatory gates passed with `realApiCalled=false`.
- B2-4 evaluated the mandatory baseline evidence gate and recorded
  `NOT_IMPLEMENTED_NO_BASELINE`: eligible private documents remain 0 and real OCR
  authority is absent, so all nine preprocessing candidates remain disabled.
- B2-4 added no preprocessing module, browser hook, service hook, or production
  flag. Its evidence-gate tests passed 2/2 and all 11 mandatory gates passed.
- B2-5 implemented a pure deterministic reading-order owner with strict block
  validation and page/column/anchor/adjacency/source-order priority. Original
  source order is preserved; header/footer evidence is excluded from content but
  retained with warnings; raw text never drives ordering.
- B2-5 unit tests passed 7/7 across single/two-column, mixed figures,
  cross-column anchors, multiline formulas, header/footer interference, and
  invalid contracts. Architecture targeted tests passed 15/15 and all 11
  mandatory gates passed.
- Reading order is implemented/unit-tested as a scaffold. It is not loaded by the
  production page, benchmark-measured on real documents, or production-promoted.
- B2-6 implemented a pure evidence-based structure extractor for strict anchors,
  stem, options, answer, solution, formulas, and images. Raw/bbox/confidence/block
  evidence is preserved; JSON wrappers and duplicate/invalid options are rejected;
  missing options require explicit expected labels and contain no invented text.
- Every extracted question remains ownership-unvalidated and ineligible for
  controlled-write/FormalAdmission. The module is a unit-tested scaffold and is
  not loaded by the production page or benchmark-measured on real documents.
- B2-6 reading-order/extractor tests passed 14/14; behavior, architecture, and
  code-boundary targeted tests passed 26/26; all 11 mandatory gates passed.
- B2-7 audited the ownership/safe-partial evidence gate and recorded
  `NO_HIGH_RISK_CHANGE_WITHOUT_HOLDOUT_FAILURE`: real Holdout failures remain 0,
  so aligner, controlled-write, and FormalAdmission code were not modified.
- Existing deterministic full/prefix/fail-closed ownership targeted tests plus the
  new decision gate passed 50/50; all 11 mandatory gates passed. Structure
  candidates remain ownership-unvalidated and ineligible for any formal write.
- B2-8 extended the existing Shadow Mode owner with sanitized allowlisted metrics,
  numeric deltas, benchmark-only flags, stable failure codes, and explicit fallback
  to the untouched production candidate. Reports/logs omit raw content/evidence.
- All UI, review, controlled-write, FormalAdmission, auto-selection, field merge,
  and answer-supplement permissions remain false. The browser-loaded module remains
  a scaffold; no real/private shadow execution occurred.
- B2-8 shadow tests passed 5/5; behavior/privacy/architecture targeted tests passed
  17/17; all 11 mandatory gates passed with `realApiCalled=false`.
- B2-9 implemented a pure candidate selection policy gated by exact promoted
  engine/version plus schema, sequence, ownership, formula, completeness,
  provenance, confidence, and zero safety errors.
- Selection compares complete candidates only by deterministic Pareto dominance on
  completeness/confidence. Ties/tradeoffs require manual review, retain original
  candidates, and never merge fields, guess semantically, or synthesize an answer.
- The promotion registry remains empty and the policy is not production-wired;
  no engine can currently be selected. B2-9 tests passed 7/7, behavior/architecture
  targeted tests passed 19/19, and all 11 mandatory gates passed.
- B2-10 audited the canary gate and recorded
  `CANARY_DISABLED_PROMOTION_GATE_NOT_MET`: private documents, production-promoted
  engines, Holdout decisions, and real canary runs all remain 0.
- B2-10 added no canary module, flag, UI, route, or production wiring. Its evidence
  gate plus shadow/selection regressions passed 15/15 and all 11 mandatory gates
  passed. Phase 2 is complete without production promotion.
- Phase 3 added 22 individually named counterfactual attacks and a 22-row evidence
  matrix covering image degradation/layout, structural ambiguity, page attacks,
  malicious/oversized responses, timeout/unavailability/version/conflict,
  confidence/fabrication, path traversal, and MIME spoofing.
- The failure-first run passed 19/23 and exposed three real boundary defects:
  circled-number compatibility folding, missing response-size limit, and trusting
  MIME without magic bytes. One in-scope repair added strict digit mapping,
  `ocr-response-too-large`, and MIME magic validation.
- Final attack suite (22 attacks plus matrix/aggregate invariants) passed 24/24;
  affected owner regressions passed 47/47; all 11 mandatory gates passed. Wrong
  attachments, fabricated formal questions, bypasses, real API calls, and enabled
  canary remained 0.
- Phase 4 code audit reviewed all ten required areas. It found and fixed two
  benchmark-integrity gaps: purpose/split was not code-enforced and unexpected
  result documents were ignored. Runner now pins matching purpose/split, rejects
  mismatch/duplicate ids, and reports unexpected results as failures.
- Phase 4 audit/runner/scorer tests passed 12/12 and all 11 mandatory gates passed.
  Decision: `OCR_QUALITY_CODE_AUDIT_R1_ACCEPTED_WITH_LIMITATIONS`.
- Remaining code-audit limitation: legacy app.js current-engine configuration still
  names `qwen-vl-plus`; no local model implementation or new Program B engine branch
  exists in app.js. This remains Program C shell debt.
- Phase 5 architecture audit verified adapter pluggability, engine/domain
  isolation, no-write Shadow, unique selection/promotion ownership, unchanged
  controlled-write/FormalAdmission/app/Route B, app local-model isolation, and
  acyclic unique manifest owners.
- Added `architecture/ocr-engine-config-r1.json` to distinguish the legacy current
  Qwen configuration (`legacy-unpinned`, not changed/promoted by Program B) from
  pinned benchmark config, empty promotion registry, and disabled canary.
- Phase 5 architecture and Program A invariant targets passed 53/53 and all 11
  mandatory gates passed. Decision:
  `OCR_QUALITY_ARCHITECTURE_AUDIT_R1_ACCEPTED_WITH_LIMITATIONS`.
- Phase 6 produced the final benchmark availability report from authorized
  evidence only. The private corpus and both authority flags remain absent:
  eligible documents, real OCR/API calls, model downloads, and real Holdout runs
  are all 0.
- Per-document, category, raw/normalized CER, formula, structure, ownership,
  paired confidence interval, and human-correction metrics are explicitly not
  measured. API cost is CNY 0; exact test hardware and engine deployment status
  are recorded without presenting synthetic fixtures as real quality evidence.
- Phase 6 final-report tests passed 5/5; combined runner/scorer/attack/report
  targets passed 37/37; all 11 mandatory gates passed. Browser preflight and
  dry-run both recorded `realApiCalled=false` and zero underlying calls.
- Final benchmark decision: `NO_ENGINE_ELIGIBLE_FOR_PROMOTION`. Production engine
  additions/replacements remain none, canary and preprocessing remain disabled,
  and current production behavior is unchanged.
- Phase 7 CTO review accepted the implemented/unit-tested evaluation, adapter,
  local-service, reading-order, structure, Shadow, and selection boundaries with
  material limitations. CTO decision:
  `OCR_QUALITY_R1_ACCEPTED_WITH_LIMITATIONS`.
- Production-promoted engines and private-corpus-measured Shadow engines remain
  none. PaddleOCR, PaddleOCR-VL, olmOCR, and mock remain research-only; the
  existing qwen-vl-plus configuration remains legacy-unpinned and was neither
  called nor changed by Program B.
- Real human-efficiency improvement remains not measured; PDF manual review is
  still required. No model/runtime burden was installed, while any future local
  deployment still requires packaging, device validation, updates, diagnostics,
  storage, and target-machine performance proof.
- Phase 7 CTO/audit/benchmark/attack targets passed 44/44 and all 11 mandatory
  gates passed with browser preflight/dry-run `realApiCalled=false`.
- Phase 8 fetched and independently queried live main. Local `main`,
  `origin/main`, and live `refs/heads/main` all remained at the Program A seal
  `1361d7e7f81d2f23819a995a0f9d1808adf19982`; the proposed Program B tag was
  available.
- Phase 8 final-report failure-first gate was established at 0/5 before the
  report existed. The completed final report gate passed 5/5, and the expanded
  Program B target set passed 70/70 with `verify:no-real-ai` passing.
- Phase 8 final mandatory matrix passed. Browser preflight/dry-run both remained
  healthy with `realApiCalled=false` and `underlyingApiCallCount=0`.

## Pending

- Phase 8 ff-only main merge, annotated tag, and remote verification.
- Program C app-shell slimming after the Program B seal.

## Blockers / limitations

- Real quality improvement cannot be measured until an approved private corpus
  exists and `QISI_ALLOW_REAL_OCR_BENCH=1` is explicitly set.
- Work may continue on reproducible synthetic/research/shadow infrastructure;
  no engine may be production-promoted from that evidence.

## Next exact action

Commit and push the Phase 8 final report, then repeat the live remote check and
perform the authorized ff-only merge, main push, annotated tag push, and
local/remote/tag equality verification.
