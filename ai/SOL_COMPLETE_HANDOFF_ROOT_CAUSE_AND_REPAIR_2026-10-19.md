# 奇思数学 Pro：完整交接、根因审计与修复设计（交给新对话中的 Sol）

交接日期：2026-10-19，Asia/Shanghai。项目：`C:\Users\Administrator\Desktop\题库系统`。本文按当前工作区代码、实际复现和日志编写；旧报告中的数字只代表对应时间与验证层级。

**交接时的状态：尚未修完，不能宣称可交付。用户最新要求是先完成分析和完整交接，停止继续修改业务代码，交由新窗口的 Sol 实施。旧 PDF 执行链尚未删除，MinerU 尚未接入正常页面。**

## 0. 用户要求——Sol 必须优先遵守

下面是用户多次强调的要求，经整理后的执行标准，不是可选建议。

1. **先找到根本原因，再动代码。** 不能停留在报错位置或表面症状；要追查输入、配置、数据协议、状态传递及下游消费为何不一致，并给出可复现证据。
2. **解决一类问题，而不是照着某张卷子打补丁。** 禁止按文件名、城市、固定题号、固定答案或某段原文写特判。修复应依赖明确的结构事实、来源身份和算法不变量，并用不同编号、不同文件组合和反例验证。
3. **算法要追求明确约束下的最优解。** 先定义输入范围、正确性条件与优化目标，比较可行方案，给出时间/空间复杂度及测量依据。能证明最优的给出证明；只能证明某一输入域内正确或性能更优的，明确适用范围。不能把“能跑”“代码更短”“一次样例更快”称为最优。正确性优先，不能为了速度猜归属、丢证据。
4. **先认真识别和总结问题，再统一设计、分步实施。** 不边猜边改，不修到一半才发现主链根本未接通；但“统一修改”不等于一个不可验证的大改动。采用一份整体设计和多个边界清楚、可单独验证的实现步骤。
5. **仔细审计业务耦合。** 每处修改都要检查生产者、协议、消费者、缓存/状态、持久化、审核、正式入库、导出和测试之间的影响。不要为了修一个入口牵动一堆不相关业务。
6. **不要防御性编程堆成屎山。** 不用层层兜底、泛化 try/catch、吞错误、自动换路线、无限重试、重复正则和平行状态来遮住根因。必要的来源/序列/角色/冲突/事务校验属于领域正确性条件，必须保留，并由明确的模块负责，避免重复散落。
7. **旧入口、旧执行链要清干净。** 用户明确说“旧的链路给我清了”。不是把旧链改成 disabled 或在旁边再接第三条链。清理必须包含加载项、配置、调用、失效脚本、登记与测试；不能因此删除用户历史数据、原始材料或审计证据。
8. **保住 DOCX 稳定链。** 正常 DOCX 使用本地 XML/OMML/MathType/MTEF 链，不应为了 PDF/MinerU 改成 OCR 或外部模型。DOCX+DOCX、完整 DOCX、题目单文件均要验收。
9. **验收必须和用户操作一致。** 用户在桌面快捷方式打开页面后实际上传/重识别，不是调用一段独立研究脚本。不能替换生产配置、绕过入口或伪造中间产物后，把成功说成“真实页面已修好”。外部传输可在离线回归中模拟，但要清楚标注这一层。
10. **实际整卷与视觉验收不能省略。** 用户此前多次要求完整深圳卷、文件夹中的 PDF 及实际 DOCX 测试。题数正确不等于内容正确；公式、答案、解析、图表、原页归属都要看。当前在线授权不可从历史封闭轮次中挪用，见第 12 节。
11. **修改后再独立复审。** 检查新回归、错误耦合、未清理的路径和测试盲区。不能以一次全绿代替复审，也不能为通过而弱化 known-bad 断言。
12. **做完已授权工作，别反复让用户确认同一件事。** 对不可缺少的新外发范围、费用或生产数据操作才核对授权；先准备好具体可审核方案。遇到限制要说明具体限制来源，不能模糊推回用户。
13. **如实交付，不留隐形尾巴。** 明确已做/未做/待验证、失败用例、剩余风险及下一步。未完成的不能写成“全部解决”。“免费”也不意味着可省略上传边界、调用回执和失败状态。
14. **当前只交接，不擅自实施下一阶段。** 用户要在新对话中让 Sol 接手；本轮不发消息给其他对话，不建新对话，不继续删代码。

关于“最优”：解析必须读取 N 个原文单位，扫描下界为 Ω(N)；对固定语法、稳定坐标和哈希索引，目标是一遍或常数遍 O(N) 扫描，来源查找均摊 O(1)，证据空间 O(N)。需要排序时说明为何不能直接使用原顺序，并标明 O(K log K)。网络耗时与并发则要在限额、取消和内存约束下测量，不能一味并发。正文/步骤完全同形且没有额外证据时存在信息不足，不能靠“更优正则”证明唯一归属。

## 1. 来龙去脉：为何走到今天

### 1.1 早期 PDF / Qwen 路线

用户最早要求阅读 `ai/PDF_QWEN37_COMPLETE_HANDOFF_2026-10-15.md`，查根因并实施。之后连续要求深圳 21 页整卷测试、视觉验收、分析并解决问题。

历史多轮 Qwen 实测遇到网络失败/受理费用未知，按当轮“失败即停、不自动重试”边界中止。用户澄清使用的是**速博士**，不是 fclash。之后用户明确需要保持**全局模式**，不能把切换规则模式当作默认解法。

历史付费轮次曾有“44 次/5 元”、后续“剩余 14 次”的具体授权，以及更早未知费用预留。这里不复算账，也不把旧授权解释成新轮次授权。后续 Sol 默认不调用真实 AI/OCR。

### 1.2 DeepSeek 引入 MinerU

用户随后说明 DeepSeek 加了 MinerU，实际识别速度和准确率明显提升且免费，要求审代码、测试、修复一类问题。

提交 `85441f5` 的标题写了真实卷 19/19、16 秒；这主要是解析与分段的实验路径。10 月 18 日统一修复报告已经明确：**并非正常 UI 上线，也不是全流程图片持久化、任务恢复与内容视觉验收完成。**

