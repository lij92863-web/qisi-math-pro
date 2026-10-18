# MinerU 链路问题审计与 Astra 交接

日期：2026-10-18。仓库：`C:/Users/Administrator/Desktop/题库系统`。

## 0. 当前指令与停止点

用户最新指令：“你先把所有问题都认真识别出来，先总结好，再统一一起修改”，随后明确：“整理好就停下来，我让 astra 来改”。

**本轮在交付本文件后停止，不再修改业务代码。Astra 应先读问题清单，再统一设计和实施，不能照着某一道题补正则。**

本文区分已修复且验证的缺陷、当前代码仍可复现的问题、尚未完成的产品接入、需要重新核实的历史判断。有限样本和代码审计不能证明不存在其他缺陷。

不自动向其他聊天发消息，不创建新聊天，不提交、不推送。没有修改生产数据库、源 PDF、系统代理、`.env`、`app.js` 或正式导入页面。旧 Qwen 付费测试授权不用于新测试；本轮修复验证和下述模拟全部离线，没有真实 AI/OCR 调用。

## 1. 结论与根因

MinerU 值得保留。六份真实 PDF 的速度、文字、表格和题图识别表现支持继续使用。当前风险集中在识别后的证据、归属、资源和准入契约，另有少量真实公式内容丢失。

不能用“19 题、19 段解析、公式都能渲染”替代整条链路的验收。这几个指标不能证明：解析没有串题、四个选项没有被复制成相同文本、答案没有内部冲突、图片在第 4 次导入或重启后还能取到、公式没有漏字。

共同根因有五类：

1. **数据模型缺少统一身份和来源。** 原始项、显示块、派生片段、题目字段、图片资源之间没有一份贯通的协议；转换、服务端响应、预览和入库候选各自处理一次。
2. **把格式检查误当成归属证明。** 知道某个 ID 存在、题号在集合内，并不能证明该块属于该题；章节、步骤、题号和选项边界也不能仅靠看见数字/字母就确认。
3. **诊断与准入脱节。** 一条路径开始消费 issues 并阻止绑定，另一条旧模型归属路径仍把 issues 当备注，产生两套安全标准。
4. **资源生命周期只覆盖一次解析。** 临时 job 和文件 basename 被当作长期图片身份，没有落实到草稿/正式题库所需的资产生命周期。
5. **验收口径混用。** 文件返回成功、分段成功、字段正确、正式 UI/持久化成功是不同阶段；语法正确也不等于数学内容正确。

## 2. 交接时的代码状态

分支：`stage/program-c-corrective-r1`。HEAD：`85441f5`。本轮没有 commit。

开始前工作区已经不干净，用户明确要求保留 DeepSeek 的已有修改并继续修复，不能 reset/stash 或把现有 diff 当成全部由本轮产生。

开始前已修改：`qisi-block-ownership.js`、`qisi-mineru-client.js`、`qisi-paper-segmenter.js`、`tests/block-ownership.test.js`、`tests/mineru-segmenter.test.js`。

开始前已有未跟踪内容：`.workbuddy/`、`ai/CODEX_TASK_MINERU_BATCH_ACTUAL_2026-10-18.md`、`ai/HANDOUT_DESIGN_2026-10-18.md`、`qisi-paper-pairing.js`、`scripts/compare-mineru-vs-gold.cjs`、`tests/paper-pairing.test.js`。讲义设计和 `.workbuddy` 与本次修复无关，不要顺手改。

本轮已修改的业务及验证文件：

| 文件 | 已做的工作 |
|---|---|
| `qisi-mineru-client.js` | 保留原始 content_list、caption/footnote、origin；非法页码拒绝；基础 ID 稳定；严格解析答案表 |
| `qisi-paper-segmenter.js` | 数学区域掩码、统一编号、支持材料边界、无损片段、完整索引、序列准入、章节前导材料归属 |
| `qisi-paper-pairing.js` | 两文件 ID 命名空间、消费准入结果、区分 matched 和 paired |
| `qisi-block-ownership.js` | 仅在已有修改上增加 caption 的 parentId 传播；**没有完成旧归属路径的安全重构** |
| `qisi-block-ownership-prompt.js` | caption 的 parentId 传播；其他问题仍在 |
| `scripts/build-mineru-preview.cjs` | 仅改为从组装结果 blocksById 取 stem 引用；其重复转换逻辑仍在 |
| `architecture/runtime-modules.json` | 将已有 pairing 登记为 dormant，没有启用生产路线 |
| `tests/mineru-integrity.test.js` | 新增 11 组完整性/变形/反例测试 |
| `tests/mineru-segmenter.test.js`、`tests/paper-pairing.test.js` | 保留坏例，改为冲突/错序时不得绑定；不是删除失败用例 |
| `ai/MINERU_BLOCK_PROTOCOL.md` | 记录附加协议、来源和绑定规则；**服务端尚未完整实现新协议** |

