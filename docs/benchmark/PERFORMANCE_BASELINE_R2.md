# Performance Baseline R2

## Reproducible benchmark

- Date: 2026-07-12 Asia/Shanghai
- OS/platform: Windows `win32-x64`
- Node: v24.16.0
- Command: `node scripts/benchmark/measure-library-metadata.js 5000 1000`
- Warm-up: 100 calls
- Samples: 7; reported value is median
- Fixture: deterministic 5,000 metadata-only questions

## Measured bottleneck

| Metric | Baseline | Final | Change |
|---|---:|---:|---:|
| 1,000 metadata aggregations | 449.721 ms | 321.314 ms | -28.55% |
| Per aggregation | 0.449721 ms | 0.321314 ms | -28.55% |

The baseline implementation made five passes for type/grade/difficulty/answer/
image counts. The final implementation makes one pass and preserves identical
results. This is a confirmed bottleneck improvement above 20%.

## Monitoring

`qisi-performance-monitor.js` is opt-in, allowlists stages, caps samples, and
records only stage, duration, count, and success. It never records question
text, OCR content, images, base64, or credentials.

## Not yet measured

Cold start, upload-to-review, first render, question-switch p50/p95, save,
reload, export, memory, and image-storage size need a controlled browser
benchmark fixture. They remain explicit gaps rather than invented numbers.
Browser product E2E and mandatory gates are used as the no-functional-regression
checks for this package.
