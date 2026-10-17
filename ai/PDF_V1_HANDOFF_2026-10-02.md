# PDF 多模态 V1 实施交接 — 2026-10-02

> 接手结论：V1 主链已接入桌面软件，尚未完成最终功能验收。最新离线门禁 1787 项：1786 通过、1 失败。还有 3 个文件的最新修正在 E 盘暂存目录，未部署到桌面。真实深圳/河北首轮各生成 19 道审核草稿，但存在大量重叠冲突、部分长解析缺失和模型转写错误，不能称为“19 题全部正确”。后续真实请求遇到 DashScope 欠费拒绝，已经停止外发。请继续完成当前 V1，不重新展开长期架构，不覆盖历史工作。

## 1. 新页面可以直接使用的接手指令

请完整阅读本交接文档，然后继续完成桌面版奇思数学 Pro 的 PDF 多模态 V1。修复目标是 `C:\Users\Administrator\Desktop\题库系统`，不是当前 E 盘备份仓库。保留全部历史未提交改动和用户修改的测试，不 reset/stash/commit/push。先核对暂存目录与桌面文件差异，审阅并部署三处尚未部署的修正，再处理剩余测试与真实响应回放验收。所有新 PDF 结果必须直接通过 V1 validator、canonical、review，禁止重新经过旧 PDF 的语义 parser/normalizer/评分 merger。DOCX 确定性链不得改变。付费累计账本已 107 次，上限 150；第 105 次返回 Arrearage，目前不要继续外发。先利用已经保存的真实响应，在隔离浏览器内完成原文件渲染、审核修改、确认、事务入库和回读。不得把回放称为新的真实模型验收，不得仅凭题数或 JSON 合法宣布成功。最后如实报告代码门禁和真实功能验收各自的结果。

## 2. 目录、分支与现场

| 用途 | 绝对路径或状态 |
| --- | --- |
| 实际修复目标 | `C:\Users\Administrator\Desktop\题库系统` |
| 当前工具工作区 | `E:\备份\题库系统` |
| V1 暂存代码、脚本、日志、真实响应 | `E:\备份\题库系统\local-run-artifacts\pdf-v1-implementation` |
| 之前深圳/河北源页、旧链证据 | `E:\备份\题库系统\local-run-artifacts\shenzhen-hebei-visual` |
| 付费总账本 | `E:\备份\题库系统\local-run-artifacts\paid-import-ledger-2026-10-02.json` |
| 桌面分支 | `stage/program-c-corrective-r1` |
| 最近提交 | `71dfe18`，本轮没有提交 |
| 本轮文件范围 | 暂存目录 `scope.json` |
| 开始前 19 个既有文件 hash | 暂存目录 `baseline.json` |
| 测试迁移开始前 hash | `test-transition-before.json` |
| 交接时现场/证据 hash | `handoff-state-2026-10-02.json` |
| 受保护函数 AST 独立核验 | `handoff-protected-ast-2026-10-02.json` |

桌面工作区有超过百个修改/未跟踪项，许多属于前面多轮修复。不能把当前 `git diff` 全部归因于 V1，更不能把它们恢复成 HEAD。用户已经明确授权保留 dirty 现场并继续当前工作；不要再次因旧规则的 dirty 停止而重复要求授权。

工具写入桌面通常需要 `require_escalated`，由自动审批处理。写 E 盘暂存目录通常在可写范围内。不要把整个项目含 tests 的快照复制到桌面项目内部：默认 `node --test` 会递归发现旧 tests；之前已经出现过快照污染测试的问题。保留原始证据，不能为了门禁绿色修改旧快照。

### 必须保护的用户文件

`C:\Users\Administrator\Desktop\题库系统\tests\base-migration-smoke.test.js` 是用户改成独立进程的测试，不能动。交接时 SHA256：

```text
3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea
```

交接现场已再次核对一致。不要写密钥到文档、日志、命令输出；不要读取/改写 `.env`。不要直接修改教师生产 IndexedDB。测试需要独立 origin/浏览器上下文。

## 3. 必读任务和规则

桌面仓库先读 `AGENTS.md` 和下列 `ai` 文件：

- `AGENT_CONSTITUTION.md`
- `MODULE_BOUNDARIES.md`
- `STABLE_CHAINS.md`
- `ACCEPTANCE_CRITERIA.md`
- `TESTING_GUIDE.md`
- `CODEX_WORKFLOW.md`
- `CODEX_TASK.local.md`：历史任务授权按时间追加，末尾当前授权覆盖前面已过时的文档阶段限制。
- `CODEX_TASK_PDF_MULTIMODAL_V1.md`：本轮最重要的范围、减法原则、付费边界与验收条件。
- `PDF_MULTIMODAL_IMPORT_ARCHITECTURE_DESIGN_2026-10-02.md`：长期设计背景，不能把其中全部机制带进 V1。