设计和授权范围见 `ai/CODEX_TASK_MINERU_INTEGRITY_REPAIR_2026-10-18.md`、`ai/MINERU_INTEGRITY_ALGORITHM_2026-10-18.md`。后者是本轮已实施算法的说明，**不代表以下待修项都已解决**。

修复前副本及 SHA256：`local-run-artifacts/mineru-repair-2026-10-18/before/`。交给 Astra 的冻结业务文件 hash：`local-run-artifacts/mineru-repair-2026-10-18/frozen-for-astra.json`。收到“整理后停止”之后未再改业务文件。

## 3. 已修复且有证据的缺陷

| 编号 | 原问题与根因 | 当前状态及验证 |
|---|---|---|
| F01 | 只复制 text/image/table_body，已识别出的 caption/footnote 被删 | 原项完整保留，附属文字变成带 parentId/origin 的 text；真实七处 caption 均恢复，包括 C、甲/乙 |
| F02 | `1【答案】B` 不符合旧 `数字+点` 语法 | 统一支持明确答案标签及全角数字；真实独立题答从 0/12 到 12/12 |
| F03 | 把块边界等同于题目边界，同块中的下一题被并入前题 | 支持有明确答案结构的内部候选；河北 17/18 分开，深圳 15/16 分开 |
| F04 | 拆出 `#0/#1` 后仍只交原始索引 | 片段有原始 ID 和绝对范围，输出包含原始块及片段的 blocksById；所有公开引用可解析，片段逐字拼回原文 |
| F05 | segmenter 报重复/倒序/缺号但 assemble 仍建 last-wins Map | 该路径先验证再建立映射，异常时答案/解析引用为空；坏例和变形测试覆盖 |
| F06 | 两个 PDF 都有 p1b0，合并可能覆盖 | pairPapers 使用 question/ 和 support/ 命名空间，同时转换 parent/source 引用 |
| F07 | 答案表删去非数字，把 1-2 当12；错误表被 null 吞掉 | 明确区分不存在与非法；列数、空答案、重复、跨表冲突均拒绝；双空单元格才是填充 |
| F08 | 答案区表格/标题残留在最后一题题干 | 章节头与重启前紧邻答案表、附属文字进入 solution preamble；三张整卷最后一题已复查 |
| F09 | 缺失页码默认为第一页，末页只有页码时页数缩水 | 非法 page_idx 拒绝，页脚虽不显示仍参与页数并保留原始证据 |
| F10 | matched 被当作已安全配对；空输入也可能宣称成功 | paired 只计实际允许附解析的题；空题目/非法 expected 序列不通过 |

以上是修复范围内的结论，不是“全系统已无问题”。下面这些问题在交接代码上仍存在。

## 4. 待修问题：已复现或代码直接确认

优先级：P0 表示接入正式候选/入库前必须解决的错挂或证据完整性问题；P1 表示影响可靠性、漏识别、资源或验收的问题；P2 表示其他输入契约/维护问题。dormant 模块的问题当前不等于已污染生产数据。

### A. 两条归属路径的安全标准不一致

**A01 / P0：旧 assembleExam 诊断后仍输出答案、解析。**

位置：`qisi-block-ownership.js:285`。输入两条题号1、expected=[1,2]，输出两个题号1的 draft，二者都带 A 和“第一题解析”，只有顶层 issues 写重复和缺号。它没有调用 validateOwnership，也没有消费序列失败状态；倒序没有完整检查。

证据：`audit-for-astra.json` 的 `OWN-duplicate-still-assembled`。先前测试明确要求“缺号/重号只报告”，现状测试绿色也不能证明安全。

算法要求：两条路径共享同一编号/来源准入结果；任何入口都不能绕过准入直接附支持材料。保留原始候选、诊断和可复核题干，但不能把“带 issues 的错挂结果”当成可写入结果。

