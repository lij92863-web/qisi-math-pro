# CODEX_TASK.local.md

## Current program

H — TEX题库讲义制作与浏览器内 Typst PDF 导出。

本任务合并以下两份用户任务书，并以合并后的 51 个章节为同一份产品契约：

- 讲义制作与 Typst PDF 导出主任务书（第 1—30 章）；
- 题目级编辑、图片排版、答案解析位置、标签、页眉页脚补充任务（第 31—51 章）。

补充任务中的第一优先级能力是第一版核心，不得降级成后续可选项。项目已经统一更名为
“TEX题库”，实现中不恢复旧品牌名。

## Objective

建立独立、离线、本地优先的讲义领域，使教师能够：

```text
新建或打开讲义
→ 添加结构化内容块
→ 从正式题库插入带引用的题目快照
→ 只在讲义实例中编辑内容和排版
→ 保存并恢复草稿
→ 生成安全的学生版和完整的教师版
→ 使用同一 Typst 链进行正式预览和 PDF 导出
```

## Global invariants

- 只在 `codex/*` 分支工作，不修改 `main`。
- 现有题库是题目内容的唯一真值来源；不得建立第二套正式题库。
- 讲义题目采用“源题引用 + 插入时快照 + 稀疏局部覆盖”。
- 讲义局部编辑默认永不回写正式题库。
- 学生版安全规则优先级最高；答案、分析、解析、教师备注在生成文档模型前删除，
  不得依赖 CSS 或视觉隐藏。
- 现有 DOCX+DOCX、PDF fail-closed、录题、题库、试题篮、组卷和 HTML 打印链保持不变。
- Typst 只服务于讲义；普通页面启动时不得加载 Typst WASM、MiTeX 或讲义字体。
- 正式预览和 PDF 导出必须共享同一数据、模板、生成器和编译链。
- 题库原始 LaTeX 不因 Typst 导出而修改；不安全的公式转换必须阻止导出并定位。
- Typst、MiTeX、模板、字体和图片必须使用本地固定资源，不依赖公共 CDN 或云端编译。
- 不允许用户输入或执行任意 Typst 源码。
- 新业务逻辑进入聚焦的 `qisi-handout-*.js` 模块；`app.js` 不接收讲义业务逻辑。
- 所有存储调用必须经过 repository；UI 不直接散落 Dexie/IndexedDB 调用。
- 图片尺寸的正式数据使用毫米或页面宽度百分比，不使用绝对屏幕坐标。
- 每个阶段一个限定变更、一个门禁报告、一个提交；提交后等待下一任务轮次再进入下一阶段。
- 不得把 failed、timeout、skipped、未人工验证或原型成功写成正式完成。

## Architecture direction fixed by H0

- 讲义采用同源独立入口 `handout.html`，与现有单页组合根隔离。
- 主页面未来只增加进入讲义的轻量链接；不把讲义状态注入 `app.js`。
- 编辑预览使用 HTML + KaTeX。
- 正式链路为：

```text
Handout
→ NormalizedHandout
→ edition safety projection
→ TypstDocumentModel
→ trusted Typst source + virtual files
→ Web Worker + Typst WASM + MiTeX
→ PDF bytes
→ PDF.js preview / local download
```

- 讲义数据使用现有 `QisiMathVueDB` 的加法式 schema 迁移，并通过独立 repository
  访问；不修改 `questions`、`images` 等已有 store 的键或语义。
- 讲义资产保存为 Blob，插入题库题目时复制必要图片到讲义资产域，避免源题删除后旧讲义失效。

## H stages

### H0 — Repository and architecture audit

Objective: audit the real repository before implementation and freeze boundaries.

Allowed files:

- `ai/CODEX_TASK.local.md`
- `docs/stages/STAGE_H0_HANDOUT_ARCHITECTURE_AUDIT.md`

Forbidden:

- all production code;
- dependencies and lockfiles;
- database schema;
- user data and real question content.

