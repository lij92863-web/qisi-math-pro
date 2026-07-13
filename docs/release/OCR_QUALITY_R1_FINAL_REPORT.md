# OCR Quality R1 Final Report

Decision: `OCR_QUALITY_R1_ACCEPTED_WITH_LIMITATIONS`

Program B delivered a fail-closed, reproducible OCR candidate evaluation boundary
without claiming evidence that was unavailable. It did not promote or replace a
production engine.

## Git scope before seal

- Program A rollback/main before seal:
  `1361d7e7f81d2f23819a995a0f9d1808adf19982`.
- Immutable rollback tag: `v1.1.0-rc2-post-r2-correction`.
- Work branch: `stage/ocr-quality-r1`.
- Pre-report accepted head: `ece5549e054b090603cf984ada1f6320bfecf74e`.
- Live local `main`, `origin/main`, and `ls-remote origin main` were rechecked
  before this report and all resolved to the Program A rollback commit.
- Proposed tag `v1.2.0-rc1-ocr-quality-r1` did not exist locally or remotely at
  the pre-report check.

## Corpus and authority

- Corpus size: 0 eligible private documents.
- `QISI_ALLOW_REAL_OCR_BENCH=1`: absent.
- `QISI_ALLOW_MODEL_DOWNLOAD=1`: absent.
- Real OCR/API calls: 0.
- Model downloads: 0.
- Real Holdout runs: 0.
- API cost: CNY 0.

The private OCR corpus directory did not exist. No private PDF/DOCX, ground truth,
credential, model weight, cache, temporary OCR file, or raw content was committed.

## Engine versions and disposition

| Engine | Version/configuration | Final disposition |
| --- | --- | --- |
| qwen-vl-plus | legacy-unpinned existing app configuration | unchanged; not called or promoted by Program B |
| PaddleOCR / PP-OCR | research candidate; no installed version/weights | research-only; not measured |
| PaddleOCR-VL | research candidate; no installed version/weights | research-only; not measured |
| olmOCR | research candidate; no installed version/weights | research-only; not measured; Windows feasibility unproven |
| local-ocr | unavailable default engine | loopback boundary unit-tested; recognition not run |
| mock | deterministic synthetic fixture | research-only runner/scorer/attack tests |

- Production engines: none added or replaced.
- Production-promoted engine versions: none.
- Shadow engines measured: none.
- Promotion registry entries: 0.
- Canary: disabled.
- Preprocessing: disabled because no real baseline existed.

## Hardware and deployment

- OS: Microsoft Windows 10 Pro.
- CPU: 12th Gen Intel(R) Core(TM) i5-12400F.
- Memory: 17032749056 bytes.
- GPU: NVIDIA GeForce RTX 4060.
- Runtime: Node v24.16.0.

This hardware ran code, unit, integration, browser-safety, and synthetic attack
tests only. It did not run a local OCR model. Local service lifecycle scripts and
the loopback service contract exist, but no service was started and no model was
installed. Future local deployment requires model/runtime packaging, device and
target-machine validation, storage/update/diagnostic ownership, and measured
latency/throughput/VRAM evidence.

## Quality metrics

- raw CER: not measured.
- normalized CER: not measured.
- formula token/exact accuracy: not measured.
- structure precision/recall: not measured.
- ownership accuracy: not measured.
- question/stem/option/answer/solution/image accuracy: not measured.
- 95% CI: not measured.
- per-category and per-document quality: not measured.

No synthetic number is presented as a real OCR quality result, improvement, or
engine comparison.

## Safety metrics

- Real Holdout safety: not measured.
- wrong answer attachment on real corpus: not measured.
- wrong solution attachment on real corpus: not measured.
- fabricated question on real corpus: not measured.
- controlled-write/FormalAdmission bypass on real corpus: not measured.
- Synthetic attack classes: 22/22 PASS.
- Synthetic wrong attachments/fabricated formal questions/bypasses: 0.

Synthetic attack evidence proves fixture-level fail-closed invariants only. It
does not substitute for an untouched real Holdout result.

## Human correction cost

- manual correction time: not measured.
- corrected fields/questions: not measured.
- manual review rate on private corpus: not measured.
- human efficiency improvement: not measured.
- Manual review required: yes.

PDF remains safe partial plus manual review. No 15% correction-time reduction is
claimed or inferred from CER, source tests, or synthetic fixtures.

## Delivered engineering boundaries

- Defined the ten-layer failure taxonomy, leakage-controlled corpus protocol,
  R1 ground-truth schema, feasibility audit, and deterministic scoring protocol.
- Implemented a sanitized offline runner/scorer with pinned purpose, split,
  engine/version, hardware, seed, timeout, complete document accounting, and
  document-level bootstrap behavior.
- Hardened adapter validation, response-size limits, cancellation, unavailable
  mapping, MIME magic validation, safe metadata, and duplicate request ids.
- Implemented a loopback-only local-service boundary with size/MIME/path/temp/
  concurrency/timeout controls and no default model.
- Implemented deterministic reading order, evidence-only structure extraction,
  no-write Shadow reporting, and exact-version fail-closed selection policy.
- Preserved controlled-write, FormalAdmission, Route B hold, DOCX stable flow,
  PDF safe-partial positioning, empty promotion registry, and disabled canary.

## Final validation

Final mandatory gates: PASS.

- Base migration execution and Route B hold: PASS.
- Batch mock, safe suite, batch safety, PDF known-bad, and ownership: PASS.
- Browser preflight: PASS, `realApiCalled=false`,
  `underlyingApiCallCount=0`.
- Browser dry-run: PASS, `realApiCalled=false`,
  `underlyingApiCallCount=0`.
- DOCX stable and no-real-AI: PASS.

Targeted Program B gates: PASS.

- Final benchmark report: 5/5.
- CTO review plus code/architecture/benchmark/attack evidence: 44/44.
- Counterfactual attacks: all 22 named classes plus matrix/aggregate invariants.
- No hidden timeout and no skipped Program B gate.

## Known limitations

- Eligible private documents and real Holdout runs are 0, so no production
  promotion gate can be evaluated.
- Real OCR accuracy, formula fidelity, structural quality, fatal-safety rates,
  human correction cost, efficiency, latency, throughput, and local resource
  usage remain unknown.
- The existing qwen-vl-plus app configuration is legacy-unpinned and was not
  benchmarked or altered by Program B.
- PaddleOCR, PaddleOCR-VL, olmOCR, and mock remain research-only. The local OCR
  service has no authorized engine implementation or weights.
- Shadow infrastructure is implemented/unit-tested but was not executed against
  the private corpus and has no write/review/default-selection authority.
- Manual review remains mandatory for PDF safe-partial processing.

## Rollback and Git seal

The Program A tag `v1.1.0-rc2-post-r2-correction` is the rollback point. Because
Program B changed no production OCR selection and wrote no migration, rollback
requires no question-bank or model-data conversion.

Seal sequence after this report commit and the final live-remote recheck:

1. Verify work branch clean and fetch `origin/main`.
2. Confirm local main, `origin/main`, and live remote main remain at the Program A
   rollback commit.
3. `git switch main`.
4. `git merge --ff-only stage/ocr-quality-r1`.
5. Push `main` without force.
6. Create and push annotated tag `v1.2.0-rc1-ocr-quality-r1`.
7. Verify local main, `origin/main`, work branch, and peeled tag all resolve to the
   final report commit and the working tree is clean.

Program C may begin only after that seal is verified.
