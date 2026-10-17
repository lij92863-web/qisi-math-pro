# Sol 实施任务：固定千问、简单流程、模型承担复杂判断

## 0. 当前交接与权限

用户要求：“写出具体的方案以及设计给 sol 去完成”。当前交付设计与可执行任务书，不在写文档的会话中启动业务实现、创建其他任务、调用付费模型或修改生产环境。Sol 在用户要求实施本任务时执行下述离线范围。

设计唯一依据：[PDF_QWEN37_SIMPLE_MODEL_LED_DESIGN_FOR_SOL_2026-10-14.md](PDF_QWEN37_SIMPLE_MODEL_LED_DESIGN_FOR_SOL_2026-10-14.md)。遇到与更早 PDF 研究方案冲突的设计选择，以此简化设计为准；不可覆盖用户新的指示和稳定链安全约束。

模型固定 `qwen3.7-flash-2026-07-15`。不再询问模型选择，不自动换供应商。真实调用次数本阶段为 0，旧授权不继承为新实验额度。

## 1. 必读与起点

阅读根 AGENTS.md、ai/AGENT_CONSTITUTION.md、MODULE_BOUNDARIES.md、STABLE_CHAINS.md、ACCEPTANCE_CRITERIA.md、TESTING_GUIDE.md、CODEX_WORKFLOW.md、CODEX_TASK.local.md，以及以下资料：

- skills/pdf-support-safe-align/SKILL.md
- skills/local-ai-ocr-boundary/SKILL.md
- skills/qisi-module-refactor/SKILL.md
- skills/testing-verification/SKILL.md
- ai/PDF_QWEN37_STAGED_SOFTWARE_2026-10-14.md
- ai/PDF_QWEN37_SHENZHEN_FULL_RESULT_2026-10-14.md
- 本任务配套设计全文。

目前分支 `stage/program-c-corrective-r1`，交接时 HEAD `71dfe18770e5161a19d38c07842d0ab865f20c92`。工作树已有大量历史授权修改及 23 个退役删除文件，必须保留，不能 reset/stash/commit/push。不要把所有 git diff 视为本任务改动，也不要恢复已退役解析器。

先运行 git status --short、git branch --show-current、git log --oneline -10，建立当次文件哈希与删除清单基线。历史 dirty 保留授权见 CODEX_TASK.local.md 和既有分阶段任务；如发现无法解释的新变化，先报告而不覆盖。记录 app.js、用户测试、旧实验账本与材料 hash。源码与旧证据保护检查用增量基线，不清理工作树以满足检查。

## 2. 唯一实施目标

在现有 PDF 外部管线内增加一个内部 profile `qwen37-simple-model-led-v1`：

`单页原文转写 R → 单页专门定位 L → 全来源纯文本整理 O → 机械裁图 C → 独立视觉复核 V → 既有人工审核`。

R/L 逐页串行，O/V 每来源各一次；P 页为 2P+2 个模型请求，全部通过 mock 验证。只实现固定路径和失败停止，不能实现动态补页、自动重试、局部补丁、自动部分放行或任务图。

本离线实施作为一个有界任务完成，中途的实现顺序不是需要再次批准的独立阶段。完成下面允许范围与全部必要验证后停止，不进入付费能力实验、默认启用或正式入库。

## 3. 允许修改的文件

业务文件，限设计规定职责：

- qisi-pdf-page-evidence.js
- qisi-pdf-external-provider.js
- qisi-pdf-external-producer.js
- qisi-pdf-external-contract.js（仅证据问题/审核投影，不重写 wire/review 协议）
- qisi-qwen-vision-source-port.js（仅 PDF 实际裁图资产标签，确有必要才改）
- qisi-config.js（内部 profile，模型固定，enabled:false）

既有测试：

- tests/pdf-page-evidence.test.js
- tests/pdf-qwen-staged-pipeline.test.js
- tests/pdf-external-contract.test.js
- tests/pdf-external-model-led.test.js
- tests/pdf-external-producer.test.js
- tests/pdf-external-review-ui.test.js
- tests/qwen-vision-source-port.test.js
- tests/e2e/pdf-external-chain.test.js

允许新增 tests/pdf-qwen-simple-pipeline.test.js 和 tests/fixtures/pdf-qwen-simple.json；合成材料，不从深圳卷复制整卷内容进入默认测试。测试辅助适配仅允许 tests/harness/browser-engine-injection.js，必须限定新 profile fixture，不改生产逻辑和旧样本断言。

