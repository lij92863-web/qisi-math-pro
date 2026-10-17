# 下一阶段任务：PDF 多模态导入 V1

日期：2026-10-02。状态：用户于本轮明确授权一次性完成 V1；实施和隔离真实验收已启动。

目标仓库：`C:\Users\Administrator\Desktop\题库系统`。本文件依据用户最新审阅意见，限定第一版实施范围；此前完整架构文档用于研究参考，不能作为顺手实现长期机制的依据。

## 1. 最高判断标准

> 每新增一段 PDF 业务逻辑，都必须回答：
> “这是在验证模型，还是在替模型重新理解试卷？”
> 如果答案是后者，默认不实现。

第一版只构建最短的、AI 主理解、本地只验证的 PDF 通路。凡不能直接提升“忠实识别 → 正确挂接 → 可审核入库”的机制，一律暂缓。

该标准适用于 producer、validator、投影、审核保存和最终 output port，不能只约束新模块而允许下游继续改写。

## 2. 首版唯一主链

```text
PDF
→ 本地 PDF.js 渲染
→ 固定滑动窗口
→ 单一多模态模型直接输出结构化 JSON
→ 少量确定性校验、保守去重与冲突标记
→ exam/import identity + question_no 精确关联
→ 原 PDF 高分辨率渲染裁图、保存并回读
→ canonical question / review draft
→ 教师确认或修改
→ 现有事务入库并回读
```

AI 负责完整语义单元，包括题干、选项、题型、题图归属、答案、解析和跨页理解。程序不得接着重新拆题、解题、猜题型、补选项或推导答案。

DOCX 仍使用已建立的 XML/OMML/MathType 本地链。教师仍只选择题目、答案、题目+答案；不新增识别算法选择器。

## 3. 必须实现 / 明确暂缓

| 首版必须实现 | 首版暂缓 |
| --- | --- |
| 可配置固定窗口与多图输入 | 核心页唯一责任协议 / window ownership |
| 一个固定模型、直接结构化题目和支持内容 | 自动升级、Flash→Plus 路由、模型共识 |
| 简单 JSON 协议、本地类型/字段校验 | 全文 bbox、anchor/region 协议 |
| 试卷身份隔离、明确题号 exact key | section registry、scope mapping |
| 保守相等去重、不同即 conflict | 候选评分、择长、语义相似度、数学等价化 |
| 图片来源页/bbox/字段归属、真实裁图 | 常驻 grounding、OCR 第二提案 |
| complete/partial/unreadable、程序产生 conflict | 长解析 fragment protocol、程序语义拼接 |
| 来源页查看、裁图调整、修改/确认 | proposal diff、版本树、复杂 provenance UI |
| 窗口级有限 API 重试与原响应留存 | 按异常自动切模型/OCR/扩窗口 |
| 编辑/重识别使旧确认失效，实际事务回读 | 与首版无关的通用平台化改造 |

编号重置、无法确认的长解析、复杂共享图或不可辨资料先进入人工复核。不因真实样本出现异常就自动解除暂缓项；先定位并记录，能人工解决则先人工，确需扩大首版范围时另行形成明确变更依据。

## 4. 固定窗口和单模型

使用配置 `window_size=5`、`overlap=2`，步长为二者之差。生成 `1–5、4–8、7–11……`，末窗口达到最后一页即停止，不额外生成完全包含于末窗口的冗余包。校验 `0 <= overlap < window_size`；页数参数不能散落为业务代码魔数。

输入为独立页面图片并附原始页号，不合成长图后猜页分界。所有可见内容由模型按原文理解，源文缺失或看不到后文时返回 partial；不强迫每个窗口末题完整。

首版固定既有可调用模型 `qwen3-vl-plus`，记录请求时的模型版本/快照信息和协议版本。不得自动遍历其他模型；不可用就报告 API 问题。后续如固定到具体快照，必须保持单模型并核对接口/授权边界，不能静默替换。默认不调用工具、不解题，使用 JSON Object 加本地严格校验。

完整原响应、来源页、请求标识、finish/usage/耗时保留在本地证据中。不是要求建设复杂 proposal revision 系统。请求只带这份来源和必要的短题号清单，不上传 DOCX。

## 5. 最小输出协议

每次响应使用 `questions/answers/solutions` 三个数组，未提供的类别返回空数组。文件身份由本地附加，不信任模型填写 sourceId 或 import identity。

```json
{
  "questions": [{
    "question_no": "10",
    "type": "single",
    "stem": "原卷题干，数学公式使用忠实 LaTeX",
    "options": [
      {"label": "A", "text": "原卷 A 选项"},
      {"label": "B", "text": "原卷 B 选项"}
    ],
    "figures": [],
    "source_pages": [3, 4],
    "status": "partial",
    "warnings": ["未看见后续选项，不补全"]
  }],
  "answers": [],
  "solutions": []
}
```