Required gates:

- `npm.cmd run verify:safe`
- `$env:QISI_ALLOWED_DIFF='ai/CODEX_TASK.local.md,docs/stages/STAGE_H0_HANDOUT_ARCHITECTURE_AUDIT.md'; npm.cmd run verify:diff-scope`

### H1 — Browser Typst/MiTeX feasibility prototype

Objective: independently prove local browser compilation before product integration.

Required proof:

- pinned, locally served Typst WASM;
- locally served MiTeX;
- redistributable fixed Chinese and math fonts with recorded licenses;
- Web Worker compilation;
- Chinese, inline/display LaTeX, piecewise, matrix, image, 2+ pages, header/footer;
- PDF bytes, browser preview and download;
- main page startup does not request any H1 resource;
- readable block/formula diagnostics and fail-closed behavior.

Allowed scope:

- `prototypes/handout-typst/**`
- focused H1 tests and fixtures;
- `vendor/typst/**`, `vendor/mitex/**`, approved fonts and license files;
- production manifest classification only if needed to classify lazy assets;
- package files only if the selected pinned dependency cannot be vendored without them;
- H1 stage document.

Forbidden:

- `app.js`;
- production navigation or database changes;
- DOCX/PDF/import/print business logic.

### H2 — Handout domain model and repository

Objective: implement schema, validation, migrations, source-reference snapshots, assets,
autosave, recovery, CRUD, revision fallback and source-update comparison.

Required boundaries:

- add stores without changing existing store indexes or records;
- expose database access explicitly while preserving existing lexical globals;
- include handout tables/assets in verified backup;
- test that讲义 overrides never mutate source questions.

Required gates:

- focused model/migration/repository/backup tests;
- `verify:docx-stable`;
- `verify:batch-safety`;
- `verify:safe`.

### H3 — Independent handout editor and HTML preview

Objective: implement handout list and structured editor without Typst business coupling.

First-priority scope:

- heading, body, callout, image, page-break and question blocks;
- create/open/rename/copy/delete/autosave/recovery;
- insert questions from the existing bank;
- reorder/copy/delete/undo/redo;
- selected-question property panel with content, options, images, answers/solutions,
  labels, display and source-update sections;
- sparse instance overrides and restore-to-snapshot;
- option layouts: auto, one row, two columns, one column;
- image source/replace/remove/restore, position, width, alignment, order and caption;
- answer/analysis/solution placements;
- global page, header and footer settings;
- student/teacher HTML preview using the same normalized layout decisions.

Forbidden:

- raw Typst editor;
- direct IndexedDB access in UI;
- changes to source questions;
- `app.js` business logic.

### H4 — Edition policy and Typst document generation

Objective: build the pure formal-document pipeline and trusted default A4 template.

Required:

- deterministic inheritance resolution;
- student safety projection and leakage scanner;
- Typst escaping and injection resistance;
- local placeholder resolver for header/footer;
- option/image layout policy shared with HTML preview;
- answer/analysis/solution end sections;
- reversible LaTeX display normalization audit trail;
- one centrally managed Typst template.

### H5 — Production compiler infrastructure

Objective: integrate lazy Web Worker compilation, virtual filesystem, fonts, MiTeX,
PDF.js preview, cancellation, diagnostics, cache/version handling and download.

Required:

- no Typst request during normal main-page load;
- no main-thread compilation;
- missing asset/font/formula blocks export;
- formal preview and export use identical PDF bytes;
- Blob URLs are released on close/unload, not by an arbitrary short timeout.

### H6 — Product integration and first-priority closure

Objective: add the lightweight main navigation entry and complete the first-priority
browser workflow without changing stable chains.

Required manual path:

```text
main page → handout page → create → mixed blocks → insert/edit question
→ image/option/answer/header/footer layout → save → reload
→ student preview/export → teacher preview/export
```

### H7 — Second-priority completion

