# CODEX_TASK.local.md

> 最新交接入口（2026-10-21）：[给 Astra 的完整交接](HANDOFF_FOR_ASTRA_2026-10-21.md)。用户已要求停止代码实施，先交接，再由 Astra 规划app.js拆分。打印拆分未实施；下面连续推进和 C8A 均为历史记录，不能据此自动继续写代码或恢复在线识别授权。

> 当前入口（2026-10-20）：[连续基线任务](CODEX_TASK_CONTINUOUS_BASELINE_2026-10-20.md) / [实际结果](CONTINUOUS_BASELINE_RESULT_2026-10-20.md)。用户本轮要求连续推进，阶段 0 证据保全后已开展离线回放、隔离恢复与有回归保护的空表格审核提示修复。下文为完整保留的历史任务记录；本索引不恢复历史付费识别权限或生产数据写入权限，后续以当前对话及明确任务范围为准。

## Current stage

C8A — Agent constitution and skills bootstrap

## Objective

Create the root `AGENTS.md`, `ai/*.md`, and `skills/*/SKILL.md` files that define the engineering workflow for this project.

This task is documentation/rules only.

## Required reading

- `AGENTS.md` if it already exists
- `ai/AGENT_CONSTITUTION.md` if it already exists
- `ai/MODULE_BOUNDARIES.md` if it already exists
- `ai/STABLE_CHAINS.md` if it already exists
- `ai/ACCEPTANCE_CRITERIA.md` if it already exists
- `ai/TESTING_GUIDE.md` if it already exists

## Allowed files

- `AGENTS.md`
- `ai/*.md`
- `skills/*/SKILL.md`

## Forbidden files

- `app.js`
- `main.html`
- `app.css`
- `qisi-*.js`
- `tests/`
- `scripts/`
- `package.json`
- `package-lock.json`
- `.env`
- `tmp/`
- any data or backup file

## Required commands

```bash
git status --short
git branch --show-current
git log --oneline -10
npm run verify:safe
```

## Acceptance criteria

- All requested instruction files exist.
- No business code changed.
- `npm run verify:safe` passes.
- Final report includes changed files, diff stat, test result, and commit hash if committed.

## Stop conditions

Stop if:

- working tree is dirty before starting
- `verify:safe` fails
- a forbidden file would need to be edited
- any real AI/OCR call appears necessary

## Commit

If all checks pass:

```bash
git add AGENTS.md ai skills
git commit -m "stage C8A add agent constitution and skills"
```

After commit, stop.

## Active user-authorized override — Findings 2026-10-01 critical data integrity

The user requested independent validation and repair of the desktop findings on 2026-10-01,
confirmed this desktop checkout as the repair target, and authorized keeping the existing
untracked .workbuddy/, deliverables/, and launcher files untouched.

Current bounded stage: reproduce and repair N1, N2, N39, N40 from the latest priority list.
Allowed files: qisi-utils.js, qisi-pdf-support-block-parser.js,
qisi-pdf-support-controlled-write.js, tests/qisi-utils-bare-latex-display.test.js,
tests/qisi-app-display-cleaners-fixtures.test.js, tests/pdf-support-block-parser.test.js,
tests/pdf-support-controlled-write-answer-ownership.test.js, this local task file,
and ai/FINDINGS_CRITICAL_REPAIR_2026-10-01.md.
Forbidden: app.js, UI, DOCX parser, dependencies, production/user data, real AI/OCR,
unrelated architecture changes, commit, push, and later stages.
Gates: red/green focused regressions, verify:safe, verify:batch-safety,
verify-app-shell-architecture and verify:diff-scope. Preserve raw evidence.
The separately authorized D-1 rule change is retained for its own bounded stage;
it is not bundled into these four root-cause repairs.


## Active user-authorized continuation — Exact frozen-file approval and D-1

On 2026-10-01 the user explicitly approved exact-hash registration after the two historical
freeze checks rejected the independently reproduced N1/N2 repairs. The user separately
authorized D-1: resume only for an identical, strictly increasing answer/solution subset
inside explicit expected numbers; never resume on one-sided gaps or malformed sequences.
The existing working-tree edits are this task's reviewed work and must be preserved.