answer 单元只有 `question_no/answer/figures/source_pages/status/warnings`；solution 单元对应 `question_no/solution/figures/source_pages/status/warnings`。figures 允许为空，支持答案/解析中的真实原图。

每张图只要求 `page/bbox/belongs_to`：bbox 为明确约定的左上原点 `[x0,y0,x1,y1]`、0–1000 规范化坐标；belongs_to 为所属字段 `stem`、`option:A`、`answer`、`solution` 等，题号由所在单元继承。字段引用必须实际存在，不能据数值大小猜 bbox 单位。

模型 status 仅为 `complete/partial/unreadable`；conflict 由程序比较产生。题型可为 single/multi/fill/long/proof/unknown，unknown 进入复核，程序不重判。全卷正常编号按原文保存为字符串；复杂编号身份不能唯一确认则人工，不建设默认作用域系统。

文字不要求逐段坐标；保留 source_pages 即可。没有答案/解析是合法缺失状态，不能为了协议完整造空文本、推导答案或抄错来源。模型无法判断某段归哪题时，窗口警报和原页证据必须可见，不能捏造题号；不能把 JSON 空数组自动当成原卷没有题。

协议实现可以收紧类型、必填项、数组和本地页码限制，但不得把减掉的 section/scope/anchor/regions/end/confidence 等字段换名字重新加回来。

## 6. 相等、冲突与精确关联

关联 key 为 `(exam/import identity, question_no)`。同一次双文件导入中的题目与答案共享明确的试卷身份，各自保留来源文件和原始页码；不能用文件名猜测不同导入属于同卷，也不能拿裸题号跨任务匹配。

去重比较题型、题干、带标签选项、答案或解析等实际业务内容。一致则合并来源页/证据，不重复写草稿；不同则 conflict，保留可供人工选择或修改的内容。不得按长度、完整度、公式数量、模型置信度或文本相似度选赢家，也不得从几个版本分别挑字段拼成一个“最好”的版本。

source_pages 的差异不构成正文冲突。图形归属或裁框不一致单独标图形待复核，不把轻微坐标差异自动升级为全部文字冲突，也不自动选某个框宣称正确。

normalization 只服务比较，原响应不改。首版至少支持 JSON 正常解码、首尾空白与 CRLF/LF 统一；额外排版空格只允许可说明不会改变数学字符、LaTeX 控制符边界和正文的极小白名单。不能为了降低 conflict 率引入新的公式解析器，也不能对错误或截断 JSON 修补反斜杠、补括号后宣布有效。

必须保持不同：`2^{n-\frac12}` 与 `2^{\frac{n-1}{2}}`；不能全量去掉空格而把 `\sin x` 与 `\sinx` 混同。明确的 `AB=2` / `AB = 2` 排版空格可以按批准的轻量规则一致；规则无法证明安全则保留差异交给人工。不做数学等价化、公式化简、LaTeX AST 等价或语义比较。

漏第 8 题后，第 9 题仍然只查 key=9。未知题号、编号重置、原文身份歧义或异常回退必须显示且阻断不确定字段；不得排序/重新编号掩盖。跨窗口合法重叠的同号一致内容是去重对象，不直接当旧 parser 的坏序列输入。

跨页两份 partial 不能由程序推断拼成完整内容；partial 与另一窗口不同的版本也不能按“更完整”自动择优，人工对照来源。缺答案与缺解析分别标记，不伪造另一条流通过旧双流门禁。

## 7. 简单异常策略

| 情况 | 首版处理 |
| --- | --- |
| complete 且基本校验通过 | 自动进入审核草稿，仍须教师确认 |
| partial | 标黄，原页对照，人工补齐/修改 |
| conflict | 标红，保留来源和候选供人工选/修改 |
| unreadable | 标红，人工录入 |
| API 失败、空响应、截断或无合法 JSON | 只对该窗口有限重试；仍失败保留窗口/页错误 |
| bbox 越界、归属不明或裁图不完整 | 只阻断这张图，人工看原页/调整裁框 |
| 编号重置/作用域不明 | 阻断自动挂接，人工确定身份 |

不做异常模型路由、OCR 再提案、自动扩窗口或 grounding。网络可恢复错误按有限预算重试；鉴权/参数/额度错误直接报告，不能当视觉问题反复付费。默认每窗口最多一次自动重试，所有外发尝试含未知结果都计入现有获准总预算，取消/耗尽就停止外发。

少量确定性校验集中在：完整 JSON 与协议类型、试卷/key 身份、页码/图片坐标、选项标签/字段引用、缺失/重复/冲突、真实资产与确认状态。KaTeX 只检查可渲染性，不证明公式正确。模型未申报漏题可能逃过所有规则，因此来源页和教师确认不可省。