按修改领域再读仓库的 batch-import、pdf-support-safe-align、review-page-draft、app-js-boundary、testing-verification、local-ai-ocr-boundary、docx-stable-chain 等 SKILL.md。它们不是新的付费授权来源。遵循用户明确批准的 V1 独立路由，同时保留旧链独立的安全测试。

## 4. 用户最终批准的第一版边界

```text
PDF
→ 本地 PDF.js 渲染
→ 可配置固定多页窗口
→ 单一 qwen3-vl-plus 直接输出结构化 JSON
→ 本地轻量、确定性校验与 exact key 关联
→ 原 PDF 高分辨率裁图
→ 审核草稿
→ 教师确认当前版本
→ 现有事务入库及回读
```

关键原则：模型负责理解，程序负责验证与确定性执行。每新增一段 PDF 业务逻辑，都必须回答“这是验证模型，还是替模型重新理解试卷？”后者原则上不实现。

- exact key 包含导入/试卷身份和原题号，不按数组顺序匹配，不因漏第 8 题把第 9 题挂到第 8 题。
- 重叠窗口内容一致才去重；不同则保留 conflict，不按长度、完整度、公式数量或相似度选择赢家。
- partial 不自动拼接半句话、选项或解析，不补写内容。
- 模型不自报 confidence；使用 complete / partial / unreadable，conflict 由本地比较产生。
- 文字只需 source_pages；真正题图/解析图才需要 page、bbox、belongs_to。
- 图片由原 PDF 提供真实像素，模型不生成/重绘图片。
- 普通试卷默认全卷唯一题号；编号作用域冲突进入人工处理，不默默增建 scope 系统。
- 修改后重新确认；重新识别后旧确认失效；图片须实际保存并能回读。
- 正常进入审核草稿，异常明确标记；模型合法 JSON 不等于识别内容正确。
- 老 PDF 模块可暂时保留用于旧路由/回归，不要求本轮大规模删除共享基础设施。
- DOCX 继续 XML/OMML/MathType OLE/MTEF → 本机转换；不上传、不调用模型、不改成 PDF 视觉链。

暂缓：section registry、scope mapping、window ownership、模型自动升级、Flash/Plus 路由、OCR 第二提案、全文 bbox、长内容 fragment 协议、语义相似度、自动评分、模型共识、复杂 provenance UI。

## 5. 已落地的两个新业务 owner

### qisi-pdf-multimodal-contract.js

浏览器导出 `Qisi.PdfMultimodalContract`，同时支持 Node。协议身份是 `pdf-multimodal-v1`。

职责：严格 JSON/字段校验；题号身份；保守比较去重；冲突保留；canonical 字段映射；字段来源与图片来源；审核问题判断；人工候选选择、删除图、手工裁图的状态更新。

主要行为：

- `parseResponse` 只 JSON.parse，不修补 JSON、不转 Markdown。检查角色允许的数组、题号字符串、状态、选项标签、来源页合法性。
- 图片 bbox 使用整页左上原点 0–1000 坐标；越界/归属非法只标该图问题，不丢弃全部正文。
- 同一窗口题号重复或回退标为 partial 并保存 warning，不擅自重新编号。
- `questionKey` 为 JSON 编码的 `[examId, question_no]`。
- `compareText` 仅比较时处理 CR/LF、首尾空白及等号两侧排版空白。保存的原始转写不被改写；不做数学等价或 LaTeX AST 比较。
- `groupProposals` 分 question / answer / solution 保存变体；不同正文保留多变体。同正文的 partial 观察不会被另一个 complete 静默抹掉。
- canonical 草稿保留 `pdfV1.states`、`candidates`、原来源页、原响应引用、窗口错误、fieldProvenance。第一个变体只是审核预览，conflict 字段为 rejected，不能成为自动入库赢家。
- `reviewProblem` 结合 unresolved provenance、题干/题型/选项、客观题答案、图片确认、数学可渲染性判断；没有解析的资料不强制伪造解析。
- `chooseCandidate` 是教师明确选择，不自动评分；选择当前显示的第一项也会使旧确认失效。
- `removeImage` 只移除对应图片 token、更新真正受影响字段的人工状态，不把全部字段都标成“人工已审”。
- `applyManualCrop` 只按教师明确指定的 stem / option:X / answer / solution 挂图。
- `mathProblems` 检查 KaTeX 错误和双反斜杠宏等明显显示问题，不修数学含义，不能证明公式忠实原文。

### qisi-pdf-multimodal-producer.js

浏览器导出 `Qisi.PdfMultimodalProducer`，职责为本地渲染、窗口调度、单模型调用、原像素裁图、证据记录与 canonical 组装。