**A02 / P0：模型返回的题号只做集合检查，没有来源归属验证。**

位置：`validateOwnership`。将题1的 solution 改成题2块、题2改成题1块，全部 ID 都真实存在，仍返回 valid=true；题号[2,1]也返回 valid=true。

证据：`OWN-cross-question-reference-accepted`、`OWN-backwards-accepted`。模型能引用一个真实 ID 不等于归属正确。

算法要求：模型只能在软件已经建立的来源/题号候选范围和 phase 权限内标注字段。不能仅信 `question_no`，不能按语义相似度重挂。无法由印刷编号和来源证据确定的范围进入人工核查。

**A03 / P0：索引和缺块错误没有贯通到准入。**

位置：`blockIndex:25`、`assembleQuestion:191`。数组中的同名块直接 Map.set，后者覆盖前者；题干/答案引用 missing 时，只报 issue，还能用 answerTable 补出 A，并保留解析。

证据：`OWN-duplicate-block-overwrite` 保留 second；`OWN-missing-reference-still-answers` 输出空题干+A+解析。要求统一唯一索引和引用闭合验证，禁止下游自行重建“容错索引”。

**A04 / P1：模型 schema 和 phase 校验不完整。**

`validateOwnership` 接受只有 `{question_no:'1'}` 的题，没有必填 type/stem 等；option label 没有限定有效集合；没有落实 prompt 宣称的 questions/solutions 字段权限。`parseOutput` 甚至接受没有 protocol 的 `{questions:[]}`。

证据：`OWN-missing-fields-accepted`、`PROMPT-missing-protocol-accepted`。需要一份按 phase 定义的 schema；parseOutput 做 JSON 解析，统一 validator 执行完整契约，不能各放宽一半。

### B. 分题、选项和答案证据仍有边界

**B01 / P0：同一题内部的两处明示答案冲突尚未聚合。**

位置：`answerStatedInSolution:201`、`assemble:217`。输入头 `1【答案】A`、正文 `【详解】…故选：B。`，输出 valid=true、answer=A、完整解析、issues=[]。当前只检查“表 vs 头”，没有检查“头 vs 正文声明”。

证据：`SEG-conflicting-explicit-evidence`。设计应将原文答案声明收集为证据集合，输出 absent/agreed/conflicting/invalid；冲突不得用“头优先”静默解决，也不能让模型多数投票。答案表和模型意见冲突与两份原始证据冲突须区分。

**B02 / P1：题目侧同块多题仍可漏分且称 valid。**

位置：`segment:108`。默认 question 模式且未给 numbers 时不 expand，`1. 第一题题干\n2. 第二题题干` 只得到题1且 valid=true。支持材料内部切分的修复不能代表题目侧也已覆盖。

证据：`SEG-question-multiple-in-one-block`。应统一扫描所有角色的候选编号，再根据角色文法和来源结构决定；无法判定时标明“覆盖未确认”，不能依赖观察到的 min/max 宣称整卷完整。

**B03 / P1：章节重启依赖至少见过三种题号。**

`findAnswerBoundary:174` 中 `seen.size>=3` 使无标题两题小卷 [1题,2题,1A,2B] 无法分出答案区，最后安全拒绝但无法使用。证据：`SEG-two-question-combined-no-heading`。这是一条经验阈值，应以可验证的章节证据和整段序列约束设计，不能改成另一个特殊常数。

**B04 / 设计边界：步骤与顶层答案语法完全相同，纯文本不可证明唯一归属。**

`1. A\n解析步骤：\n2. (1) x=1 (2) y=2` 可以被当前语法当成完整两题且 valid=true。证据：`SEG-ambiguous-identical-nested-syntax`。这不是再加一个关键词就能根治的问题。需要保留原页/可靠层级证据，区分“满足文本语法”和“已确认归属”，无法区分时不得升级为确认状态。

**B05 / P0：旧选项组装会复制同一整块四次。**

`assembleQuestion` 中 options A/B/C/D 引用同一块，会得到四个完全相同的完整选项段，仅报告 options-shared-block。现有三组真实 fixture 也固定了这种行为，所谓“由上层切分”的集成尚未在 MinerU 正式路线完成。

证据：`OWN-shared-options`，以及 `tests/block-ownership.test.js` 的 real21/real4/real26。必须定义独立、可追溯的选项片段；只在数学区域外标号、顺序、唯一性和边界足够明确时切分。无法证明时保留原块供核查，不能复制四份伪选项。不能直接用任意 A/B/C/D 出现位置切几何正文。

