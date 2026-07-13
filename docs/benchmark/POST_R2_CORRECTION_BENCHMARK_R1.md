# Post-R2 Correction Benchmark R1

Date: 2026-07-13 Asia/Shanghai  
Platform: Windows win32-x64, Node v24.16.0  
Real OCR/AI: not called; deterministic fixtures only.

## Workload results

| Required workload | Command / evidence | Observed result | Decision |
| --- | --- | --- | --- |
| Formal Admission scenario matrix | `tests/formal-admission-policy.test.js` | 12 policy scenarios passed, including PDF rejection, manual revision, deterministic DOCX, package schema, malformed decision, and provenance conflicts. | PASS |
| true deterministic E2E | `tests/e2e/true-import-{docx,pdf-safe-partial,admission}.test.js` | 4 browser scenarios passed through UI/transport, review persistence, admission/rejection, reload, and sanitized export. | PASS |
| 10/50/100 review | `node scripts/benchmark/measure-review-validation.js` | Median production validation: 10 = 0.247 ms; 50 = 1.349 ms; 100 = 1.982 ms (5 warm-ups, 7 samples). | PASS |
| formal submit | production submit plus formal transaction/concurrency suites | Formal v2 transaction, idempotency, stale/two-tab conflict, rollback, and duplicate ID behavior passed. | PASS |
| reload | true DOCX E2E and storage repository suites | Admitted v2 survives reload; deleted/restored library records remain consistent. | PASS |
| 1000/5000 metadata library | large-dataset tests and reproducible aggregation command | Query/filter/sort/paginate passed at 1,000 and 5,000; 5,000-row aggregation performance is recorded below. | PASS |
| image persistence | storage repository and export suites | Question/image writes are atomic; rollback removes partial images; export resolves stored image blobs. | PASS |
| export | `tests/export-service.test.js` and true DOCX E2E | Manifest/questions/images plan, missing-image behavior, filename safety, and sanitized export passed. | PASS |
| direct DB formal writes remaining count | submit-segment static scan | 0 | PASS |
| app.js high-risk DB call sites | whole-app static scan | 6 direct `db.questions.put/add/bulkPut` sites, all classified as metadata migration, external-bank merge/undo, or manual entry; none is the batch formal-submit boundary. | RECORDED LIMITATION |

## Acceptance counters

| Counter | Result | Evidence |
| --- | ---: | --- |
| wrong attachment | 0 | PDF safe-partial and controlled-write ownership gates |
| formal submit bypass | 0 | submit-segment and architecture guards |
| duplicate submit | 0 | idempotency and two-tab concurrency gates |
| partial transaction | 0 | forced abort/quota rollback gates |

## Core performance comparison

Reproducible command:

```text
node scripts/benchmark/measure-library-metadata.js 5000 1000
```

R2 final baseline: 321.314 ms for 1,000 aggregations. An initial isolated
three-run representative before remediation was 359.364 ms (+11.84%), which
failed the 10% gate. The only production change removed three closure calls per
metadata row while preserving Map/key semantics and output.

Post-remediation isolated run medians:

| Run | Median for 1,000 aggregations | Change vs R2 final |
| --- | ---: | ---: |
| 1 | 332.295 ms | +3.42% |
| 2 | 340.796 ms | +6.06% |
| 3 | 317.338 ms | -1.24% |

Representative regression vs R2 final: +3.42%

Every post-remediation isolated run is within the allowed 10% regression
boundary. The original pre-optimization R2 baseline was 449.721 ms, so the
current representative remains 26.11% faster than that original baseline.

## Limitations

- This Program A benchmark intentionally does not claim real OCR quality.
- Cold-start, memory, and image-byte browser performance still lack a stable
  hardware-controlled baseline; functional browser E2E is used for those paths.
- The six non-formal direct question-write call sites remain Program C/app-shell
  debt and are not misreported as zero.

Decision: PASS