MinerU 后处理在 10 月 18 日修过来源片段、归属准入、冲突聚合等问题。6 份材料 68 页的离线重放是历史证据；深圳/河北部分边界使用了原页人工核验记录，不能说成无条件全自动通过。

### 1.3 10 月 19 日审计与修复

用户要求对照昨天、今天的报告与实际代码，审计是否修对、是否引入新问题。产出 `ai/REPORT_CODE_AUDIT_2026-10-19.md`，发现 F01–F12；用户随后授权修复与修后复审。

已保存但未提交的修复涉及：支持证据聚合、角色约束、DOCX 章节/编号、去重保真、已提交草稿图片保护、选项语法、打印门禁。详见第 4 节。不能重复按旧报告把这些全部当作未修，也不能因为这一轮修过就假设没有新漏洞。

### 1.4 用户手工测试暴露真实入口缺口

用户创建桌面快捷方式后，手动导入河北 PDF 显示 `IMPORT_RECOGNITION_FAILED`、100%、0 题，继而报告佛山 DOCX 也失败。用户质问：为何 AI 测试时好好的，自己操作就不行？

本轮查明：

- PDF：正常 UI 仍调用关闭的旧 `PdfExternalProducer`；MinerU 没接到这个入口。模拟浏览器测试会先修改 `Config.pdfExternal`，因此可以通过。
- DOCX：新增括号题号规则把小问当大题；空格句点题号漏识别；答案区复杂格式没被既有测试覆盖。
- 错误层层包装后只保存通用错误码，用户看不到真实原因。

本轮真实佛山 DOCX 隔离回验已恢复 19 题，但复审又发现倒序/重复支持题号的错误合并，尚未修复。

### 1.5 当前停止点

用户先要求清掉旧链，随即改为：**先分析全部相关问题、危险耦合，写完整设计与修复路线，给新窗口的 Sol 做。** 因此当前没有继续旧链删除或 MinerU 接线。本文就是这一停止点的完整交接。

## 2. 环境、分支、数据及权限

| 项目 | 当前事实 |
|---|---|
| 工作区 | `C:\Users\Administrator\Desktop\题库系统` |
| Shell | PowerShell；npm 使用 `npm.cmd` |
| 分支 | `stage/program-c-corrective-r1` |
| HEAD | `3099a479ca4a8bd5e2a06f2365bb78bc5ff848af` |
| 最近相关提交 | `3099a47`、`1dc4101`、`01db97a`、`85441f5` |
| 页面 | `http://127.0.0.1:3000/main.html` |
| 本地数据库 | `QisiMathVueDB`，含草稿批次/文件/题目/图片及正式库 |
| 工作区状态 | dirty，已有审计和修复被用户授权保留；不 reset/stash/覆盖，不自动 commit/push |
| 当前是否上线 MinerU | 否；有服务端 API 和算法/脚本，没有正常 UI 生产适配 |
| 本轮真实外部 AI/OCR | 0 次 |
| 本轮生产数据改写 | 无；实际验收用隔离副本 |

根目录 AGENTS.md 要求读 constitution、boundaries、stable chains、acceptance、testing、workflow、local task 及对应技能。`CODEX_TASK.local.md` 包含大量历史覆盖，不要只读开头的“文档任务”而忽略后续用户授权。当前实施前应建立新的、有范围的任务文件，以新窗口用户明确指令为准。

此前 dirty 保留授权已存在；新窗口先报告 dirty 并识别来源，不能机械执行清空。不能修改 `.env`、密钥、真实输入材料、数据库文件、依赖/lockfile，不能静默提交正式库。

## 3. 当前真实架构与最危险的耦合

### 3.1 实际调用图

```text
桌面快捷方式 -> localhost:3000/main.html
  -> createDraftImportBatch / runBatchRecognition（app.js）
  -> NormalUiImportController（锁、requestId、取消）
  -> ProductionImportBridge（状态机、路由、持久化前后）
       DOCX -> ProductionDocxSourcePort -> BatchImporter
            -> 编号/XML/OMML/MTEF -> 支持证据 -> typed drafts
       PDF  -> PdfExternalProducer -> config.enabled=false -> 抛错
  -> 统一草稿保存 -> 审核 -> 正式准入 -> 正式仓储 -> 导出

另一条目前没有接入正常 UI 的路径：
脚本/测试 -> /api/mineru/parse -> MineruClient -> 原始 ZIP/content_list
         -> MineruEvidence / PaperSegmenter / PaperPairing / BlockOwnership
         -> 实验候选或预览；尚未形成正常 UI 全生命周期
```

`architecture/runtime-modules.json` 中 MineruClient 为 node，MineruEvidence、PaperSegmenter、PaperPairing、BlockOwnership/Prompt 为 dormant；`main.html` 仍加载旧 PDF external 生产者。

### 3.2 危险耦合清单

| 耦合 | 具体位置 | 为什么危险 |
|---|---|---|
| 提供商协议与内部草稿协议混为一体 | `qisi-pdf-external-contract.js` | 同时拥有模型 schema、序列、canonical draft、图片规则、审核、编辑和公式门禁；替换识别服务会波及审核和历史数据 |
| routeId 白名单散布 | bridge 约 163/506/553/619；output port 约 312；identity contract 约 254；formal admission 约 212 | 新 `pdf-mineru-v1` 即使输出正确，也可能在桥接、去重或正式准入被拒绝；把旧 routeId 冒充新来源会污染 provenance |
| UI 直接消费提供商字段 | `app.js` 约 650–653、1846–1859、1912、2084；`main.html` 约 678 | `pdfExternal/pdfV1` 成为界面/保存分支；简单删 provider 会留下空引用或历史草稿打不开 |
| 题目边界和支持边界二次解释 | BatchImporter supportBlocks + SupportTextParser 递归解析 | 前段声明的块边界可被后段全文正则重新推翻，倒序/未知号会重新成为可用解析 |
| 普通文本值代替证据状态 | 已修过的 support reducer、source port、validation | 空字符串可能同时表示缺失/冲突/拒绝；新增消费者若只看值会复活错误答案 |
| 资产缓存等于持久化 | MineruClient jobs Map 与 readImage | 内存淘汰/重启导致草稿失图；缺 job 回退最新任务可能串图 |
| “部分可审核”与“正式可入库”混用 | validation / review / formal admission | 为了允许缺失字段进审核而放松正式校验，会把不确定性带入正式库 |
| 测试适配器修改生产配置 | `tests/harness/browser-engine-injection.js:15` | 检验的是被替换后的路线，无法发现用户真实入口关闭或没接线 |
| 元数据登记与旧实现名称绑定 | 两套 architecture/docs manifest、AST/freeze/gate 测试 | 清理文件不更新登记会启动失败；反过来只更新登记又会制造“架构已接通”的假象 |

