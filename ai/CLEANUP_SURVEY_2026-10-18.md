# 只读盘点报告：哪些东西可能用不上

- 盘点时间：2026-10-18 19:25–19:45（Asia/Shanghai）
- 盘点人：cleanup-survey（只读）
- 仓库：`C:/Users/Administrator/Desktop/题库系统`
- 最近提交：`85441f5 2026-10-18 01:28 feat(pdf): MinerU block route — 19/19 questions on the real paper in 16 s`
- 本报告是**唯一被写入的文件**。没有删除、移动、重命名任何东西，没有执行任何有副作用的 git 命令。

## 0. 必须先说清楚的三件事

1. **盘点时工作区是"活的"。** `git status` 有 33 项未提交改动，`tmp/audit-deep`、`tmp/audit-perf`、`tmp/audit-mineru`、`tmp/audit-docx` 的时间戳是 19:30–19:35，`ai/HANDOUT_*.md`、`qisi-handout-formula-gate.js` 是 19:30 之后才出现的。**MinerU 链路和讲义链路正在被其他同事改**，本报告对这些文件的结论一律标"暂勿动"。
2. **我没有跑 `npm test`。** 只跑了一个只读校验 `node scripts/verify-runtime-modules.js`（结果 `{"valid":true,"errors":[]}`）。所有"删了会让测试变红"的结论都是**读代码引用关系**得出的静态判定，已逐条注明证据文件。
3. **"被 .gitignore 忽略"不等于"可以删"。** `.gitignore` 里的 `tmp/`、`local-run-artifacts/`、`local-test-materials/`、`*.log`、`*.zip`、`.env` 都不在 git 里，**删了没有任何历史可以恢复**。这一点在后面每一档都会重复标注。

---

## 1. 总览表

| 类别 | 文件数 | 占用 | 建议 |
|---|---:|---:|---|
| 根目录 `qisi-*.js`（浏览器加载 80 + Node 9 + 沉睡 23） | 112（仍在增加） | 1.59 MB | 🔴 绝大部分别动；🟡 23 个沉睡模块可另案处理 |
| 根目录疑似残留（`.bm_*`、`tmp/`、`page-1.png`、`test.pdf`、`1.docx`） | 1686 | 约 21 MB | 🟡 分区处理，见第 3 节 |
| `docs/` | 407 个文件（403 md + 4 json） | 2.7 MB | 🟡 建议"归档"而不是删；12 篇被代码引用 🔴 |
| `ai/` | 103 个文件（98 md + 2 json + 3 txt） | 1.6 MB | 🔴 7 篇必读；🟡 历史工单回执 |
| `deliverables/` | 203 | 8.3 MB | 🟡 验收证据，156 tracked / 47 ignored |
| `local-run-artifacts/` | 3340 | **328 MB** | 🟡 整体是证据；🟢 仅个别重复快照；🔴 今天在写的三个目录 |
| `tmp/` | 1664 | 19 MB | 🟢 缓存可清；🟡 快照/日志；🔴 今天在写的审计目录 |
| `node_modules/` + `vendor/` | — | 76 MB | 🔴 绝对别动 |
| `.workbuddy/` | 10 | 121 KB | 🔴 不在 git，删了找不回 |
| `local-test-materials/` | 4 | 1.2 MB | 🔴 真实素材，不在 git，含隐私 |
| `tests/` `scripts/` `skills/` `tools/` `benchmarks/` `local-ocr/` | — | 约 620 KB | 🔴 工程资产，测试互相依赖 |

---

## 2. 第 1 类：`qisi-*.js` 里的死模块

### 2.1 判定方法与口径

对每个根目录 `qisi-*.js` 同时查了 5 件事：

1. `main.html` 是否有 `src="./qisi-xxx.js?v=..."`（实测加载 **80** 个；网上常说的 84/90 是更早的快照）；
2. 其他 `qisi-*.js` / `app.js` 是否出现 `Qisi.Xxx`、`window.Qisi.Xxx`、`QisiBatchXxx` 或 `require('./qisi-xxx')`；
3. `architecture/runtime-modules.json` 的 `runtime`（当前 111 条：browser 81 含 app.js / dormant 21 / node 9）；
4. 是否只被 `tests/` 引用；
5. `architecture/layers.json` 的 `status`（production-wired 66 / scaffold 8 / deprecated 6 / research-only 1）。

### 2.2 A 表：确认在跑的

| 分组 | 数量 | 说明 |
|---|---:|---|
| 浏览器加载 + 有生产消费点 | 75 | 主链路：导入、审核、存储、备份、导出、PDF v2、DOCX、Qwen 视觉。含 `qisi-ocr-qwen-adapter.js`（被 `qisi-qwen-vision-source-port.js` 的 `root?.Qisi?.OcrQwenAdapter` 调用）、`qisi-support-parser.js`（被 `qisi-visual-support-source.js` 的 `?.SupportParser` 调用）、`qisi-secure-logger.js`（`main.html:1630` 内联脚本安装，同时被 Node 侧 require） |
| 浏览器加载 + 通过全局 `db` 消费 | 1 | `qisi-db.js`：它不挂 `Qisi.*`，而是在共享脚本作用域里建 `const db = new Dexie('QisiMathVueDB')`，`app.js:19/3142/3236` 直接使用 `db`。**这类"没有 Qisi 前缀"的模块最容易被误判为死代码** |
| 浏览器加载但**没有任何消费者**（空转） | 4 | `qisi-performance-monitor.js`、`qisi-ocr-engine-registry.js`、`qisi-ocr-local-adapter.js`、`qisi-ocr-shadow-mode.js` |
| Node 侧 | 9 | 8 个被 `qisi-local-server.js` require 的模块 + 入口 `qisi-local-server.js` 本身：`qisi-temp-job-manager`、`qisi-local-instance`、`qisi-local-ai-request-policy`、`qisi-docx-upload-policy`、`qisi-local-https-transport`、`qisi-local-http-boundary`、`qisi-mineru-client`、`qisi-mathtype-local-service`。这 8 个 + 浏览器兼用的 `qisi-secure-logger` = 服务启动时的完整 require 列表 |

**"空转"的 4 个要单独说清楚：** 它们被 `main.html` 加载，但全库搜不到 `Qisi.PerformanceMonitor` / `Qisi.OcrEngineRegistry` / `Qisi.OcrLocalAdapter` / `Qisi.OcrShadowMode` 的任何消费点（`qisi-ocr-qwen-adapter.js` 走的是 `QwenVisionSourcePort`，不走注册表）。`architecture/layers.json` 把它们标成 `scaffold`，`architecture/ocr-engine-config-r1.json` 写明 `shadow.benchmarkOnly: true`、`canary.enabled: false`。

→ 结论：**它们不产生功能，但属于"OCR 质量 R1"研究的正式脚手架**，删了会同时打破 `architecture/layers.json` 的 scaffold 记录和 6–9 个测试。**不建议现在删**，最多从 `main.html` 摘掉 4 个 script 标签省 4 次请求（这属于代码改动，不在本次授权范围）。

### 2.3 B 表：只被测试引用 / 无人引用但仍在清单里（"疑似未接线"）

> 本表是按"能不能接到生产链路"归类。标了 **（已加载·空转）** 的 4 个，浏览器确实加载了它们，所以在附录 A 表里计入 "A 空转"；这里重复列出，是为了说明它们和完全没加载的 scaffold 一样，**都没有消费者**。