**B06 / P1：截断可能删除题号和字段边界。**

`buildOwnershipPayload` 默认4000字，保留首尾，虽然会标 truncated，但中部 `2【答案】B` 消失后没有强制拒绝基于不完整输入产生的归属。模拟输入5007字，输出4026字，标记消失。

证据：`OWN-truncation`。本批六份实际结果没有超过4000字的单块，不能说真实六卷已触发此问题。应按可追溯片段和上下文预算分配，不任意截断证明身份的内容；truncated 不能只作提示。

### C. 内容与来源跨层传输存在缺口

**C01 / P0：新客户端保留的 evidence 被服务端响应丢弃。**

`qisi-mineru-client.js` 已返回 evidence；`qisi-local-server.js:869` 手工枚举字段，没有 `evidence:result.evidence`。因此离线直接调用客户端的测试通过，真实 HTTP 消费者拿不到新协议要求的完整原始项。这是本轮已改代码中的跨层未完成项，不能隐瞒。

建议用显式、测试过的解析响应适配器统一客户端与 HTTP 契约；不能只在本地 replay 里验证。需要 mock route 的返回字段测试，不用重传六份 PDF。

**C02 / P1：预览脚本仍有另一套有损转换和边界解析。**

`scripts/build-mineru-preview.cjs:18` 按全局序号生成另一种 pNbM、忽略 caption/footnote；`:54` 仍用 `/参考答案/` 找边界，另写答案表提取。仅改 stem 查索引还不够。

要求预览复用同一规范化、分章、答案表和引用索引；实际 replay 的验证脚本不是这个脚本，不能混称“正式预览已通过”。

**C03 / P1：分窗 API 与页码来源不一致，会静默丢块。**

`planWindows:63` 要求每块 `.page`，客户端只在 `.pages[].page` 给页码，直接 flatMap blocks 会全部无页码。传入一个无 page 的块会被 continue 丢弃。它还按 page 重新分组排序，与 ownership 文件注释“跨页合并块不能按页切”的要求冲突。

证据：`PROMPT-page-absent-silently-dropped`。应统一页内块/平铺块类型和唯一转换口，错误输入报明确契约错误；不能因缺页码就少一块。分窗按有序来源切片，保留可验证上下文和输出范围；MinerU 报告的页码不是跨页来源证明。

**C04 / P1：跨页来源和空壳仍需完整呈现。**

深圳真实结果含空 text p3b0/p12b0/p20b0，以及空 table p5b0；十二校有两个空 text。部分前页块已经含次页文本，但页码/bbox不能完整表达跨度。当前 segmenter 可以引用空表且 valid，不等于表内信息完整。

证据：`content-audit-for-astra.json`。原始证据必须保留；显示和计数区分空壳与有内容表格。不能只凭空块存在判断 OCR 漏页，也不能用不完整 bbox 再裁原页并宣称覆盖所有正文。优先保留原 ZIP 资产和原整页核查入口。

### D. 图片资产生命周期未闭环

**D01 / P0：basename 不是图片身份。**

`renderBlock`、figures 组装只留下 basename。`first/a.png` 与 `second/a.png` 产生两个同名 a.png，缺少原始路径/source/job；两个 PDF 也可能同名。没有足够信息确定取哪张。

证据：`OWN-image-path-collision`。要求资产身份至少区分来源文档和 ZIP 完整路径，引用贯穿草稿、预览、保存、导出；占位符不能成为唯一真实身份。

**D02 / P1：第四次解析使第一次的图片任务被淘汰。**

`MAX_JOBS=3`，remember 会删除最旧 job。四次 mock 解析后按第一份 job 读图得到 MINERU_JOB_NOT_FOUND。不是“多加一点缓存”就闭环；解析缓存与用户资产要有不同生命周期。

**D03 / P0：缺 job 时回退 latest，有取错文件的风险。**

`pickJob:447` 无 job 会选最新任务。模拟确认 readImage 未带 job 时返回 synthetic-4.pdf。路径相同的多文件场景可能串图；显式资源身份缺失应拒绝，不可猜最新。

**D04 / P1：TTL 并非读取时过期，且重启必丢内存。**

清理只在 remember 时进行；模拟 Date.now 前进31分钟，显式 job 仍能读取。进程重启后 jobs Map 全丢。TTL、缓存上限和草稿/正式图片持久化的产品约定尚未落实。

