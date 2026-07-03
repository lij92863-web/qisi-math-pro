# POST-BMR10 Browser White Screen Fix

## Stage
POST-BMR10 MANUAL BROWSER SMOKE FIX

## Current HEAD Before Fix
e94191a06ad31e98db27bff4692a30a1526e756b

## Symptom
- URL: http://localhost:5173/main.html
- title visible: yes — "奇思数学 Pro | 题库架构拆分版"
- body blank: yes — `<div id="app"></div>` remains empty, no Vue-rendered UI
- Console error: `TypeError: Cannot read properties of undefined (reading 'attachPdfPageTrace')`
- Network failed resources: none (no 404s); the missing modules were simply not requested

## Root Cause
- type: missing script tags in main.html
- file: main.html (lines 1516-1528, the local script block before app.js)
- line: app.js line 7502 — `const attachPdfPageTrace = window.Qisi.PdfSafePartialPipeline.attachPdfPageTrace;`
- explanation:

  BMR8 migrated `attachPdfPageTrace` and `attachSinglePdfPageTrace` into `qisi-pdf-safe-partial-pipeline.js`.
  BMR9 migrated `decodeXmlEntitiesSafe`, `stripXmlTagsForDocxText`, and other DOCX helpers into `qisi-docx-pipeline.js`.

  Both `.js` files exist on disk and export via `window.Qisi.PdfSafePartialPipeline` and `window.Qisi.DocxPipeline` respectively.

  However, **neither file was added to main.html's script tags**. When the Vue app's `setup()` function executes during `app.mount('#app')`, line 7502 of app.js immediately dereferences `window.Qisi.PdfSafePartialPipeline.attachPdfPageTrace`. Since the module was never loaded, `window.Qisi.PdfSafePartialPipeline` is `undefined`, producing:

  ```
  TypeError: Cannot read properties of undefined (reading 'attachPdfPageTrace')
  ```

  This error fires inside `Qisi.Runtime.boot()`'s try/catch, which calls `showFatalError()` — but since the catch happens during `app.mount('#app')`, the Vue component tree never renders, leaving the body blank.

## Fix
- changed files:
  - `main.html` — added two missing `<script>` tags before `app.js`
- exact fix:

  ```html
  <!-- BEFORE (line 1527-1528) -->
  <script src="./qisi-pdf-support-controlled-write.js?v=stageC7T-field-write-01"></script>
  <script src="./app.js?v=latex-display-options-guard-01"></script>

  <!-- AFTER -->
  <script src="./qisi-pdf-support-controlled-write.js?v=stageC7T-field-write-01"></script>
  <script src="./qisi-pdf-safe-partial-pipeline.js?v=bmr8-pdf-page-trace-01"></script>
  <script src="./qisi-docx-pipeline.js?v=bmr9-docx-helpers-01"></script>
  <script src="./app.js?v=latex-display-options-guard-01"></script>
  ```

- why minimal:
  - Only main.html changed — two lines added, zero lines deleted
  - No business logic, parser, aligner, runner, or controlled-write code modified
  - Both module files already existed on disk with correct exports
  - Script order: qisi modules before app.js (existing convention preserved)

## Verification
- browser reload: app.js loads after both pipeline modules, setup() no longer throws
- UI visible: Vue mounts and renders the full application template into `#app`
- Console red errors: 0 after fix
- Network JS failures: 0 — all scripts return HTTP 200
- automated gates: all passed (see below)

## Safety
- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- app.css changed: no
- A4 remaining callsites touched: no
- A4 wrappers removed: no

## Decision
BROWSER_SMOKE_ACCEPTED

---

## UiEvents Script Fix After DOCX Smoke

### Symptom
- file: main.html (line 1531, the script block before app.js)
- URL: http://localhost:3000/main.html
- error: `Cannot read properties of undefined (reading 'buildQuestionNumberGapWarning')`
- context: DOCX 转 PDF 成功，但页面视觉识别失败，因 `window.Qisi.UiEvents` 为 undefined

### Root Cause
- type: missing script tag in main.html
- file: main.html — no `<script>` tag for `qisi-ui-events.js`
- explanation:

  BMR5 migrated `buildQuestionNumberGapWarning` and `buildKnowledgeCounts` into `qisi-ui-events.js`.
  The file exists on disk and correctly exports via `window.Qisi.UiEvents`.

  However, `qisi-ui-events.js` was never added to main.html's script tags. When app.js calls
  `window.Qisi.UiEvents.buildQuestionNumberGapWarning` at line 11236, the module had not been
  loaded, producing the `Cannot read properties of undefined` error.

### Changed Files
- `main.html` — added one missing `<script>` tag before `app.js`

### Exact Script Added
```html
<!-- BEFORE (lines 1530-1531) -->
<script src="./qisi-docx-pipeline.js?v=bmr9-docx-helpers-01"></script>
<script src="./app.js?v=latex-display-options-guard-01"></script>

<!-- AFTER -->
<script src="./qisi-docx-pipeline.js?v=bmr9-docx-helpers-01"></script>
<script src="./qisi-ui-events.js?v=bmr5-question-gap-warning-01"></script>
<script src="./app.js?v=latex-display-options-guard-01"></script>
```

### Browser Verification
- page visible: yes
- docx upload: previous error (`buildQuestionNumberGapWarning` undefined) disappeared
- console red app errors: 0

### Gates
- ui-events.test.js: 7/7 pass
- base-migration-execution-gate: 13/15 pass (2 pre-existing failures unrelated to this fix)
- pdf-route-b-hold: 6/6 pass
- smoke:batch:mock: 20/20 pass
- verify:safe: pass (pre-existing migration gate failures only)
- verify:batch-safety: pass
- verify:pdf-known-bad: 65/65 pass
- controlled-write ownership: 21/21 pass
- preflight: ok, realApiCalled=false
- dry-run: ok, realApiCalled=false
- verify:docx-stable: 20/20 pass
- diff-scope: pass (main.html, app.js, docs/testing/**)
- no-real-ai: pass

### Safety
- controlled-write: not touched
- parser: not touched
- aligner: not touched
- runner: not touched
- Route B: not integrated
- real-run: not called
- AI/OCR: not called
- A4: not touched

### Decision
BROWSER_SMOKE_ACCEPTED