| 子类 | 文件 | 它本应服务的功能 | 清单状态 | 测试引用数 |
|---|---|---|---|---:|
| B1 官方 deprecated | `qisi-import-orchestrator.js` | 老的导入协调器，已被 `qisi-production-import-bridge.js` 取代 | deprecated | 9 |
| B1 | `qisi-legacy-batch-run-coordinator.js` | 老批量运行协调，已被 `batch-engine-v2` 取代 | deprecated | 2 |
| B1 | `qisi-injected-import-path.js` | 注入式导入路径 | deprecated | 5 |
| B1 | `qisi-pdf-support-controlled-write.js` | PDF 答案字段级受控写入（V1 路线） | deprecated | 10 |
| B1 | `qisi-import-equivalence-normalizer.js` | 导入快照等价性对比 | deprecated | 4 |
| B1 | `qisi-pdf-multimodal-producer.js` | PDF 多模态生产者（V1） | deprecated | 3 |
| B2 官方 scaffold | `qisi-ocr-reading-order.js` | OCR 阅读顺序校验 | scaffold | 3 |
| B2 | `qisi-ocr-structure-extractor.js` | OCR 题目结构抽取 | scaffold | 3 |
| B2 | `qisi-ocr-candidate-selection-policy.js` | OCR 引擎候选选择策略 | scaffold | 4 |
| B2（已加载·空转） | `qisi-ocr-local-adapter.js` | 本地 OCR 适配器 | scaffold | 8 |
| B2（已加载·空转） | `qisi-ocr-engine-registry.js` | OCR 引擎注册表 | scaffold | 6 |
| B2（已加载·空转） | `qisi-ocr-shadow-mode.js` | OCR 影子对比（只跑基准，不许写库） | scaffold | 6 |
| B2（已加载·空转） | `qisi-performance-monitor.js` | 阶段耗时采样（import/ocr/save/export…） | scaffold | 1 |
| B2 | `local-ocr/server.js`（非 qisi 前缀，但同属 scaffold） | 本地 OCR 服务端 | scaffold | — |
| B3 清单外的 BM 遗留门面 | `qisi-app-facade.js` | BM04/BME13 的"应用门面"，设计上是 `app.js` 的收口层 | **不在 layers.json** | 3 |
| B3 | `qisi-batch-orchestrator.js` | BM06 批处理编排接口 | **不在 layers.json** | 2 |
| B3 | `qisi-review-view-model.js` | BM09 审核页视图模型 | **不在 layers.json** | 2 |
| B3 | `qisi-storage-facade.js` | BM14 存储门面 | **不在 layers.json** | 1 |
| B3 | `qisi-ui-renderer.js` | BM16 UI 渲染器 | **不在 layers.json** | 2 |
| B4 清单外的 PDF 研究件 | `qisi-pdf-answer-only-extraction.js` | Route B 只抽答案（研究冻结） | **不在 layers.json** | 4 |
| B4 | `qisi-pdf-answer-extraction-quality.js` | 答案抽取质量分级 | **不在 layers.json** | 4 |
| B5 今天在做的 MinerU 链路 | `qisi-mineru-evidence.js` | MinerU 证据规范化（数学掩码/答案声明/选项区间） | dormant | 0（被 `qisi-block-ownership.js`、`qisi-paper-segmenter.js` require） |
| B5 | `qisi-paper-segmenter.js` | 试卷分段 | dormant | 2 |
| B5 | `qisi-paper-pairing.js` | 题-答配对 | dormant | 2 |
| B5 | `qisi-block-ownership.js` | 块归属与字段投影 | dormant | 1 |
| B5 | `qisi-block-ownership-prompt.js` | 块归属提示词 | dormant | 2 |
| B6 今天在做的讲义链路 | `qisi-handout-model.js` | 讲义数据模型（19:36 新建，尚未接线） | 未登记 | 0 |
| B6 | `qisi-handout-html.js` | 讲义 HTML 渲染（19:36 新建，尚未接线） | 未登记 | 0 |

**关键判断：**

- B1 的 6 个是**最干净的删除候选**：官方已标 `deprecated`、不在 `main.html`、无生产调用。但它们各自有 2–10 个测试在 require，且 `architecture/runtime-modules.json`、`layers.json`、`owners.json` 都登记着。**删一个文件要同时改 3 份清单 + 删/改若干测试**，否则 `tests/runtime-module-inventory.test.js`、`tests/architecture-manifest.test.js` 立刻红。
- B3 的 5 个是**真正被遗忘的 refactor 半成品**：`app-facade` 有完整测试证明它自己能用，但 `main.html` 从来没加载过它。这类最像"死模块"，但也最像"作者当时有意留的下一阶段接口"。**建议保留 + 在 `ai/APP_SHELL_SLIMMING_R3_STATE.md` 里标一句状态**，而不是删。
- B4 的 2 个对应 `README.md` 里"Route B 已冻结为 research-only"，是**冻结证据**，不是垃圾。
- B5 是**今天正在写、尚未提交**的代码（`git status` 显示 `qisi-block-ownership.js` 等已修改、`qisi-mineru-evidence.js` 新增）。**现在碰它会直接打断同事的工作。**
- B6 的 `qisi-handout-model.js` / `qisi-handout-html.js` 是 19:36 才出现的，**连 `runtime-modules.json` 都还没来得及登记**。这类"盘点期间新长出来的文件"最危险 —— 任何按旧清单生成的删除脚本都会漏掉它，或者相反，把它当成孤儿。**凡是 2026-10-18 当天新建/修改的文件，一律先问再动。**

### 2.4 C 表：明确的孤儿

**0 个。**

112 个 `qisi-*.js` 里，没有任何一个同时满足"没被 `main.html` 加载 + 没被任何生产代码 require + 测试里也没有"。最接近孤儿的 5 个（`app-facade`、`batch-orchestrator`、`review-view-model`、`storage-facade`、`ui-renderer`）都还有自己的单测在跑。

> 结论：**`qisi-*.js` 目录里没有"删了立刻变干净"的文件。** 想瘦身只能走"模块下线"流程（代码 + 3 份清单 + 测试一起改），不适合当成"清理垃圾"来做。

---

## 3. 第 2 类：历史副本与构建残留

### 3.1 逐个定性

| 路径 | 大小 | 是什么 / 谁生成的 | 现在还有谁读 | 建议 |
|---|---:|---|---|---|
| `C:/Users/Administrator/Desktop/题库系统/.bm_a4_app_before.js` | 1.17 MB | BM-A4 迁移前 `app.js` 的**片段快照**（首行就是 `const App = {`，缺文件头，不能直接运行）。由当时的迁移活动人工保留 | 无脚本读取；仅 `.git/info/exclude` 第 7 行和若干历史 md 提到它 | 🟡 可删。`app.js` 从 `809a2cb` 起就在 git 里，历史版本可恢复。删前建议先 `git log --all --oneline -- app.js` 确认目标版本在 |
| `.../tmp/converted/`（26 个 job 目录） | 15 MB | `qisi-local-server.js:26` 定义、`:502` 写入的 DOCX→PDF 转换输出，被 `:52` 挂成静态目录 | 服务端按需读取；前端拿到 URL 后预览 | 🟢 **停掉服务后**可清空，下次导入自动重建 |
| `.../tmp/uploads/` | 25 KB | `multer` 上传的临时文件（`qisi-local-server.js:25`） | 同上 | 🟢 停服务后可清 |
| `.../tmp/codex-pre-fix-348927b/` | 3.4 MB | 2026-09-29 某次修复前的**整站快照**（含 `vendor/`、`app.js`、`main.html`） | 无 | 🟡 回滚副本。git 里没有同名快照，删前确认不需要回滚 |
| `.../tmp/full-test.log` | 396 KB | 一次性全量测试日志 | 无 | 🟢 可删（但它是某次失败/通过的唯一记录） |
| `.../tmp/dry-run-ui/` | 97 KB | 干跑截图（`01-stop-before-create.png` 等）+ 驱动脚本 | 无 | 🟡 证据截图 |
| `.../tmp/audit-mineru/`、`audit-perf/`、`audit-deep/`、`audit-docx/` | 约 90 KB | **今天 19:30–19:35 正在被其他同事写入**的审计现场 | 同事正在读 | 🔴 现在别动 |
| `.../tmp/superseded/handoff-prompt-for-other-ai.md` | 24 KB | 旧交接提示词 | 无 | 🟡 |
| `.../tmp/*.cjs` `*.js`（probe、diag、mineru-batch 等） | 约 40 KB | 一次性诊断脚本，会 require 生产模块 | 无（它们读生产代码，不被生产代码读） | 🟢 可删，但今天新写的（10-18）先留 |
| `.../page-1.png` | 352 KB | 2026-06-01 的截图，**git tracked** | `docs/architecture/REPOSITORY_ASSET_INVENTORY_R2.md` 把 `page-1.png/test.pdf/1.docx` 明确列为 **H 类：需人工确认来源** | 🟡 保留，别公开 |
| `.../test.pdf` | 288 KB | 2026-06-01 的样例 PDF，**git tracked** | 同上；`ai/TESTING_GUIDE.md` 只把它当"测试"字样出现，不是路径引用 | 🟡 保留 |
| `.../1.docx` | 184 KB | 2026-05-29 的真实 DOCX，**git tracked**；元数据 `dc:creator = 鸡霖sama` | 同上 | 🟡 保留，**禁止外发/发布** |
| `.../local-run-artifacts/` | **328 MB / 3340 文件** | 历次真实运行的回执：PDF 验收、Qwen 逐卷跑、MinerU 独立跑、gold 对照 | 84 个 `ai/`、`docs/`、`.workbuddy/` 文件按路径引用它 | 🟡 整体保留；🟢 仅"被后续 run 取代、且无报告引用"的重复快照；🔴 今天三个目录 |
| `.../local-test-materials/` | 1.2 MB / 4 文件 | 真实 DOCX+DOCX、PDF+PDF 验收素材 | `docs/testing/LOCAL_TEST_MATERIALS.md` 描述它；`.gitignore` 明确排除 | 🔴 不在 git，删了永久丢失，且含真实试卷 |
| `.../local-ocr/` | 49 KB | 本地 OCR 服务端脚本（`server.js` 在 `layers.json` 里是 scaffold 的 `local-ocr-service`） | `local-ocr/README.md`、`server_contract.md` | 🔴 属于 OCR scaffold，别动 |
| `.../.workbuddy/` | 121 KB / 10 文件 | AI 助手的历史记忆（`memory/2026-*.md`、`MEMORY.md`） | 无代码读，但人和 AI 都在用 | 🔴 不在 git，删了找不回 |
| `.../deliverables/**/*.log`、`**/*.zip` | 47 个文件 | 一次性门禁日志与备份 zip，被 `.gitignore` 的 `*.log`/`*.zip` 忽略 | `ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md` 明确点名"保留的首次失败日志" | 🟡 别删（"被忽略 ≠ 可删"的典型） |