D02-D04 离线模拟见 `asset-audit-for-astra.json`，没有真实上传、没有触碰系统时间。

### E. 网络任务、输入限制与 ZIP

**E01 / P1：300秒只约束轮询循环，不能取消挂起 fetch。**

`apiRequest` 和上传/ZIP下载没有本地 deadline；while 只有 await 返回后才能检查时钟。因此外部不发 abort 时，挂起请求可能超过所称 timeout。此项由代码确认，本轮没有真的等待300秒制造挂起。

建议一条端到端 deadline 和明确 stage，所有 fetch 使用同一取消传播；GET 重试仍受同一 deadline。不要对提交/上传未知状态自动重发。

**E02 / P1：失败后的已受理任务缺少可恢复回执。**

job 只在完整成功后 remember；中途 batch_id、上传状态、轮询状态没有形成可供调用方恢复的生命周期证据。上轮真实测到 POST/PUT 连接重置，测试脚本另行保存回执和查询状态才确认 waiting-file，生产客户端没有同等恢复路径。

不要据一次连接错误断言“连接重用就是根因”。统一受理/上传/处理中/已完成/失败/受理未知状态；保存已得 batch_id，允许明确只读恢复，不把重新上传当恢复。

**E03 / P1：200页硬限制目前只是正则估计。**

`qisi-local-server.js:806` 对 PDF 原始字节匹配 /Type /Page，匹配不到返回0交给上游；压缩对象、对象流等不由此可靠计数。需要真正 PDF 页树/现有 PDF 读取器验证或明确上游限制契约，不能把估计称作本地强保证。此项为代码确认，未上传超限文件测试。

**E04 / P2：最小 ZIP 读取器缺少完整包一致性约束。**

`readZipDirectory/readZipEntry/findContentListEntry`：同名 entry 会覆盖；多个 content_list 只按路径长短选一份；没有校验 CRC、完整解压长度和总量。普通已保存ZIP都能打开，不证明异常ZIP也安全可判。

若保留自实现，需要明确支持的ZIP子集并做可验证错误处理；不能为“兼容”猜选来源，也不应临时堆出另一套大型ZIP框架。本轮是静态审计，未做破坏性/大内存测试。

### F. 公式准确性与源文件错误必须分开

**F11 / P1：LaTeX可渲染但原式内容丢失是真实存在的。**

深圳第19页 p19b3 只有 `${}^{2}(b^{2}/a^{2}+1)$`，p19b4 从 `+4-b²` 开始；原页的“由Δ=0得4λ²…−8λ…”未完整进入文字。已对照本轮源图 p19.png。代码分题和语法渲染不能补回这些字符。

处理一类问题的方向是保留原页证据、明确字段待核查/使用原图，并把“语法通过”和“内容核对通过”拆开。不能按数学常识自动改出一条看似正确的推导，也不能靠某题号专修。

**F12 / 待复核：历史 compare 脚本的某些判断不可靠。**

`scripts/compare-mineru-vs-gold.cjs` 包含手写 solutionDefects、固定旧目录/块下标和“按语义修正”的建议，不是自动准确率金标。

本轮重新查看深圳源图第15页：关于面积比分式“漏+”的历史结论没有得到明确视觉支持，不能当确定bug直接向公式中插入加号。该脚本的 claims 必须逐条重新比源图；尤其不能把其 expected 当原文。

第15页 `2/2、6/6` 及第16页 `4/2.5` 等另有源页本身印字压缩/重叠问题；不要未经再次核对就声称全部是 OCR 错误，更不能静默把源文改成解题者认为正确的公式。

数字在公式中以 `3 2`、`1 2` 等逐字符空格存在也不等于渲染错误。本批深圳12块、十二校7块、河北2块 equation 命中相邻数字空格，见 content-audit；不能全局删空格破坏其他数学语法。

## 5. 尚未完成的接入与验收