文档：本任务、配套设计（只修正发现的歧义，不能自行扩大范围）、新 ai/PDF_QWEN37_SIMPLE_MODEL_LED_IMPLEMENTATION_2026-10-14.md。离线诊断脚本/日志放新 ignored local-run-artifacts/pdf-qwen37-simple-model-led-* 目录，避免被递归默认测试发现。

不新增业务模块、不改变模块加载顺序/依赖图，因此本阶段不需要改 main.html 或架构注册表。若已证实无法在上述边界内正确落地，报告具体原因与最小范围变更，不自行扩大。

## 4. 禁止修改和禁止行为

- app.js、main.html、app.css、DOCX 链路、退役/冻结 PDF 模块、生产路由和正式入库策略。
- 数据库/schema、用户 IndexedDB/localStorage、源 PDF/DOCX、旧响应和账本、历史人工修改。
- package.json、锁文件、依赖安装、.env/凭据读取或输出、网络/VPN/证书设置。
- 生产 3000 服务重启、正式默认启用、commit/push、真实 AI/OCR 请求。
- 为表格格式、图形、题号、标题、“略”字样增加本地语义规则。
- 降低既有序列/来源/人工确认门禁；因为模型自报 pass 而清除已有问题。
- 重建通用工作流引擎、重复账本/缓存系统、多个模块分别持久化或自行调用重试。

## 5. 明确的实施顺序

### A. 先锁住反例与兼容边界

用泛化合成原响应写出目标行为测试：额外字段全文保留、内嵌 bbox 不执行、严格定位失败停止、源异常与 null 框问题不消失、两页六调用、unknown 不重发、O 无图、V 审实际裁图。保留旧 v1/直接模式/外部 parser 的现有测试，不能把新行为直接套到旧协议。

先核对现有 producer/provider/page-evidence 的接口和账本。直接复用已有能力，不重新建设。所有新增方法写明谁调用、输入输出及是否有副作用；纯页证据模块不得访问网络/存储。

### B. 实现 v2 原始证据与定位合同

在现有页证据 owner 加 v2，保留 v1 的 restore。RawPage 身份由请求构造，原文不 JSON.parse/不清洗；LocationPage 严格检查，只有它能生成可裁资产。所有模型问题保留来源页；原页一个 block ID 不伪装成模型定位到的语义段落。

完整来源 R+L 包是缓存复用单元；不要写按失败页继续运行的调度。旧整卷原响应不能转换成伪造单页请求缓存。

### C. 接入固定 provider 顺序

新 profile 只在入口分派一次；现有旧 profile 原路。R 纯转写文本、L 小型定位协议、O 纯文本 v2.2、V 既有独立复核。R/L 都使用单页，不通过模型输出决定跳过某页。

新 profile 仅支持完整连续 document 范围。请求前校验 scope/容量配置/预算；不支持的 window/选页模式明确拒绝，不自动 fallback。每次真实物理请求都经现有登记回调；没有独立隐藏请求或候选修订调用。

### D. 接入全部资源裁图和审核证据

复用现有渲染接口，对每个非 null 资产裁一次，保留原 bbox。复核包括未放置资产和原始定位问题，放置实例只引用资源。只在现有 PDF 请求端口添加必要的资产标签，不改 DOCX。

候选仍按 v2.2 投影到旧审核体系；新 profile 的问题必须能在现有界面显示。如果现有视图无法正确展示必要阻断信息，先报告证据，不绕过问题或扩张为 UI 改版。

### E. 缓存、费用与失败闭环

新增 R/L 的 operation 被既有费用汇总完整覆盖；received-invalid 仍结算，unknown 保留预留与封锁。响应先保存再校验。检查旧 onStage 中“取第一条 parse 回执”一类单次假设，按每个 attempt 身份登记；不能把多页调用的 usage 覆盖到同一回执或重复收费。

缓存命中/刷新不增加调用；所有原页、模型/提示、定位结果和裁图内容变化不能复用旧 pass。容量不足不摘要，模型 requests 不自动执行，V 失败不调用 revise。

### F. 验证与交付

完成 focused tests、隔离浏览器 mock 和完整安全门禁；核对增量范围/旧证据哈希。产出实施报告，区分“软件流程通过”与“真实模型能力尚未验证”。到此停止。

## 6. 必须执行的验证

按实际修改范围运行相关 focused suites，至少包含页证据、新固定流程、既有模型账目与外部 producer。示例：

```powershell
node --test --test-concurrency=1 tests/pdf-page-evidence.test.js tests/pdf-qwen-simple-pipeline.test.js tests/pdf-qwen-staged-pipeline.test.js tests/pdf-external-model-led.test.js tests/pdf-external-producer.test.js
node --test --test-concurrency=1 tests/e2e/pdf-external-chain.test.js
npm.cmd run verify:safe
node scripts/verify-runtime-modules.js
node scripts/verify-app-shell-architecture.js
```

