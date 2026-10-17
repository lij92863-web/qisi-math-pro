# PDF V1 与 MinerU API 接手交接 — 2026-10-04

交接对象：在另一个 Codex 窗口继续处理奇思数学 Pro 的 PDF 录题质量、API 选型与费用问题。

**接手结论：恢复修复、两卷离线全文复核、紧凑 JSON 对照、两版提示词实测、四次识别/组织隔离诊断和外部实现调研均已完成。紧凑 JSON、提示词 A/B 均被质量门槛否决；成本优化、替代 API 实测、新链两卷最终验收尚未完成。用户现在选择托管 API，并在考虑 MinerU。OpenXLab AK/SK 已在本机加密保存，尚未发起认证或 MinerU 识别请求。**

本文是状态、证据及后续执行顺序的交接，不自动扩大外发授权，也不替代新阶段的明确任务范围。历史报告中的旧预算、账户阻断和“下一步”应按本文所列最新状态理解。

## 1. 用户当前目标与最新约束

用户希望 PDF 录题能够保留题干、选项、答案、解析全文和原图，避免漏证明、错公式、跨页错挂，并降低实际费用及复核负担。

最新指示按时间顺序为：

1. 要求在同源输入上测试，查 GitHub/全网的录题和文档解析实现，比较国内模型的能力、价格，避免只在当前提示词上反复试错。
2. 明确说“本地就算了，我还是调用 api 吧”。后续采用托管 API；不要安装本地模型、下载权重或推荐 GPU 推理部署。
3. 询问 MinerU 是否适合、成本多少、自己现在需要做什么。
4. 创建并提供了一对 Access Key ID / Secret Access Key，要求“你不要上传就行了，留在本地”。不要在文档、日志、输出或 Git 中重复密钥；无需继续讲泄露或要求轮换。
5. 确认创建凭据的网站是 [OpenXLab 用户中心](https://sso.openxlab.org.cn/usercenter?lang=zh-CN)。
6. 本轮要求写详细交接，准备另开窗口。本轮只交付文档和离线核验，不开始新服务商测试。

“留在本地”的最新要求仍需遵守。现阶段可以继续公开文档研究、离线适配准备、证据整理和 mock 验证；不能仅因拿到凭据就推定用户同意把凭据用于认证，或把两卷上传到 MinerU。用户后续明确授权认证/具体材料外发时，再按实际范围执行；已有明确授权不重复询问。

## 2. 工作目录、版本与现场保留

| 项目 | 接手状态 |
| --- | --- |
| 实际工作目录 | `C:/Users/Administrator/Desktop/题库系统` |
| Shell | Windows PowerShell |
| 分支 | `stage/program-c-corrective-r1` |
| HEAD | `71dfe18770e5161a19d38c07842d0ab865f20c92` |
| 工作区 | 大量历史已修改、已删除和未跟踪文件；不是干净 checkout |
| 保留授权 | `ai/CODEX_TASK.local.md` 及 V1 明确任务已授权保留历史 dirty，禁止 reset/stash/commit/push |
| 本次交接增量 | 仅新增本交接 Markdown；证据和门禁日志进入 ignored 目录 |
| 产品/配置/数据 | 本次交接不修改业务代码、生产配置、IndexedDB、正式题库、依赖或凭据内容 |

不要把整个 `git diff` 当作下一窗口的改动。先保存当前字节基线和 Git 状态，再核对本轮增量。本文编写前记录了 **1183 个实际存在的非忽略文件**，不包含 Git 已标记删除的文件；这与旧报告的 1169/1172 属于不同采集时点和口径，不能直接当作新增代码数量。

本次证据目录：`C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-mineru-handoff-2026-10-04/`。其中 `before.json`、`git-status-before.txt`、`git-diff-stat-before.txt` 保存交接前现场。接手后重新核对；其他窗口如果改变现场，先区分并发变化，不覆盖它们。

## 3. 必读文件与任务规则

编辑前必须阅读根 `AGENTS.md` 和以下七份规则：

- [AGENT_CONSTITUTION.md](C:/Users/Administrator/Desktop/题库系统/ai/AGENT_CONSTITUTION.md)
- [MODULE_BOUNDARIES.md](C:/Users/Administrator/Desktop/题库系统/ai/MODULE_BOUNDARIES.md)
- [STABLE_CHAINS.md](C:/Users/Administrator/Desktop/题库系统/ai/STABLE_CHAINS.md)
- [ACCEPTANCE_CRITERIA.md](C:/Users/Administrator/Desktop/题库系统/ai/ACCEPTANCE_CRITERIA.md)
- [TESTING_GUIDE.md](C:/Users/Administrator/Desktop/题库系统/ai/TESTING_GUIDE.md)
- [CODEX_WORKFLOW.md](C:/Users/Administrator/Desktop/题库系统/ai/CODEX_WORKFLOW.md)
- [CODEX_TASK.local.md](C:/Users/Administrator/Desktop/题库系统/ai/CODEX_TASK.local.md)

按任务领域再读 `skills/local-ai-ocr-boundary/SKILL.md`、`skills/testing-verification/SKILL.md`、`skills/batch-import/SKILL.md`、`skills/pdf-support-safe-align/SKILL.md`；若涉及 `app.js` 或审核页面，分别读对应 skill。当前要求没有授权子代理，不自行派生其他 agent 或聊天任务。

必须保留：DOCX+DOCX 稳定链、明确源身份和原题号、原始响应、原图像素、冲突候选、人工确认、事务及读回验证。错误挂答案比缺答案更严重。不要按数学语义猜题号、选最长解析、自动补答案，或为了让测试绿而改变坏例期望。

所有真实 AI/OCR 实验必须有明确任务文件：目的、模型/服务、输入文件和 hash、端点、最大调用/页面量、费用止损、成功条件、失败停止条件、业务代码是否允许改动。读公开网页不等于认证，认证不等于试卷上传授权。

## 4. 当前阶段：哪些完成，哪些未完成

| 内容 | 状态 | 不能混同的结论 |
| --- | --- | --- |
| V1 正常 UI 主链与部分旧链退役 | 已实施、已做离线和局部 UI 验证 | 不代表机器全文质量合格 |
| 坏 JSON 成功缓存、PDF 无编辑重跑问题 | 已修复并复验 | 恢复正确性收益不等于首次导入降费 |
| 两卷全文金标和冲突来源复核 | 已完成离线复核，保留源字形待验项 | 金标转录不代表原题数学正确或模型通过 |
| DashScope 账户恢复 | 用户已明确确认 | 旧报告“账户待恢复”已过时；不再付费探余额 |
| 当前提示词真实小样本基线 | 已建立，响应可复用 | 不重复收费重建已有基线 |
| 紧凑 JSON 对照 | 完成，候选否决 | 成本下降目标未达到 |
| 提示词 A/B 质量修复 | 完成，两版均否决 | 未替换生产提示词 |
| 四次识别/组织隔离诊断 | 完成 | 不代表纯 OCR 或其他厂商已可靠 |
| 国内 API 与开源项目调研 | 完成一轮，有固定源码版本与来源 | 官网能力/价格不能代替两卷实测 |
| OpenXLab 凭据本机保存 | 已完成，加密及来源标记已核验 | 没有验证密钥有效性或 MinerU 权限 |
| MinerU 或 GLM 等替代厂商试卷实测 | 尚未开始 | 上传次数 0，没有替代方案胜出 |
| 窗口调整/生产替换 | 未获质量和收益准入 | 默认配置保持 |
| 两卷全部 38 题最终验收 | 未完成 | 局部人工修好 2 题的闭环不能算 38/38 |

## 5. 根因判断：模型、任务设计和软件各有什么问题

结论是三个层面共同存在问题，不能只说“视觉模型不行”或“软件已经没问题”。

**第一，模型确实有转写错误。** 纯逐页 OCR 仍会误读数字/下标/中文字形、漏页脚，甚至生成图占位。识别能力不足是部分原因，不能宣布 OCR 全文已经可靠。

**第二，同时转写、划题、分题干/答案/解析、跨页合并和判断 complete 的任务容易丢内容或错归属。** 最直接证据是相同河北两张图片：逐页转写能保留第 6 题尾段，结构化组织却删除该段，并称第 6 题解析完整。提示词会影响行为，但 A/B 都失败，不能靠一条新指令承诺解决。

**第三，软件目前主要检查协议和身份，没有独立证明全文覆盖。** 非法 JSON、越界页、重复/回退、冲突等有门禁；但合法 JSON、号码唯一递增、来源页列全、模型自报 complete 仍可能漏文或错挂。原始 API 响应里已经出现这些错误，离线回放未证明软件删了正确正文；软件的缺口是没有充分发现这类错误，而不是已确认把所有原文清理掉。

草稿仍默认 `pending`、`manualConfirmed=false`，保留人工审核边界。不能把“当前契约接受字段”说成自动正式入库；也不能以“最终有人审核”掩盖低机器质量。

### 5.1 四次隔离实测的具体证据

固定 `qwen3-vl-plus`、temperature=0、enable_thinking=false、max_tokens=16384、JSON object；不发金标或正确公式。

| 请求 | 输入/任务 | 关键观察 |
| --- | --- | --- |
| 121 | 深圳原第 13 页整页，逐页转写 | 读出此前漏掉的 `2^48 = 8^16 = (1+7)^16`；仍有图占位、体积下标误读和页脚遗漏 |
| 122 | 同页原像素公式局部、同提示词 | 关键等式可读；局部末行被裁断且有 warning，不能代表全文 |
| 123 | 河北原第 6/7 页，逐页转写 | 保留第 7 页开头第 6 题尾段及“故选 D”；第 5 题有 `a3`→`a2` 误读，“齐次”读成“其次” |
| 124 | 与 123 完全相同两图，B 结构化任务 | 第 6 题尾段从所有结构字段中删除，source_pages 仅 `[6]` 却 complete；第 8 题真实续文在未提供的第 8 页，也被标 complete |

124 还静默丢掉第 6 页开头没有起始题号的第 4 题残段。这个最新样本的第 6 题尾段是**删除**；此前请求 120 的同类问题是**挂到第 7 题**，两种失败不要混说。

121/122 均读到目标等式，不能据此证明裁剪是必要条件。123/124 改变提示任务及输出协议，不是只改变 JSON 序列化的实验。四次各一次，不给准确率、泛化或全卷成本结论。

详细报告：[隔离诊断](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_ISOLATION_DIAGNOSIS_2026-10-04.md)。证据目录：`local-run-artifacts/pdf-v1-isolation-and-landscape-2026-10-04/`，包括 `results.json`、`parsed-121…124.json`、`decoded-121…124.json`、`replay-audit.json`、`crop-registration.json`、`native-probe.json`、`scope-audit.json`。

### 5.2 软件入口和责任模块

- `qisi-pdf-multimodal-producer.js`：滑窗、动态 prompt、缓存验证、证据、有限重试、原 PDF 裁图；不直接替换其中默认模型或恢复旧 fallback。
- `qisi-pdf-multimodal-contract.js`：schema、候选、exact key、冲突、canonical 草稿、review 字段和状态；其中 complete 是模型状态及有限契约检查，不能等价为已核验全文。
- `qisi-qwen-vision-source-port.js`：响应 transport/解码；原响应回放与保存文本一致。
- `qisi-production-import-route-policy.js`、`qisi-normal-ui-import-controller.js`：生产路线及正常 UI 请求复用边界。
- 审核、正式准入及 repository 负责确认、写入与读回；不要绕过这些责任层。
- `app.js` 是高风险协调器，不能承载新的 MinerU 认证、OCR 解析、分页和全文覆盖业务逻辑。

## 6. 已否决的方案及真实费用

### 6.1 紧凑 JSON：不要重复当作未试的新思路

请求 108–114 共 7 次尝试：6 成功、109 一次网络失败且无 usage。三组输入固定为深圳 10–14、19–21 页和河北 4–8 页，仅改变输出格式要求。

成功配对合计：输出 13333→13082 Token，降 1.88%；输入 28597→28792；usage 按官方标价核算费用 0.161927→0.159612 元，降 **1.43%**；HTTP 总耗时 271.469→283.359 秒，增 **4.38%**。未达到预登记的至少 5% 费用及输出下降要求，另有字面反斜杠 n、漏句、错误 complete 等质量回归，候选否决。

六份成功响应已知价目小计 0.321539 元，另有请求 109 未知费用；这不是账户账单。不要把本地压缩保存的 JSON 字节换算成 API Token 节省，也不要靠少抄解析来报告省费。

报告：[紧凑 JSON 真实对照](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_COMPACT_JSON_REAL_COMPARISON_2026-10-03.md)。

### 6.2 提示词 A/B：两版都没有通过

请求 115–120，各版三窗；六次均 HTTP200/stop。A/B 严格质量均 0/3 窗通过，共 0.312570 元价目核算。

仍有：同题跨页拆项、证明漏式、无号尾文错挂、答案证明被造为题干、不存在的解析被补出、伪 complete、图附错题。九个框像素/标签检查有五框归属正确、四框错挂；不能只检查图框像素完整就放行。A 的初轮和 B 的初轮不是同版本两轮，不可拼接各自优点宣布通过。

报告：[提示词修复实测](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_QUALITY_REPAIR_REAL_CONFIRMATION_2026-10-04.md)。

### 6.3 四次隔离诊断

121–124 合计输入 12011、输出 5235 Token；四次 HTTP200/stop，HTTP 耗时合计 113.129 秒，官方价目核算 **0.064361 元**。其他厂商实测次数 0，账户实际扣费未知。

### 6.4 费用的主要来源

当前三组失败基线的输出费占已知价目约 **82.34%**。更早 V1 85–107 的已知费中输出约占 79.49%，含失败未知项。缩短 prompt、缩小 JPEG 字节或删 JSON 空白不是主要收益来源，也不能凭窗口重叠页数比例推算总账单。

有效成本应包含所有尝试、失败/重试、异常复核、人工修改与审核时间。没有合格整卷时，“每合格试卷成本”尚无有效分母；不能用模型返回条目数或人工修好题数充当机器正确整题数。

## 7. 两卷来源、金标和必须保留的勘误

源 manifest 正确位置：`E:/备份/题库系统/local-run-artifacts/shenzhen-hebei-visual/source-manifest.json`。它不在 `pdf-v1-implementation/` 下。

| 卷 | 原文件绝对路径 | 页数 / 题数 | SHA256 |
| --- | --- | --- | --- |
| 深圳 | `C:/Users/Administrator/Desktop/题目与答案/广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf` | 21 / 19 | `874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21` |
| 河北 | `C:/Users/Administrator/Desktop/题目与答案/河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷.pdf` | 19 / 19 | `011f12024f5c8bdd013e6524ba63b1ed762b34db501295d2edd9b6505d06c4a9` |

两卷合计 40 个原页、38 题。分区均为 1–8 单选、9–11 多选、12–14 填空、15–19 解答。局部证明小问不能改变整题分区类型。

全文参考：

- [深圳全文金标](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_FULL_GOLD_SHENZHEN_2026-10-03.md)
- [河北全文金标](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_FULL_GOLD_HEBEI_2026-10-03.md)
- [金标与冲突复核](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_FULL_GOLD_AND_CONFLICT_AUDIT_2026-10-03.md)
- [源页勘误](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_SOURCE_REFERENCE_2026-10-03.md)
- 结构化镜像：`local-run-artifacts/pdf-v1-full-gold-2026-10-03/gold-深圳.json`、`gold-河北.json`，只能连同原页图像使用。

重点勘误与待验项：

1. 河北第 8 题原答案表及详解均为 **B**。旧模型 D 是识别错误；旧报告的“原卷 D/B 冲突”已纠正，不再引用。
2. 深圳第 13 题原文自身有孤立 `0`；不要统计为模型幻觉或擅自删除。
3. 深圳第 5、15 题存在源字形待核项；不能按数学常识补减号或改公式后给模型算通过。原卷自身错误证明也要按源保留，与数学审校分开。
4. 全部图片的原图标签、坐标轴、箭头、虚线、字段归属，以及最终 Blob 保存/重载仍需全卷验收。
5. 长证明逐步骤核对；同号、source_pages 列全、KaTeX 能渲染不能代替全文覆盖。

离线发现深圳 20/21 页、河北 19/19 页有文本层，但特殊字体/私用字形和拆散的指数使裸文本不可靠。本轮未把文本层接为生产 fallback，不要偷偷恢复旧语义 parser。

## 8. 账本、预算与目的地授权

唯一原累计账本：`E:/备份/题库系统/local-run-artifacts/paid-import-ledger-2026-10-02.json`。

结构是根对象 `{ limit, calls }`，不是根数组。本轮只读核对：`limit=150`、`calls.length=124`，最后一条 number=124、status=200，**剩余 26 次**。历史报告的 107/114/120 是阶段终点，不是当前余额。

原真实授权限于具体深圳/河北 PDF 及 DashScope 指定目的地，失败和重试都计入 150 次；后期诊断固定 qwen3-vl-plus。用户确认恢复的是此前 DashScope 账户，不是 MinerU 账户余额或服务权限。

原请求/响应：`E:/备份/题库系统/local-run-artifacts/pdf-v1-implementation/request-N.json`、`response-N.json` 及对应原图。先记账再发送，保留原 HTTP 响应，不清洗覆盖历史证据。剩余 26 次是既有最终两卷预留，不能自动用来测试新提示词、新厂商或无限重试。

本次交接、凭据保存及公开文档读取新增识别/付费请求 **0**。未向 MinerU、GLM、百度、Mathpix或其他新厂商发送试卷。原账本不得另建副本当主账，亦不得删除失败项降低总数。

## 9. OpenXLab 凭据：准确状态与下一窗口使用边界

唯一保存位置：

`C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/mineru-api-2026-10-04/credentials.dpapi.json`

该路径已验证被 Git 忽略。文件不是明文 AK/SK；不把整个文件输出到聊天或日志。

| 元数据 | 当前值 |
| --- | --- |
| schemaVersion | 1 |
| provider | OpenXLab |
| credentialType | access-key-pair |
| protection | Windows-DPAPI-CurrentUser |
| format | PowerShell-ConvertFrom-SecureString |
| providerSource | 用户提供的 OpenXLab 用户中心 URL |
| networkAuthenticationPerformed | false |
| mineruAuthenticationValidated | false |

`ciphertext` 内加密载荷包含 `accessKeyId`、`secretAccessKey`。创建时已用当前 Windows 用户离线解密回读核对，两项一致；没有打印明文。本轮只读脱敏元数据，未再次解密。随后确认来源时仅改 provider 元数据，密文内容保持。

解密需同一 Windows 用户及 DPAPI 环境。另开本机窗口可以引用原路径；不要为了换窗口导出明文、复制进源码、写 `.env` 或设置永久环境变量。只有后续明确需要并授权认证时，才在内存读取解密值，禁止秘密日志。

### 9.1 AK/SK 与 MinerU Token 的关系

[OpenXLab 官方 SDK](https://pypi.org/project/openxlab/) 说明 AK/SK 可通过 `openxlab.xlab.handler.user_token.get_jwt(ak, sk)` 获取 JWT；它也可能写入用户目录的 token 文件。因此它属于真实联网认证，不是本地格式检查，当前没有安装 SDK 或调用该方法。

[MinerU 精准 API 文档](https://mineru.net/apiManage/docs) 要求 `Authorization: Bearer <Token>`，并说明在 MinerU API 管理页创建 Token。不能直接把 AK 或 SK 填成 Bearer Token，也不能仅凭两者共享 OpenXLab 体系就宣布该 JWT 一定具备当前 MinerU API 权限。

后续有两个待确认的入口：使用 MinerU 管理页直接生成 API Token，或按当前官方认证协议使用已有 AK/SK 换 Token 后核验 MinerU 接受情况。**凭据有效性、账号服务权限、额度、Token 有效期均未实测。** 没有证据要求用户必须重新建 AK/SK；先核清真正缺少的认证步骤。

## 10. MinerU：适合试什么，成本目前能说到哪里

MinerU 适合作为“专用文档解析 API”的待测候选：先取得文字、公式和文档资源，再研究有原页出处的题号组织。它不是已验证的本项目完整录题软件，不能承诺自动把独立答案/解析正确挂到所有题目。

2026-10-04 复核的[官方云 API 文档](https://mineru.net/apiManage/docs)：精准接口采用异步任务，URL 提交为 `/api/v4/extract/task`，本地文件入口为 `/api/v4/file-urls/batch`；返回 Markdown/JSON 等资源。支持 pipeline/vlm，单文件上限 200MB/200 页。文档列每天 1000 页最高优先级额度，超过后优先级降低；不要把它解读为超额付费价或无限免费承诺。

此前官方教程出现 2000 页和更大页数限制，与当前页面不一致。以运行前的当前控制台/文档为准；不能引用旧教程保证额度。

对用户“成本多少”的准确答复是：**如果账号当前确有可用免费解析额度，两卷 40 页的解析费用可能为 0；本账号权益和超额价格仍未知。** 不把“最高优先级额度”直接等同于免费余额。文档解析费之外，还要计题目组织 API、失败/复核请求、审核时间和存储等实际发生的代价。若无 usage/账单，记未知，不记 0。

开源 MinerU 4.0 的内部结果结构和托管云 API 不是同一承诺。前轮读了固定提交 `ed50cc15bc2c9bfb00520dadfe61979866e62236` 的 pipeline、native、content_list/v2 和 parse-result；它可用于学习页/块/坐标和资源分离，不能预造当前云 JSON schema。托管结果必须先留原包再核验。

不选免登录轻量 Agent 接口来绕过凭据或外发边界；它也不等于精准 API 的数学/结构输出。是否比较 pipeline/vlm、是否用 is_ocr，应在冻结实验任务中明确，不一次改变多个因素。

## 11. 国内 API 与开源实现调研已做了什么

完整报告：[API 与公开实现调研](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_MODEL_AND_PARSER_LANDSCAPE_2026-10-04.md)。核对 9 家服务商及 11 个固定提交的公开项目，保留官方价格/模态来源、代码路径、许可与限制。下表是前轮截至 2026-10-04 的筛选摘要，执行前重新核价；不表示已经测试能力排名。

| 候选 | 前轮价格摘要 | 未验证事项 |
| --- | --- | --- |
| 当前 Qwen3-VL-Plus | 北京短输入，输入 1 / 输出 10 元每百万 Token | 已有真实漏文/错挂，不能作为合格整卷基线 |
| GLM-OCR 托管 layout_parsing | 输入/输出各 0.2 元每百万 Token | 两卷公式保真、版面/坐标、实际 usage、延迟 |
| Qwen3.7-Flash | 短输入 0.2 / 0.8 元每百万 Token | 是否比当前质量好，当前可用固定版本/价格 |
| GLM-5.3-Flash / 豆包 Seed2.1-Lite | 前轮短档约 0.8/2.8、0.8/2.7 | 第二批通用视觉候选，未上传实测 |
| 百度 PaddleOCR-VL 文档解析 | 前轮按量 0.05 元/页；40 页示例 2 元 | 实际托管版本、同质量复核时间 |
| Mathpix | v3/pdf 前轮 0.005 美元/页；另有开通费和 Files 口径 | 网络、权限、实际数学质量与不同产品收费 |
| MinerU 托管精准 API | 账户实际权益/费用待核 | 最新用户关注方向，尚未认证和试卷测试 |

同 Token 换价只能筛选，不能当跨厂商实际成本：分词、图像缩放、输出、思考计费及质量不同。也不要将 DeepSeek-OCR 等开源项目效果当作同名聊天 API 的效果。

已研究的项目包括 GLM-OCR、PaddleOCR、MinerU、Docling、Marker、DeepSeek-OCR-2、HunyuanOCR，以及 Math Question Bank、ExamSplitAI、TeX-QB-Gen、pdf-exam-bank。学到的方向是：不可变源页/块、文字与位置共同保存、OCR 与题目组织分离、未分配尾段与续页显式暴露。没有一个项目提供这两卷完整金标验收，不能直接拿来宣布解决。

代码只下载阅读，未安装执行。许可逐项记录；GPL 项目不能整段搬入产品，缺 LICENSE 的项目不按可自由复用处理，代码许可和模型权重许可不混同。用户拒绝的是本地模型推理；本地普通页码、hash 和原像素裁图仍属于必要证据工具。

## 12. 下一窗口的执行顺序

### 步骤 A：先恢复上下文和冻结现场，零外发

1. 读本文、七份根规则、V1 最新报告及原规划第 19–21 节。执行 `git status --short`、`git branch --show-current`、`git log --oneline -10`。
2. 以当前工作区为基线保留全部历史 dirty；核账本 124/150、源 PDF/hash、金标、保护 smoke 和凭据文件的存在/脱敏元数据。没有业务理由不解密凭据。
3. 阅读现 producer/contract 的实际能力和已录制反例，避免把旧报告建议当作尚未试的新方案。
4. 继续准备 MinerU 认证适配及 cloud 返回结构的离线契约/mock；保持它在独立实验范围，不注册生产路线、不重写 app.js、不暗接旧 parser。

### 步骤 B：认证和材料外发分别明确后，做最小 MinerU 质量样本

认证步骤与上传步骤分开说明：认证会把必要认证信息或签名提交到已核实的认证服务；上传会把试卷/原页提交到 MinerU 及其返回的文件接收地址。用户“留在本地”的要求未解除时，不能执行这两步。需要确认时，先把输入、端点、页面量、预算、停止条件准备为可审核任务，再问真正缺少的范围，不泛问“是否继续”。

建议先选最小已知反例：深圳第 13 原页、河北第 6/7 原页，共 3 页。不要发金标、纠正公式或正确答案。若采用临时子 PDF/图片，冻结字节与原页映射，明确服务相对页 1 与原页 13/6/7 的关系；原 PDF 不改。

只上传已经明确许可的最小材料。若使用原 PDF 加 page_ranges，**传输的仍可能是整卷**，页面范围不等于只上传选中的页；授权必须覆盖实际外发字节。提交次数、上传次数、处理页数、轮询次数和重复请求分别登记。

先核验能否忠实保留 `8^16`、河北第 6 题尾段、“齐次”字形和第 5 题数字，再核云资源的原页、块、图片、阅读顺序与终态。保存未修改的响应、结果 ZIP 和文件 hash，确认 schema 后再适配。未知字段/单位/坐标空间不猜。

若模型仍漏公式或尾段，保留失败样本并止损，不立刻扩成两卷、不用另一模型自动补成“通过”。认证/服务/网络错误也保留记录，避免无限重试和收费健康探测。

### 步骤 C：小样本值得继续才扩到 13 页同源对照

重点范围：深圳 **10–14、19–21**，河北 **4–8**，共 13 个独立原页。同源、同一 gold、固定厂商参数，至少同版两轮核验稳定性；具体提交数量按厂商协议登记，不把 13 页写成固定 13 个请求。

用户当前关注 MinerU，可以将它作为候选；前轮建议的 GLM-OCR / Qwen3.7-Flash 仍是备选研究，并未得到自动并行多厂商上传权限。不要同时试九家。新服务预算单独明确，不把旧 DashScope 26 次预留挪过来。

### 步骤 D：证明质量、效率和费用，才讨论生产变更

新路线可研究“每页只识别一次 → 保存源块 → 组织层引用块范围 → 检查未分配段、续页和原题号 → 仅异常源块复核”。这是待测方向，不是已接入的功能；相对旧 V1 一次结构化理解有架构变化，必须在新任务里明确允许，不静默扩张。

质量要求：关键数字/指数/符号及中间等式不新增错误，长证明全文保留，题型和字段正确，错挂/错图为 0，未知源字形不猜补，窗外续文不能伪 complete。对应 source_pages 或 bbox 必须与实际内容核对。

效率要求：记录渲染、上传、排队、模型处理、轮询/下载、组织、裁图、审核、保存/重载总时间及各段；保留失败/超时、人工修订和尾部耗时。不要用一轮网络时间证明稳定更快。

费用要求：实际处理页数/usage/计费档位及可用账单；失败/重试/局部复核和人工耗时都计入。免费额度属于当前账号情景，另报无优惠/持续使用条件。质量不相等时不只比较总价。

原规划第 21 节的“质量不降、处理效率不降、实质收益”仍适用；费用专项必须有下降证据。若没有胜出，明确未完成目标，不增加生产复杂度。

### 步骤 E：候选达标后，再做两卷最终验收

在最终发布版本逐题核对两卷 38 题机器初始四字段、所有原图、来源、冲突和人工状态。分别报告机器质量、拦截行为、人工修订、最终入库回读，不混为一个“通过”。

单独完成深圳第 5/15 题源字形、全部图片标签/归属/Blob 回读；验证正常 UI、失败局部恢复、重复导入、审核后确认失效、事务及重载。保留 DOCX+DOCX 回归。

有新代码时，先窄范围回归，再 `npm.cmd run verify:safe`，按实际任务核对增量范围、handler/hash及无真实 AI 默认测试。达标后是否部署/提交按该阶段授权执行，不因为“继续”跨到未指定阶段。

## 13. 原 V1 遗留事项，不要在 MinerU 调研中误删

- 已删除 6 个旧 PDF 专用模块、退役 17 个纯旧实现测试，并收缩旧分支。正常 UI PDF 已走新链，不能恢复长期双链/fallback。
- `qisi-pdf-support-controlled-write.js` 产品不再加载，但受保护 smoke 及其他测试/工具仍消费它；不能说零引用或顺手删除。
- `tests/base-migration-smoke.test.js` 是用户保护文件；前轮核验 SHA256 为 `3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea`。具体迁移例外此前尚未明确，不推定本次交接授权修改它。
- 早期 1787/1790 项、退役后 1631 项、后续 1633 项属于不同版本。测试数量不是识别能力或质量分数，不能用旧汇总宣称新链最终验收。
- 前轮独立代理端口 32262/32263 已关闭。不要假定它们仍在运行，不操作用户的 3000 服务；如需独立服务，核 PID/实例、使用隔离端口，结束时只关闭本任务进程。
- 不直接编辑用户 IndexedDB/localStorage，不正式写题库做“诊断”；隔离 browser/DB、mock 与录制回放优先。

## 14. 证据索引与报告阅读顺序

| 文件 / 目录 | 用途 |
| --- | --- |
| `ai/PDF_V1_NEXT_ROUND_PLAN_2026-10-03.md`，尤其第 19–21 节 | 原加固、退役、证明与优化准入规划；历史状态须结合最新报告 |
| `ai/PDF_V1_NEXT_ROUND_EXECUTION_2026-10-03.md` | 原 V1 路线/退役及局部审核闭环 |
| `ai/PDF_V1_COST_AND_RECOVERY_EXECUTION_2026-10-03.md` | 两个恢复 bug、真实成本构成、11 张候选证据卡与资源量测 |
| 两卷全文 gold、冲突审计、SOURCE_REFERENCE | 字段全文、源自身问题、原答案勘误 |
| `ai/PDF_V1_COMPACT_JSON_REAL_COMPARISON_2026-10-03.md` | 原基线和纯输出格式实验，候选否决 |
| `ai/PDF_V1_QUALITY_REPAIR_REAL_CONFIRMATION_2026-10-04.md` | A/B 实测、跨页/错挂/错图证据及否决 |
| `ai/PDF_V1_ISOLATION_DIAGNOSIS_2026-10-04.md` | 最新四次诊断及根因边界 |
| `ai/PDF_V1_MODEL_AND_PARSER_LANDSCAPE_2026-10-04.md` | 国内模态/价格、固定开源提交/许可、待测 API 方向 |
| `ai/CODEX_TASK_PDF_ISOLATION_AND_LANDSCAPE_2026-10-04.md` | 已完成诊断阶段的精确输入、四次上限、无代码修改边界 |
| `local-run-artifacts/pdf-v1-cost-audit-2026-10-03/` | 旧代码 before、恢复红绿回归、性能/成本卡、scope |
| `local-run-artifacts/pdf-v1-full-gold-2026-10-03/` | JSON gold、完整性核验、离线冲突证据 |
| `local-run-artifacts/pdf-v1-compact-json-2026-10-03/` | 同源冻结、解码/评分、图框、原账本快照 |
| `local-run-artifacts/pdf-v1-quality-repair-2026-10-04/` | A/B prompts、全部响应评审、九个图框、回放与 gate |
| `local-run-artifacts/pdf-v1-isolation-and-landscape-2026-10-04/` | 121–124 诊断、费用计算器、源码和官方资料快照、最终校验 |
| `local-run-artifacts/mineru-api-2026-10-04/credentials.dpapi.json` | 本机加密凭据，只按第 9 节边界使用 |
| `E:/备份/题库系统/local-run-artifacts/pdf-v1-implementation/` | 不可变真实请求/响应及原图 |
| `E:/备份/题库系统/local-run-artifacts/paid-import-ledger-2026-10-02.json` | 原累计账本，当前 124/150 |

## 15. 本次交接验证与交付范围

本轮 mandatory preflight 已执行：Git 状态、分支、最近 10 条提交。阅读根规则、相关验证 skill 和最新报告，核对了原 manifest、账本统计、源码默认参数及凭据脱敏元数据；公开重读 MinerU API 和 OpenXLab SDK 文档，没有使用密钥。

本轮唯一允许新增的非忽略文件：`ai/PDF_V1_MINERU_API_HANDOFF_2026-10-04.md`。不修改历史报告或任务文件，不将凭据复制到交接中。

本轮最终 `npm.cmd run verify:safe` 退出 **0**：主测试 **1633/1633**、DOCX stable **8/8**、PDF known-bad **62/62**、batch mock **8/8**、no-real-ai 和 batch-safety 通过，均 0 失败、0 cancelled、0 skip、0 todo。首次默认沙箱阻止 Node 子进程启动，报 `spawn EPERM`；保留失败日志后，原命令通过已批准执行权限重跑，没有改代码、测试或期望。当前 `package.json` 的 `verify:safe` 实际包含 `verify:batch-safety`，以现有脚本为准，不照旧说明重复跑重门禁。

增量范围核验通过：编写前 1183 个实际存在的非忽略文件字节保持，仅新增本交接文档；原 branch/HEAD 保持。源 PDF、manifest、两份 JSON gold、保护 smoke、原累计账本及加密凭据共 8 份额外保护文件 hash 保持；凭据和证据目录仍被 Git 忽略。文档内 15 个去重的本地 Markdown 文件链接均存在。历史 `git diff --stat` 保留于证据，不将其变化总量计为本轮贡献。

日志和记录在 `local-run-artifacts/pdf-v1-mineru-handoff-2026-10-04/`：`verify-safe-sandbox.log`、`verify-safe.log`、`protected-before.json`、`scope-audit.json`、`final-verification.json`。本轮未添加测试或更改门禁；上述门禁是文档交接后的实际重新验证，不能替代尚未执行的 MinerU 质量测试。

本轮无 commit/push，无真实 AI/OCR/认证调用，无新付费或试卷外发；本交接完成后停止，不启动下一阶段。

## 16. 可复制给下一窗口的开场指令

> 请认真阅读 `C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_MINERU_API_HANDOFF_2026-10-04.md`，以及根 AGENTS.md 要求的规则和交接列出的最新报告。保留全部历史 dirty、原响应、gold、账本、用户保护 smoke 和凭据；不 reset/stash/commit/push。用户选择托管 API，现在优先研究 MinerU。先完成当前现场/124次账本核对、认证关系和最小3页已知反例实验的离线准备；已有 OpenXLab AK/SK 在 ignored 的 DPAPI 文件中，不打印或另存明文。最新“留在本地”要求尚未解除，当前不发送认证或试卷请求；先把具体认证/目的地/输入/费用/止损准备清楚，有必要时只确认缺少的授权。不要继续盲堆提示词、重做已否决的紧凑 JSON，或拿合法 JSON/模型 complete/离线绿色当全文验收。若我随后明确授权实测，在冻结任务范围内执行并保留原始结果；先3页反例、后13页同源两轮，再决定是否进入生产改动和两卷完整验收。分别报告模型转写、组织归属、软件验证、实际费用、耗时和人工量，成本优化及最终通过必须以证据为准。