### 3.2 `.gitignore` 实际内容与含义

`.gitignore` 共 8 组规则：`node_modules/`、`.env*`（保留 `.env.example`）、`tmp/ uploads/ converted/ dist/ build/ coverage/`、`*.log *.cache`、OS/编辑器、`*.bak *.tmp *.zip *.7z *.rar *.local.*`、`CODEX_TASK.local.md`、`local-test-materials/`、`local-run-artifacts/`、`local-ocr/{models,runtime,tmp}/`、`playwright-report/ test-results/`。

**逐条后果：**

- `tmp/`、`local-run-artifacts/`（328 MB，`git ls-files` 返回 **0**）、`local-test-materials/`、`CODEX_TASK.local.md`、所有 `.log`/`.zip`：**完全不在版本库**。删了就是永久删除，没有 `git checkout` 可救。
- `CODEX_TASK.local.md` 还是 `AGENTS.md` 第 7 项**必读文件**。它被 ignore 但被强制要求读 —— 这是全项目最反直觉的一条：**它在 .gitignore 里，却绝对不能删。**
- 另有 `.git/info/exclude` 单独排除了 `.bm_a4_app_before.js`（本地私有排除，不进版本库）。

---

## 4. 第 3 类：文档体系

### 4.1 `docs/` 407 个文件（403 md）

| 子目录 | 数量 | 性质 | 建议 |
|---|---:|---|---|
| `docs/refactor/` | 214 | BM-AUTO 自动迁移活动的**逐批次工单 + 阶段回执**。其中 `BM_AUTO_A4_R3_*` 75、`BM_AUTO_CHAIN_*` 33、`BM_AUTO_FULL_*` 29、`BM_AUTO_ROUND_*` 12、`BM_AUTO_DOC_AUDIT_*` 13、`BM_AUTO_GROUPED_*` 5，其余 47 是 BM0x/BMR/ BASE_ 等早期阶段 | 🟡 **归档**到 `docs/archive/bm-auto/`，不要删 |
| `docs/testing/` | 73 | P8–P10 研究系列（20）、`PDF_SUPPORT_*`（20）、`PDF_MASTER_*`（11）、KaTeX/LaTeX 修复系列（7）、C9（3） | 🟡 audit-only；`docs/testing/README.md` 自己写明"历史报告只作追溯" |
| `docs/release/` | 30 | 各阶段最终报告与 CTO 复核。`docs/release/README.md` 写明"旧报告在新最终报告明确取代后降级，但保留用于回滚与审计" | 🟡 旧报告可归档 |
| `docs/architecture/` | 43 | 架构清单、责任矩阵、决策记录 | 🔴 至少 12 篇被 `skills/`、`scripts/`、`tests/` 按路径引用；`layers.json`/`owners.json` 是测试输入 |
| `docs/audit/` + `docs/audits/` | 12 + 1 | 审计报告。**两个目录只差一个 s**，属于历史命名残留 | 🟡 合并到 `docs/audit/` |
| `docs/ocr/` | 10 | OCR 决策记录，6 篇被 `skills/local-ai-ocr-boundary/SKILL.md` 引用 | 🔴 大部分别动 |
| `docs/benchmark/` | 11 | 基准协议，5 篇被引用 | 🔴/🟡 按引用区分 |
| `docs/corrective/` `docs/recovery/` `docs/archive/` | 5 + 2 + 1 | 纠正/恢复/归档 | 🟡 |
| `docs/README.md` | 1 | 文档索引，定义 active/superseded/archived/audit-only 四种状态 | 🔴 |

**哪些已被后续文档取代（有明确证据的）：**

- `docs/testing/PDF_KATEX_DISPLAY_NORMALIZATION_FINAL_FIX.md` 是 `PDF_BARE_LATEX_INLINE_DISPLAY_FIX` → `PDF_KATEX_DELIMITER_NORMALIZATION_FIX` → `PDF_LATEX_SECOND_PASS_CLEANUP_FIX` → `PDF_LATEX_WRAPPER_CLEANUP_SMOKE_FIX` 这一串修复的**最后一环**；前 4 篇的诊断价值仍在，但"现行修法"只看 FINAL_FIX 即可。→ 前 4 篇可归档，🟡。
- `docs/refactor/BM_AUTO_ROUND_1_PLAN.md` … `ROUND_10`、`BM_AUTO_FULL_ROUND_006_PLAN` … `014`、`BM_AUTO_A4_R3_CONT_BATCH_001` … `014`、`BM_AUTO_A4_R3_MED_BATCH_001` … `005`、`BM_AUTO_A4_R3_SHARD_R3-S001` … `S005`：这些是**逐批次执行回执**，结论已被 `*_CAMPAIGN_SUMMARY.md`、`*_FINAL_VERIFICATION_PROOF.md`、`BM_AUTO_MASTER_PLAN.md` 汇总。→ 🟡 归档首选。
- `docs/refactor/BM_AUTO_DOC_AUDIT_HISTORICAL_CLEANUP_BATCH_001` … `007`：已被 `..._CLEANUP_SUMMARY.md` 汇总（失败数 63→0）。→ 🟡 归档。

**哪些是唯一信息源（不能删）：**

- `docs/refactor/BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md`、`..._MEDIUM_REMAINING_REGISTER.md`、`..._MEDIUM_WRAPPER_REMOVAL_GATE.md`：`tests/qisi-app-display-cleaners-doc-audit.test.js:141/148/155` 直接 `readFileSync` 这三个路径。删了测试必红。🔴
- `docs/testing/P10K_B_ROUTE_B_ANSWER_ONLY_AI_PASS_DESIGN.md`：被 `skills/` 引用 2 次，是 Route B 冻结的唯一设计依据。🔴
- `docs/architecture/*.json`：测试输入，见第 5 节。🔴

### 4.2 `ai/` 103 个文件（盘点结束时）

**活规矩（🔴 绝对不能删，`AGENTS.md` 要求每次改代码前必读）：**