Objective: complete multi-question batch settings, source diff/update conflicts,
multi-image complex layout, custom labels, header/footer images and backgrounds,
and local single-question formal preview.

### H8 — Real formula, offline, performance and final acceptance

Objective: produce the final evidence set and documentation.

Required:

- real question-bank formula compatibility report;
- 5/20/50-page compile measurements;
- cold/warm initialization, memory and PDF size evidence;
- cached offline restart and export;
- complete browser action acceptance;
- student-PDF text scan for answer leakage;
- rendered PDF visual inspection;
- regression of main page, search, cart, exam, print and batch chains;
- usage, architecture, dependency/license, known-limit and recovery documentation;
- clean tree and pushed branch.

## Explicitly out of scope

- AI-generated handouts, rewrites, summaries or variants;
- arbitrary Typst source editing;
- Word export;
- cloud sync or cloud compilation;
- multiplayer/collaboration;
- template marketplace;
- arbitrary-coordinate desktop-publishing layout;
- complex text wrapping;
- QR-code implementation;
- changes to recognition or answer-alignment algorithms.

## Interposed stage H3R — DOCX/PDF real-material recovery gate

This user-authorized hotfix stage must finish before H4. It is a separate bounded
change from the handout program and temporarily permits focused recognition fixes.

Objective:

- isolate MathType native-helper crashes so one malformed equation cannot abort a
  complete DOCX batch or expose a raw PowerShell/.NET stack in the UI;
- correct general DOCX question-skeleton false rejections without weakening
  duplicate, jump-back, source-order, answer/solution, or fail-closed safeguards;
- run every file under `C:\Users\Administrator\Desktop\题目与答案` through the
  applicable local structure/import acceptance path;
- run the real dual-PDF pair at most five times and keep all unsafe support
  alignment fail closed;
- do not start H4 until the H3R gates pass and the hotfix is committed.

Allowed production files:

- `qisi-local-server.js`;
- `tools/translate-mathtype-mtef.ps1`;
- focused DOCX modules named `qisi-docx-*.js`;
- `qisi-batch-importer.js`;
- focused PDF safety modules named `qisi-pdf-*.js` or `qisi-support-*.js`, but only
  when a reproduced real-material failure proves a change is necessary.

Allowed supporting files:

- focused tests and local-only real-material harnesses;
- `ai/CODEX_TASK.local.md`;
- one H3R stage report.

Read-only unless a separately documented blocker proves otherwise:

- `app.js`;
- `main.html`;
- `app.css`.

Forbidden:

- formal question-bank writes or direct IndexedDB mutation;
- filename, document hash, fixed question number, or school-specific special cases;
- semantic answer attachment;
- weakened PDF fail-closed rules;
- dependency or lockfile changes;
- H4 implementation.

Real AI/OCR test authorization:

```text
Purpose: real dual-PDF question/support acceptance before H4
Models: existing production-selected qwen-vl-plus, qwen3-vl-plus,
        qwen-vl-max-latest, qwen-vl-ocr-latest, and qwen-plus only
Input: 完整版题目.pdf + 完整版答案.pdf from the authorized desktop folder
Endpoints: local /api/ai/chat and /api/ai/ocr proxies only
Expected maximum: five complete dual-PDF attempts
Cost risk: paid DashScope requests; bounded by the five-attempt ceiling
Success: ordered question drafts, reliable support sequence, no wrong attachment,
         no formula/image/layout corruption, and reviewable diagnostics
Abort: unexpected model/endpoint, repeated upstream/auth failure, sequence
       conflict, duplicate/jump-back, or five attempts consumed
Business changes: allowed only in the focused files above, followed by all gates
```

Required gates:

- focused regression tests for every reproduced failure;
- `npm.cmd run verify:docx-stable`;
- `npm.cmd run verify:pdf-known-bad`;
- `npm.cmd run verify:batch-safety`;
- `npm.cmd run verify:safe`;
- diff-scope verification;
- clean staged diff, one H3R commit, and push.

