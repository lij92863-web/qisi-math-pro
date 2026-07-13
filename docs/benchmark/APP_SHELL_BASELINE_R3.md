# App Shell Slimming R3 Baseline

## Git and measurement boundary

- Baseline commit: `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`.
- Baseline tag: `pre-app-shell-slimming-r3-b15e6fb`.
- Work branch: `stage/app-shell-slimming-r3`.
- Measurement date: 2026-07-13 Asia/Shanghai.
- Real OCR/API calls: 0; model downloads: 0.
- PDF runner mode: no real-run.

Static counts use committed UTF-8 source at the baseline commit. Function ranges
use `scripts/base-migration-inventory.js`, whose deterministic scanner recognizes
top-level `const name = function/arrow` definitions. Nested functions inside a
recognized outer function are deliberately not double-counted.

## Required static baseline

| Metric | Baseline | Reproducible definition |
| --- | ---: | --- |
| app.js lines | 21,778 | UTF-8 split on `\r?\n`, including final logical line |
| function count | 318 | functions recognized by the committed inventory scanner |
| direct DB calls | 87 | app.js `db.*` mutation invocation lines |
| direct DB member references | 159 | all lexical app.js `db.<member>` occurrences |
| direct formal DB writes | 6 | direct `db.questions.put(...)` call sites |
| direct OCR calls | 11 | invocations of the five in-app OCR/vision recognition and repair owners |
| parser/repair calls | 69 | invocation lines matching explicit parse/repair/align function names |
| export implementation lines | 41 | `exportQuestionBankPackage`, lines 19,993–20,033 inclusive |
| processDraftImportBatch lines | 5,132 | lines 15,984–21,115 inclusive |

Machine-readable snapshot: app.js lines=21778; function count=318;
processDraftImportBatch lines=5132.

The six direct formal writes are the previously disclosed non-batch app-shell
sites. The production batch formal-submit path continues through FormalAdmission
and the repository; this baseline does not call those six sites safe or migrated.

## Largest functions

| Function | Lines | Range | Baseline risk evidence |
| --- | ---: | --- | --- |
| processDraftImportBatch | 5,132 | 15,984–21,115 | DOM, async, OCR, controlled-write; high risk |
| parseDocxOptionsFromText | 242 | 2,746–2,987 | DOM-coupled |
| recognizeExamPageStructuredWithQwen | 239 | 6,363–6,601 | DOM, async, OCR/external boundary |
| recognizeDocxRenderedPageQuestionsWithQwen | 202 | 9,900–10,101 | DOM, async, OCR/external boundary |
| processDraftImportBatchV2 | 182 | 15,801–15,982 | DOM/async orchestration |
| repairPageChoiceAndSolutionDetailsWithVision | 172 | 6,190–6,361 | DOM, async, OCR/external boundary |
| loadPreconvertedDocxPageImages | 168 | 9,036–9,203 | DOM/async file flow |
| extractTextFromDraftFile | 146 | 4,143–4,288 | DOM/async source handling |
| repairFinalDraftDetailsOnImage | 137 | 12,557–12,693 | DOM, async, OCR/external boundary |
| mergeQuestionItemsWithFallback | 134 | 2,314–2,447 | DOM-coupled normalization |

Only `processDraftImportBatch` exceeds the Program C 250-line domain target. Line
count is evidence for scope, not permission to split unsafe ownership.

## Browser performance and memory

Harness: `scripts/benchmark/measure-app-shell-browser.js` with purpose
`app-shell-r3-phase0-baseline`, 7 isolated browser contexts, Chromium headless,
`networkidle`, precise-memory metrics, and the local app at
`http://127.0.0.1:3000/main.html`.

| Browser metric | Median |
| --- | ---: |
| cold start | 4,983.914 ms |
| DOMContentLoaded | 2,436.8 ms |
| load event | 4,456.3 ms |
| JS heap used | 14,979,876 bytes |
| JS heap total | 36,306,944 bytes |
| DOM nodes | 6,845 |
| documents | 3 |

All seven responses were HTTP 200 and visible body text was present. The harness
records counts/timing/heap metadata only, starts a hidden local server when needed,
and stops only the process it owns. It performs no upload, recognition, write, or
real external call.

Supporting same-host Node baselines:

| Benchmark | Median |
| --- | ---: |
| production review validation, 10 drafts | 0.454 ms |
| production review validation, 50 drafts | 2.073 ms |
| production review validation, 100 drafts | 1.994 ms |
| library metadata, 5,000 records / 1,000 iterations | 345.891 ms total; 0.345891 ms/call |

These are reference points. Upload-to-review, question switching, draft persist,
formal submit, reload, export, image bytes, IndexedDB size, and repeated-run memory
growth still require the controlled Phase 6 comparison harness; they are not
invented from static or unit-test data.

## Module dependency graph

- Manifest: `architecture/layers.json`.
- Layers: 5.
- Modules: 28.
- Directed dependency edges: 28.
- Missing dependency targets: 0.
- Dependency cycles: 0.
- Reverse/upward dependency violations: 0.
- Automated owner-source mismatches: 0.

The current graph already protects Program A FormalAdmission/repository and
Program B OCR boundaries. Program C must extend it for each new owner and cannot
replace a dependency edge with an undeclared global fallback.

## Phase 0 conclusion

The shell is not yet slim: one 5,132-line batch owner, six direct formal DB writes,
eleven direct OCR call sites, and substantial parser/repair/export orchestration
remain in `app.js`. The baseline is sufficiently explicit and reproducible to
enter architecture design. It does not authorize moving controlled-write,
FormalAdmission, repository, OCR policy, or Route B ownership.