- `ai/AGENT_CONSTITUTION.md`（4.5 KB）
- `ai/MODULE_BOUNDARIES.md`（3.1 KB）
- `ai/STABLE_CHAINS.md`（3.4 KB）
- `ai/ACCEPTANCE_CRITERIA.md`（3.3 KB）
- `ai/TESTING_GUIDE.md`（3.4 KB）
- `ai/CODEX_WORKFLOW.md`（2.7 KB）
- `ai/CODEX_TASK.local.md`（26 KB，同时被 `.gitignore` 忽略 —— ignore 但必读）

另外被测试/脚本按路径读取的：`ai/APP_SHELL_SLIMMING_R3_STATE.md`、`ai/ALIGNMENT_ANCHORED_KEY_JOIN_2026-10-17.md`、`ai/pdf-api-first-v2-prompts/result.schema.json` → 🔴。

**历史工单回执（🟡 可归档，不建议直接删）：**

| 组 | 数量 | 说明 |
|---|---:|---|
| `CODEX_TASK_*` | 29 | 每次任务的输入说明。任务已结束，但它是"当时为什么这么改"的唯一记录 |
| `PDF_V1_*` | 15 | PDF V1 路线的设计/成本/验收。已被 V2 + MinerU 取代，但成本数据和失败原因是唯一的 |
| `PDF_QWEN37_*` | 10 | 逐卷跑的回执，与 `local-run-artifacts/` 一一对应 |
| `PDF_EXTERNAL_V2_*` | 5 | V2 设计与审计 |
| `FINDINGS_*` | 3 + 1 json | 2026-10-01 的 48 项问题清单与修复状态，`ai/FINDINGS_ALL_STATUS_2026-10-01.json` 是可机读的唯一清单 |
| `*_STATE.md` | 4 | 各阶段"当前状态"。注意它们是**按分支**的，见第 5 节 |
| `MINERU_*` / `HANDOUT_*` | 5 + 2 | **今天正在写**，🔴 |

### 4.3 `deliverables/` 203 个文件（8.3 MB）

| 类型 | 数量 | 性质 | 建议 |
|---|---:|---|---|
| `*.cjs` + `*.js` | 34 + 11 | 各次验收用的**一次性脚本**（生成样本、跑门禁、写 completion.json） | 🟡 与对应报告同生共死，别单独删 |
| `*.json` | 40 | 验收结论、SHA 清单、部署 manifest | 🟡 有证据价值 |
| `*.log` | 45 | 门禁日志（全部被 .gitignore 忽略，git 从未跟踪） | 🟡 报告点名"保留失败日志" |
| `*.md` | 21 | 人读的报告 | 🟡 |
| `*.jpg` + `*.png` | 16 + 11 | 桌面/打印验收截图 | 🟡 |
| `*.txt` | 17 | 样本、覆盖清单 | 🟡 |
| `*.zip` | 2 | 空库备份 | 🟡 |

**关键数字：** 203 个文件里 **156 个被 git 跟踪、47 个被忽略**。有证据价值的是那 156 个（报告 + JSON + 截图）；47 个被忽略的是日志和 zip。`ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md:154/203/258/323` 逐段说明这些目录是"完整门禁日志 + 首次失败日志 + 18 个全链样本"的唯一副本，并特别提醒"Temp 清理会失去外部回滚副本"。

→ **整体建议：🟡 全部保留。** 它只占 8.3 MB，删了换不来多少空间，却会破坏一条被正式报告引用的证据链。

---

## 5. 第 4 类：重复与矛盾

### 5.1 四份架构清单并存，schema 各不相同

| 文件 | 条目 | schema | 谁在读 | 结论 |
|---|---:|---|---|---|
| `architecture/runtime-modules.json` | 111（browser 81 含 app.js / dormant 21 / node 9） | `qisi.runtime-file-inventory.v1` | `scripts/verify-runtime-modules.js`、`tests/runtime-module-inventory.test.js`、`tests/c2-13-owner-runtime-closure.test.js`、`tests/pdf-projection-single-owner.test.js` | **唯一权威的"文件级"清单**。它的测试会强制"磁盘有几个文件就必须登记几个"，多一个少一个都失败 |
| `architecture/layers.json` | 81 | `qisi.architecture-manifest.v1`（5 层） | `tests/architecture-manifest.test.js`（强校验 layer/owner/api/status/依赖无环） | **分层与所有权的事实来源**。只覆盖 81 个，另有 29 个文件不在里面 |
| `docs/architecture/layers.json` | **0 个模块** | `qisi.program-c-layers.r3`（6 层） | 没有测试读；只有 `ai/CODEX_TASK_PDF_MULTIMODAL_V1.md` 和历史报告提到 | **纯历史残留**。它仍被 `verify-runtime-modules.js` 检查"`runtimeInventory` 必须指向根版 runtime-modules.json"，所以还不能直接删，但内容已无模块 |
| `docs/architecture/owners.json` | 85（r3 `owners` 结构） | `qisi.program-c-owners.r3` | 没有测试读；`architecture-manifest.test.js` 读的是**根版** `architecture/owners.json` | **与根版已分叉** |

**已知的正式结论（不是我的新发现，是仓库里已经写下的）：**

- `deliverables/code-review-architecture-2026-08-30.md:972` 与 `:1007`（写于 8 月 30 日，当时是 34 KB vs 4.7 KB；**当前实测已变成 47 KB vs 5 KB、85 条 vs 81 条**）：
  > `docs/architecture/owners.json` 34KB vs `architecture/owners.json` 4.7KB —— 内容已经不同步了。……这是当前**唯一一处已知的"治理数据自相矛盾"**，会直接误导 AI 助手。
- `deliverables/findings-2026-10-01.md:522`：`docs/architecture/layers.json` 引用模块数 **0**；`docs/architecture/owners.json` 当时 68 条，与根版分叉（**现已增长到 85 条**）。

**建议：** 把 `docs/architecture/layers.json` 和 `docs/architecture/owners.json` 改成"指针文件"（只写一行 `见 architecture/…`），或直接删除并把 `verify-runtime-modules.js` 里对 `docs/architecture/layers.json` 的 `runtimeInventory` 检查去掉。**这是一处代码改动，需要你点头。**

### 5.2 两套"同主题互相矛盾"的文档

| 主题 | 旧说法 | 新说法 | 判定 |
|---|---|---|---|
| PDF 自动化程度 | `README.md`：「PDF 不追求 12/12 全自动 complete」「Route B 已冻结为 research-only」「controlled-write 是 PDF 答案写入的唯一 truth gate」 | 2026-10-18 提交 `85441f5`：MinerU block route「19/19 questions on the real paper in 16 s」；`ai/MINERU_UNIFIED_ALGORITHM_2026-10-18.md`：「本轮不是新的生产入库路线」 | **不真冲突，但读起来像冲突。** 新路线是"预览/证据链"，不是入库路线。建议在 README 加一句澄清，否则下次会有人以为 PDF 已经全自动入库 |
| 当前阶段 | `ai/POST_RC_ENGINEERING_CLOSURE_R2_STATE.md`（7-12）「Phase 8 封版已授权」 | `ai/POST_R2_CORRECTION_R1_STATE.md`（7-13）「final report prepared; Git ff-only seal pending」 | 两者在**不同分支**上，各自成立。不是矛盾，是缺"按分支读"的说明 |
| 历史文档是否可删 | `docs/README.md`：「refactor 与历史测试报告是 audit-only 证据，**不因为名字里有 debug/result/recovery 就删**」 | `docs/architecture/CLEANUP_POLICY_R2.md` 第 5 条：「`docs/testing/` 与 `docs/refactor/` 是审计证据链……证据不得被静默移除」 | **一致，而且明确反对删。** 这直接决定了第 4.1 节只能是"归档"而不是"删除" |
| 发布文档现行性 | `docs/testing/README.md`：历史报告一律 audit-only | `docs/release/README.md`：release 文档"在它命名的 commit/tag 范围内 active" | 两条规则对同一批文档给出不同"现行性"，需要一张总表；不影响删除判断 |

### 5.3 轻微重复