Allowed in addition to the prior N1/N2/N39/N40 files: architecture/pdf-freeze-approved-repairs.json,
scripts/verify-frozen-pdf-files.js, tests/frozen-pdf-approval.test.js,
tests/docx-producer-identity-architecture-gate.test.js,
tests/program-c-phase5-acceptance-gate.test.js, qisi-pdf-support-aligner.js,
tests/pdf-support-aligner.test.js, qisi-pdf-candidate-projection.js,
tests/pdf-candidate-projection.test.js, qisi-import-validation-service.js,
tests/import-validation-service.test.js, ai/AGENT_CONSTITUTION.md, ai/STABLE_CHAINS.md,
skills/pdf-support-safe-align/SKILL.md, and the existing repair report.
Only frozen-file acceptance rules and D-1 consumers may change; app.js, UI, DOCX parser,
dependencies, production data, real AI/OCR, commit and push remain forbidden.
Required: before/after evidence, exact approval tamper rejection, focused tests,
verify:safe, verify:batch-safety, app-shell guard and diff-scope. No further stage work.


D-1 prerequisite confirmed by reproduction: the existing question-number normalizer accepts x3 and truncates 1000. Repair that normalizer (first-round problem 5, aligner only, and one duplicate fullwidth pass of N12; NOT the N5 draft-editor issue) in the already allowed aligner; do not broaden source-text marker parsing.


D-1 rule-dependent fixture updates also allow tests/batch-smoke-mock.test.js and tests/pdf-candidate-projection-characterization.test.js. The known-bad jump-back fixture and its assertions must remain unchanged. Preserve original sequence validity in existing sourceTrace before unsafe blocks are filtered.


D-1 production-route completion also permits qisi-pdf-ocr-support-parser.js. Its existing contiguous-marker cutoff prevents the authorized shared-gap rule from reaching OCR Markdown. Preserve original anomaly evidence and existing bad-case assertions; verify using the already allowed production projection test. No endpoint calls.


## Active user authorization — Finish all 48 remaining findings without stage pauses

The user explicitly requested on 2026-10-01: verify and repair all remaining 48 items in one continuous task, without stopping between stages. This overrides prior next-stage and four-item limits. Preserve all previous reviewed edits and the three original untracked items. Do not reset/stash them.
Objective: independently classify N3-N18, N22-N23, N25-N38, N41-N56; repair actual defects at their existing owners; document disproven, intentional and dormant findings with evidence. No cosmetic rewrite or guessed fix.
Allowed files: all previously authorized files, plus app.js (only editor/handler/export/cart glue), main.html/app.css (only editor state, script wiring, fonts/print/security evidence relevant to these findings), qisi-support-text-parser.js, qisi-backup.js, qisi-archive-security.js, qisi-storage-repository.js, qisi-db.js, qisi-batch-importer.js, qisi-page-question-parser.js, qisi-draft-editor-service.js (focused new pure editor owner if required), qisi-batch-context-service.js, qisi-docx-producer-identity-contract.js, qisi-recognition-structure-policy.js, qisi-solution-quality-policy.js, qisi-strict-question-policy.js, qisi-visual-support-source.js, qisi-review-workflow-service.js, qisi-question-image-policy.js, qisi-recognition-contracts.js, qisi-support-parser.js, qisi-file-dispatcher.js, qisi-export-service.js, package.json (verification commands only), .githooks/pre-commit, scripts/verify-app-shell-architecture.js, scripts/verify-no-real-ai.js, architecture/owners.json, architecture/layers.json, architecture/runtime-modules.json, docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json, and existing tests corresponding to these modules, focused findings regressions, ai/FINDINGS_ALL_REPAIR_2026-10-01.md and ai/FINDINGS_ALL_STATUS_2026-10-01.json.
Architecture/module/owner metadata may change only after locating and proving the existing defect; preserve production import routing and DOCX+DOCX. Review exact frozen PDF content changes and update the already approved hash register explicitly; never auto-refresh during tests.
Forbidden: real AI/OCR, production/user IndexedDB or localStorage manipulation, uploaded user materials, secrets, .env, package-lock.json, dependency installation, commit/push, broad app.js rewrite, changing bad-case assertions to mask failures. Test in isolated mock DB/browser contexts only.
Required: per-item evidence ledger; focused root-cause reproductions; bounded fixes; final verify:safe, verify:batch-safety, runtime/app shell/diff scope, no-real-AI; proofs and measurement for new algorithms, with honest limits. Continue between internal groups under this explicit authorization until all 48 have a justified disposition.

