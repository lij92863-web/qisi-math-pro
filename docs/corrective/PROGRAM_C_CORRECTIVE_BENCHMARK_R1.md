# Program C Corrective Benchmark R1

Date: 2026-07-14  
Baseline: `79fea1e1cad0c682c42539dd575370f3919f1d05`  
Candidate: `stage/program-c-corrective-r1` working tree at measurement

## Decision

`PROGRAM_C_CORRECTIVE_BENCHMARK_ACCEPTED`

The final comparison used 5 warmups and 20 measured samples per profile. The
benchmark materialized the exact RC2 files with `git show`, ran baseline and
candidate in separate Node processes, and deleted the verified temporary
snapshot afterward. Both profiles used the same machine, Node v24.16.0, and
Playwright Chromium 149.0.7827.55. No network/model latency was measured and no
real AI/OCR call was made.

The harness contains no final-candidate fixture transport. It measures the
shared production identity, safe-partial, ReviewDraft, confirmation, formal
transaction, output/dedupe, cleanup, and persistence owners. True-file browser
authenticity remains separately proved by the 17-scenario normal-UI suite.

## Results

| Scenario | RC2 p50 ms | Candidate p50 ms | Change | RC2 p95 ms | Candidate p95 ms | Change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| DOCX deterministic | 16.432 | 15.515 | -5.6% | 18.036 | 16.673 | -7.6% |
| DOCX vision | 17.026 | 16.624 | -2.4% | 18.830 | 18.615 | -1.1% |
| PDF safe-partial | 0.106 | 0.113 | +6.2% | 0.195 | 0.190 | -2.7% |
| 100 ReviewDraft | 0.445 | 0.397 | -10.8% | 0.790 | 0.660 | -16.4% |
| 300 ReviewDraft | 1.126 | 1.124 | -0.2% | 1.421 | 1.402 | -1.3% |
| Confirm | 1.437 | 1.355 | -5.7% | 1.570 | 1.592 | +1.4% |
| Single formal submit | 0.279 | 0.316 | +13.3% | 0.410 | 0.441 | +7.6% |
| Five-item batch submit | 1.563 | 1.831 | +17.1% | 1.950 | 2.172 | +11.4% |
| Dedupe 300→150 ×10 | 185.285 | 187.478 | +1.2% | 193.241 | 197.613 | +2.3% |
| Cleanup 300 ×10 | 54.535 | 55.026 | +0.9% | 58.270 | 57.531 | -1.3% |
| Reload ×100 | 1.266 | 1.297 | +2.5% | 1.692 | 1.497 | -11.5% |

Single and batch formal-submit p50 exceed the preferred 10% target but remain
below the 25% default blocker; their absolute deltas are 0.037 ms and 0.268 ms.
These changes include the new fresh-row duplicate decision and cross-draft
request-ID collision check and are not offset by weakening safety behavior.
Every p95 is within the 15% target.

A preliminary 10-sample run observed a non-repeating batch-submit maximum of
2.654 ms and was conservatively marked blocked. An exact repeat did not
reproduce it. The final 20-sample run makes p95 the second-highest sample and
produced the stable result above; no sample was discarded.

## Counters

```text
scenarioCount = 11
sampleRuns = 20 per profile
failureCount = 0
timeoutCount = 0
defaultBlockers = 0
realApiCalled = false
fixtureCandidateTransport = false
```

Reproduction:

```powershell
node scripts/benchmark/measure-program-c-closure.js --runs=20 --warmup=5
```
