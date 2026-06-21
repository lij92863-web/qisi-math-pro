# BM02 Migration Safety Harness

## Stage

BM02 — add boundary tests to prevent accidental Route B integration and enforce invariants

## Tests Added

### `tests/base-migration-boundary.test.js` (9 tests)

| # | Test |
| --- | --- |
| 1 | Route B not imported by controlled-write |
| 2 | Route B not imported by runner |
| 3 | Route B not imported by app.js |
| 4 | controlled-write is only truth gate (functional check) |
| 5 | baselineCandidate only from controlledWriteAccepted |
| 6 | safe partial not treated as complete |
| 7 | Q8/Q9 dirty shell still rejected |
| 8 | Q2 safe wrapper accepted |
| 9 | No production file imports Route B (scan all files) |

### `tests/base-migration-smoke.test.js` (5 tests)

| # | Test |
| --- | --- |
| 1 | DOCX+DOCX stable mock passes (subtest 20 pass) |
| 2 | PDF known-bad fixture loads correctly |
| 3 | controlled-write truth gate functional |
| 4 | Route B research files exist, production files absent |
| 5 | safe partial target, not complete |

### Results

All 34 tests pass (9 boundary + 25 smoke/docx).