当前默认配置：

```json
{
  "window_size": 5,
  "overlap": 2,
  "model": "qwen3-vl-plus",
  "renderScale": 2,
  "cropScale": 3,
  "jpegQuality": 0.94,
  "maxTokens": 16384,
  "timeoutMs": 180000,
  "retryCount": 1
}
```

窗口 1–5、4–8、7–11……，最后一个窗口覆盖到末页即停止，不额外制造尾部重复窗口。参数可配置，不能在业务代码写死 5/2。retryCount 当前限制最多 1，模型限制单一指定模型。

端口：renderPages、renderRegion、recognizeWindow、getRoles；可注入 renderMath、contract、identityContract。题号列表仅作为后续答案/解析的明确编号参考，不用于语义匹配。

缓存 key 为模型、prompt、maxTokens、原页号与页面图内容的 SHA256。只复用同源、相同 key、正常 stop 的已有响应。缓存证据通过正常草稿/文件事务持久化；不是每收到一个响应就单独写断点，所以中途取消尚不能宣称完整断点恢复。

Prompt 已加入：题号/标签不要重复进正文；答案解析中的重述题干不要再输出 questions；JSON 反斜杠正确转义；不摘要长解析；KaTeX 不支持的 tabular 不要伪装为可渲染公式。最终 prompt 的完整双卷效果尚未验收。

## 6. 模型实际输出协议

三个数组始终存在；无该类别用空数组，不编占位内容。

```json
{
  "questions": [{
    "question_no": "1",
    "type": "single",
    "stem": "原题干 $x^2$",
    "options": [
      {"label": "A", "text": "原选项"},
      {"label": "B", "text": "原选项"}
    ],
    "figures": [{"page": 1, "bbox": [100, 200, 400, 500], "belongs_to": "stem"}],
    "source_pages": [1],
    "status": "complete",
    "warnings": []
  }],
  "answers": [{
    "question_no": "1", "answer": "A", "figures": [],
    "source_pages": [9], "status": "complete", "warnings": []
  }],
  "solutions": [{
    "question_no": "1", "solution": "原解析全步骤", "figures": [],
    "source_pages": [9, 10], "status": "partial", "warnings": ["窗口未见后文"]
  }],
  "warnings": []
}
```

此例只是结构说明；实际同一请求的 source_pages 必须全部属于该请求窗口，不能把 1–5 窗口虚构引用到第 9 页。type 可为 single / multi / fill / long / proof / unknown。图片 belongs_to 为 stem、option:A 等、answer 或 solution，并与所属数组一致。身份由本地上下文赋予，模型不能自行决定另一导入任务的身份。

## 7. 共享接线已经怎样绕开旧理解层

| 文件 | V1 改动目的 |
| --- | --- |
| qisi-qwen-vision-source-port.js | 多图结构化请求，保留 rawResponse/model/finishReason/usage/requestId，使用现有同源 transport |
| qisi-browser-pdf-renderer.js | 要求全部请求页完成；原 PDF region 高分辨率 PNG 裁图；V1 不显示旧 OCR 模式提示 |
| qisi-local-server.js | AI proxy 默认超时 90 秒调整为 180 秒，长窗口输出可完成 |
| qisi-docx-producer-identity-contract.js | 注册独立 PDF V1 route 与明确 PDF 支持来源，不放松旧 DOCX/旧 PDF 身份 |
| qisi-formal-admission-policy.js | V1 answer/solution 只接合法 PDF source manifest/exact-key provenance；图片检查真实来源，保留人工确认边界 |
| qisi-production-import-bridge.js | V1 marker 分支绕开旧 PDF projection，走新 contract，正常草稿事务保存 |
| qisi-production-import-output-port.js | V1 不经过旧评分/择优 merger，维护阶段也不重评分 V1 |
| qisi-review-draft-normalization-policy.js | V1 保存提前返回，保留字段，不重新 clean/拆选项/猜题型/按解析质量替换 |
| qisi-review-controller.js | V1 人工字段修改使确认失效，标对应字段人工状态 |
| qisi-import-diagnostics.js | 注册 pdf-v1-window-start / pdf-v1-canonical-produced / pdf-v1-contract-validated 三个阶段，保留日志脱敏与限额 |
| app.js | 新 producer 工厂接线、证据持久化、审核源码不经旧解析、人工候选/裁图/删除图少量胶水 |
| main.html | 模块加载、V1 状态/候选选择、来源页/实际图、手工裁图目标；不显示未经校准的模型 confidence |

审核中的 unchanged AI 源码提交走 V1 保真旁路。显式人工修改源码仍需检查是否会进入旧 editor 解析而意外清理人工公式：这是后续需要实际 UI 验证的风险，不能以只检查 producer 代替。