原则：边界校验可有不同目的，但同一事实必须有一个真源。生产者负责来源提取；canonical 层负责内部字段/证据；审核负责人工裁决；正式准入负责写入资格。不要各层重复分题、重复清洗、按文本长度择优。

## 4. 已经做了什么（必须保留并复审）

### 4.1 前一轮 F01–F12 修复

完整记录见 `ai/AUDIT_CLASS_REPAIR_RESULT_2026-10-19.md`，这里列交接必知点：

- 新增 `qisi-support-evidence.js`，证据集合归并，冲突为吸收态；测试排列/重复/拆分的不变性。
- `qisi-support-text-parser.js`、identity contract、DOCX source port 统一支持证据；先角色后聚合；冲突可进入审核但不成为正式合法值。
- DOCX 章节边界和原始段落坐标修正，括号题号支持；后者后来暴露小问回归，见下文。
- output port 不再因短题干/质量分吞掉同号异题和冲突候选；合法缺失字段可合并。
- maintenance/仓储保护 submitted 草稿与图片闭包、软删详情读取边界。
- Utils 保留 DOCX 无标点选项语法并屏蔽数学区域；打印门禁和实际格式化用相同规范化输入。
- app.js 此前增量只限打印委托/未归属证据展示等小接线；没有大重写。
- package.json 将正式测试发现范围限制为 tests 下的测试，防止 ignored 历史快照被递归执行。不能因此省略真实文件离线验收。

这些修复是当前 dirty 的组成部分，不要回退到 HEAD 后重新做。

### 4.2 真实 DOCX 修复与验收

源文件：`C:\Users\Administrator\Desktop\题目与答案\广东佛山市第一中学2026届高三一模检测数学试题.docx`，1,599,596 字节。

用户失败任务：`batch_1792394126397_802aow`；文件 ID：`file_1792394123681_r3xvgc`；full 角色、docx-deterministic，原错误 `IMPORT_SOURCE_LOAD_FAILED`。

已修：

1. `(1)(2)` 小问不再在普通数字主标题内拆成主问题；纯括号主标题仍可识别。
2. `13 .2025年…` 可识别为第13题，不再并入第12题。
3. 答案区使用保留原始 Word 分隔符/位置的 supportBlocks，识别 `15.(1)…` 等边界。
4. 保留 `1.D` 等裸选项答案，以及源全角分隔符 `13．14` 对应的数值答案14。
5. 分小问答案只有连续 `(1)(2)…` 且不含未转换公式占位符才提取；不拿第一小问冒充整题答案。

实际验收：从用户失败数据的隔离副本，在页面点击“重新识别”；最终 19 道题、1–19 连续、进入 review，未提交正式库。

- 1–11 答案：D、A、B、C、C、D、D、A、AD、ACD、ABD；12 为 -4，13 为14，14 为区间 (8/3,7/2)。这是本次输出证据，不是所有内容已独立判真。
- 15/17/18/19 有分小问答案；16 含未转换公式 rId703/rId705，答案留空；19 题解析均保留。
- 图数量：2/8/11/14 各1，17有3，18有1；未在已接受字段中残留公式占位符。
- 隔离目录：`local-run-artifacts/diagnose-2026-10-19/edge-profile-docx-multipart`。
- 原生产任务仍是原状态，隔离副本成功不会自动修复用户库里的失败状态。

**这次修正仍不完整：本轮复审的倒序/重复反例已证明 supportBlocks 算法有剩余问题，见 R03/R04。**

### 4.3 用户要求先交接前，刚保存的增量

- `qisi-production-import-status-port.js`：把桥接层的安全 causeCode 保留进持久化错误文案；对 `PDF_EXTERNAL_NOT_CONFIGURED` 给出中文原因。不传原始模型响应。
- `tests/production-import-status-port.test.js`：验证批次/文件原因一致及非法 cause 内容不传播。
- `tests/e2e/review-draft-command-ui-recovery.test.js`：审核操作从 await 远程 proxy Promise 改为点击“标记已确认”，等待真实数据库状态，再断言原有字段和 dirty；没有删减字段断言。
- 新 `tests/e2e/production-pdf-configuration.test.js`：使用未替换的生产配置，验证 PDF 明确失败且原因可刷新回读；**该测试最后的导航定位器有歧义，当前失败，未因交接而偷偷修掉。**
- 新 `ai/CODEX_TASK_MANUAL_IMPORT_FOLLOWUP_2026-10-19.md`：记录当时的限定范围；用户后来要求先交接，所以不能把这份任务理解为当前可继续自动实施。

未做：未删除旧 PDF 模块，未改 PDF 配置为 enabled，未加 MinerU producer，未改 app.js 接线，未调用外部服务。

## 5. 新审计问题登记（确定性、风险与复现分开）

优先级：P0 表示一旦接入可导致来源/答案/资产错误的关键风险，不表示已经发生正式库污染；P1 表示正常流程阻塞或内容/证据损失；P2 表示诊断、验证或维护缺口。

### R01 / P1 / 已证实：真实 PDF 页面没有使用 MinerU

`app.js:1846–1859` 创建 PdfExternalProvider/Producer；`qisi-config.js:165` 的 pdfExternal.enabled=false；producer 第48行在任何请求前抛 `PDF_EXTERNAL_NOT_CONFIGURED`。

