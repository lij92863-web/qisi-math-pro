# 通用 PDF V2 软件链路交付 — 2026-10-13

用户要求先完成整体软件链路，稍后提供 API。本轮按 [实施任务](CODEX_TASK_PDF_EXTERNAL_V2_SOFTWARE_CHAIN_2026-10-13.md) 完成软件实现和隔离 mock 验证。没有恢复真实 API 调用、认证或网络诊断；查询公开模型说明不属于识别调用。保留原工作树、原卷、gold、全部历史请求和证据，不 commit/push，不操作用户 3000 实例或生产 IndexedDB。

## 实际接通的链路

```text
正常界面选文件、用途和页码
  → 原 PDF 渲染、真实原卷总页数
  → 连续 owner 页组＋两侧上下文；非连续选页分组并提示
  → 发送前保存任务与预算预留
  → 通用外部执行器
      A：直接视觉完整转写
      B：外部解析 → 全文整理；可保存异步解析回执并查询原任务
  → 先保存原响应、终态、usage、解析证据，再检查协议
  → 原来源、原页、角色、整体题号/答案/解析序列、图片引用门禁
  → 原 PDF 裁图或已声明外部资源字节
  → V2 独立身份的完整草稿、原页、未归属内容与问题
  → 编辑／选候选／手工裁图；人工确认失效
  → 原有审核、正式准入、事务写入、读回和刷新
```

本地不 OCR，不猜题号、不解题、不修正原文、不按题意配答案、不拼两个不完整候选。主卷、完整卷、分开的答案/解析角色沿用日常用途选择。全局序列校验在按题号分组之前进行；单侧缺口只能接可靠前缀，D-1 共缺口必须双流相同、严格递增且在明确预期题号内。

## 模块与正常入口

| 文件 | 实际职责 |
| --- | --- |
| `qisi-pdf-external-contract.js` | 统一 wire schema、来源/资源/整体序列检查、V2 canonical、审核投影、候选/裁图、重识别保留人工内容；离线评价复用同一验证器 |
| `qisi-pdf-external-provider.js` | 固定 system 和 direct/organize 提示、可信任务配置、解析页映射验证、解析回执查询、全文整理能力端口 |
| `qisi-pdf-external-producer.js` | 页组/上下文、任务证据、预算预留、缓存与状态恢复、原图资源、完整草稿；无自动重试或付费 fallback |
| Bridge / output / identity / admission | 显式承认 V2，专用直通，保留 DOCX 和正式准入规则；拒绝其他未知 PDF 协议 |
| review-controller / normalization | 人工操作使确认失效，V2 内容不进入旧重分题/清洗逻辑 |
| `app.js` / `main.html` | 窄装配、审核 dispatch、证据保存、来源问题/原页/候选/裁图展示；九个受保护 handler AST 未改变 |

原 V1 contract 继续读取和审核历史草稿，不伪造为 V2。正常入口不再创建或加载 V1 producer。已有历史协议草稿的批次不能由 V2 原地改写，需保留原批次并新建识别任务。已退役的 6 个专用实现与 17 个纯旧链测试仍全部不存在；服务 DOCX 的共享模块和冻结历史工具保持。

## 缓存、恢复和人工内容

- 成功响应按实际页图、原页配置、schema、固定提示、模型/配置版本建立缓存；使用时再次验证。修改模型、提示或配置不会复用过期成功响应。
- `registered` / `submission_unknown` 不自动重发；更换预算或模型也不能绕过。收到晚响应先保存，但取消后不生成草稿。
- 异步解析返回 `state: pending` 和 `jobId` 后保存原回执。再次执行查询原 job，未取得终态不重复上传；查询失败后状态未知仍阻止自动操作。
- 解析已经验证、整理接口明确拒绝：后续明确执行可复用解析全文，仅重新整理。整理提交是否被接受未知：保留解析证据，阻止整理重发。
- 未知解析费仍占用完整预留；不能只算整理模型 usage 就宣称两阶段费用已知。usage 核价是估计，不等于账单。
- 新结果不覆盖老师修改过的字段、手工图或已提交草稿。老师草稿保留，新机器候选可选，审核确认失效；新结果漏掉人工处理题时，保留该题并显示问题。已提交草稿保留原状态，正式题目不受重识别影响。
- 请求级原响应保存在来源证据中，人工显示字段与原机器候选分开。终态拒绝/错误也保存原响应。无号尾段及不可读页留在任务问题/原页审核中，不静默丢弃。

## API 提供后的有限接入点

默认 `Qisi.Config.pdfExternal` 为 `enabled: false`、空 model，不发识别请求。主链已装配现有直接传输端口；通用替代能力通过 `bindings` 提供。没有把任何模型判定为质量合格，也没有设置未经验收的生产模型。