Necessary existing owners additionally authorized for N5-N16/N27: qisi-review-draft-state.js, qisi-backup-workspace.js, and their focused tests. No new business owner or production route.
N50/N51 fixed-load-order safety verification additionally authorizes scripts/verify-runtime-modules.js. Preserve current dependency order; do not rewrap modules or defer provenance/duplicate initialization.


## Active user correction — Snapshot isolation and N50/N51 module loading

The user explicitly identified snapshot tests discovered by the default runner and the remaining raw config/components/app scripts and eager DB policy capture. Preserve all prior edits and the user-authored independent-process change in tests/base-migration-smoke.test.js byte-for-byte. The dirty tree is explicitly under review. Archive work first outside the project, then move old evidence outside it with SHA-256 verification; never modify snapshot contents.
Allowed additional files: qisi-config.js, qisi-components.js, app.js (wrapper/start wiring only), qisi-db.js (late policy delegation only), tests/runtime-module-loading.test.js, tests/db-fingerprint-owner.test.js, tests/image-display-url.test.js (use component export), scripts/verify-runtime-modules.js, docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json (review only wrapper AST growth/range offsets while preserving all nine function hashes and call constraints), ai/FINDINGS_ALL_REPAIR_2026-10-01.md, ai/FINDINGS_ALL_STATUS_2026-10-01.json and ai/FINDINGS_LOADING_FOLLOWUP_2026-10-01.md. Archive path: C:/Users/Administrator/Desktop/题库系统-修复存档/2026-10-01-followup. Preserve schemas, DB upgrades/hooks, original import routes and vendor files. No production DB, real AI/OCR, dependencies, commit/push or unrelated improvements. Keep the full default recursive test command; choose the user-preferred evidence relocation. Required: old/new module load failures, 24 order permutations, delayed duplicate-policy call/hook proof, real isolated browser boot, final verify:safe, app-shell, runtime, diff scope and unchanged evidence/user-test hashes.


## Active user request — Desktop historical archives and one-click shortcut

The user explicitly requested identifying and relocating four desktop qisi* folders into the software files and a desktop shortcut that starts the local service automatically. Preserve the dirty worktree, prior repair archives, and the user-edited base-migration smoke bytes. The four exact directories are qisi-program-c-recovery-20260714-024343, qisi-stage2-backup-225d0f5, qisi-stage3-backup-3e0679e, qisi-stage4-backup-94a8a93. Store hash-verified ZIP copies under local-run-artifacts/历史版本存档 inside the software; move originals intact to the existing external repair archive so old tests cannot re-enter recursive discovery. Do not delete original evidence.
Allowed: Desktop 奇思数学 Pro.lnk, open-app.cmd (hidden server start only; preserve readiness/instance checks, port and browser origin), scripts/start-local-server.ps1 (small Start-Process helper), this local task, ai/DESKTOP_LAUNCHER_SETUP_2026-10-01.md, and ignored archive/log artifacts. Reuse start-app.vbs unchanged. Local service startup and read-only health/main-page checks are explicitly authorized; real AI/OCR, database edits, dependencies, server/application business logic edits, commit/push remain forbidden. Verify ZIP bytes, original hashes, shortcut target, cold/warm startup on an isolated port without touching the user's running 3000 service, then full verify:safe and prior repair/user-test hashes.

## Active user correction — Restore automatic normal DOCX recognition