检查实际 package.json 中 verify:safe 覆盖项，避免无理由重复全套测试。当前已包括 verify:batch-safety；必须保持 DOCX 稳定链、PDF 已知坏例和 batch mock 通过。默认测试无真实 AI/OCR。脚本运行需要本机进程权限时，只申请对应测试，不因权限限制跳过验收。

浏览器使用隔离 context/端口和 mock，不能直接写生产 DB；只关闭本任务创建的服务。默认开关仍为 false，通过测试注入新 profile。

失败若明确属于本范围，修正后重跑受影响测试与必要门禁；若范围外，保留失败日志并停止报告，不改预期凑通过。

## 7. 交付与停止条件

实施报告必须包含：本轮增量文件、固定调用顺序与数量、所有失败停点、缓存/费用证据、原始材料保持、旧链兼容、测试结果、未验证的真实质量、剩余风险。不重复宣称已在深圳实测通过。

停止：离线目标完成；范围外失败；需要禁止文件/新架构；需要真实付费调用；来源或序列无法可靠建立。不得顺手进入下一阶段。

真实能力实验另列任务、明确来源/端点/模型/预算和停止条件。不得复用旧深圳最多 4 次/5 元的同意；本设计 21 页正常流程是 44 次模型请求，预算必须重算。

## 8. 可直接发给 Sol 的启动文字

> 请执行 ai/CODEX_TASK_PDF_QWEN37_SIMPLE_MODEL_LED_SOL_2026-10-14.md，设计以 ai/PDF_QWEN37_SIMPLE_MODEL_LED_DESIGN_FOR_SOL_2026-10-14.md 为准。只完成其中离线软件实现与验证，保留所有历史 dirty 改动。固定千问 qwen3.7-flash-2026-07-15。让模型承担转写、定位、归属和复核；软件只做机械执行、合同与既有账本。不要动态补页、自动重试、字段级补丁、局部自动放行或通用工作流框架。不得付费调用、修改 app.js/DOCX/生产数据、默认启用、commit 或 push。完成安全回归与增量范围报告后停止，真实质量仍须后续单独验收。

## 9. 本次文档交付验证

2026-10-14，方案编写会话完成以下检查。这些是文档交付结果，不是 Sol 未来实施或真实模型质量结果。

- 本轮只新增本任务与配套设计两份 Markdown。基线 1230 个已有非忽略文件逐文件 SHA256 不变，23 个既有删除未恢复，无范围外新增；文档相对链接检查通过。
- git status --short 仍包含历史 dirty 改动。git diff --stat 包含历史工作，不能充当本轮范围；本轮范围以 ignored 目录中的 baseline.json 和 scope-proof.json 为依据。
- npm.cmd run verify:safe：退出 0；主测试 1753/1753，DOCX 稳定链 8/8，PDF 坏例 62/62，批量 mock 8/8，no-real-ai 通过。
- 分支仍 stage/program-c-corrective-r1，HEAD 仍 71dfe18770e5161a19d38c07842d0ab865f20c92，无 commit/push。
- 业务实现、真实 AI/OCR、付费调用、默认启用、生产数据变更均未进行。后续模型定位/忠实性和新流程成本仍未验证。
- 证据目录：local-run-artifacts/pdf-qwen37-sol-design-2026-10-14，含基线、范围证明、安全回归完整日志和退出码。
- 下一步：用户将本任务交给 Sol 后，只实施本文限定的离线范围。

## 10. 本轮实施授权

2026-10-14，用户明确要求“根据方案设计与任务书进行修改”，启动上述离线实施范围。保留已授权历史 dirty 工作；允许本文所列文件的有界修改及验证。此次不调用真实模型、不扩展旧付费授权，不默认启用、不变更生产数据或服务，不 commit/push。完成实施报告与安全验证后停止。

## 11. 本轮实施结果

已完成固定 R/L/O/C/V 离线闭环，详见[实施报告](PDF_QWEN37_SIMPLE_MODEL_LED_IMPLEMENTATION_2026-10-14.md)。交付版本 verify:safe 退出 0：主测试 1783/1783，DOCX 8/8、PDF 坏例 62/62、batch mock 8/8。定向 101/101，PDF 浏览器 8/8，运行时注册及 9 个 app-shell 受保护函数门禁通过。既有工作和旧证据保留；真实模型调用为 0、默认仍关闭、未入库、未提交。当前任务停止在离线交付，不进入真实实验。