## 8. 绕开旧理解层，复用基础设施

新路径必须是：

```text
AI structured result → V1 validator → canonical question → review draft
```

不得重新经过旧 PDF 的 parser、OCR Markdown 支持解析器、选项重拆、题型猜测、评分 merger、字符串修 JSON 或内容补全器。尤其检查 final output port、review normalization 和 confirm/save 阶段，防止新 producer 的正确字段在下游被再次改坏。

允许复用 PDF.js 渲染、同源 HTTP、图片像素裁剪、任务状态、资产 repository、草稿事务、人工审核和正式 admission。canonical 转换仅作字段映射与证据绑定，不得以“兼容旧 candidate”为名重新解释内容。旧 pipeline 暂保留独立路由用于回放，不与新结果混合；无须第一版同时大规模删除旧共享模块。

新版需要独立 route/producer 身份；双 PDF 支持来源在已有 admission 边界合法注册。旧 DOCX、旧 PDF known-bad 的门禁不能为了新协议放松。旧 Markdown 双流规则继续约束旧路径；V1 采用明确题号的独立 answer/solution 来源验证，不能为了缺解析资料制造空解答或伪装来源。

## 9. 代码范围与边界

实施前先核对当前调用入口与字段写入消费者。建议新业务归属仅两个：`qisi-pdf-multimodal-producer.js`（窗口/调用协调）与 `qisi-pdf-multimodal-contract.js`（协议、确定性校验/比较/关联、canonical 投影）；是否拆分以实际职责为依据，不能每个流程框建模块。

实施候选改动范围限于：上述新 PDF owner、`qisi-qwen-vision-source-port.js` 的多图/响应元数据接口、现有 PDF sources/route/bridge/output 注入边界、review normalization 的 V1 绕行边界、现有确认/图片/admission/持久化消费者的必要接线，以及准确的模块元数据和对应少量契约/验收测试。

`app.js` 只允许必要的小接线，解析/关联业务留在 PDF owner；`main.html/app.css` 只允许必要的状态、来源页、原 PDF/裁图查看和确认展示。不得重写 app.js，不得顺手改 DOCX producer、数据库 schema、dependencies、用户数据、旧快照、用户编写的 `tests/base-migration-smoke.test.js`，不得提交/推送未经授权的旧工作区改动。

以上是下一阶段候选范围，本轮不修改上述业务文件。实施开始前按定位结果写出确切文件清单，不能仅凭“对应消费者”随意增加改动；默认只改首版实际需要的注入/字段边界。实施发现需要增加 owner、调整高风险契约或 frozen 文件时，先记录现有责任为何无法容纳、具体边界及验收依据；禁止自动刷新 frozen hash 或修改测试期望隐藏退化。

## 10. 验收对象是最终题目

保留深圳 21 页、河北 19 页作为回归反例集，两份各 19 题。源文件路径与 hash 以现有 source-manifest.json 为准，原始请求/响应与源页证据不可改写。二者已用于找问题，不冒充未知泛化样本。

逐题对照原卷，检查最终审核对象和实际入库回读：19 题是否全在、题号/题型/选项是否对、数学公式是否忠实、题图/答案/解析是否挂对、跨页是否完整。不能只用题数或合法 JSON 判成功。缺失/源文不可辨必须如实显示；明确缺失不强迫凑满。

至少再包含陌生正常试卷、答案无解析资料和一个预计人工处理的异常样本。UI 验收走创建任务→审核原页/实际图→修改/确认→现有事务入库→重新打开。使用隔离验收题库，不直接修改教师生产 IndexedDB。

自动测试只保留少量有业务意义的契约/回放：漏题不平移、同号一致去重/不同 conflict、partial 不自动拼接、公式关键差异不等同、真实图资产回读、确认失效、窗口局部失败和无真实 API 的默认门禁。不要写几百条镜像 parser/regex/merger 实现的测试。

必须分别报告代码门禁与真实功能验收。记录实际 usage/费用/墙钟/人工修改量，不用原长期设计的核心页唯一责任成本表当本 V1 的滑窗实测，因为重叠输出成本不同。未做真实调用/源文对照时，不能写“识别率更高”“已全局最优”或“已修复深圳/河北”。

## 11. 启动与结束条件

实施前执行 git status/branch/log，记录已有 dirty 工作区为经用户要求保留的历史现场；本次新增改动按新的开始前清单检查，不 reset/stash/覆盖旧工作。

默认开发为离线 fixture/mock；真实验收只承接会话已有明确的人类授权文件、目的地、模型与剩余预算，本文件不新增或扩大付费权限。DOCX 始终不上云。授权不覆盖的输入/模型不得发送；本轮任务文件落地阶段一律不调用真实 AI。