On 2026-10-01 the user reported actual DOCX MathType/WMF formula placeholders and explicitly requested restoring the original workflow with only question/answer/full role selection, without selecting a recognition producer. Preserve all existing dirty edits and the user-authored independent-process base-migration smoke bytes. The baseline normal-UI route audit proves DOCX question/full always used local PDF conversion plus strict vision; deterministic XML was not the normal fallback. Restore that existing producer for newly created normal-UI DOCX batches and PDF for PDF batches, persisting explicit internal producer identity. Do not infer a different producer after failures.
Allowed bounded edits: qisi-production-import-route-policy.js (pure normal-UI default selection), app.js (createDraftImportBatch glue and removal of obsolete selector state only), main.html (remove manual producer selector), tests/production-import-route-policy.test.js, tests/e2e/browser-harness.js (test-only explicit fixture producer injection instead of removed UI selector), docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json (range offsets and actual AST count only, preserve all nine function hashes), this task and ai/DOCX_AUTO_ROUTE_REPAIR_2026-10-01.md. No parser, server, converter, PDF, dependencies, production DB edits, commit/push, or real AI/OCR calls.
Read-only real-file verification is authorized for desktop 1.docx and local-test-materials/case01-docx-docx-stable/{01-question,02-support-answer-solution}.docx. Use isolated browser contexts and local offline Word/PDF conversion only; preserve file hashes. Verify actual XML placeholders, authoritative DOCX skeleton, rendered formula-bearing PDF pages, normal UI role-only route selection and existing vision producer orchestration with mocked recognition, no XML fallback on failure, focused tests, full verify:safe and batch safety. Snapshots stay outside recursive project test discovery at C:/Users/Administrator/Desktop/题库系统-修复存档/docx-auto-route-2026-10-01.


## Superseding user correction — Deterministic DOCX XML/OMML/MathType only

The user explicitly rejected DOCX visual recognition and requested XML/OMML and MathType Equation Native/MTEF -> local MT6.dll + LaTeX.tdl, with the existing JavaScript reader as fallback. This supersedes the preceding normal-UI DOCX vision default. DOCX normal UI must choose docx-deterministic automatically; PDF routing remains unchanged. No manual producer selector. Local native translation is explicitly authorized; no AI/OCR, rendered-page recognition, production DB editing or dependency installation.
Existing evidence: desktop lacks both OLE/MTEF readers; the clean E:/备份/题库系统 checkout contains them. Historical commit 95ceebb contains tools/translate-mathtype-mtef.ps1. Local native test has succeeded; JS reader recovers 35/35, 65/66, 146/146 OLE formulas in the three real samples, and native translation recovers the JS-unreadable formula. Port these focused sources without replacing the desktop architecture or app. Preserve prior dirty code, frozen PDF content and user test bytes.
Additional allowed owners: qisi-docx-ole-reader.js and qisi-docx-mtef-reader.js (reuse E modules), qisi-docx-formula-source.js (relationship-bound deterministic formula expansion), qisi-mathtype-local-service.js (local native batch adapter), tools/translate-mathtype-mtef.ps1 (reuse historic helper), qisi-local-server.js (register only local native endpoint), qisi-batch-importer.js (call expansion, preserve evidence and expose whole-document support text), qisi-production-docx-source-port.js (consume converted support text and full-role support; preserve source/number/field gates and images), architecture/{owners,layers,runtime-modules}.json (register exact new owners), tests/docx-formula-source.test.js and corresponding existing DOCX source-port tests. Existing route tests may update only the user-changed DOCX default expectation. app.js remains small creation glue; no new parsing or OCR logic. The existing nine handler ASTs, PDF hashes, transport safety and default test discovery remain unchanged.
Required: native-first/local-fallback real-file recovery and visual LaTeX rendering; original bytes/relationship bindings retained; unresolved fields stay review-blocked; question-only, full, question+support normal UI run with AI transport blocked; exact scoped diff and full verify:safe. Native helper uses only fixed translator, bounded batch/input/output and hidden isolated process. Restore the user's running local service to the new version after exact instance validation, without changing origin or user database. Archive all evidence outside project tests.

Actual native-chain validation also permits qisi-docx-producer-identity-contract.js: support images currently append after canonical projection while image provenance remains missing. Move their exact-token-bound merge into the existing deterministic support projection, with source/field provenance; never widen attachment identity.

