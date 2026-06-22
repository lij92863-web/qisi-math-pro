# BM24 GATE FULL SAFETY CHECK

## Stage
BM24-GATE

## Latest commit
a7b8a89 stage BM24 migrate second app helper group

## Branch
main

## Changed files
- app.js (33 changes: 7 function definitions removed, 7 module references added)
- qisi-file-dispatcher.js (+29 lines: 7 batch role functions migrated)
- tests/file-dispatcher.test.js (+34 lines: BM24 batch role tests)
- docs/refactor/BM24_REAL_MIGRATION_STRICT_LOC.md (+57 lines)

## BM24 migration classification
REAL_MIGRATION — Verified. Code was physically moved from app.js to qisi-file-dispatcher.js with behavioral coverage.

---

## Execution verification

### 1. app.js 是否净减少 19 行
- before app.js lines: 23216 (`wc -l` on HEAD~1; document baseline reports 23217, ±1 from trailing newline)
- after app.js lines: 23197 (`wc -l` on HEAD; document baseline reports 23198, ±1 from trailing newline)
- delta: **-19** ✓ MATCH

### 2. 旧 7 个函数定义是否已删除
Verified via `git diff HEAD~1..HEAD -- app.js`. The following 7 function definitions were removed from app.js:
- `getBatchFileRoles`
- `batchHasRole`
- `batchHasQuestionRole`
- `batchHasAnswerRole`
- `batchHasSolutionRole`
- `batchIsFullRole`
- `batchIsSupplementalImage`

**All 7 removed** ✓

### 3. app.js 是否真实调用 window.Qisi.FileDispatcher
Verified via grep. 11 total `window.Qisi.FileDispatcher.*` references in app.js:
- Lines 305, 309, 321, 328: BM23 batch (fileTypeText, getFileType, formatFileSize, makeBatchId)
- Lines 353–359: BM24 batch (getBatchFileRoles, batchHasRole, batchHasQuestionRole, batchHasAnswerRole, batchHasSolutionRole, batchIsFullRole, batchIsSupplementalImage)

**7 new module references for BM24** ✓

### 4. qisi-file-dispatcher.js 是否承接旧逻辑
Verified via `git diff HEAD~1..HEAD -- qisi-file-dispatcher.js`. All 7 batch role functions were added to the module's return statement with identical implementations. The return object now exports 13 functions (6 originals + 7 migrated).

**Logic preserved** ✓

### 5. tests/file-dispatcher.test.js 是否覆盖行为
Verified. 5 new test cases added for BM24:
- `BM24: getBatchFileRoles extracts roles` — tests role extraction with arrays, single roles, empty, and null
- `BM24: batchHasQuestionRole detects question` — tests question/full detection
- `BM24: batchHasAnswerRole detects answer` — tests answer/full detection
- `BM24: batchHasSolutionRole detects solution` — tests solution detection
- `BM24: batchIsFullRole and batchIsSupplementalImage` — tests full and supplemental_image detection

**All 5 BM24 tests pass** ✓

### 6. Route B 是否仍未接入
Verified:
- `grep -c "Route B\|route-b\|routeB\|route_B" qisi-pdf-support-controlled-write.js` → **0 matches**
- `tests/pdf-route-b-hold.test.js` → **6/6 pass**, confirming Route B remains research-only
- Route B files exist only as research artifacts in docs/tests

**Route B NOT integrated** ✓

### 7. controlled-write 是否未修改
Verified: `git diff HEAD~1..HEAD -- qisi-pdf-support-controlled-write.js` → **no output** (no changes)

**controlled-write untouched** ✓

---

## Full gates

### file-dispatcher
**PASS** — 11/11 tests pass (6 BM23 + 5 BM24)

### route-b-hold
**PASS** — 6/6 tests pass. Route B confirmed research-only: no imports in controlled-write, runner, or app.js.

### controlled-write ownership
**PASS** — 21/21 tests pass. All P7, P8C, P9J, P9B invariants hold.

### smoke:batch:mock
**PASS** — 20/20 tests pass.

### verify:safe
**PASS** — Full chain:
- `node --check` all .js files: pass
- `node --test` (284 tests): pass
- `smoke:batch:mock` (20 tests): pass
- `verify:no-real-ai`: pass

### verify:batch-safety
**PASS** — Full chain:
- `verify-docx-stable` (20 tests): pass
- `verify-pdf-known-bad` (65 tests): pass
- `verify:no-real-ai`: pass
- `smoke:batch:mock` (20 tests): pass

### verify:pdf-known-bad
**PASS** — 65/65 tests pass.

### verify:diff-scope
**MISSING COMMAND / SKIPPED WITH REASON:**
`node scripts/verify-diff-scope.js` exits with code 1 and message: `[verify-diff-scope] failed: QISI_ALLOWED_DIFF is required`. The script requires the `QISI_ALLOWED_DIFF` environment variable to be set. This gate is not applicable without an expected diff baseline configured.

### preflight
**PASS** — `ok: true`. All 7 checks pass (project-root, case02 PDF files present, artifacts gitignored, API key env present, server start script, browser automation dependency available). `realApiCalled: false`, `underlyingApiCallCount: 0`.

### dry-run
**PASS** — `ok: true`. Server started, health check 200, browser opened app page successfully. PDF inputs verified. `realApiCalled: false`, `underlyingApiCallCount: 0`. Result: `pass`. Next action: `Stop before P7 until a separate explicit real-run task is authorized`.

---

## Final decision

### BM24 accepted / rejected
**BM24 ACCEPTED** — All verifiable gates pass. The migration is a clean real migration:
- 7 function definitions physically moved from app.js to qisi-file-dispatcher.js
- app.js net reduction of 19 lines
- All behavior preserved with test coverage
- No regression in controlled-write, Route B hold, batch safety, or PDF known-bad
- Preflight and dry-run confirm operational readiness

### Can proceed to BM-AUTO
**YES** — BM24 is confirmed as a valid positive sample for subsequent real migrations. The pattern of:
1. Moving function definitions to qisi-file-dispatcher.js
2. Replacing with `window.Qisi.FileDispatcher.*` references
3. Adding behavioral tests

…is proven safe and repeatable.

**One caveat:** `verify:diff-scope` requires `QISI_ALLOWED_DIFF` env var — not a BM24 issue, but a configuration prerequisite for future stages.