结束要求：`npm run verify:safe`、DOCX stable/PDF known-bad/batch-safety、app-shell/runtime/module 及本轮增量 scope 检查；实际 UI 验收单列。测试失败不能改断言凑绿。仅授权范围的根因可以继续处理，超范围缺陷记录，不扩成另一次全仓重构。

停止扩张条件：试图引入暂缓机制；新结果被旧语义处理器改写；需要猜题号/补正文/补选项；图无真实 bytes；未经当前版本教师确认入库；预算耗尽；修改范围或行为无法说明；验收已完成。识别异常进入人工不等于整个任务丢弃全部可用草稿。

下一阶段成果必须包括：可运行的最短新 PDF 链、最终题目逐题验收报告、准确的本轮文件改动范围、真实费用/耗时与剩余问题。不得把暂缓机制混进首版提交。

## 本轮实施授权覆盖

用户最新指令“行，一次性完成 v1 给我”覆盖上述文档阶段不实施限制。保留既有 dirty 现场，不提交或覆盖历史改动。精确文件范围如下：

- `qisi-qwen-vision-source-port.js`
- `qisi-browser-pdf-renderer.js`
- `qisi-production-import-bridge.js`
- `qisi-production-import-output-port.js`
- `qisi-docx-producer-identity-contract.js`
- `qisi-formal-admission-policy.js`
- `qisi-review-draft-normalization-policy.js`
- `qisi-review-controller.js`
- `qisi-local-server.js`
- `app.js`
- `main.html`
- `architecture/runtime-modules.json`
- `architecture/owners.json`
- `architecture/layers.json`
- `docs/architecture/owners.json`
- `docs/architecture/layers.json`
- `docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json`
- `ai/CODEX_TASK.local.md`
- `ai/CODEX_TASK_PDF_MULTIMODAL_V1.md`
- `qisi-pdf-multimodal-contract.js`
- `qisi-pdf-multimodal-producer.js`
- `tests/pdf-multimodal-v1.test.js`
- `ai/PDF_MULTIMODAL_V1_ACCEPTANCE_2026-10-02.md`

app.js 仅替换 PDF runner 的工厂接线，并在审核源码/保存处绕开旧解析和清理，补来源页和人工冲突选择；九个受保护工作流 handler AST 保持原值。PDF.js renderer 仅加完整渲染选项和原 PDF region 裁图，proxy 仅调整支持窗口长响应的超时。身份/admission 仅增加独立 pdf-multimodal-v1 路由及 PDF 支持源，旧路由约束保持。

真实验证承接已获人类明确同意的深圳/河北源文件、既有 source-manifest SHA256、DashScope 两端点、qwen3-vl-plus、累计最多 150 次（开始前 84 次）。只上传这两份 PDF，所有尝试先写既有 paid ledger；不上传 DOCX，不修改生产 IndexedDB。未经授权的陌生样本只做本地合成/离线验收。

### 已定位的测试协议迁移范围

既有默认 UI PDF 测试输入是旧 camelCase 单页 JSON/Markdown，且断言旧 parser、controlled-write owner 必须入场。V1 已明确禁止这些行为，因此迁移到真实新 wire 响应、对应 exact-key/provenance、原字段保存/确认和 API 局部故障约束；不放松旧链独立测试或已知坏序列断言。测试 transport 只按请求协议封装响应，不解析或修复内容。counterfactual fault 改为使新 contract 失败，以继续证明新门禁不能绕过。确切测试消费者：
- `tests/production-pdf-sources-port.test.js`
- `tests/pdf-candidate-projection-characterization.test.js`
- `tests/pdf-import-coordinator.test.js`
- `tests/e2e/true-import-pdf-safe-partial.test.js`
- `tests/e2e/true-producer-chain-smoke.test.js`
- `tests/e2e/true-import-admission.test.js`
- `tests/e2e/production-normal-ui-import-cutover.test.js`
- `tests/harness/browser-engine-injection.js`
- `tests/e2e/browser-harness.js`

补充必要基础设施接线：qisi-import-diagnostics.js 仅注册 3 个 V1 阶段，避免现有日志白名单将其改成 unknown-stage，保留原内容脱敏和限额。

### 交接续作 — 2026-10-03

承接用户交接指令，保留 dirty 桌面现场及原始付费证据；本轮不外发、不提交。补充精确迁移消费者 `tests/e2e/pdf-projection-browser-shadow.test.js`：旧单页 camelCase/Markdown 输入和旧路由阶段不适用于批准的 V1。迁移为结构化 V1 wire，证明正常 UI、来源身份、绕开旧语义层、真实草稿事务和重开回读，保留无 shadow candidate / 无真实 API 边界。修改前 SHA256 登记于 `local-run-artifacts/pdf-v1-acceptance-2026-10-03/before.json`，不刷新原值。审核源码、原标签、原 PDF 查看和任务警报的必要修正限于已有授权 owner 和小量 UI 接线；真实响应只在隔离 origin 的模型 HTTP 边界回放，不能当新模型验收。