## 8. 架构元数据与受保护函数

两个新 owner 已登记 runtime-modules、owners、layers。contract 层级应为 1（它依赖已有 identity contract），producer 为 2。

注意两套清单 ID 不相同：

- `architecture/layers.json` compatibility identity ID：`docx-producer-identity-contract`。
- `docs/architecture/owners.json` detailed owner ID：`docx-producer-identity`。

当前桌面清单已修正早先 layer 0/ID 错误。**暂存脚本 `metadata.cjs` 仍含旧错误**：entries 中 contract layer=0、compatibility dependency 使用错误 ID；还可能向 docs layer 0 再次添加 owner。不要直接重跑它！先修脚本，或者只取 AST 检查/计数更新部分，保持真实依赖清单。

交接时独立 AST 检查：

| 版本 | AST 节点 | 函数数 | 9 个受保护 handler hash |
| --- | ---: | ---: | --- |
| 当前桌面 app.js | 27522 | 571 | 全部匹配 |
| 暂存最新 app.js | 27534 | 571 | 全部匹配 |

详见 `handoff-protected-ast-2026-10-02.json`，含每个函数名称、预期/实际 hash 和行号。部署最新 app.js 后需要更新责任矩阵的实际总节点数和行号，但不能“刷新”受保护 hash 来掩盖行为变化。

## 9. 最关键：三个最新文件尚未部署

交接重新比对 scope 内暂存文件和桌面文件，只有以下三项存在当前内容差异。完整 SHA256 在 `handoff-state-2026-10-02.json`。

| 文件 | 暂存版本新增修正 | 状态 |
| --- | --- | --- |
| qisi-pdf-multimodal-producer.js | question/full 文件优先，支持文件随后；HTTP 400/401/402/403 等致命错误停止后续外发但保留此前已成功草稿；保留错误 details | 仅 E 盘暂存，未部署、未做最终验收 |
| qisi-browser-pdf-renderer.js | 裁图 RGB 检查是否实际有墨迹，空白图只拒绝该图 | 仅 E 盘暂存，未部署、未做最终验收 |
| app.js | batch patch 保留 importWarnings 和 unmatchedAnswers | 仅 E 盘暂存，未部署、未做最终验收 |

为什么重要：最终 prompt 复测时深圳第一窗口成功，第 105 次欠费导致旧已部署 producer 整个 throw，批次 0 草稿。这是当前真实观察到的错误，不是“只剩外部账户问题”。暂存 fatal-preserve 修正就是为此写的，仍须回放真实 102 成功 + 105 拒绝验证后才可称修好。

文件处理顺序修正来自一个真实本地不确定性：文件 ID 排序可能让答案文件先处理，模型缺少已知题号上下文，且旧测试顺序响应被错用于另一个角色。最新全量该测试偶尔通过，不代表排序问题消失。

不要整目录复制、不要重跑 activate.py/wire.py/review-wire.py/tests-wire.py。这些按固定锚点的迁移脚本主要用于首次实施，重复执行可能失败/重复写入；先审阅精确 diff，仅同步明确需要的三个文件和核准矩阵。

## 10. 测试迁移已完成和未完成的范围

本轮只新增少量 V1 契约测试 `tests/pdf-multimodal-v1.test.js`，目前五个业务用例覆盖 exact key 不平移、保守冲突/partial、严格协议及图错误隔离、人工选择使确认失效、窗口配置与局部失败重试。

既有默认 UI PDF 用例原来使用 camelCase 单页 JSON + OCR Markdown，并要求旧 parser/controlled-write 链入场。已迁移下列消费者到 V1 wire，同时保留 DOCX 用例及旧链独立 known-bad 测试：

- tests/production-pdf-sources-port.test.js
- tests/pdf-import-coordinator.test.js
- tests/pdf-candidate-projection-characterization.test.js
- tests/e2e/true-import-pdf-safe-partial.test.js
- tests/e2e/true-producer-chain-smoke.test.js（仅 PDF 场景换新链，DOCX 两类保留）
- tests/e2e/true-import-admission.test.js
- tests/e2e/production-normal-ui-import-cutover.test.js（17 场景）
- tests/harness/browser-engine-injection.js（按请求协议封装真实 fixture，不转换/修复模型内容）
- tests/e2e/browser-harness.js（counterfactual fault 也使新 canonical contract 失败，继续证明门禁不可绕过）

尚未迁移：`tests/e2e/pdf-projection-browser-shadow.test.js`。它仍返回旧 questionNumber/options object 和 Markdown，断言旧 route `pdf-vision-controlled-write` 以及旧 parser/projection stages。V1 不应重回这些阶段。接手时先补登记该精确测试的迁移范围和修改前 hash，再把其业务证明迁移为新 wire、来源合法、绕开旧语义链、草稿实际持久化/回读；保留“不靠 shadow candidate”“没有真实外发”等有效断言。不能删掉测试或改 batch.status 期望为 failed 来凑绿。