用户河北任务 `batch_1792393707921_q3g3rn`，文件 `河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷.pdf`，因此显示0题。不是凭此就能认定 MinerU 服务宕机、代理不通或原 PDF 坏了。

修法：完成新的生产适配与内部契约后一次切换，并移除旧执行链。不能简单把 enabled=true 开启 Qwen。

### R02 / P1 / 已证实：错误原因丢失，重试建议没有依据

bridge normalizedFailure 保留 causeCode，但原 status port 只保存 error.message；controller toast 又只显示稳定外层 code。保存了错误的新文案只是部分修复，toast/诊断/刷新一致性仍要统一。

设计：持久化一份受约束的错误对象 `{code,causeCode,stage,retryability,requestId}`，展示层统一映射；不要存原始上游响应/密钥。对配置缺失不能建议盲目重试；未知受理不能建议重发。只为该问题必要的 schema 变化做兼容，不重构全库。

### R03 / P0 / 已复现：DOCX 支持分段将倒序/重复题头吞成前题解析

位置：`qisi-batch-importer.js` 约953–980：只有 `index >= nextIndex && declared` 才开新块，否则拼入 active.lines。

最小反例（题目区已有1、2）：

```text
参考答案
2.(1)第二答案
【分析】第二题解法
1.(1)第一答案
【分析】第一题解法
```

实际只生成 questionNumber=2 的 supportBlock；parser 输出第2题解析包含 `1.(1)第一答案 / 【分析】第一题解法`，conflicts 为空。

同号两次 `1.(1)…【分析】…` 也合成一个解析，不产生冲突。**已知错误/不确定的新题头不能退化成普通正文**。修复应有明确的边界候选状态、冲突区间及原文保留，而不是再加 `continue`。

证据：`local-run-artifacts/diagnose-2026-10-19/handoff-probes.json` 中 backwardsMultipart、sameNumberMultipart；可运行同目录 `handoff-probes.cjs` 离线复现。

### R04 / P1 / 已复现：结构块不是权威边界，解析器会重新发明题号

同一 probe 的 unknown：题目只有1、2，supportBlocks 仅有1，内容包含 `99.【解析】其他试卷解法`；parser.solutions 仍生成99，conflicts 为空。backward 中块只有2，输出却有2和1。

位置：`qisi-support-text-parser.js` 的 supportBlocks 分支，将块重组为字符串后递归纯文本扫描；allowedQuestions 主要约束 answers，没有构成所有字段的范围约束。

已证明解析器越界输出，**尚未证明99进入正式题库**；下游可能拒绝/收集 unmatched，但这不修复来源身份丢失。

修法：每个结构块内只提取字段内容，不重新解释顶层 questionNumber；所有答案/解析声明携带 source/range/parentBlock，允许范围校验一致。

### R05 / P1 / 已复现输入歧义：括号大题与括号小问仍未统一解决

输入 `(1)第一大题 / (1)第一小问 / (2)第二小问 / (2)第二大题` 得到1、1、2、2。当前样式启发式只解决了普通数字父题下的括号小问。不可通过凑连续编号猜修；优先用 Word numId/ilvl、段落结构、章节语境，证据不足则保留歧义。

### R06 / P1 / 已知剩余：DOCX 公式失败仍需分层诊断

佛山第16题两个 MTEF 关系未转换，答案留空是正确的安全结果，但功能未全完。`qisi-docx-formula-source.js:70–95` 原生批量转换 catch 会清空 nativeRows，外层仍可能只看到 JS reader 的 unresolved code，原生服务失败原因不够明确。

待验证：是源 MTEF/预览冲突、MT6 依赖、返回缺项、转换器失败，还是某批错误清掉先前成功批；不能预先认定 Windows 服务故障。按关系 ID 保留原始公式、每项结果和批次原因；不能转 OCR 兜底。

### R07 / P0 / 代码确认：MinerU 尚无 canonical draft/资产生产适配

Segmenter 输出 stemBlocks/solutionBlocks/figureBlocks、type 常为 null；BlockOwnership 图片是 path/sourceId/assetId，不是现生产 `[[IMAGE:id]]` 和持久化图片记录。直接把其输出塞进现 bridge，不能保证类型、选项、来源、图、审核、正式入库都闭合。

必须新增一个聚焦的 production adapter，消费已验证结果；不能在 app.js 再写分题/对齐/取图算法。既有块算法不应重新复制一套。

### R08 / P0 / 当前代码确认，历史已模拟：图片用 latest job 回退可能串源

`qisi-mineru-client.js` pickJob 缺 job 时选最新任务；readImage 依赖这个行为。多个源都有相同相对资源路径时，缺失身份可能取到另一份文档图。

修法：显式 sourceId + 完整资源路径 + job 关联；缺身份即拒绝。拒绝是领域约束，不是乱加防御逻辑。

### R09 / P1 / 代码确认：内存图片缓存与草稿寿命冲突

MAX_JOBS=3、TTL=30分钟，清理在 remember；第4个任务可淘汰第1个，重启全部丢失。当前没有把图片可靠搬进草稿/正式资产生命周期的正常 UI 实现。

先将图片字节及来源持久化，事务提交之后才能认为导入可恢复。job 只能是临时传输句柄，不能是用户资产主键。不要单纯把缓存数改大。

### R10 / P1 / 代码确认：超时不是端到端，未知任务受理不可恢复

timeoutMs 主要约束轮询循环；申请、PUT、下载及挂起 fetch 没有统一截止。上游 batch_id 只在函数局部，成功后才 remember；失败/重启没有持久化回执恢复路径。

设计单一任务状态机和端到端 deadline；GET 查询可在预算内重试，创建/上传在受理未知时不得自动重发。先保存 request identity / batch_id /阶段再继续。网络失败不能直接归因为速博士或连接重用。

### R11 / P1–P2 / 静态确认、未破坏性测试：页数/ZIP 边界不完整

