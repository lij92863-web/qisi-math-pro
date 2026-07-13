# Program C App Shell Benchmark R3

## Decision and measurement boundary

Benchmark result: PASS.

- production commit under measurement:
  `6b1dcc81d22b0d31a0d3cd3c621b26c6bffae34b`;
- branch: `stage/app-shell-slimming-r3`;
- OS: Microsoft Windows 10 Pro 10.0.19045;
- CPU: Intel Core i5-12400F, 12 logical processors;
- memory: 15.9 GiB;
- Node: v24.16.0;
- browser: Playwright Chromium headless;
- real OCR/API calls: 0;
- `realApiCalled = false`;
- timeout/failure count: 0.

This benchmark evaluates Program C owner-chain overhead and stability, not OCR
accuracy or network/model latency. DOCX vision and PDF measurements use fixed
deterministic fixtures through the production identity/projection owners. The
browser harness blocks real AI requests.

## Method

Every reported scenario has 10 measured runs after warmup. p50 and p95 are
calculated from all 10 samples; fastest-only selection is not used. Timeouts
count as failures. The in-process owner scenarios use 3 warmup runs, production
review validation uses 5, first ReviewDraft render uses 2, and startup uses a
fresh isolated browser context for each sample.

Reproduction:

```powershell
node scripts/benchmark/measure-program-c-closure.js --runs=10 --warmup=3
node scripts/benchmark/measure-review-validation.js --runs=10 --warmup=5
$env:QISI_BENCHMARK_PURPOSE='program-c-phase6-closure'
node scripts/benchmark/measure-app-shell-browser.js --runs=10
node scripts/benchmark/measure-first-review-render.js --runs=10
```

## Production owner-chain results

These measurements include immutable identity/projection/ReviewDraft operations
and the named persistence/source owners. They exclude file upload, actual OCR,
and external conversion.

| Scenario | p50 ms | p95 ms | Fail/timeout | Safety result |
| --- | ---: | ---: | ---: | --- |
| DOCX stable import owner chain | 0.107 | 0.474 | 0/0 | deterministic identity retained |
| DOCX vision fixture owner chain | 0.100 | 0.256 | 0/0 | canonical vision identity retained |
| PDF full projection | 0.128 | 0.381 | 0/0 | full only with valid ownership |
| PDF safe-partial projection | 0.058 | 0.224 | 0/0 | manual review retained |
| PDF known-bad reject | 0.067 | 0.094 | 0/0 | rejected, no promotion |
| build 50 ReviewDraft | 0.248 | 0.582 | 0/0 | immutable 50/50 |
| build 100 ReviewDraft | 0.404 | 0.580 | 0/0 | immutable 100/100 |
| build 300 ReviewDraft | 1.333 | 1.672 | 0/0 | immutable 300/300 |
| persistence commit + readback | 0.123 | 0.227 | 0/0 | version/readback verified |
| ReviewDraft reload | 0.017 | 0.017 | 0/0 | exact one-draft readback |
| cancellation before transport | 0.018 | 0.065 | 0/0 | transport not invoked |
| duplicate idempotent retry | 0.068 | 0.363 | 0/0 | one version/one draft |

Persistence figures use the repository's deterministic in-memory transaction
harness. The true browser suite separately proves Dexie persistence/reload,
duplicate click, cancellation, and formal transaction behavior.

## Production review validation

| ReviewDraft count | p50 ms | p95 ms | Historical median | p50 change |
| ---: | ---: | ---: | ---: | ---: |
| 50 | 1.276 | 1.861 | 2.073 ms | -38.4% |
| 100 | 2.274 | 2.731 | 1.994 ms | +14.0% |
| 300 | 6.040 | 7.293 | not measured | new baseline |

The 100-draft p50 is 14.0% above the historical seven-run median, exceeding the
suggested 10% target but remaining below the 25% default blocker threshold.
The absolute cost is 2.274 ms for 100 drafts. The current validator also checks
the post-baseline source/provenance/controlled-write safety contracts. No
validation was removed or weakened to recover a microbenchmark number.

The historical baseline did not record p95, so a historical p95 regression is
not invented. Current p95 values and the reproducible harness become the future
comparison baseline.

## Browser startup and memory

Historical values are the committed Phase 0 seven-run medians in
`docs/benchmark/APP_SHELL_BASELINE_R3.md`.

| Metric | Current p50 | Current p95 | Historical median | p50 change |
| --- | ---: | ---: | ---: | ---: |
| cold start | 4,077.191 ms | 4,193.707 ms | 4,983.914 ms | -18.2% |
| DOMContentLoaded | 1,922.900 ms | 2,028.600 ms | 2,436.800 ms | -21.1% |
| load event | 3,553.400 ms | 3,668.800 ms | 4,456.300 ms | -20.3% |
| JS heap used | 14,619,848 B | 18,631,092 B | 14,979,876 B | -2.4% |
| JS heap total | 36,306,944 B | 37,879,808 B | 36,306,944 B | 0.0% |
| DOM nodes | 6,916 | 6,916 | 6,845 | +1.0% |

The historical baseline did not preserve p95. As a conservative check, current
heap-used p95 is 24.4% above the old median, still below the 25% default memory
blocker; heap-total p95 is only 4.3% above the old median. There were ten HTTP
200 responses, visible body content in every run, and zero timeout.

## First ReviewDraft render

The true browser benchmark repeatedly seeds a deterministic two-draft review
batch, enters the visible batch page, invokes the real `openBatchReview`
command, waits for the LaTeX editor to become visible, and clears the database
between runs.

| Metric | Result |
| --- | ---: |
| p50 | 18.842 ms |
| p95 | 30.695 ms |
| warmup/measured | 2 / 10 |
| failure/timeout | 0 / 0 |
| real API | false |

The Phase 0 baseline explicitly recorded this scenario as unmeasured. These
results therefore establish the first reproducible baseline; no historical
percentage is claimed.

## Threshold decision

- startup p50 improved by 18.2%;
- current startup p95 is also below the historical median;
- memory is below the default 25% blocker under the conservative comparison;
- 50-draft validation improved;
- 100-draft validation p50 is +14.0%, a disclosed non-blocking microbenchmark
  regression with a 2.274 ms absolute cost;
- all owner-chain and browser safety assertions passed;
- timeout, failure, wrong attachment, leakage, fallback, and real API counts are
  zero.

Safety failures are always blockers and cannot be offset by speed. None
occurred. Program C benchmark decision: PASS.
