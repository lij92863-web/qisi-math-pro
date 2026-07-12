# Benchmark Final Audit R2

## Decision

The performance package satisfies the R2 acceptance rule for one confirmed
bottleneck. Recognition quality does not have an authorized real baseline/final
comparison, so no OCR engine is promoted and no real quality improvement is
claimed.

## Reproducibility controls

| Control | OCR | Library metadata performance |
|---|---|---|
| corpus | ten-category public synthetic scorer fixtures; real corpus unavailable | deterministic 5,000 metadata records |
| truth | versioned schema/fixtures; not real OCR truth | identical expected aggregation result |
| normalization | NFC/full-width normalization in scorer | not applicable; same generated records |
| scoring | CER, LaTeX token F1/exact, structure, options, ownership, correction cost | median wall time for 1,000 aggregations |
| hardware/OS | engine run not authorized | same Windows `win32-x64` host |
| runtime | Node v24.16.0 | Node v24.16.0 |
| engine config | none; no OCR engine invoked | same script, 100 warm-ups, seven samples |

Reproduction commands:

```text
node --test tests/ocr-benchmark-scoring.test.js
node scripts/benchmark/measure-library-metadata.js 5000 1000
```

The OCR command validates scoring only. It makes no network or engine call.

## OCR baseline versus final

| Required report | Baseline | Final |
|---|---|---|
| real corpus | unavailable/not authorized | unavailable/not authorized |
| per-document metrics | not measured | not measured |
| aggregate CER/formula/structure | not measured | not measured |
| fatal safety errors on real outputs | not measured | not measured |
| manual correction cost | not measured | not measured |

Synthetic fixtures cover clear DOCX, electronic PDF, scanned PDF, skew, low
resolution, formula-heavy, geometry image, long solution, non-contiguous
numbering, and known-bad categories. They prove schema/scoring determinism, not
engine quality. No best-sample selection or synthetic-to-real extrapolation is
used.

The ten production-eligibility requirements are therefore not demonstrated as
a set. In particular, real wrong attachment/fabrication/leakage counts,
structural non-regression, core weakness improvement, and correction-cost
reduction remain unknown. Qwen remains the existing path, local OCR remains an
optional adapter boundary only, and shadow output remains ineligible for review,
selection, merging, controlled-write, or formal storage.

## Performance baseline versus final

Command and fixture are identical to the WP2O baseline package.

| Metric | Baseline | WP2O archived final | Phase 6 rerun | Baseline to rerun |
|---|---:|---:|---:|---:|
| 1,000 metadata aggregations | 449.721 ms | 321.314 ms | 310.307 ms | -31.00% |
| per aggregation | 0.449721 ms | 0.321314 ms | 0.310307 ms | -31.00% |

The implementation changed five full passes to one pass without disabling a
feature. Targeted 100/1,000/5,000-record correctness tests, browser E2E, and the
mandatory matrix pass. The improvement is above the required 20% confirmed
bottleneck threshold; no measured regression above 10% was observed in the
available benchmark.

The following required metrics remain unmeasured and are not inferred from E2E
duration: cold start, upload-to-review, first render, question switch p50/p95,
save, reload, export, page memory, and image-storage footprint. Performance
monitoring has allowlisted stages but no controlled cross-version browser
fixture yet. These are accepted limitations, not zero values.

## Architecture metrics

| Metric | Result |
|---|---|
| app.js baseline/final | 22,043 -> 21,779 physical lines; -264 (-1.20%) |
| extracted responsibilities | question contract; storage repository; library query; review lifecycle; export mapping; import routing; OCR registry/adapters/shadow; performance monitoring |
| new root qisi modules | 11 |
| changed root qisi production lines | +2,086 / -39, plus app.js +183 / -447 |
| repository-wide R2 delta before this report | 96 files, +10,077 / -586 |
| duplicate helper removed | obsolete filename helper; high-risk owner implementations guarded |
| dependency cycles in audited extracted layer | 0 detected by source/runtime guards |
| owner conflicts | 0 for guarded critical symbols |
| remaining largest function | `processDraftImportBatch`, 5,134 lines |

Line reduction alone is not the architecture claim: R2 added explicit contracts,
repositories, services, candidate-only adapters, browser E2E, counterfactual
tests, and owner guards. The small app line reduction and the remaining large
function are disclosed rather than presented as completed shell decomposition.

## Final benchmark verdict

- OCR quality: **not eligible for promotion; shadow/research only**.
- Metadata bottleneck: **accepted**, reproducible improvement above 20%.
- Other performance metrics: **unmeasured accepted limitations**.
- Safety: all mandatory gates and no-real-AI checks must remain green through
  Phase 8.