- server estimatePdfPageCount 用字节正则数 `/Type /Page`，不是压缩对象/页树的可靠页数上限。
- ZIP 同名目录项覆盖、多份 content_list 按短路径择一；没有完整 CRC/解压长度/总量边界。不要猜选来源文件，也不要现写一套更大的 ZIP 框架。

优先复用已存在、已审查的读取能力；若保留最小实现，声明支持子集并测试边界。禁止下载大文件或解压炸弹做生产试验。

### R12 / P1 / 既有证据：可渲染公式仍可能 OCR 漏字

10月18日原页审计记录深圳第19页内容漏失；KaTeX 成功不能证明公式正确。部分旧 compare 脚本又有硬编码预期/语义修正建议，不能当真值。

本轮没有重新逐页视觉确认；这是必须复核的内容质量风险。原图、原始块、字段审核状态要保留，不能按数学常识补写原文。

### R13 / P1 / 已证实：测试把“路线注入成功”当成“默认入口成功”

engine injection 开启旧配置；真实 DOCX 版式缺少回归；旧单一 owner 测试还强制页面包含 PdfExternalProducer。修改后应建立“默认入口不改配置”的测试，以及“只 mock 外部 I/O，不 mock 分段/投影/保存”的集成测试。

不能删除失败断言来变绿；旧执行器退役时，应迁移仍有效的安全行为测试，只有专测废弃外部协议的用例才随实现退役。

### R14 / P2 / 已复现并部分修复：审核测试误报导航

旧用例用 page.evaluate await `markDraftReviewed`，间歇报 `Execution context was destroyed`。协议日志真正错误是 `Promise was collected`，没有导航事件；随后同一页面读到 reviewed、dirty=false、toast“已标记为确认”。因此不应给业务保存函数加重试。

已改为真实按钮+持久化等待，当前针对性测试与最新全量该用例通过；未做长期稳定性证明。证据：review-protocol.log、trace-review.log。

### R15 / P2 / 当前确定失败：新 PDF E2E 的定位器歧义

`tests/e2e/production-pdf-configuration.test.js:24` 的 `getByText('批量录题', exact:true)` 同时命中 button 和 h1。应在 Sol 实施时改为语义按钮定位；不能因此删掉默认配置、错误回读和零外部请求断言。切换 MinerU 后，将此用例改为新链路未配置能力的验证，不继续断言旧 enabled=false。

### R16 / P1 / 待场景验证：重识别、人工改动与版本身份

NormalUiImportController 的 requestId 基于 batch sourceVersion/draftPersistence；PDF 不复用 committed request。新 MinerU 任务若简单沿用此行为，会重复上传或覆盖人工改动；若改成永远复用又可能忽略源文件变化。

实现前验证：相同源 SHA、角色、页范围、解析版本的结果可复用；不同输入不得复用；同一次未知受理只能查询；submitted/人工编辑草稿及资产闭包必须保留。不能只用同一题号当跨版本身份。

## 6. 设计建议：单向数据流、一个生产入口、清晰的最小职责

### 6.1 目标数据流

```text
正常 PDF UI
 -> 明确源清单/角色/范围/源版本
 -> 本地 MinerU 任务服务（回执、取消、截止时间）
 -> 原始内容与资产快照（保留 bytes/hash）
 -> 已有唯一规范化块 / 派生片段 / 序列与归属验证
 -> PDF production adapter
 -> 与提供商解耦的 canonical review draft + evidence + asset refs
 -> 现有统一持久化、审核、正式准入、导出
```

DOCX 继续独立的本地提取链，只在已有内部草稿/仓储接口汇合。不要让 DOCX 调 MinerU，也不要把旧 Qwen 作为失败回退。

### 6.2 内部协议先于接线

应先定义以下事实，并复用现有对象，避免为了“架构漂亮”创建十几个模块：

- SourceIdentity：导入范围、文件 ID、SHA256、format、roles、page selection；文件名只显示，不当身份。
- ExtractionEvidence：原始响应/原文引用、引擎/协议/算法版本、提交回执、归属状态；OCR 与确定性分段是不同轴，不能把 MinerU 写成 deterministic source text。
- FragmentIdentity：sourceId + 原块 ID + UTF-16 半开范围；parent/source 坐标不可丢。
- FieldDecision：missing / accepted / ambiguous / conflicting / rejected；值、候选、原因、证据分别表达。人工裁决另有版本和操作记录。
- AssetIdentity：sourceId + 完整 ZIP 路径及字节摘要；临时 job 只用于取回，不进入长期展示引用。
- CanonicalDraft：沿用题目字段、source、producer、fieldProvenance、warnings、图片关联、version；新生产者有真实 routeId，不能伪装为旧 external route 通过门禁。

协议示意不是要求整库迁移。Sol 应列出最少必须改变的字段及所有消费者，优先通过显式适配接入现有 schema。

### 6.3 DOCX 分段算法修复要求

1. 章节、段落和编号结构产生唯一边界候选流，保留原始段落坐标、Word numId/ilvl 与字面分隔符。
2. 先判层级和章节，再验证主问题序列；禁止用 expected 恰好命中证明模糊步骤就是题头。
3. 对合法边界开启新块；对重复、倒序、未知且有题头证据的边界，形成歧义/冲突区域，绝不默认拼进上一题。
4. 同号独立声明进入证据集合，不能去重成一段文本。按来源范围区分同一次抽取重复与真实多声明。
5. support parser 消费 block 的已确定身份；内部只找答案/解析标签，不再扫描其他大题身份。
6. 不确定区域保留全文并允许人工审核；错误字段不自动附着。正式准入不因“可进入审核”而放宽。

算法评审需讨论：摘要答案表 + 后续逐题解析重复编号属于不同支持区；不能简单“见倒序就整文件清空”误伤合法格式。应以明确章节/表格结构形成独立区间，再归并同号证据；无章节证据时保留歧义。

### 6.4 MinerU 分段与字段投影

复用现有 MineruEvidence/Segmenter/Pairing 的来源与序列准入，不再复制规则。question/full/separate answer/separate solution 的字段权限必须先确定，冲突和正常值都不能越权。