1. MinerU 客户端是 node runtime；segmenter/pairing/ownership/prompt 仍为 dormant。`main.html`、`app.js` 正式入口没有这些调用；服务端只有 parse/image。不能说用户正常导入界面已切成 MinerU。
2. segmenter 输出的是字段块引用，不是完整的 production typed draft；type 默认null，选择题选项未完成统一投影。它的19/19不是可直接入库的19道完整题。
3. 正常UI上传→识别→审核→编辑→确认→存储→刷新/重启后图片回读没有用 MinerU 完整验证。
4. 没有生产数据写入，没有commit/push，没有承诺对全部68页逐字符准确。
5. 尚未设计统一模型归属执行器、窗口合并准入和图片持久化；不能为“接好流程”直接在 app.js 增加大片业务逻辑。
6. 上次真实测试的成功适配器使用独立 Node HTTPS 连接，现业务客户端还是 fetch。成功结果说明实际服务可用，不证明所有生产网络稳定性问题已修复。

这些是产品/阶段缺口，需要明确下一阶段任务边界；不应在一次修复里顺手改 DOCX、数据库表结构、系统代理或旧Qwen链路。

## 6. 建议 Astra 统一实施的算法与顺序

### 第一步：冻结输入与协议，只保留一个转换真源

定义 Source → NormalizedBlock → Fragment → ValidatedOwnership → Draft 的单向数据流。每层显式交付来源/索引/状态；预览、HTTP响应、归属和测试共用。

资产身份与文档身份从开始建立：文档 hash + 原项位置 + 原始资源完整路径；不要用数组位置、basename、latest job 做替代。不同文件的“都是题1”只表示编号相同，整卷关联须来自用户选择/明确导入身份，不能从题意猜同卷。

### 第二步：候选边界与准入分离

统一数学掩码和编号/选项文法。题干和支持材料都扫描候选；候选不是确认。验证章节、题号顺序、唯一性、expected本身是否合法、题答集合及角色权限，再确认范围。

不存在额外证据时，完全同形的步骤/题目边界本来不可识别，应保留待核查状态。不能把“唯一满足程序当前正则的切法”当作真实题意的证明。现有>=3经验常数也不能用另一个常数替换。

### 第三步：统一引用与答案聚合

原文片段采用半开范围，拼回必须等于来源；所有公开ID、parent、origin必须可解析且不覆盖。选项从相同原块拆为真实不同片段，未解析时不能复制字段充数。

答案聚合从所有明确原文声明形成集合，区分缺失/一致/冲突/无效；比较必须依据题型进行规范化，禁止计算答案和泛化语义猜测。保留原始答案及诊断。

### 第四步：在最靠近输出处统一执行准入

两条组装路径不得各有一套有效性定义。未通过序列/来源/角色准入不能附答案或解析；直接 assemble 调用也要受约束。模型只标注被允许的来源引用；其 `question_no` 和文本观点不是事实来源。

保留现有DOCX稳定路线和既有D-1规则；不要用这次新严格策略覆盖旧生产模块行为。新增MinerU路线先独立通过，再做小型适配。

### 第五步：完成资产、任务和HTTP协议

HTTP传播完整证据；已确认草稿需要的图片从临时解析缓存转入合适的本地资产生命周期。以显式ID取图，缺ID拒绝。端到端deadline、取消、批次回执与恢复要有同一状态机；受理未知不得自动重投。

### 第六步：最后才接正式UI

先纯函数坏例，再六份已保存结果离线回放，再mock HTTP与资产生命周期，最后隔离数据库跑正常界面全链路。只在离线证据确实不够时，由用户另行明确授权必要的真实服务测试。不要反复上传相同文件诊断本地算法。

时间/空间目标：规范化、候选扫描、索引和验证以输入字符/块/引用数量线性为主；共享集合/索引，不在每层重建整套副本或做全对全语义比对。协议问题用一个真源解决，不能在每个消费者补一个兼容分支。

## 7. 必需验收清单

| 层 | 必须覆盖的反例/性质 |
|---|---|
| 内容 | caption/footnote/未知项保留；缺页码拒绝；空壳不伪造正文；不修改源对象 |
| 身份 | 同ID不同块、两文档p1b0、同basename不同路径、缺job、图片缓存淘汰、过期/重启 |
| 分题 | 同块多题、跨页、两题小卷、无点号答案、全角、公式数字、小数、同形步骤、未声明总题数 |
| 归属 | 缺字段/错phase/重号/倒序/缺号/交换解析/未知引用；不能只检查issues存在，还要断言零错误绑定 |
| 选项 | 四选项同块、B/C无空格、图选项、几何字母伪标号、前导正文守恒 |
| 答案 | 表/头/正文结论一致与冲突；单选/多选标签；不可比原文不能猜标签 |
| 片段 | 拼回原文、不重叠、绝对范围、二次切分、完整索引、非法来源和片段ID碰撞 |
| 传输 | 客户端→HTTP→消费者字段无损；真实fetch不进入mock；挂起/取消/未知受理有明确状态 |
| 内容质量 | 语法渲染成功但漏字仍需核查；源文件错误不静默改；图片证据可复查 |
| 产品 | 隔离UI全生命周期、刷新/重启资产、导出回读；DOCX+DOCX与PDF known-bad保持 |