The actual support-image admission check proves an existing single-source images restriction. qisi-formal-admission-policy.js and its existing tests may additionally validate exact per-image source/field/token evidence for the new deterministic DOCX aggregate image field. Primary field identity stays canonical; every support image must independently match a declared DOCX support role and its exact token in the corresponding answer/solution. No PDF change or relaxed provenance.

Formula regressions additionally authorize tests/helpers/ole-container.js (reuse the existing small CFB fixture builder), tests/docx-producer-identity-contract.test.js and tests/formal-admission-policy.test.js for exact image evidence and unresolved-formula admission rejection. These fixtures are synthetic; default verification never runs native MathType or AI.

Actual DOCX browser verification exposed an existing review-model ordering bug: loading draft rows before selecting the completed batch leaves the first review empty. Authorize only reordering these two existing coordinator statements, with a visible review regression in the existing native DOCX end-to-end test.

## User-authorized continuation — 2026-10-02 global import failure and performance audit
The user explicitly requests auditing and repairing all PDF failures, full-role DOCX failures and DOCX slowdown together. Preserve all prior dirty changes and before evidence. Read-only verification of Desktop/题目与答案 documents is authorized, in isolated browser/DB contexts only. No real AI/OCR, secrets, production data writes, dependencies or broad app rewrite. Allowed after root-cause reproduction: existing DOCX source/parser/formula/native owners, PDF import projection/validation and their producer provenance owners, diagnostic status owners, corresponding architecture metadata and focused existing tests. Any frozen PDF edit requires documented exact before/after approval registration; keep duplicate, unknown and jump-back rejection, field identity and controlled-write rules. Existing detailed architecture manifests must accurately register the native modules. New algorithms require proof against declared input domain and measured tradeoffs; do not claim unrestricted global accuracy. Required: actual failing document reproduction, stage timings, red/green root cases, question/full/separate-support and PDF normal-UI fixtures, no paid calls, verify:safe/batch-safety, app boundary, scoped diff, snapshots outside recursive tests. Local same-origin server restart after validated PID/instance is authorized.

User additionally explicitly confirms: allow Desktop/题目与答案/完整版题目.pdf and 完整版答案.pdf contents to be sent to DashScope at dashscope.aliyuncs.com, with at most 50 paid requests; DOCX remains local. This resolves the specific-file/destination auto-review rejection. No requests were sent before that confirmation.

Actual review-to-formal verification additionally authorizes a bounded correction in qisi-solution-quality-policy.js: a scalar multiplication symbol \cdot or · alone is not vector-domain evidence. Existing textual vector/arrow/dot-product cues and strict source/number admission remain. Add one existing-suite regression covering scalar and real mismatched-domain cases, then real isolated lifecycle proof.

## Recorded paid validation boundary (completed, no further paid run planned)
The human explicitly authorized only C:/Users/Administrator/Desktop/题目与答案/完整版题目.pdf and 完整版答案.pdf to DashScope. Actual permitted upstreams were https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions and https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation. Existing producer model choices: qwen3-vl-plus, qwen3.5-plus, qwen-vl-ocr-latest, qwen-vl-plus, qwen-vl-max-latest. Persist each request before sending; max 50 actual requests including retries. Abort on budget exhaustion, unlisted model/destination/document, cancellation or unexpected authority changes. DOCX is never uploaded. Actual ledger finished at 36. Default verification remains offline with real AI transports blocked. Paid scripts and raw response evidence stay in ignored local-run artifacts/external archive, not default tests.
Actual full DOCX proof also authorizes correcting the same quality owner’s exclusive-domain predicate: a sequence proof using monotonicity must not be rejected just for an additional domain. Keep disjoint-domain/number/keyword rejection and source/sequence gates. Actual 14-question UI confirmation, admission and reload passed after this correction.