模型归属不是必选生产阶段：确定性结构足够时直接使用；信息不足时保留待核查。若以后引入模型，仅能提供候选引用意见，不能越过来源范围/序列证明，也不能把隐含模型调用塞进“免费链路”。

选项要依据数学区域外的合法标签和原文范围投影，不把整块复制到 A/B/C/D；图片相同 basename 不能合并。type 不明确时待确认，不能按题号段猜题型。

### 6.5 任务与资源生命周期

最小状态：prepared -> submitting -> accepted -> uploading -> processing -> materializing -> ready；失败、cancelled、unknown 独立，状态跳转需带回执/原因。状态机归一个 owner，不在前后端各自维护互相猜测的版本。

- 已受理 job/batch_id 落盘后再继续后续步骤；未知受理不自动创建第二任务。
- 端到端 deadline 贯穿请求、上传、轮询、下载；取消可中断 sleep 和 I/O。
- ready 前取回并校验全部被引用资产；保存失败就不能报告“识别完成”。
- 使用已有 draftImages/images 仓储接口及事务边界，不直接写生产 IndexedDB。
- 清理只清临时任务资源，不能清理仍被草稿/正式题引用的资产。
- 同批次跨窗口锁与并发限制分工明确；不把全局串行化当稳定性修复。

### 6.6 审核与历史兼容

历史 pdfExternal/pdfV1 数据不能随旧执行器删除而失读。推荐**只读旧记录适配器**：将旧持久化结构投影到统一审核模型，保留原字段/证据，不触发网络、不重新解释题目、不重写全部旧库。

如果历史编辑/确认需要旧逻辑，先抽取必要的记录级行为与固定历史 fixture 验证，再删除旧 contract 的上游 schema/执行相关部分。不能把整个旧模块改名后继续作为暗中 fallback；这不算清理。

新 draft 的编辑、候选采用、图片确认、来源查看、字段人工凭证、正式准入应消费 canonical 模型；不要继续新增 `if(pdfExternal) else if(pdfMineru)` 到处扩散。

## 7. 旧链清理清单与禁止误删项

### 7.1 应退役的旧 PDF 执行链

- `qisi-pdf-external-producer.js`
- `qisi-pdf-external-provider.js`
- `qisi-pdf-page-evidence.js`
- `qisi-pdf-multimodal-producer.js`（已不在 main 加载，但仍在仓库/测试/登记中）
- qisi-config 中旧 pdfExternal 模型、价格和启用开关；确认无非旧链消费者后删除。
- main 的旧生产者/提供商加载，app 的 executor/createProducer 接线，专属研究/付费脚本默认可执行入口。

不是立即按文件名全删：先完成替代链在隔离环境的契约与 UI 验证；最终同一切换步骤移除旧执行入口，禁止两条正常 PDF 生产路线共存或运行时回退。

### 7.2 需先解耦再清理

- `qisi-pdf-external-contract.js` / `qisi-pdf-multimodal-contract.js`：外部协议与历史审核读取混合，先拆出必要兼容逻辑，不能直接删。
- `qisi-docx-producer-identity-contract.js`：名字带 DOCX，但实际校验所有来源；新 PDF 身份需有显式受约束支持，不能全面放宽路由。
- `qisi-formal-admission-policy.js`：支持来源及 producerBoundary 校验必须跟新身份一致；不得删校验让测试通过。
- bridge/output/review-controller/normalization/UI：消除提供商协议判断，保留业务语义与历史读取。
- architecture 与 docs/architecture 两套登记、脚本/测试引用：同步删除 retired execution owner，新增最少必要新 owner；不要只改文档声称完成。

### 7.3 不可一刀切删除

QwenVisionSourcePort、BatchEngineV2、DOCX vision 显式旧任务和其他单题识别消费者可能共享依赖。正常 DOCX 是 deterministic，不等于仓库中所有 Qwen 代码都是 PDF 独占。必须先列出实际 caller 再决定独立清理范围。

不可删除 `.workbuddy/`、`local-run-artifacts/`、`tmp/` 中原始证据、真实素材、旧授权账本、生产数据库、vendor/node_modules。清理历史报告不是本任务目标。旧安全 fixtures 要迁移，不能为了减少失败数全部删除。

## 8. 给 Sol 的实施路线（每步有明确退出条件）

### S0：接管与冻结基线

读本文、AGENTS 必读文件、当前任务及实际 git diff。保存 status、diff-stat、关键文件 hash 和测试结果。建立新任务范围，明确当前 dirty 已授权保留。先修复 R15 的测试定位器，证明其余断言原样成立；运行一次门禁建立可比较基线。

退出：知道哪些代码已改、哪些测试是真失败；没有 reset/stash、没有外部调用。

### S1：固化反例与错误可观测性

把 handoff-probes 的 R03/R04/R05 变成正式失败回归；补默认入口与 MinerU 未配置/上游错误的 UI 测试。统一安全错误结构及展示，清楚区分失败阶段。保留当前安全 causeCode 增量，评估是否改成结构化字段。

退出：问题可复现，真实原因不会被包装抹掉；不靠修改期望变绿。

### S2：独立修复 DOCX 边界所有权

实现第6.3节算法，重点修掉倒序/重复被吞并与二次猜题号。复审公式未转换的诊断。运行完整 DOCX、题答分文件、仅题目、编号/小问/表格变体测试及佛山真实离线 UI。

退出：R03/R04 无错挂，R05 歧义明确；原19题成功样本不退化；第16题未解决则仍有明确证据和待审状态，不伪造答案。

### S3：定义 PDF canonical 边界与旧记录适配

列出身份、字段 provenance、选项、资产、审核/入库消费者；用新 canonical fixture 与历史 fixture 双向验证读取/编辑/确认/准入。尽量复用现有层，不做大框架迁移。

退出：新 route 无需伪装旧 route；历史数据可读，正式校验不放松；app 不增加解析业务。

### S4：补齐 MinerU 任务/资产闭环

先修 job/latest 身份、端到端超时、已受理回执、图片落盘，再接 adapter。全部先 mock I/O：第4任务、重启、断网、取消、上传受理未知、相同图片路径不同源、图片保存失败等。