- `docs/audit/`（12 篇）与 `docs/audits/`（1 篇 `APP_JS_BOUNDARY_AUDIT.md`）——只差一个字母的历史目录，🟡 可合并。
- `architecture/owners.json`（81 条扁平 `xxxOwner: file`）与 `docs/architecture/owners.json`（`owners` 数组）——同一件事的两种表达。
- `docs/benchmark/` 里的 `POST_R2_CORRECTION_BENCHMARK_R1` 与 `docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json` 都描述纠正轮的性能口径，交叉引用但不是重复。

---

## 6. 三档清单

### 🟢 放心删（确定无引用、非唯一信息源、可再生成）

| 绝对路径 | 为什么 |
|---|---|
| `C:/Users/Administrator/Desktop/题库系统/tmp/converted/*`（15 MB，26 个目录） | DOCX→PDF 转换缓存，`qisi-local-server.js` 下次导入自动重建。**前提：先停服务** |
| `C:/Users/Administrator/Desktop/题库系统/tmp/uploads/*` | multer 上传临时文件，同上 |
| `C:/Users/Administrator/Desktop/题库系统/tmp/full-test.log`（396 KB） | 一次性测试日志，无引用 |
| `C:/Users/Administrator/Desktop/题库系统/tmp/qisi-server.log`、`tmp/qisi-server-error.log`（空） | 启动日志，会被 `open-app.cmd` 重新生成 |
| `C:/Users/Administrator/Desktop/题库系统/tmp/mineru-*.log` | 今天的临时日志，无引用 |
| `C:/Users/Administrator/Desktop/题库系统/tmp/check-subos.cjs`、`diag-e2e-blocker.cjs`、`export-pdf-run-json.js`、`verify-export-snippet.cjs`、`q18-probe.cjs`、`q18-dump.cjs`、`combine_code.py` | 一次性诊断脚本，只读生产代码、不被生产代码读 |

> 合计约 **15.2 MB**，且全部在 `.gitignore` 的 `tmp/` 下（删了不可恢复，但都是可再生成的缓存/日志）。**这一档是唯一"删了不心疼"的。**

### 🟡 需用户确认（可能是劳动成果或有历史价值）

| 绝对路径 | 为什么 |
|---|---|
| `.../.bm_a4_app_before.js`（1.17 MB） | BM-A4 迁移前的 app.js 片段快照。git 历史里有 app.js 各版本，但它可能对应某个未提交的中间态 |
| `.../tmp/codex-pre-fix-348927b/`（3.4 MB） | 修复前整站快照。git 里没有完全对应的副本 |
| `.../tmp/dry-run-ui/`、`tmp/superseded/`、`tmp/audit-perf/` | 干跑截图、旧交接词、性能基线 JSON —— 都是"当时的证据" |
| `.../page-1.png`、`.../test.pdf`、`.../1.docx` | 被仓库资产清单标为 H 类"来源需人工确认"；`1.docx` 含个人作者信息 |
| `.../docs/refactor/` 中除 3 个被测试读取文件外的 **211 篇** | 迁移活动日志。按项目自己的 CLEANUP_POLICY 应"归档"而非删除 |
| `.../docs/testing/` 73 篇、`docs/release/` 30 篇 | audit-only 证据链；旧的被新的取代，但保留可追溯 |
| `.../ai/CODEX_TASK_*` 29 篇、`PDF_V1_*` 15 篇、`PDF_QWEN37_*` 10 篇、`FINDINGS_*` 4 件 | 历史工单与回执。PDF V1 的成本/失败数据是唯一的 |
| `.../deliverables/` 全部 203 个 | 8.3 MB 换一条被正式报告引用的证据链，不划算 |
| `.../local-run-artifacts/` 中"被后续 run 取代且无报告引用"的重复快照（如 `pdf-qwen37-pilot-*`、`pdf-qwen37-shenzhen-simple-full-*-revalidation`） | 需逐个对照 ai/ 报告确认；**分不清就保留** |
| `.../scripts/bm-a4-*.js` 16 个 | 一次性迁移工具，但被 10 个测试 require；删是"脚本+测试"打包动作 |

### 🔴 绝对别动

| 绝对路径 | 为什么 |
|---|---|
| `.../vendor/`（4 MB）、`.../node_modules/`（72 MB） | 运行时依赖。`vendor/katex` 没了公式全变源码；`vendor/vue` 没了页面白屏 |
| `.../qisi-local-server.js` + 它 require 的 8 个 node 模块 | 应用入口。删任何一个，双击 `启动奇思数学.bat` 直接起不来 |
| `.../main.html`、`.../app.js`、`.../app.css` | 主应用三件套 |
| `.../open-app.cmd`、`start-app.vbs`、`启动奇思数学.bat`、`package.json`、`package-lock.json` | 启动链 |
| `.../AGENTS.md`、`ai/AGENT_CONSTITUTION.md`、`ai/MODULE_BOUNDARIES.md`、`ai/STABLE_CHAINS.md`、`ai/ACCEPTANCE_CRITERIA.md`、`ai/TESTING_GUIDE.md`、`ai/CODEX_WORKFLOW.md`、`ai/CODEX_TASK.local.md` | `AGENTS.md` 强制必读。`CODEX_TASK.local.md` 还被 `.gitignore` 忽略 —— ignore ≠ 可删 |
| `.../ai/APP_SHELL_SLIMMING_R3_STATE.md`、`ai/ALIGNMENT_ANCHORED_KEY_JOIN_2026-10-17.md`、`ai/pdf-api-first-v2-prompts/` | 被测试/脚本按路径读取 |
| `.../skills/` 全部 9 个 SKILL.md | `AGENTS.md` 的领域必读 |
| `.../tests/` 全部 277 个测试 | 删测试等于删掉唯一的安全网 |
| `.../architecture/runtime-modules.json`、`architecture/layers.json`、`architecture/owners.json` | 3 份清单 + 4 个测试强校验 |
| `.../docs/architecture/layers.json`、`docs/architecture/owners.json` | 虽然分叉，但 `verify-runtime-modules.js` 要求前者存在且 `runtimeInventory` 指向根版 |
| `.../docs/refactor/BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md`、`..._MEDIUM_REMAINING_REGISTER.md`、`..._MEDIUM_WRAPPER_REMOVAL_GATE.md` | `tests/qisi-app-display-cleaners-doc-audit.test.js` 直接读 |
| `.../docs/testing/P10K_B_ROUTE_B_ANSWER_ONLY_AI_PASS_DESIGN.md`、`docs/ocr/` 被 skills 引用的 6 篇 | 技能文档按路径引用 |
| `.../.workbuddy/` | 不在 git，AI 历史记忆 |
| `.../local-test-materials/` | 不在 git，真实试卷素材，含隐私 |
| `.../tmp/audit-deep/`、`tmp/audit-docx/`、`tmp/audit-perf/`、`tmp/audit-mineru/` | **今天 19:30–19:35 正在被写入** |
| `.../qisi-block-ownership*.js`、`qisi-paper-*.js`、`qisi-mineru-*.js`、`qisi-handout-formula-gate.js`、`local-run-artifacts/mineru-*`（今天的三个目录） | 未提交的进行中工作 |
| `.../local-run-artifacts/pdf-v1-acceptance-2026-10-03/`、`.../gold/` | 验收基准与 gold 对照，报告按路径引用 |

---

## 7. 风险最高的 5 条（误删之后会发生什么）

1. **删掉 `qisi-local-server.js` 依赖的 8 个 Node 模块（`qisi-temp-job-manager` / `qisi-local-instance` / `qisi-local-ai-request-policy` / `qisi-docx-upload-policy` / `qisi-local-https-transport` / `qisi-local-http-boundary` / `qisi-mineru-client` / `qisi-mathtype-local-service`）**
   → 双击"启动奇思数学"直接报 `Cannot find module`，**整个系统打不开**，连题库都进不去。最容易误伤的是 `qisi-docx-upload-policy.js` 和 `qisi-local-http-boundary.js` —— 名字听起来像"策略文件"，其实是启动必需。