### 用户要求执行下一轮规划 — 2026-10-03

用户明确要求阅读并执行 `ai/PDF_V1_NEXT_ROUND_PLAN_2026-10-03.md`，随后要求继续。按 A/B/C/D/E/F 的证据依赖推进，保留全部旧 dirty，不提交。外部账户恢复没有明确消息前不发送收费请求；不推定余额恢复。原累计账本 107/150，第 107 次仍计入。

本轮初始证据：`local-run-artifacts/pdf-v1-next-round-2026-10-03/baseline.json`，登记 1190 个文件的实际修改前 SHA256、Git 现场和 ledger hash；`before/` 仅保存 `.before`，不会进入递归测试发现。前轮 10 个修改及验收报告 hash 全部一致，保护测试仍为原值。

已证实的第一批退役范围：`qisi-production-pdf-sources-port.js`、`qisi-pdf-import-coordinator.js` 只有 main script 与历史测试消费者，正常 UI 已由结构化 producer 替代。先删除这两个旧入口；在 `qisi-production-import-bridge.js` 删除旧 PDF projection fallback 和 required port，仅接受 V1 协议；`app.js` 只删除 `projectPdfCandidates` 注入和零调用的 `productionImportEngineHelpers` 构造，不改九个 handler。依据见 `dependency-inventory.json`、`raw-to-draft-diagnostics.json` 与前轮完整生命周期证据。

精确第一批文件：上述两个删除文件；`qisi-production-import-bridge.js`、`app.js`、`main.html`；`architecture/{owners,layers,runtime-modules}.json`、`docs/architecture/{owners,layers}.json`、`docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json`（真实数量/行号，原 hash 不刷新）；`tests/production-import-bridge.test.js`、`tests/c2-13-owner-runtime-closure.test.js`、`tests/pdf-import-coordinator.test.js`、`tests/production-pdf-sources-port.test.js`、`tests/pdf-projection-single-owner.test.js`；必要的退役消费者 `scripts/app-shell-responsibility-inventory.js`；新增字段参考和本轮报告 `ai/PDF_V1_SOURCE_REFERENCE_2026-10-03.md`、`ai/PDF_V1_NEXT_ROUND_EXECUTION_2026-10-03.md`；本任务文件。后续闭包证明完成后再登记后续精确范围。

测试迁移原则：旧入口纯实现测试随其实现退役；混合 bridge 测试保留 DOCX、异常/取消、失败与事务保护，将 PDF fixture 改为现有 V1 canonical；旧 fallback 改为明确拒绝反例。`tests/base-migration-smoke.test.js` 不改。该文件第 69 行仍 require controlled-write，是完整删除此文件的真实授权冲突，已询问是否允许迁移这一条测试，未答复前保留其字节。

验证：先 focused bridge/architecture/退役入口检查，实际 PDF 双文件和失败保留回放、DOCX 与历史读取，然后完整 verify:safe、runtime/app-shell/九个原 AST/增量 scope。所有本地模型 HTTP 回放使用 fulfill，不外发，隔离题库，不注入最终草稿。不能将旧响应回放称为新指令质量验证。

源参考勘误：本轮再次目视原源页，河北第 8 题第 5 页答案表清楚写 B，7–8 页详解也写 B，旧报告与规划中的 D/B 源冲突结论错误；深圳第 13 题第 14 页原解析本身含孤立 0。新参考据实际源页纠正，历史记录原文保留并附新证据，不能把错误旧金标沿用到验收。

第二批精确闭包：删除 `qisi-pdf-candidate-projection.js`、`qisi-pdf-ocr-support-parser.js`；`qisi-batch-engine-v2.js` 只删除 `engine-closure.json` 标为 keep=false 的顶层声明及旧公共导出/自测（含 processBatchV2、文本/公式评分、题干选项恢复、自动图归属）。保留已确认由 DOCX 视觉调用的两个 strict 工厂及 uniq/getRoles，保留原 AST 字节。这里没有 DOCX XML/OMML/OLE/MTEF 处理变化。修改前 hash 均来自本轮 baseline.json。

第二批配套迁移的既有文件：`tests/architecture-consistency.test.js`、`tests/c2-13-owner-runtime-closure.test.js`、`tests/pdf-projection-single-owner.test.js`、`tests/program-c-phase5-acceptance-gate.test.js`、`tests/qisi-app-display-cleaners-r3-ownership-audit.test.js`、`tests/phase5-canonical-producer-comparator.test.js`（保留有效来源/producer/admission 反例，退役比较旧路线实现细节）。main 与前列四份 manifest 更新实际删除、engine API 和调用者。