## Active user authorization — Shenzhen / Hebei actual PDF visual audit, 2026-10-02
The user requested actual full PDF recognition, careful visual comparison against both sources, root-cause classification, general and efficient bounded algorithms with explicit proofs, and repair without defensive complexity. Preserve the dirty desktop checkout and every prior edit/user test; no reset, stash, commit or production data mutation. On 2026-10-02 the user answered yes to the exact request: permit the Shenzhen 21-page PDF and Hebei 19-page PDF under Desktop/题目与答案 to DashScope (dashscope.aliyuncs.com), and increase the cumulative paid-request ceiling to 150 including the prior 36, all retries and revalidation. Inputs are the exact paths/hashes in the new source-manifest.json. Existing endpoints/models and no-secret transport rules remain; DOCX is not uploaded. Record each attempted paid request before dispatch; stop external calls on budget/cancellation/unlisted input/model/destination. Use isolated browser DB/server; never write the production question bank.
Allowed: this task, ai/PDF_SHENZHEN_HEBEI_VISUAL_AUDIT_2026-10-02.md; existing PDF recognition owners qisi-batch-engine-v2.js, qisi-qwen-vision-source-port.js, qisi-pdf-question-boundary.js, qisi-pdf-candidate-projection.js, qisi-pdf-ocr-support-parser.js, qisi-page-question-parser.js, qisi-recognition-structure-policy.js, qisi-strict-question-policy.js, qisi-solution-quality-policy.js, and their existing focused regression suites, exact frozen-PDF repair register if a frozen owner changes. Change only proven PDF defects in these owners; keep DOCX, current public ports, app.js handlers/UI/storage/admission chain, dependencies and source documents untouched. Add another owner only after demonstrating existing ownership cannot contain the defect cleanly. Proven additional owners: qisi-production-pdf-sources-port.js (actual route discards every recognized figure and lacks inherited section evidence), qisi-browser-document-source.js (layout must retain explicit token coordinates for A/B/C/D image ownership), qisi-review-draft-normalization-policy.js (review re-splits already typed PDF fields), and existing corresponding tests. Preserve public ports and app.js. Required: immutable baseline/raw response/source hashes, complete visual comparison of 40 pages, real normal-UI reproduction and revalidation, offline reuse rather than paid duplicate diagnostic calls, relevant bounded proofs and measurements, root regressions, verify:safe/batch-safety/runtime/app-shell and exact incremental scope report. No claim of guaranteed OCR accuracy from finite samples.


## Superseding user direction — PDF V1 task specification, documentation only

On 2026-10-02 the user accepted the simplified V1 goal and requested recording the next-stage constraints. The current turn only creates ai/CODEX_TASK_PDF_MULTIMODAL_V1.md, links it here, and marks the full architecture document as research rather than V1 implementation scope. Preserve the dirty desktop worktree and all prior evidence/user-authored tests. Do not resume the previous repair continuation or paid test run. No business code, runtime, data, dependency, commit or push changes in this documentation turn.

V1 implementation specification: [CODEX_TASK_PDF_MULTIMODAL_V1.md](CODEX_TASK_PDF_MULTIMODAL_V1.md). Its core rule is: every added PDF business step must explain whether it validates the model or reinterprets the exam for the model; the latter is excluded by default. Use configurable sliding windows, one model, compact structured output, conservative equal-content deduplication/conflict, exact exam/import identity plus question number, original PDF crops, basic validation and teacher review. No secondary semantic parsers or deferred mechanisms.

Allowed files in this turn: this task file, ai/CODEX_TASK_PDF_MULTIMODAL_V1.md, ai/PDF_MULTIMODAL_IMPORT_ARCHITECTURE_DESIGN_2026-10-02.md. The new task is an implementation specification, not a statement that implementation or real acceptance has begun. Existing source/destination/budget permissions are not expanded. Required: task-content/link checks, exact incremental documentation scope, protected-business-file hashes, verify:safe with no real AI, and stop after document delivery.

## Superseding user direction — PDF V1 implementation

本轮用户明确要求一次性完成 V1；实施授权、文件范围、付费来源/预算和停止扩张条件以 `ai/CODEX_TASK_PDF_MULTIMODAL_V1.md` 的“本轮实施授权覆盖”为准。此前仅文档限制已由用户解除。旧 dirty 改动已获保留授权，本轮不 reset/stash/commit/push。