2. **删掉 `vendor/katex/` 或 `vendor/katex/contrib/auto-render.min.js`**
   → 所有题目里的 `$...$` 不再渲染，题干、选项、解析、试卷导出全变成 LaTeX 源码；`main.html` 不会报错，只是"看起来全坏了"，很难第一时间想到是字体/公式库没了。

3. **删掉 `qisi-qwen-vision-source-port.js` 或 `qisi-ocr-qwen-adapter.js`**
   → 图片录题（`app.js:1075` 的 `QwenVisionSourcePort.createProductionOcrRuntime`）和 PDF 视觉识别全部失效；点"识别"按钮会静默失败或一直转圈。

4. **删掉 `docs/refactor/` 里那 3 个被测试 `readFileSync` 的 MEDIUM_* 文件**
   → `npm run verify:safe` 直接红，`node --test tests/qisi-app-display-cleaners-doc-audit.test.js` 抛 ENOENT。这三个文件看起来和另外 211 篇一模一样，**是整批归档时最容易被一起打包走的**。

5. **删掉 `.workbuddy/`、`local-test-materials/` 或 `local-run-artifacts/`**
   → 三者都**不在 git**，删了没有任何办法恢复：AI 的历史决策上下文没了；真实试卷验收素材没了（且属于隐私数据，也不该外传）；328 MB 的验收证据没了，将来有人质疑"当时到底跑没跑通"时无法自证。

（第 6 条留给运行中的操作：**服务开着的时候删 `tmp/converted`**，正在预览的转换 PDF 会 404，前端表现为"点开就白屏"。）

---

## 8. 建议的清理顺序

原则：**先清缓存 → 再归档文档 → 最后才谈代码。每一步之后都跑验证，任何一步红就停。**

### 第 0 步：留基线

```bash
cd "C:/Users/Administrator/Desktop/题库系统"
git status --short
git log --oneline -3
NODE_OPTIONS=--max-old-space-size=4096 npm run verify:safe
```

把最后一条的输出（通过/失败、耗时）记下来。**这是后面每一步的对照基线。**

### 第 1 步：清 `tmp` 里的纯缓存（约 15.2 MB，最安全）

```bash
# 先停服务（任务管理器结束 node.exe，或确认 3000 端口没在跑）
curl -s http://127.0.0.1:3000/api/health || echo "服务已停"
rm -rf tmp/converted/* tmp/uploads/*
rm -f tmp/full-test.log tmp/qisi-server.log tmp/qisi-server-error.log
```

验证：

```bash
npm start          # 另开一个窗口
curl -s http://127.0.0.1:3000/api/health
```

然后**手动导入一份 DOCX**（走一次 DOCX→PDF 转换），确认 `tmp/converted/` 自动重建、预览正常。

### 第 2 步：归档根目录历史阶段文档（不删）

```bash
mkdir -p docs/archive/stages
git mv STAGE1A_RELEASE_NOTES.md STAGE_C2_*.md STAGE_C6_*.md STAGE_C7*.md docs/archive/stages/
git mv CODEX_TASK.md docs/archive/stages/
```

`CODEX_TASK_2_AGENT_CONSTITUTION_AND_SKILLS.md` 先留（它被 1 处引用）。`CODEX_TASK.local.md` **不要动**。

验证：

```bash
grep -rn "STAGE_C7\|STAGE_C2\|STAGE1A" --include=*.js --include=*.md --include=*.json . --exclude-dir=node_modules --exclude-dir=.git | grep -v docs/archive
```

应无输出（除了 archive 自身）。

### 第 3 步：归档 `docs/refactor` 的逐批次回执（实测 64 篇）

**先保住 3 个被测试读取的文件：**

```bash
# 这三个必须留在原地
ls docs/refactor/BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md
ls docs/refactor/BM_AUTO_A4_R3_MEDIUM_REMAINING_REGISTER.md
ls docs/refactor/BM_AUTO_A4_R3_MEDIUM_WRAPPER_REMOVAL_GATE.md
```

再按模式归档（`git mv`，不是 `rm`）：

```bash
mkdir -p docs/archive/refactor-batches
git mv docs/refactor/BM_AUTO_A4_R3_CONT_BATCH_*.md docs/archive/refactor-batches/
git mv docs/refactor/BM_AUTO_A4_R3_MED_BATCH_*.md  docs/archive/refactor-batches/
git mv docs/refactor/BM_AUTO_A4_R3_SHARD_R3-S*.md  docs/archive/refactor-batches/
git mv docs/refactor/BM_AUTO_FULL_ROUND_*.md       docs/archive/refactor-batches/
git mv docs/refactor/BM_AUTO_ROUND_*.md            docs/archive/refactor-batches/
git mv docs/refactor/BM_AUTO_DOC_AUDIT_HISTORICAL_CLEANUP_BATCH_*.md docs/archive/refactor-batches/
```

验证：

```bash
NODE_OPTIONS=--max-old-space-size=4096 node --test --test-concurrency=1 tests/qisi-app-display-cleaners-doc-audit.test.js
NODE_OPTIONS=--max-old-space-size=4096 npm run verify:safe
```

> 注意：`bm-a4-doc-audit.js` 会扫描 `docs/refactor` 下**现存**的每一篇；移走的不会被扫到，所以只要留下那 3 篇，测试应仍通过。**如果它要求目录里至少 N 篇，就在这里停手，改为"只归档不移动"。**

### 第 4 步：处理根目录残留（需你确认后）

```bash
# 先确认 .bm 对应的 app.js 版本在 git 里
git log --all --oneline -- app.js | head -20
# 确认无引用
grep -rn "bm_a4_app_before" --exclude-dir=node_modules --exclude-dir=.git . | grep -v "^./.git"
```

确认后再删：

```bash
rm -f .bm_a4_app_before.js
rm -rf tmp/codex-pre-fix-348927b
```

验证：`NODE_OPTIONS=--max-old-space-size=4096 npm run verify:safe` + 打开应用点一遍主要功能。

### 第 5 步（最后做）：沉睡模块下线 —— **不建议批量做**

如果一定要瘦身，**一次只下线 1 个**，且必须同时改 4 处，否则测试必红：

1. 删 `qisi-xxx.js`
2. 从 `architecture/runtime-modules.json` 删对应条目
3. 从 `architecture/layers.json` 删模块 + 从 `architecture/owners.json` 删 owner
4. 删/改它的测试

推荐顺序（风险从低到高）：`qisi-ui-renderer.js` → `qisi-storage-facade.js` → `qisi-review-view-model.js` → `qisi-batch-orchestrator.js` → `qisi-app-facade.js` → 6 个 `deprecated`。

每次都验证：

```bash
node scripts/verify-runtime-modules.js
NODE_OPTIONS=--max-old-space-size=4096 node --test --test-concurrency=1 tests/architecture-manifest.test.js tests/runtime-module-inventory.test.js
NODE_OPTIONS=--max-old-space-size=4096 npm run verify:safe
```

**我的建议：这一步现在不要做。** 收益是省 1.59 MB 里的几十 KB，成本是动 4 份治理文件 + 多个测试，风险收益完全不对等。

### 第 6 步（可选）：`local-run-artifacts` 瘦身

不要直接删。先整体复制到外部盘，再按"有没有被 ai/ 报告按路径引用"逐目录判断：

```bash
du -sh local-run-artifacts/* | sort -hr
grep -rl "local-run-artifacts/<目录名>" ai docs deliverables
```

**没有任何引用的目录**才可以考虑移走。`gold/`、`pdf-v1-acceptance-2026-10-03/`、今天的 `mineru-*` 三个目录不要动。

---

## 9. 我分不清、建议保留的

- `page-1.png` / `test.pdf` / `1.docx` 到底是"随手放的测试文件"还是"某次验收的原始素材"——资产清单只写了"H 类，需人工确认"，**我按保留处理**。
- `tmp/codex-pre-fix-348927b/` 对应哪个 commit、是否比 git 历史更完整——**分不清，建议保留**。
- `docs/refactor` 里 47 篇"其他"（`PUBLIC_REPO_HANDOFF.md`、`NEXT_STAGE_HANDOFF_AFTER_BMR10.md` 等）：可能含对外发布决策，**分不清，建议保留**。
- `deliverables/` 里 34 个 `.cjs` 验收脚本：一次性，但每份都对应一个 `completion.json` 和 SHA 清单，**分不清哪份还能复跑，建议整目录保留**。
- `local-run-artifacts` 中哪些快照"已被后续 run 取代"：需要逐份对照 `ai/*_RESULT_*.md` 的结论，**我没做这个逐份比对，建议保留**。