| 能力端口 | 输入/输出约定 |
| --- | --- |
| `recognize(task)` | 固定 system/prompt、原页图、可信 metadata；返回原 text、model、finishReason、usage、rawResponse，可附 ok/refusal；完成终态必须为 stop |
| `parse(task)` | 返回完整 `parsedPages`（source_id、原 page、text）、声明 assets、原响应；或 pending＋jobId 回执 |
| `resumeParse(task)` | 使用 `task.parseReceipt` 查询已接受解析任务，返回上述同一终态/回执格式；不重新创建任务 |
| `organize(task)` | 固定全文整理提示和 schema，保留原解析全文和原页图；输出与 direct 相同 wire |
| `resolveAsset(assetId, result)` | 仅返回已声明、同原来源/页的图像字节 data URL 与原页 0..1000 bbox；拿不到可靠资源则审核缺图，不猜图归属 |

厂商适配器必须明确记录 HTTP 拒绝与提交未知，不能偷偷重试。来源/角色/原页 metadata 由软件确定，提供者不能替换。实际端点、服务认证、模型参数能力、资源下载和价格配置待用户给 API 后完成；凭据不进入提示、浏览器证据或日志。

当前选型顺序：Qwen3.7-Flash 固定版本 `qwen3.7-flash-2026-07-15` 作为低输出价候选，GLM-4.6V-Flash 同源对照，必要时才验证 GLM-OCR 或 MinerU＋整理。北京 ≤32K 首档官方输入/输出价为 Qwen3.7-Flash 0.2/0.8、旧 Qwen3-VL-Plus 1/10 元/百万 Token。旧深圳用量等量折算 0.034213 对 0.322270 元，约降 89%；不是 Flash 的同卷实测账单。速度、公式准确率、全文完整率和人工量尚未取得同卷对照结论。[阿里价格](https://help.aliyun.com/zh/model-studio/model-pricing)、[视觉能力](https://help.aliyun.com/zh/model-studio/vision-model)、[GLM 候选文档](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash)。

先前唯一新候选实测请求仍为 `submission_unknown`，费用仍未知，0.0326144 元预留不清零。用户暂停 API 之后未续发识别请求。

## 验证与证据

证据目录：`local-run-artifacts/pdf-api-first-v2-software-chain-2026-10-13/`。

| 检查 | 结果/日志 |
| --- | --- |
| 新 V2 contract / producer / 两种模式正常 UI、原图资源、手工裁图、缓存重跑保留人工内容、提交刷新 | 29/29；`complete-chain-final.log` |
| 首轮完整回归 | 暴露 5 项旧入口/架构登记差异；保留 `full-first.log`，仅更新有意切换的协议和加载断言，安全坏例不放宽 |
| 首次 `verify:safe` | 1701/1701 主测试＋DOCX 8/8＋PDF known-bad 62/62＋batch mock 8/8；`verify-safe-final.log` |
| 覆盖最终资源接入和来源 metadata 门禁的最终 `verify:safe` | exit 0；1703/1703 主测试＋DOCX 8/8＋PDF known-bad 62/62＋batch mock 8/8，无失败；`verify-safe-final-after-boundaries.log` |
| runtime | `valid: true`，无错误 |
| app-shell | `APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED`；本阶段 27579→27838 AST nodes、572→585 functions，九个受保护 handler 前后 hash 相同；`app-ast-final-review.json` |
| 本轮增量与原文件/旧证据 | 精确核对实施前 1201 文件、1462 旧证据；最终明细见 `scope-and-preservation-final.json` |

没有修改冻结 PDF 实现，冻结修复登记无需新 hash；23 项旧退役文件保持不存在。变更范围以本轮 before.json 为基线，不把之前 dirty 差异算成本轮工作。实现细分为 3 个新模块＋3 个测试＋本报告；原文件变动为任务、app/main、6 个架构清单、10 个配置/边界模块、评价复用入口和实际 V1 入口断言/mock harness。逐项完整清单在 scope 证据中。

`git status --short`：本轮开始前已有大量修改和退役文件，全部保留。`git diff --stat` 是累计工作树差异，不能作为本轮范围；使用实施前 hash 差异核验。未 commit/push，HEAD 保持 `71dfe18770e5161a19d38c07842d0ab865f20c92`。没有新依赖、数据库 schema 修改、真实 OCR 或生产写入。

软件验收证明链路和安全边界可执行，不能证明外部模型忠实转写。下一项工作仅在用户提供 API 后完成具体服务绑定，并按原有限实验方案验证同源难例、整卷、费用、耗时及人工量；不因软件测试绿色自动开启付费识别或取消老师审核。