退出：已引用资源与草稿可重启回读；重试不重复提交；错误有阶段；无隐式模型回退。

### S5：MinerU production adapter 与页面切换、旧链退役

适配已有分段/准入输出，接 bridge 的单一 PDF port；app 仅替换工厂与传参，预计只限原 PDF 接线、审核投影委托和证据保存映射。main 只做必要加载替换。

同步删除第7.1节旧执行代码和专属配置；第7.2节按已完成适配消除引用；迁移测试和两套登记。正常 PDF 只剩一个入口。

退出：不改生产配置的 UI 测试从上传到 review 成功；所有旧执行入口不可达且可删；未配置 MinerU 明确报原因，不启动 Qwen。

### S6：真实材料与视觉验收

先离线重放历史原始 MinerU JSON/ZIP，仅替换外部 I/O；用真实 PDF 文件走正常 UI，不能直接灌最终 drafts。上传 SHA 与回放响应 source SHA 必须一致，避免回放错卷。

然后在获得适用的当前外发授权后才做真实在线整卷；用户要求全局模式，不能偷偷改代理。至少覆盖深圳、河北、十二校、题答分文件及佛山 DOCX；每份有题号/答案/解析/公式/图/未归属清单，视觉标注原页。内容不确定不做自动修正。

退出：明确结构通过与内容通过的范围，审核/编辑/确认/刷新/重启/导出及隔离正式入库闭环完成；不操作用户正式库。

### S7：最终独立复审与交付

审查新调用图、旧引用、状态重复、原始证据守恒、人工编辑保护、DOCX 隔离、性能。运行全部 gate，输出关闭清单、尚未解决项、文件改动和测量值。没有用户新授权不 commit/push/部署下一阶段。

## 9. 必须具备的验收矩阵

| 层级 | 必验内容 | 不合格信号 |
|---|---|---|
| 默认入口 | 不注入生产配置，按钮上传/重识别；能力缺失能定位 | mock 配置开关后才通过 |
| DOCX 结构 | 空段落、numId/ilvl、普通/括号大题与小问、数字开头题干、答案表及重复区段 | 漏题、重复主键、步骤当题目 |
| 支持归属 | 顺序/缺号/重复/倒序/未知号/题答不一致；角色先于聚合 | 不确定题头被吞为前题正文 |
| 证据代数 | 声明排列、重复、分文件拆分不变；冲突不复活 | 第三份覆盖冲突，正文子串当去重 |
| 来源范围 | 所有字段引用属于该源/角色/题范围；片段重组可回溯 | 合法 ID 跨题使用、supportBlocks 被重扫 |
| 资产 | 同路径不同源、第4任务、重启、缺 job、下载/保存失败、正式导出 | 读 latest、重启后只剩临时 URL |
| 生命周期 | 取消/端到端超时/受理未知/只读恢复/跨窗口/重识别 | 失败后隐式重发或改走旧服务 |
| 审核 | 真实按钮、字段保存、未保存保护、人工采用、问题解释 | 只 await proxy 不看数据库 |
| 入库 | 缺失/冲突允许审核但不越过正式准入；submitted资产闭包 | 为新route跳过 provenance |
| 历史数据 | 旧 pdfV1/pdfExternal fixture 可读/编辑/人工确认，不调用旧服务 | 清理导致历史草稿打不开 |
| 内容视觉 | 所有页有覆盖清单；公式/表/图片来源核对 | 题数19或KaTeX通过即声称准确 |
| 性能 | 分阶段计时；N/2N/4N输入趋势；内存峰值和请求数 | 没有基线即“最优”“更快” |

默认验证命令（以当前 package.json 为准，不照抄旧文档的组成）：

```powershell
git status --short
git branch --show-current
git log --oneline -10
npm.cmd run verify:safe
npm.cmd run verify:batch-safety
node scripts/verify-runtime-modules.js
node scripts/verify-app-shell-architecture.js
git diff --check
```

本版 verify:safe 实际为 `verify:no-real-ai && check && test && verify-write-boundary`；测试失败则后面的 write-boundary 不会执行。batch-safety 另跑。环境普通沙箱曾报 spawn EPERM；在受控隔离测试提升权限后可运行，不应因此改业务代码或绕过门禁。

## 10. 交接时验证结果——当前不是全绿

| 时间/范围 | 结果 | 解释 |
|---|---|---|
| 前次 DOCX 修复后 verify:safe | 2009/2009 通过 | `verify-safe-docx.log`；有限测试集合 |
| 再次完整 gate | 2008/2009 | review proxy Promise collected 假导航错误 |
| 审核旧测试重复5次 | 3通过、2失败 | 已用 CDP 与真实 DB 证明错误性质 |
| batch-safety | 通过 | `verify-batch-safety-docx.log`，不是 MinerU 在线验收 |
| 本轮三个针对性测试文件 | 10通过、1失败 | R15 定位器；审核和 status 单测通过 |
| **交接时最新 verify:safe** | **2010通过、1失败，共2011；退出1** | **仅 R15：批量录题同时匹配 button/h1**；日志 `verify-safe-handoff.log` |
| 最新只读诊断反例 | R03/R04/R05 已复现 | `handoff-probes.json`；尚未加入正式 gate |

**即使 Sol 修掉 R15 后所有2011项通过，也不能声称 R03/R04 已修——反例还没进入正式测试集合。**

本轮未新跑 batch-safety 于最后几项状态/测试改动后；旧成功记录不得当最新全量闭环。当前没有 commit，不能提交红门禁代码。

## 11. 工作区改动与证据索引

交接前 tracked diff：29个文件，546新增/428删除；此统计不含未跟踪文件。以后增量会改变，Sol 需重新取 git status。没有任何旧 PDF 删除操作。

### 11.1 已修改的 tracked 文件