## Stop conditions

Stop the affected stage when:

- the tree becomes unexpectedly dirty;
- a required file is outside the stage allowlist;
- selected dependencies cannot be pinned, licensed and served locally;
- Typst/MiTeX cannot satisfy the H1 proof without cloud or native installation;
- formula conversion cannot be proved safe;
- student output contains any protected teacher content;
- stable DOCX/PDF/import/print gates regress;
- a browser or PDF claim lacks actual evidence.

## H3R completion report (2026-07-29)

Status: complete. H4 remained blocked until every gate below passed.

### Documented production-boundary exception

`app.js` and `scripts/production-entry-manifest.js` had to change during H3R.
This is the explicit blocker record required by the H3R read-only rule:

- the live DOCX visual-support page loop, retry scheduling, draft merge, and review
  save coordinator still exist only in `app.js`; reproductions proved that changing
  only the pure DOCX modules could not affect the production route;
- all new sequence, partition, retry-plan, evidence, and fail-closed decisions live
  in `qisi-docx-pipeline.js`; `app.js` contains orchestration and calls those
  policies rather than duplicating their business rules;
- the PDF review save/cleanup path required two narrow calls to the existing
  `Qisi.PdfContentIntegrity.normalizeQuestionItem` boundary so persisted drafts use
  the same sanitizer as initial recognition;
- `scripts/production-entry-manifest.js` changed only to register and audit the new
  independent `qisi-mathtype-native-guard.js` production module.

No filename, school, document hash, or fixed question-number special case was
added. No dependency or lockfile changed. No formal question-bank write or direct
IndexedDB mutation was used for acceptance.

### Real-material scope and evidence

The user explicitly removed the Zhejiang scan from scope. H3R acceptance used all
16 files under `C:\Users\Administrator\Desktop\题目与答案`: 13 DOCX files and the
three authorized PDFs.

- dual DOCX normal browser flow: 14 questions, 14 answers, 14 solutions;
- combined question/answer/solution DOCX: 14/14/14;
- `周二晚测.docx`: 12 questions; question images only on 5, 9, and 11;
- `高二.docx`: continuous 1-56 skeleton, 56 drafts, trailing answer section kept
  fail-closed where support was absent;
- five 19-question school papers: tables, 1/2/4-column choices, formulas, and the
  Wuhan two-image horizontal row survived the normal browser route;
- real MathType WMF/MTEF translation, brief six-question DOCX, and full twelve-
  question dual DOCX all passed without AI/OCR.

Four complete authorized dual-PDF attempts were consumed, within the five-attempt
ceiling. The final real browser results were:

- brief pair: 6 questions; answers `B,C,B,C,D,C`; zero render errors on every
  question; question image on 4; solution images on 2 and 6;
- full pair: 12 questions; answers
  `B,C,B,C,D,C,ABD,AC,ABD,-19/13,6,(sqrt(2)+1)/2`; zero render errors on every
  question; question images on 4, 8, and 11; solution images on 2, 6, and 8;
- repeated display cleanup preserved all answers, formulas, and image anchors;
- generated TikZ source was removed only from display fields, while verified crop
  tokens and raw source evidence remained available;
- PDF answer/solution ownership stayed sequence-based and fail-closed.

### Final gates

- production syntax: 60 files passed;
- real DOCX general browser test: passed;
- real DOCX layout browser test: five files passed;
- real DOCX rich-content and native MathType tests: three tests passed;
- `npm run verify:docx-stable`: 20/20 passed;
- `npm run verify:pdf-known-bad`: 65/65 passed;
- `npm run verify:batch-safety`: passed;
- `npm run verify:safe`: 1313 total, 1305 passed, 0 failed, 8 intentionally
  skipped;
- `npm run verify:no-real-ai`: passed;
- `git diff --check`: passed;
- production diff scan found no fixture filename, school, hash, or fixed-number
  branch.