随旧实现退役的纯实现测试：`tests/pdf-answer-path-trace.test.js`、`tests/pdf-bridge-shadow-equivalence.test.js`、`tests/pdf-candidate-projection-characterization.test.js`、`tests/pdf-candidate-projection-invariants.test.js`、`tests/pdf-candidate-projection-known-bad.test.js`、`tests/pdf-candidate-projection.test.js`、`tests/pdf-canonical-comparator-provenance.test.js`、`tests/pdf-controlled-write-conflict.test.js`、`tests/pdf-ocr-support-projection.test.js`、`tests/pdf-ocr-support-parser.test.js`、`tests/pdf-support-source-ambiguity.test.js`。原字节/hash 留在 before/。这些测试中的现行业务安全由 pdf-multimodal-v1、production-import-bridge、正常 UI 真 PDF 回放及新退役门禁承接：exact exam+no、保留不同候选不猜选、重复/回退/跳号不语义附会、来源/字段 evidence、答案缺失拒绝确认、旧协议拒绝、新版确认/图片/事务。旧 comparator volatile 字段、OCR Markdown 解析细节不迁移到 V1。

`controlled-write` 的唯一剩余保护测试要求与其纯实现依赖/冻结门禁尚不能迁移；不能因这一点保留无关 projection/OCR parser。其 script 加载可在证明无有效消费者后删除，但完整文件删除仍受保护测试限制，报告真实剩余。

第三批函数级证据：strict producer 的真实调用来自 DOCX vision port，其 converter 总是标记 convertedFromDocx=true（qisi-docx-converter.js:153）。prepared recognizer 中 PdfQuestionBoundary 重建只在原生 PDF、非转换 DOCX 才调用；布局绑定对 DOCX 转换记录没有 pdfQuestionLayouts。旧 PdfQuestionBoundary 无其他有效生产消费者，删除这一分支和 `qisi-pdf-question-boundary.js`。这次与第二批不同，保留工厂中的 DOCX 有效代码但删除其旧 PDF 专用段；新的入口明确拒绝未标记转换来源的原生 PDF。

第三批精确文件：qisi-batch-engine-v2.js、qisi-pdf-question-boundary.js（删除）、main.html、architecture/runtime-modules.json、tests/pdf-question-boundary.test.js（纯旧边界重建测试删除）、tests/batch-engine-pdf-boundary.test.js（保留 DOCX 绕过断言并新增原生 PDF 无调用拒绝反例）、tests/batch-engine-prepared-pages-recognizer.test.js、tests/batch-engine-strict-visual-producer.test.js（fixture 标记实际转换 DOCX 来源，保留原进度/异常/取消/端口断言），tests/pdf-projection-single-owner.test.js（扩大已退役文件门禁）。全部修改前 hash 由 baseline.json 登记。

全量门禁第一次 1694/1695：唯一失败是 `tests/program-c-phase6-engineering-closure.test.js` 仍要求历史 counterfactual matrix 里的旧 projection 测试文件存在。该根因直接属于本轮退役消费者迁移。精确补充这一测试与 `architecture/pdf-v1-retired-files.json`：不覆盖历史 matrix/evidence 结论，按删除前 SHA256 登记旧文件及当前安全测试承接；历史存在性断言接受有明确退役记录、真实删除且替代测试存在的旧证据路径。该 JSON 是审计元数据，不参与产品业务或识别。不能以删除测试数量减少来宣称错误更少。

第四批：block parser 无实际产品调用者，controlled-write 不 require 它，保护 smoke 也不 require 它。删除 qisi-pdf-support-block-parser.js 及纯旧实现 tests/pdf-support-block-parser.test.js、tests/pdf-real-case.test.js、tests/pdf-support-controlled-write-answer-ownership.test.js。后者保护旧数字答案语义转标签/旧 parser feed，V1 明确不使用，当前六选项/缺失标签/错型等在现行 wire/admission 测试覆盖，保护 smoke 本身不改。findings-integrity-regressions.test.js 仅移除 N10/N11 的 PDF marker 子断言，所有 DOCX marker 反例保留。

精确第四批配套：main.html（同时去掉 controlled-write 加载，因为无产品消费者）、architecture/{owners,layers,runtime-modules}.json、docs/architecture/{owners,layers}.json、architecture/pdf-v1-retired-files.json、tests/architecture-manifest.test.js、tests/c2-13-owner-runtime-closure.test.js、tests/no-duplicated-production-logic.test.js、tests/findings-integrity-regressions.test.js、tests/batch-smoke-mock.test.js、scripts/verify-pdf-known-bad.js、scripts/verify-frozen-pdf-files.js、tests/pdf-projection-single-owner.test.js。batch-smoke 按原 known-bad 题号/回退数据迁移到现行 Contract/Producer exact-key，保留错序不可静默附会、缺题号、不完整/非法 schema、答案标签与题型不一致和无自动正式写入约束；不复制旧 parser。known-bad 命令保留，改跑现行 multimodal、bridge、batch 及共享 DOCX 序列 gate。