```text
app.js
architecture/layers.json
architecture/owners.json
architecture/runtime-modules.json
docs/architecture/layers.json
docs/architecture/owners.json
main.html
package.json
qisi-batch-importer.js
qisi-docx-producer-identity-contract.js
qisi-draft-maintenance-service.js
qisi-handout-formula-gate.js
qisi-import-validation-service.js
qisi-library-service.js
qisi-production-docx-source-port.js
qisi-production-import-bridge.js
qisi-production-import-output-port.js
qisi-production-import-status-port.js
qisi-storage-repository.js
qisi-support-text-parser.js
qisi-utils.js
scripts/verify-write-boundary.js
tests/e2e/review-draft-command-ui-recovery.test.js
tests/import-validation-service.test.js
tests/merge-determinism.test.js
tests/production-import-bridge.test.js
tests/production-import-status-port.test.js
tests/qisi-app-display-cleaners-r3-ownership-audit.test.js
tests/support-ambiguity.test.js
```

未跟踪重点：`.workbuddy/`（历史用户内容）、`qisi-support-evidence.js`、`tests/audit-class-repair.test.js`、`tests/audit-support-review.test.js`、`tests/e2e/production-pdf-configuration.test.js`、本次/前轮 ai 报告。不要遗漏新模块导致新窗口只看 git diff 得出错误结论。

### 11.2 首先应读的报告

1. 本文——最新停止点与执行要求。
2. `ai/DOCX_REAL_IMPORT_REPAIR_2026-10-19.md`——实际DOCX修复；其中“导航异常”的初步解释已被本文 R14 的协议证据更新。
3. `ai/AUDIT_CLASS_REPAIR_RESULT_2026-10-19.md`——前一轮F01–F12改动与复审。
4. `ai/REPORT_CODE_AUDIT_2026-10-19.md`——前一轮原始反例；不能当成所有问题仍未修。
5. `ai/MINERU_UNIFIED_REPAIR_REPORT_2026-10-18.md`、`MINERU_UNIFIED_ALGORITHM_2026-10-18.md`、`MINERU_BLOCK_PROTOCOL.md`——当前 MinerU 算法合同及未上线边界。
6. `ai/MINERU_ASTRA_AUDIT_HANDOFF_2026-10-18.md`——历史24项审计；A/B/C部分后来已修，D/E网络资产问题多仍存在，逐项对代码核验。
7. `ai/CLEANUP_SURVEY_2026-10-18.md`——历史清理盘点，统计随代码变化，不可照表盲删。

### 11.3 关键运行证据

所有路径相对工作区，位于 ignored 的 `local-run-artifacts/diagnose-2026-10-19/`：

- `verify-safe-docx.log`：早先2009全过。
- `verify-safe-docx-final.log`、`review-recovery-repeat.log`：间歇错误。
- `review-protocol.log`：CDP `Promise was collected`；仅隔离测试数据。
- `trace-review.cjs` / `.log`：报错后页面未导航、保存已完成的复现。
- `verify-safe-handoff.log`：最新2010/2011红门禁。
- `verify-batch-safety-docx.log`：此前稳定链结果。
- `handoff-probes.cjs` / `.json`：本轮新反例，直接运行，不依赖真实文件或网络。
- `handoff-worktree-manifest.json`：交接时分支、HEAD、tracked 改动及新增业务/测试文件的 SHA256；用于发现新窗口开始前的代码漂移，不包含密钥或用户材料内容。
- `edge-profile-docx-multipart`：真实DOCX最终隔离验收副本（含本地用户材料，只本地保留，不上传）。

更早 MinerU 已保存原文/ZIP/边界核验参见：`local-run-artifacts/mineru-unified-2026-10-18/boundary-reviews.json` 及相应报告所列 replay 路径；先核验文件存在、SHA与当前源一致，不能套用另一个快照。

## 12. 权限、成本、代理与不可推断事项

- 已授权：保留现有修改；本地读代码、离线诊断、隔离测试；用户希望后续修复根因和清理旧链。但本轮最后指令是先交接。
- 未授权自动执行：在这份交接后立刻进行新在线试卷上传、使用旧Qwen预算、清用户数据库、批量正式入库、改代理模式、安装依赖或提交/推送。
- 历史深圳付费授权是具体文件/hash、endpoint/model、次数/金额、失败即停轮次；不能转换成 MinerU 任意材料上传授权。MinerU“免费”是用户历史体验，本轮没有核验当前商业条款，不作费用保证。
- 速博士为用户实际软件；用户要求保持全局模式。先检查生产网络适配的真实证据，不再把更换代理模式当万能解决。
- 默认本地测试对外部 AI/OCR 阻断。现浏览器 harness 只阻断 `/api/ai/**`，**接入 MinerU 时必须同时阻断/精确mock `/api/mineru/**`，否则新 UI 测试可能意外真实外发。** 这是 S1/S5 的前置门禁，不能后补。
- 不需要用户再次确认普通可逆代码修复；真实新增外发需按任务具体范围判断授权并准备确切源清单，不能从本文件虚构授权。

## 13. 新窗口给 Sol 的开场指令（可直接复制）

> 请先完整阅读 `C:\Users\Administrator\Desktop\题库系统\ai\SOL_COMPLETE_HANDOFF_ROOT_CAUSE_AND_REPAIR_2026-10-19.md`，按第0节用户要求执行。先核对当前工作区与交接证据，保留现有 dirty 修改，不 reset/stash，不碰生产数据，不调用真实 AI/OCR。当前正常 PDF 仍是关闭的旧 Qwen 路线，MinerU未接UI；DOCX真实19题通过但已发现倒序/重复支持边界仍会错挂；最新门禁2010/2011，失败是新测试定位器。请先确认根因和最危险耦合，给出严格的算法与复杂度论证，再按路线分步修复，最终以真实默认页面、真实文件、资产重启回读和视觉验收证明。清理旧执行链，保留历史数据的受控读取，不新增隐式回退；不要按某张卷子特判，不用防御性堆代码，不把测试全绿等同于问题全部解决。在线验证如需新增外发，在准备好具体材料与预算后再核对授权。

本文交付后，原窗口停止实施。新窗口应在用户明确要求开始后执行 S0–S7；本文是设计与证据交接，不是“已修完”的报告。
