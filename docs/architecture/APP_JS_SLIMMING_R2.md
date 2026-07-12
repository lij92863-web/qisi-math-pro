# app.js Slimming R2

## Outcome

Baseline `da699b5`: 22,043 physical lines. Current pre-WP2N measurement:
21,779 lines, a net reduction of 264 lines (1.20%). This is below the suggested
20% target and is accepted as an explicit limitation rather than forcing an
unsafe split.

## Real owner migrations

- storage/preferences/recent-task operations: `qisi-storage-repository.js`
- library query/sort/pagination/metadata: `qisi-library-service.js`
- review edits/validation/confirmation state: `qisi-review-controller.js`
- export plan/mapping/filename/progress: `qisi-export-service.js`
- import routing/cancellation/validation/handoff: `qisi-import-orchestrator.js`

Each migration removed its replaced app implementation, calls the production
module, passed runtime dependency and browser E2E gates, and was committed
independently. The obsolete `makeSafeFileName` helper was removed after the
ExportService became its only owner.

## Why the reduction is below 20%

`app.js` still contains 131 direct `db.` references, primarily in batch import,
review image editing, external-bank merge/revert, and controlled submission
transactions. Moving these mechanically would split transaction invariants,
duplicate reactive state, or couple several high-risk owners in one package.
The R2 guardrail says to report this condition and not force extraction.

Remaining app responsibilities also include Vue state, lifecycle, UI events,
view mapping, browser download/print effects, and top-level error display. The
next safe slimming work must be benchmark/test-driven and split by one owner at
a time; no line-count-only refactor is authorized.