冻结 gate 对确实删除的 block-parser 使用已登记原文件 SHA256 的退休证明；原批准 contentSha256 不刷新，不修改任何现存冻结文件字节。受保护 controlled-write 仍原字节、仅取消产品加载并在架构中标记 deprecated；完整删除仍待具体保护测试迁移授权。before/ 保存上述每个文件原字节。第三批原生 PDF 拒绝与 DOCX gate 已通过，正常 UI 会在最终回放验证。

第五批共享边界：qisi-import-validation-service.js 保留现行 DOCX 的 sequence/schema/review/missing-field/support-evidence 行为；删除旧 PDF partial/controlled-write 的放行分支与 safePartialPipeline 默认依赖，对送入该 DOCX validator 的 PDF 返回 pdf-v1-producer-required。V1 仍在独立 Contract 验证，不经过它。qisi-pdf-support-aligner.js 暂保持字节，因为其 validatePdfSupportSequence 被 DOCX expected-sequence gate 实际调用；保留理由是当前有效函数，不是未来兼容猜测。

qisi-pdf-safe-partial-pipeline.js 只保留 DOCX converted-source 的两个 attach trace 函数；删除无产品消费者的 normalizePdfPipelineResult/assertSafePartialInvariants。精确配套：tests/import-validation-service.test.js、tests/pdf-safe-partial-pipeline.test.js、tests/app-facade-wiring.test.js、scripts/benchmark/measure-program-c-closure.js（移除只测已退役 safe-partial facade 的情景，不替换成不可比的 V1 性能结论）、tests/program-c-phase6-engineering-closure.test.js（现行非浏览器 benchmark 从 11 到 10，历史报告不覆盖）；更新 architecture/layers.json 与 docs/architecture/owners.json 的真实 API/责任；main.html 的已改 owner 查询版本。before/ 与 baseline 原 SHA256 保持。batch-smoke 同时保留并加强原 DOCX+DOCX 三题 fixture，使用实际 identity owner 的 exact support-field 合同，避免 protected smoke 的 DOCX 用途被 PDF 用例替代。

最后的 output 边界：qisi-production-import-output-port.js 的评分/合并实际仍服务 DOCX，不能整函数删除。对有 PDF format/mode/旧 producer route 的非 V1 输入明确拒绝，不能进入此评分分支。tests/production-import-output-port.test.js 保留原 DOCX/general merge 断言并增加旧 PDF 路线拒绝与 V1 原字段旁路反例。main 的 output owner 查询版本同步更新。三个文件均在 baseline.json；不改 DOCX 评分算法，不用这里纠正 PDF 文本或题型。

最终全量消费者定位：第二次门禁 1629/1631，仅剩 tests/e2e/runtime-startup.test.js 的模块清单强制加载已停用 controlled-write，以及 tests/program-c-corrective-benchmark.test.js 的旧情景数量 11。两者直接属于实际退役清单迁移，补充精确范围：启动检查把 active owner 改为 PdfMultimodalContract 并加 7 个旧 owner 不加载断言；benchmark 保留全部机器/版本/无真 AI/无预置结果/无失败等断言，现行情景为 10 并明确不含 retired safe-partial facade。修改前 hash 仍为 baseline 原值。

### 用户要求一次执行第 21 节 — 2026-10-03

用户明确要求认真阅读交接规划第 21 节并一次性执行。承接第 19–21 节的最小顺序：先修复已复现的坏 JSON 成功缓存反例，再核算实际费用、候选证据卡及本地重复量测；没有实测质量/效率/费用准入证据，不发布成本配置改动。保留全部历史 dirty、账本、原源与响应，不提交。第 21.6 节的文档阶段不实施限制由本次执行指令覆盖，但账户恢复、保护 smoke 例外及新模型/服务权限没有因此扩大。

本轮独立 baseline 为 `local-run-artifacts/pdf-v1-cost-audit-2026-10-03/baseline.json`，保存 1160 个非忽略文件的前 hash、HEAD、Git 现场、两源 hash 与账本 hash。精确允许修改：`qisi-pdf-multimodal-producer.js`（现有响应/缓存控制流，不新增业务 owner）、`tests/pdf-multimodal-v1.test.js`（同一缓存业务反例及参数化边界）、本任务、`ai/PDF_V1_NEXT_ROUND_EXECUTION_2026-10-03.md`（追加本轮状态）、新增总报告 `ai/PDF_V1_COST_AND_RECOVERY_EXECUTION_2026-10-03.md`；本地证据脚本、量测/成本账放忽略目录，不进入递归测试发现。producer 前 hash `da77f10b3fab45a3b594d87425cdfc44eec552169324077bafe256e06d9af074`，V1 测试前 hash `f537f4ad2fc9632c311a42963698ec284fafcf9cbda72b1fbe3d1520e18057f1`。不改 prompt/model/window/image defaults、Contract、DOCX、app.js 九个 handler、main/runtime、生产数据或任何冻结 hash。