## 8. 已有真实证据与当前验证结果

真实来源根目录：`local-run-artifacts/mineru-independent-2026-10-18/live-2026-10-18T05-48-56-815Z/`，包含manifest、六份ZIP、解压原文/图片、全部68页源图和对照HTML。成功六份总时132.09秒、中位20.70秒是前一轮真实测试结果；本轮没有再次调用服务。

| 文件 | 页 | 修复后题目/解析候选 | 实际绑定 |
|---|---:|---|---:|
| 完整版答案 | 4 | 12段支持材料 | 与题目文件配对后12 |
| 完整版题目 | 2 | 12题；两个甲/乙caption | 12/12 |
| 深圳 | 21 | 19题/19段；15、16片段来源闭合 | 19/19 |
| 十二校 | 21 | 19题/19段；答案表进入支持preamble | 19/19 |
| 河北 | 19 | 19题/19段；17、18分离；C标签保留 | 19/19 |
| 简版 | 1 | 6题；两个甲/乙caption | 题目-only，不伪造答案 |

本轮修复证据：`local-run-artifacts/mineru-repair-2026-10-18/`：

- `replay.cjs` / `replay.log` / `audit.json` / `01.json`…`06.json` / `pair.json`：六份原始结果离线回放，不读旧分段充当新结果。
- `visual.cjs` / `visual-audit.json` / `index.html` / 八张对照截图：公式2010处语法异常0，资源路径缺失0，三卷33个客观答案与此前确认结果一致；已人工看过八张对照及章节修复后的两张重生成截图。
- `audit-for-astra.cjs` / `audit-for-astra.json` / `audit-for-astra.log`：交接现状的合成反例；**包含仍然失败的语义结果，不是通过的回归测试**。
- `asset-audit-for-astra.json`：四次解析、无job、TTL读取的纯mock证据。
- `content-audit-for-astra.json`：空壳、相邻数字空格、长块统计。
- `frozen-for-astra.json`：交接业务文件hash。

本轮视觉检查补充发现了答案表进入最后一题的问题并修复；也确认了p19公式内容缺失。33个客观答案正确不能外推为全文100%准确。

实际命令结果：

- 五个聚焦测试文件：**50/50通过**，日志 `focused.log`。
- 最终 `npm.cmd run verify:safe`：**1905/1905通过**；后续 batch-safety 中 DOCX stable 8、PDF known-bad 62、batch mock 8 全通过。日志 `verify-safe-final-complete.log`。
- runtime inventory：valid=true；app-shell：APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED。
- diff-scope：通过，允许集合显式包含本轮文件和原有用户dirty文件；不表示这些旧文件都由本轮修改。
- git diff --check：通过。LF/CRLF提示不属于空白错误。
- 早先全量有一次旧Qwen计时测试402ms越过400ms；原断言未修改，单独36项复查通过，最终完整门禁通过。早期失败日志也保留。
- 一次自动审批因额度暂时不可用阻止了本地截图启动；用户继续后正常审批的截图和完整测试已经执行成功，不存在待用户批准的操作。

测试通过只证明已覆盖契约成立；第4节新增审计反例尚未纳入修复后的门禁，Astra必须据此补回归、统一改造，不能以1905项通过关闭这些问题。

## 9. Astra 开始时的最小操作

1. 读根AGENTS及必读文档，确认当前分支/dirty；先比对 frozen-for-astra.json，不覆盖用户随后修改。
2. 读本文件与两个JSON审计证据，按P0/P1核实；旧compare脚本只当线索，不当金标。
3. 在修改前形成统一方案和边界；如需服务端、UI、资产持久化，明确扩充任务范围，保持 app.js 小型编排与DOCX稳定链。
4. 不重传六份PDF；先用已有ZIP和合成反例完成离线验证。
5. 本轮状态是“审计交接并停止”，不是已完成正式接入，也不授权恢复旧付费轮次。