---

## 附录 A：全量 `qisi-*.js` 判定表

判定口径：`加载` = 有 `main.html` script 标签；`生产引用` = 被 `app.js`/其他 `qisi-*` 按名字或路径引用（不含测试）；`测试` = 测试文件引用数；`清单` = `runtime-modules.json` 的 runtime；`层状态` = `layers.json` 的 status（`—` 表示未登记）。

| # | 文件 | main.html | 生产引用（首个） | 测试引用数 | 清单 | layers 状态 | 判定 |
|---:|---|---|---|---:|---|---|---|
| 1 | `qisi-app-facade.js` | — | — | 2 | dormant | — | B3 遗留门面 |
| 2 | `qisi-archive-security.js` | ✅ | `qisi-backup.js` 等 5 处 | 3 | browser | production-wired | A 在跑 |
| 3 | `qisi-backup-snapshot-policy.js` | ✅ | `qisi-storage-repository.js` | 0 | browser | — | A 在跑 |
| 4 | `qisi-backup-workspace.js` | ✅ | `app.js` | 2 | browser | — | A 在跑 |
| 5 | `qisi-backup.js` | ✅ | `qisi-backup-snapshot-policy.js` 等 4 处 | 2 | browser | — | A 在跑 |
| 6 | `qisi-batch-context-service.js` | ✅ | `app.js` | 3 | browser | production-wired | A 在跑 |
| 7 | `qisi-batch-engine-v2.js` | ✅ | `app.js` | 4 | browser | production-wired | A 在跑 |
| 8 | `qisi-batch-formal-submit.js` | ✅ | `app.js` | 4 | browser | production-wired | A 在跑 |
| 9 | `qisi-batch-importer.js` | ✅ | `app.js` | 3 | browser | — | A 在跑 |
| 10 | `qisi-batch-orchestrator.js` | — | — | 2 | dormant | — | B3 遗留门面 |
| 11 | `qisi-block-ownership-prompt.js` | — | — | 2 | dormant | — | B5 进行中（MinerU） |
| 12 | `qisi-block-ownership.js` | — | `qisi-block-ownership-prompt.js` | 1 | dormant | — | B5 进行中（MinerU） |
| 13 | `qisi-browser-document-source.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 14 | `qisi-browser-pdf-renderer.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 15 | `qisi-candidate-normalizer.js` | ✅ | `qisi-recognition-structure-policy.js` 等 2 处 | 3 | browser | production-wired | A 在跑 |
| 16 | `qisi-components.js` | ✅ | `app.js` | 2 | browser | — | A 在跑 |
| 17 | `qisi-config.js` | ✅ | `app.js` | 2 | browser | — | A 在跑 |
| 18 | `qisi-db.js` | ✅ | — | 1 | browser | — | A 在跑（全局 db） |
| 19 | `qisi-docx-converter.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 20 | `qisi-docx-formula-source.js` | ✅ | `qisi-batch-importer.js` | 1 | browser | production-wired | A 在跑 |
| 21 | `qisi-docx-import-coordinator.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 22 | `qisi-docx-mtef-reader.js` | ✅ | `qisi-docx-formula-source.js` | 0 | browser | production-wired | A 在跑 |
| 23 | `qisi-docx-ole-reader.js` | ✅ | `qisi-docx-formula-source.js` 等 2 处 | 0 | browser | production-wired | A 在跑 |
| 24 | `qisi-docx-pipeline.js` | ✅ | `qisi-browser-document-source.js` | 2 | browser | — | A 在跑 |
| 25 | `qisi-docx-producer-identity-contract.js` | ✅ | `qisi-formal-admission-policy.js` 等 8 处 | 15 | browser | production-wired | A 在跑 |
| 26 | `qisi-docx-upload-policy.js` | — | — | 1 | node | — | A Node 侧运行 |
| 27 | `qisi-docx-vision-reconciler.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 28 | `qisi-draft-maintenance-service.js` | ✅ | `app.js` | 5 | browser | production-wired | A 在跑 |
| 29 | `qisi-draft-persistence-service.js` | ✅ | `app.js` | 7 | browser | production-wired | A 在跑 |
| 30 | `qisi-export-service.js` | ✅ | `app.js` | 6 | browser | production-wired | A 在跑 |
| 31 | `qisi-file-dispatcher.js` | ✅ | `qisi-docx-pipeline.js` 等 2 处 | 4 | browser | — | A 在跑 |
| 32 | `qisi-formal-admission-policy.js` | ✅ | `app.js` | 24 | browser | production-wired | A 在跑 |
| 33 | `qisi-handout-formula-gate.js` | ✅ | `app.js` | 1 | browser | — | A 在跑 |
| 34 | `qisi-handout-html.js` | — | — | 1 | dormant | — | B6 进行中（讲义） |
| 35 | `qisi-handout-model.js` | — | — | 2 | dormant | — | B6 进行中（讲义） |
| 36 | `qisi-import-diagnostics.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 37 | `qisi-import-equivalence-normalizer.js` | — | — | 2 | dormant | deprecated | B1 deprecated |
| 38 | `qisi-import-orchestrator.js` | — | — | 9 | dormant | deprecated | B1 deprecated |
| 39 | `qisi-import-state-machine.js` | ✅ | `app.js` | 6 | browser | production-wired | A 在跑 |
| 40 | `qisi-import-validation-service.js` | ✅ | `app.js` | 3 | browser | production-wired | A 在跑 |
| 41 | `qisi-injected-import-path.js` | — | — | 2 | dormant | deprecated | B1 deprecated |
| 42 | `qisi-legacy-batch-run-coordinator.js` | — | — | 1 | dormant | deprecated | B1 deprecated |
| 43 | `qisi-library-service.js` | ✅ | `app.js` | 8 | browser | production-wired | A 在跑 |
| 44 | `qisi-local-ai-request-policy.js` | — | — | 0 | node | — | A Node 侧运行 |
| 45 | `qisi-local-http-boundary.js` | — | — | 0 | node | — | A Node 侧运行 |
| 46 | `qisi-local-https-transport.js` | — | — | 0 | node | — | A Node 侧运行 |
| 47 | `qisi-local-instance.js` | — | — | 1 | node | — | A Node 侧运行 |
| 48 | `qisi-local-server.js` | — | — | 0 | node | — | A Node 侧运行 |
| 49 | `qisi-mathtype-local-service.js` | — | — | 1 | node | production-wired | A Node 侧运行 |
| 50 | `qisi-mineru-client.js` | — | `qisi-local-server.js` | 1 | node | — | A Node 侧运行 |
| 51 | `qisi-mineru-evidence.js` | — | `qisi-block-ownership.js` 等 2 处 | 0 | dormant | — | B5 进行中（MinerU） |
| 52 | `qisi-normal-ui-import-controller.js` | ✅ | `app.js` | 9 | browser | production-wired | A 在跑 |
| 53 | `qisi-ocr-adapter-contract.js` | ✅ | `qisi-ocr-local-adapter.js` 等 2 处 | 0 | browser | production-wired | A 在跑 |
| 54 | `qisi-ocr-candidate-selection-policy.js` | — | — | 2 | dormant | scaffold | B2 scaffold |
| 55 | `qisi-ocr-engine-registry.js` | ✅ | — | 2 | browser | scaffold | A 空转（无消费者） |
| 56 | `qisi-ocr-local-adapter.js` | ✅ | — | 4 | browser | scaffold | A 空转（无消费者） |
| 57 | `qisi-ocr-qwen-adapter.js` | ✅ | `qisi-qwen-vision-source-port.js` | 6 | browser | production-wired | A 在跑 |
| 58 | `qisi-ocr-reading-order.js` | — | — | 3 | dormant | scaffold | B2 scaffold |
| 59 | `qisi-ocr-shadow-mode.js` | ✅ | — | 2 | browser | scaffold | A 空转（无消费者） |
| 60 | `qisi-ocr-structure-extractor.js` | — | — | 2 | dormant | scaffold | B2 scaffold |
| 61 | `qisi-page-question-parser.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 62 | `qisi-paper-pairing.js` | — | — | 2 | dormant | — | B5 进行中（MinerU） |
| 63 | `qisi-paper-segmenter.js` | — | `qisi-block-ownership.js` 等 2 处 | 2 | dormant | — | B5 进行中（MinerU） |
| 64 | `qisi-pdf-answer-extraction-quality.js` | — | `qisi-pdf-support-controlled-write.js` | 1 | dormant | — | B4 研究冻结 |
| 65 | `qisi-pdf-answer-only-extraction.js` | — | — | 1 | dormant | — | B4 研究冻结 |
| 66 | `qisi-pdf-external-contract.js` | ✅ | `qisi-pdf-external-producer.js` 等 6 处 | 8 | browser | production-wired | A 在跑 |
| 67 | `qisi-pdf-external-producer.js` | ✅ | `app.js` | 6 | browser | production-wired | A 在跑 |
| 68 | `qisi-pdf-external-provider.js` | ✅ | `qisi-pdf-external-producer.js` 等 2 处 | 4 | browser | production-wired | A 在跑 |
| 69 | `qisi-pdf-multimodal-contract.js` | ✅ | `qisi-browser-pdf-renderer.js` 等 5 处 | 6 | browser | production-wired | A 在跑 |
| 70 | `qisi-pdf-multimodal-producer.js` | — | — | 4 | dormant | deprecated | B1 deprecated |
| 71 | `qisi-pdf-page-evidence.js` | ✅ | `qisi-pdf-external-producer.js` 等 2 处 | 3 | browser | production-wired | A 在跑 |
| 72 | `qisi-pdf-safe-partial-pipeline.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 73 | `qisi-pdf-support-aligner.js` | ✅ | `qisi-import-validation-service.js` | 3 | browser | production-wired | A 在跑 |
| 74 | `qisi-pdf-support-controlled-write.js` | — | — | 5 | dormant | deprecated | B1 deprecated |
| 75 | `qisi-performance-monitor.js` | ✅ | — | 1 | browser | scaffold | A 空转（无消费者） |
| 76 | `qisi-production-docx-source-port.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 77 | `qisi-production-docx-vision-source-port.js` | ✅ | `app.js` | 5 | browser | production-wired | A 在跑 |
| 78 | `qisi-production-import-bridge.js` | ✅ | `app.js` | 13 | browser | production-wired | A 在跑 |
| 79 | `qisi-production-import-output-port.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 80 | `qisi-production-import-route-policy.js` | ✅ | `app.js` | 6 | browser | production-wired | A 在跑 |
| 81 | `qisi-production-import-status-port.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 82 | `qisi-production-review-validator.js` | ✅ | `app.js` | 6 | browser | production-wired | A 在跑 |
| 83 | `qisi-question-content-policy.js` | ✅ | `qisi-pdf-external-producer.js` 等 2 处 | 1 | browser | production-wired | A 在跑 |
| 84 | `qisi-question-duplicate-policy.js` | ✅ | `qisi-db.js` 等 3 处 | 5 | browser | production-wired | A 在跑 |
| 85 | `qisi-question-image-policy.js` | ✅ | `qisi-components.js` 等 2 处 | 1 | browser | production-wired | A 在跑 |
| 86 | `qisi-question-index-storage.js` | ✅ | `qisi-db.js` | 2 | browser | production-wired | A 在跑 |
| 87 | `qisi-qwen-vision-source-port.js` | ✅ | `app.js` | 5 | browser | production-wired | A 在跑 |
| 88 | `qisi-recognition-contracts.js` | ✅ | `qisi-import-validation-service.js` 等 4 处 | 12 | browser | production-wired | A 在跑 |
| 89 | `qisi-recognition-structure-policy.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 90 | `qisi-review-controller.js` | ✅ | `app.js` | 15 | browser | production-wired | A 在跑 |
| 91 | `qisi-review-draft-builder.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 92 | `qisi-review-draft-normalization-policy.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 93 | `qisi-review-draft-state.js` | ✅ | `app.js` | 4 | browser | production-wired | A 在跑 |
| 94 | `qisi-review-view-model.js` | — | — | 2 | dormant | — | B3 遗留门面 |
| 95 | `qisi-review-workflow-service.js` | ✅ | `app.js` | 4 | browser | production-wired | A 在跑 |
| 96 | `qisi-runtime.js` | ✅ | `app.js` | 5 | browser | — | A 在跑 |
| 97 | `qisi-secure-logger.js` | ✅ | `qisi-local-server.js` 等 2 处 | 2 | browser | production-wired | A 在跑 |
| 98 | `qisi-solution-quality-policy.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 99 | `qisi-source-role-classifier.js` | ✅ | `app.js` | 5 | browser | production-wired | A 在跑 |
| 100 | `qisi-storage-facade.js` | — | — | 1 | dormant | — | B3 遗留门面 |
| 101 | `qisi-storage-repository.js` | ✅ | `qisi-utils.js` 等 2 处 | 17 | browser | production-wired | A 在跑 |
| 102 | `qisi-strict-question-policy.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 103 | `qisi-support-latex-policy.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 104 | `qisi-support-parser.js` | ✅ | `qisi-pdf-support-controlled-write.js` 等 2 处 | 2 | browser | production-wired | A 在跑 |
| 105 | `qisi-support-repair.js` | ✅ | `qisi-recognition-structure-policy.js` 等 3 处 | 5 | browser | production-wired | A 在跑 |
| 106 | `qisi-support-text-parser.js` | ✅ | `app.js` | 2 | browser | production-wired | A 在跑 |
| 107 | `qisi-temp-job-manager.js` | — | `qisi-local-server.js` | 2 | node | — | A Node 侧运行 |
| 108 | `qisi-ui-events.js` | ✅ | `app.js` | 3 | browser | — | A 在跑 |
| 109 | `qisi-ui-renderer.js` | — | — | 1 | dormant | — | B3 遗留门面 |
| 110 | `qisi-utils.js` | ✅ | `qisi-browser-document-source.js` 等 16 处 | 29 | browser | production-wired | A 在跑 |
| 111 | `qisi-visual-question-source.js` | ✅ | `app.js` | 1 | browser | production-wired | A 在跑 |
| 112 | `qisi-visual-support-source.js` | ✅ | `app.js` | 3 | browser | production-wired | A 在跑 |

**判定小计：** B3 遗留门面 5；A 在跑 75；B5 进行中（MinerU） 5；A 在跑（全局 db） 1；A Node 侧运行 9；B6 进行中（讲义） 2；B1 deprecated 6；B2 scaffold 3；A 空转（无消费者） 4；B4 研究冻结 2。共 112 个文件（盘点结束时快照）。

## 附录 B：本报告的证据来源

- 文件清单与体积：`ls` / `du -sh` / `find -type f | wc -l`
- 加载关系：`main.html` 正则提取 `src="./qisi-*.js`
- 引用关系：对根目录 112 个 `qisi-*.js` + `app.js` + `main.html` + `tests/**` + `scripts/**` + `tools/**` 做 `Qisi.<CamelName>` / `Qisi?.<CamelName>` / `Qisi['<Name>']` / `./qisi-xxx.js` 四路文本匹配；`main.html` 里的 `<script src>` 单独排除，避免"被加载"自证"被使用"
- 清单状态：`architecture/runtime-modules.json`、`architecture/layers.json`、`architecture/owners.json`
- git 跟踪状态：`git ls-files`、`git ls-files --others --ignored --exclude-standard`、`git status --porcelain`
- 既有结论复用：`deliverables/code-review-architecture-2026-08-30.md`、`deliverables/findings-2026-10-01.md`、`docs/architecture/CLEANUP_POLICY_R2.md`、`docs/README.md`、`docs/testing/README.md`、`docs/release/README.md`
- 只读校验：`node scripts/verify-runtime-modules.js` → `{"valid":true,"errors":[]}`