## 11. 三轮本地验证结果，不能混用

| 日志 | 结果 | 说明 |
| --- | --- | --- |
| verify-safe.log | 1787 项，1758 通过、29 失败 | 初次接线；新脚本地址/服务白名单以及旧测试协议不兼容，不是最终结果 |
| focused-ui-2.log | 9/9 通过 | 包含 17 个生产 UI 场景、真实 producer 的两类 DOCX 和 V1 PDF mock，不能当真实模型准确率 |
| verify-safe-final.log | 1787 项，1784 通过、3 失败 | app-shell baseline、旧 PDF shadow 测试、17 场景中的支持文件顺序不稳定 |
| handoff-verify-safe.log | **1787 项，1786 通过、1 失败，取消 0** | 为本次交接重新跑；仍失败的是旧 PDF shadow 测试；命令退出 1 |

最新 `handoff-verify-safe.log` 完整墙钟测试输出约 86.7 秒。`verify:safe` 因 npm test 失败没有完成后续 batch-safety，不能写“所有门禁已过”。三处暂存修正尚未部署，所以该日志也不是暂存最新代码的完整验证。

旧 app-shell 失败原因：本地 3000 服务在启动时根据 main.html 建静态脚本白名单，新脚本使用裸文件名且老服务未更新，产生 404，Vue 页面 body 保持 hidden。main.html 已改成 `./qisi-...js`，服务曾重启。交接前探测 `http://127.0.0.1:3000/qisi-pdf-multimodal-contract.js` 返回 200，本次 baseline 通过。不能为了绕过它而放宽 benchmark 测试。

后续部署后先跑相应少量测试，再跑完整 `npm.cmd run verify:safe`；另补 DOCX stable/PDF known-bad/batch safety、runtime/app-shell/incremental scope 检查。不要在没有新改动或失败时重复全套，也不新增几百个 parser/regex 镜像测试。

## 12. 两个真实源文件与原文注意点

来源清单：`E:\备份\题库系统\local-run-artifacts\shenzhen-hebei-visual\source-manifest.json`。

### 深圳

- 路径：`C:\Users\Administrator\Desktop\题目与答案\广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf`
- 21 页，19 题。题目 1–7 页，第 8 页空白，答案解析 9–21 页。
- SHA256：`874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21`
- 旧错误反例：第 15 题几何题的点名 A/B/C 被本地重新拆成选项。V1 首轮第一候选为解答题，未出现旧层的自动重拆，但仍需源页核对全部正文和图。
- 第一轮 V1 第 10 题显示单选，源卷是多选，应检查最终 prompt 是否仍错；不能用局部规则强制改成多选掩盖模型错误。

### 河北

- 路径：`C:\Users\Administrator\Desktop\题目与答案\河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷.pdf`
- 19 页，19 题。题目 1–4 页，答案解析 5–19 页。
- SHA256：`011f12024f5c8bdd013e6524ba63b1ed762b34db501295d2edd9b6505d06c4a9`
- 必核对第 14 题指数：原文 `2^{n-\frac12}` 与 `2^{\frac{n-1}{2}}` 不能视为一致。
- 必核对第 13 题集合 `{1}` 与 `{}`，不能以可渲染/类似代替忠实识别。
- 第 10/11 题型也需对照源卷，不凭模型返回 type 宣布正确。

交接捕获脚本重新计算两个源文件 hash，原文件未改变。源图以 PDF.js 渲染为重要对照：之前其他渲染器有图中文字/点名显示差异，不能拿缺字渲染作为唯一金标。

## 13. 已进行的 V1 真实调用与观察

### 首轮，调用 85–101

| 文件 | 成功窗口/请求情况 | 草稿 | 非空答案 | 非空解析 | 墙钟 |
| --- | --- | ---: | ---: | ---: | ---: |
| 深圳 | 7 个窗口全部收到响应（85–91） | 19 | 19 | 18 | 548488 ms，约 9.1 分钟 |
| 河北 | 3 个窗口成功，另有网络失败重试，10 次尝试（92–101） | 19 | 12 | 11 | 276818 ms，约 4.6 分钟 |

河北成功窗口 1–5、4–8、16–19；7–11、10–14、13–17 的窗口未识别成功，502 响应含 ECONNRESET。不能因为题目部分全在就宣称整份答案解析完成。

深圳第 4–19 题 question 变体大量 conflict，解析多项 conflict/partial；河北答案解析也多项缺失/冲突。原因包含模型在答案段重复输出题干、窗口边界不完整、措辞/转义差异以及真正内容差异。当前严格比较选择人工复核，不能用自动选“较长”版本降低冲突率。