缓存修复只验证模型：原始坏响应完整保留，旧缓存经过当前 JSON/Schema/角色/窗口页验证才复用；无效旧缓存不消耗新请求重试槽，也不再次作为同一个坏缓存重试；成功窗口保持零请求，失败窗口最多现有 1 次重试。此修复单列为恢复正确性，不冒充首次导入降费。变更前红例、原同一反例及修复后绿例、本地至少三次分段/资源量测、历史原 usage/耗时费用账、当前方案与至少两个候选的证据卡、最终 verify:safe/batch-safety/runtime/app-shell/增量 scope 与保护 hash 必须交付。真实收费仍等待明确账户恢复，仅既有两 PDF/目的地/qwen3-vl-plus/总上限 150 可用；本轮不以收费探针试账户。

本地正常 UI 无编辑重跑暴露第二个已证实恢复缺口：NormalUiImportController 自动复用整批已提交 requestId，Bridge 在进度已改变状态后走 committed-readback 分支而失败，根本不进入窗口缓存。保存的本轮原 producer 也复现同样失败（`ui-repeat-baseline.log`），所以不是缓存修复导致。当前 producer 不能决定整批请求身份；补充现有正确 owner `qisi-normal-ui-import-controller.js` 的精确范围：仅已持久化内部 `producerMode=pdf` 的默认重跑创建新草稿请求版本，仍复用有效窗口响应；保留显式 requestId 的幂等重试、并发 promise 与 DOCX 现有请求身份。新增回归仅放既有 `tests/import-cutover-idempotency.test.js` 与 `tests/e2e/production-normal-ui-import-cutover.test.js`。修改前 SHA256 取本轮不可变 baseline，并额外保存原字节；不改 app.js 受保护 runBatchRecognition 或其他 handler，不修改 bridge/DB schema，也不隐式选择不同 producer。这是第 19–21 节要求的真实入口恢复/旧确认失效修复，单列为正确性，不宣称性能或首次降费优化。

最终门禁指出通用控制器不得读取 producerMode（route-policy-single-owner 仍严格保留）。因此修正上段实现责任：新增精确允许 qisi-production-import-route-policy.js 导出当前内部身份是否可复用整批默认已提交请求的纯策略，控制器仅接受 canReuseCommittedRequest 可选端口；app.js 的 createNormalUiImportController 工厂实参只增加两行该函数引用接线，无新业务判断、箭头或算法，九个保护 handler 原字节不动。为什么必须碰 app.js：控制器保持通用时，该策略必须通过现有工厂注入；单独修改模块不会自动接上真实 UI。预计 app.js 两行、route policy 三行函数与一行导出、控制器一处条件。测试为原路由唯一 owner、幂等恢复、正常 UI 真重跑、app-shell/runtime、全量 verify:safe。两个原文件均已在 baseline 中，并保存 .before 原字节。此前“bridge/DB/schema 不修改”继续保持，冻结 hash 不刷新，测试不放宽。
工厂端口接线新增 AST 节点且使后续 handler 位置统一后移两行，app-shell gate 准确报告该元数据过期。精确允许 docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json 只调整 reviewedAstNodeCount 到实际节点数、九个 range 统一 +2；reviewedFunctionCount、maxWrapperLines、全部九个 astSha256 和 allowed/forbidden calls 保持。保存原字节，最终独立比较 handler 源字节与 AST。这是接线的真实增量登记，不修改任何冻结业务 hash 或放宽函数约束。

第21节本轮最终状态：两个恢复bug通过原反例及实际UI复验；最终verify:safe全量1633/1633，PDF known-bad62/62、DOCX8/8，runtime和app-shell通过。最终接线版两源各三次冷导入/重跑，代表2题事务与6个图片Blob回读通过。成本总报告/11张证据卡/usage费用账与合成规模量测已保存。最终scope审计1160基线→1161文件，10个既有文件改动加总报告1文件，范围外0；9个保护handler源字节/AST、保护smoke、原PDF、23项原请求/响应hash、账本均不变，新增收费0、账本107/150。不提交。本轮未发布任何新的prompt/window/image/model成本配置：完整费用下降及模型质量/效率非退化没有证明，账户恢复、38题完整gold/最终验收与保护例外条件仍缺；这些不能标作已完成。详情 ai/PDF_V1_COST_AND_RECOVERY_EXECUTION_2026-10-03.md。
