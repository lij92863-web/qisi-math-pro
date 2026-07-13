# OCR Preprocessing Decision R1

## Decision

```text
NOT_IMPLEMENTED_NO_BASELINE
```

As of 2026-07-13, eligible private documents: 0.
`QISI_ALLOW_REAL_OCR_BENCH=1`: absent.

The R3 prerequisite says preprocessing is implemented only when a baseline proves
that an individual step adds value. There is no authorized real OCR baseline,
category-level failure measurement, Holdout evidence, or human-correction timing.
Synthetic image mutations can test safety but cannot prove recognition benefit.
Therefore no preprocessing module, browser script, service hook, production flag,
or default transformation is added.

Production-promoted: no. Research/shadow preprocessing candidate: no.

## Step status

- orientation: disabled — no measured baseline benefit
- deskew: disabled — no measured baseline benefit
- perspective: disabled — no measured baseline benefit
- crop: disabled — no measured baseline benefit
- contrast: disabled — no measured baseline benefit
- grayscale: disabled — no measured baseline benefit
- threshold: disabled — no measured baseline benefit
- denoise: disabled — no measured baseline benefit
- resolution normalization: disabled — no measured baseline benefit

Disabled means the transformation is neither implemented nor silently performed by
the current adapter/service boundary.

## Future evidence gate

An authorized later package may evaluate **one step at a time** only after:

1. The private corpus follows the Calibration, Development, and untouched Holdout
   split protocol without page leakage.
2. A pinned baseline records engine/model version, config, hardware, source hashes,
   OCR/structure/safety metrics, latency, and human correction cost.
3. The step has a deterministic configuration and an explicit off switch.
4. The step stores transformation metadata and must not overwrite the source image.
5. Baseline and candidate run on the same documents with a paired document-level
   comparison and category results.
6. Fatal safety events remain zero and structure does not regress.
7. A no benefit result means do not enable the step; negative or inconclusive
   results remain disabled.

Multiple preprocessing steps must not be introduced in one experiment. A second
step requires a new baseline against the accepted first-step configuration and a
separate work package, tests, report, commit, and rollback switch.

## Current evidence classification

- Designed gate: yes.
- Implemented preprocessing: no.
- Unit-tested decision guard: yes after its test passes.
- Benchmark-measured benefit: no.
- Production-wired: no.
- Production-promoted: no.