真实首轮资产：深圳选中预览图 10 张，河北 7 张，具体每题数量在交接 state。已裁图并进入隔离草稿快照，但尚未完整视觉验证归属、边界、所有候选图片和正式图片 Blob 回读。

### 最终 prompt 的复测，调用 102–107

- 102：深圳第一个 1–5 窗口成功，最终 prompt 的局部数据已保存。
- 103/104：下一窗口网络 502。
- 105：HTTP 400，error.type/code 为 **Arrearage**，消息要求账户状态正常，链接指向 overdue-payment。已部署 producer 整体失败，深圳批次 0 草稿，这是暂存修正尚未部署的直接原因。
- 106：河北第一个 1–5 窗口成功。
- 107：已发起，随后停止测试进程；账本没有终态、没有 response-107.json，结局和计费不确定。必须继续计入累计次数，不擅自删除/改成未发送。

不能宣称最终 prompt 已完整跑完两个 PDF，也不能用首轮结果冒充最终版结果。首轮所有正式题库行均为 0，仅审核草稿，不是已经验收正式入库。

## 14. 付费权限、计数与费用

用户曾允许指定完整版题目/答案 PDF 的最多 50 次请求，先前该轮到 36 次。后来明确授权上述深圳/河北两份 PDF 发往 DashScope，并将累计上限提高到 **150，包含之前的 36 次和所有重试**。V1 开始时累计 84，当前账本 **107**，算术余量 43，但欠费拒绝仍在，不能因此继续盲试。

既有获准目的地：

- `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`

V1 固定单模型 qwen3-vl-plus。同源 `/api/ai/chat` 为本地入口。每次尝试必须先写账本再 dispatch。授权不覆盖其他陌生真实样本、其他服务商、新模型，不覆盖上传 DOCX。默认自动测试不调用真实 API。

本次已查 [阿里云官方 qwen3-vl-plus 价格](https://help.aliyun.com/zh/model-studio/qwen3-vl-plus)：北京输入每请求 ≤32k 档，输入 ¥1/百万 Token，输出 ¥10/百万 Token。已保存的 V1 请求均在此档，缓存命中 0。

计算式：`费用估算 = (prompt_tokens + 10 × completion_tokens) / 1,000,000 元`。

| 已保存成功响应 | 输入 Token | 输出 Token | 按公开单价折算 |
| --- | ---: | ---: | ---: |
| 深圳首轮 85–91，完整 7 窗口 | 70260 | 25201 | ¥0.322270 |
| 河北首轮成功的 92/93/101，仅 3 窗口 | 29788 | 12339 | ¥0.153178，**不是整份费用** |
| 深圳最终 prompt 第一个窗口 102 | 10773 | 3924 | ¥0.050013 |
| 河北最终 prompt 第一个窗口 106 | 10773 | 5665 | ¥0.067423 |
| 上述成功响应合计 | — | — | ¥0.592884，包含复测，不是一次识别两份的价钱 |

给用户的正常单轮预算估计：深圳约 ¥0.32；河北完整 6 窗口暂估 ¥0.30–0.40；两份约 ¥0.62–0.72。河北完整成本未实测，失败重试/107 无 usage，不能武断认定都不收费，最终账单以平台为准。主要费用来自长解析输出 Token，渲染/裁图是本地计算不产生 API 调用费用。

## 15. 证据文件如何使用

暂存目录内以下文件是本轮实际证据，不可改写：

- `request-85.json` 到 `request-107.json`：请求元数据、prompt、页面图 hash/文件名；原 image 已拆成 JPEG，避免把大 base64 打到日志。
- `request-N-image-M.jpg`：真正发给模型的页面像素。
- `response-85.json` 到 `response-106.json`（有成功、有错误）：原 upstream/代理响应；没有 response-107。
- `real-v1.log`、`real-final.log`：真实运行概要。
- `v1-深圳-full.json`、`v1-河北-full.json`：首轮完整 producer/草稿/隔离 DB 快照，分别约 110MB / 130MB，含大量 base64。
- `v1-real-1790953331271.json`：首轮汇总，约 10MB；并非全部图像都小，避免直接 Get-Content 全量输出。
- `v1-final-深圳-full.json`、`v1-final-1790954386847.json`：最终 prompt 的深圳失败现场。
- `v1-real-深圳-ui.png`、`v1-real-河北-ui.png`、`v1-final-深圳-ui.png`：实际浏览器截图。
- `handoff-state-2026-10-02.json`：交接时各 scope 桌面/暂存 hash、源 hash、付费 response usage、首轮状态、证据 hash、git status；不含密钥。
- `handoff-protected-ast-2026-10-02.json`：桌面与暂存两份 app.js 的独立受保护函数检查。
- `handoff-verify-safe.log`：交接最新 1786/1787 门禁结果。

读取 100MB 快照只提取关心的题号、字段、候选、状态，逐份处理；不要把 base64 图或所有解析打印到聊天，避免新页面也卡。旧外部快照不进默认 test discovery。

`real-v1.cjs` 是会真实收费的脚本，**不要直接运行**。它按实际文件创建 UI 任务，拦截同源 AI 调用并继续 route.fetch，因此不是 mock。要回放必须另写仅在 AI HTTP 边界 fulfill 保存响应、绝不 continue/fetch 外部的脚本。不要把最终 candidates 直接灌入 DB，这会跳过真正 pipeline。

## 16. 尚待功能分析的风险，不能假装都已修

1. 最终 prompt 下完整两卷忠实度没有验证；首轮冲突率高，模型存在题型/公式转写错误，local validator 不能验证所有语义。
2. 致命账户错误丢弃已成功草稿的修正只在暂存；必须用真实 102 + 105 回放证明保存部分草稿且不继续外发。
3. 选项标签缺失：contract 标为 partial，但 canonical 旧字段 options 数组与 UI 位置标签可能使 C 显示成 B。需要验证原标签在异常审核预览中不被重编号；禁止本地猜补选项。
4. 人工改源码后是否被旧 editor 清理/重拆，尚未完整 UI 验证；原样保存旁路已有，但不能据此推出修改链也安全。
5. 选择其他支持来源候选后 supportSources 是否完整登记，尤其多个 PDF 支持文件；普通双文件路径已测，复杂来源需针对真实问题验证，不顺手造 registry。
6. 裁图 bbox 几何合法不等于包括所有点名/箭头、不混入正文、不挂错题。空白墨迹检查也不证明归属正确。跨题同一区域图冲突尚未系统验收。
7. 来源页视图已有，直接“查看原 PDF”链接是否完整仍需补查/最小接线；第一版需要让教师能看原 PDF，而不是只看模型 JPEG。
8. failed windows 的 task-level warnings 和 unmatchedAnswers 最新持久化只在暂存 app.js；未出现的题不能给自身标黄，所以必须让整任务显示可能漏题的页范围。
9. 每图重新打开 PDF、重复原页/base64 证据可能有内存/速度成本；目前约百 MB 快照是事实。先测瓶颈，不以性能名义重写架构或加入语义规则。
10. 缓存正常重复运行、局部失败只重试失败窗口、确认失效、真实图片 Blob 回读尚缺最后端到端证明。

## 17. 接手后的推荐顺序

### A. 核对现场，先不收费

执行 git status/branch/log，核对交接 state 和用户测试 hash。读当前任务范围。核对三个暂存文件精确 diff。若期间有人修改桌面文件，先合并实际新改动，不用旧暂存覆盖。

审阅并同步 role-priority/fatal-preserve、空白裁图、batch warnings 三处必要修正。独立验证受保护 AST 后更新真实计数/行号，不改保护 hash。先修 metadata.cjs 的 layer/两套 ID 错误，或避免重跑它。

### B. 小范围闭环并修掉剩余门禁

登记并迁移 pdf-projection-browser-shadow 真实新协议。增加至多必要的 fatal-preserve/cache/真实图回读业务用例，不生成一堆实现镜像测试。focused 中继续保留 DOCX 两种链路及双 PDF source provenance。

确认 3000 新模块都能 200，页面能 boot；若需更新服务只重启已核对属于该项目的 server，隐藏后台启动，不能误杀所有 node。

### C. 用真实响应回放完成最终题目验收

新建隔离 server/origin（例如未占用的 32231），创建任务时使用原始两 PDF，仍走本地真实 PDF.js 渲染和原像素裁图。只有模型 HTTP 边界回放原 response 文件，其他业务代码是真实生产链。

请求映射要按试卷身份与原页号对应，不随便按数组索引喂另一个窗口。深圳首轮可回放 85–91；河北首轮回放 92/93/101，缺失窗口回放真实 502，不能编造缺失模型响应。最终 prompt 局部回放 102/106，并用 105 验证致命停止保留。旧 prompt raw 在新 prompt 下回放只验证基础设施，不冒充最终 prompt 质量。

先详细对照深圳 15/10、河北 13/14 等已知反例，再逐题 19+19：题号/题型/题干/选项/公式/图/答案/解析/跨页。记录机器候选问题、教师明确人工选择/修改量。对待 missing/partial/conflict 不能自动选最长版本。

审核时实际打开源页/原 PDF、查看裁图、修改/确认；入库使用现有事务、隔离题库，再重新打开核对文本和图片 Blob。检查确认后修改使旧确认失效、重新识别使旧确认失效。不能把正确模型字段通过旧 normalizer 又改坏。

河北缺失解析窗口的回放只能证明异常展示/不误挂，不能凭人工补录或其他模型过去输出宣称本轮自动解析成功。欠费恢复后的新增完整真实调用仍需来源/预算/账本条件满足，避免重复消费已缓存窗口。

### D. 其他样本、最终门禁和报告

陌生正常资料、只有答案没有解析、明确人工处理异常：授权不足的真实资料只做本地/合成 fixture，不上传。将自动正确率、人工复核率、错误自动入库率、耗时/成本分开统计，不能把人工修好后的准确率说成模型识别率。

最后运行 safe、DOCX stable、PDF known-bad、batch-safety、app-shell/runtime/module，以及本轮增量 scope。全量 dirty 是历史现场，scope 要参考开始前清单，不能简单把所有旧 diff 说成越界。

生成正式 `ai/PDF_MULTIMODAL_V1_ACCEPTANCE_2026-10-02.md`（交接时尚不存在），列出实际完成/未完成、源 hash、版本、每题问题/人工修改、付费账本、真实费用/耗时、测试命令结果、图片回读、保护 hash。若账户仍阻断真实最终验证，要明确报告这项外部限制，不能宣称全量功能验收完成。

## 18. 运行命令参考

下列均在桌面目标执行；不要误在 E 盘备份跑出另一套结果。

```powershell
Set-Location -LiteralPath 'C:\Users\Administrator\Desktop\题库系统'
git status --short
git branch --show-current
git log --oneline -10
Get-FileHash -LiteralPath '.\tests\base-migration-smoke.test.js' -Algorithm SHA256

node --test --test-concurrency=1 tests/pdf-multimodal-v1.test.js tests/e2e/pdf-projection-browser-shadow.test.js tests/e2e/true-import-pdf-safe-partial.test.js tests/e2e/true-producer-chain-smoke.test.js tests/e2e/production-normal-ui-import-cutover.test.js
npm.cmd run verify:safe
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
node scripts/verify-app-shell-architecture.js
node scripts/verify-runtime-modules.js
```

脚本真实可用参数/当前 npm gate 以 package.json 为准。当前 verify:safe 实际顺序是 no-real-ai → check → npm test → batch-safety；一些早期文档描述落后于 package，不能凭记忆报告后续 gate 已执行。

日志写到 E 盘暂存，长输出少打到聊天。独立 AST 复核可以用 `capture-handoff-ast.cjs`；现场捕获可以用 `capture-handoff.py`，但旧交接 JSON 是证据，后续重捕获请换新文件名，不覆盖交接版本。

## 19. 关于“全局最优”的准确表述

用户要求新算法有证明、效率准确性提升，而非补丁屎山。只能证明明确前提下的确定性性质，不能对多模态模型识别宣称全局最优。

- exact key：按 `[importIdentity, originalQuestionNo]` 等值关联，缺少一个 key 不改变另一个 key，所以不会发生本地按位置整体平移。
- 保守比较：相同规则下去重，不同内容保存冲突；不引入“较长就是正确”的自动赢家。要检查实现是否有越过 rejected provenance 的消费者。
- 固定滑窗：size>overlap≥0，步长 size-overlap>0，最后窗口覆盖末页即停，可证明每个请求页被覆盖；这不证明每道跨页题完整落在某窗口，更不证明模型正确。过长单元可以 partial/人工。
- 图片：本地从原 PDF 裁像素，可证明程序没有模型重绘；不能单凭 bbox 数值证明模型归属正确。
- fail-closed：在当前字段 provenance/确认/资产校验前提下阻止未解决异常入库，需要实际事务反例验收；不是数学语义真实性证明。

费用/模型/窗口的整体最优需真实金标和对照实验支持。本轮单模型固定窗口是用户批准的第一版取舍，不应为追求一个无法证明的口号引入路由/共识/语义评分。性能和维护复杂度改善也要报告实际测量，不只报代码行数。

## 20. 交接结束状态

本次交接只写文档和捕获可核查现场，另运行一次离线 verify:safe；没有部署三处暂存代码，没有继续付费，没有改生产 DB，没有提交/推送。业务目标仍是完成 V1，交接不是功能已完成声明。

当前最优先的具体工作：**审阅/部署三个暂存修正 → 迁移剩余旧协议测试 → 离线真实响应回放逐题审核及入库回读 → 完整门禁及诚实验收报告**。

新页面若需要再次解释权限，应直接引用当前任务文件与本会话人类授权。不要重复问已经回答过的桌面目标、dirty 保留、深圳/河北目的地和 150 次预算问题；若外部账户恢复与付费验证尚缺条件，先完成所有独立可做的验证。
