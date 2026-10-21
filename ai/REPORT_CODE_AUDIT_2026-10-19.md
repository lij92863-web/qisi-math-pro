# 10 月 18—19 日报告与代码交叉审计

审计基线：`stage/program-c-corrective-r1`，`3099a479ca4a8bd5e2a06f2365bb78bc5ff848af`。

## 结论

**改对了一部分，但“全部完成、类问题已解决”的结论不成立。** 当前 `verify:safe` 确实是 **2026/2026，通过**；本次新增反例同时证明，答案冲突、DOCX 切分、候选去重、图片保留、共享选项识别和打印门禁仍有缺口，其中包含最近提交引入的回归。

本报告列出 **12 组代码问题**，另列完成状态与架构问题。这里的 P1 表示应优先修复的内容错误、丢失或正常导入失败；P2 表示门禁/证据展示缺陷。没有证明正式题库已经发生污染，不将草稿错误夸大成已入库事故，也不声称穷尽所有缺陷。

本轮只新增本报告及 ignored 审计产物；**没有修改业务代码、测试断言、依赖、代理或正式数据库，没有调用 AI/OCR，没有 commit/push**。开始时只有历史保留的 `.workbuddy/` 未跟踪内容，没有覆盖它。

## 1. 基线与核验范围

- 三个相关提交：`01db97a`（历史工作快照）、`1dc4101`（冲突与事务修订）、`3099a47`（编辑确认、软删除、选项共享）。
- 相对 `85441f5`，范围为 81 个文件、9879 行新增/1507 行删除；这不是单一 MinerU 修复，应分开验收。
- 核对对象包括 `ai/今天改了什么_2026-10-18.md`、`一二档根因与通用方案_2026-10-18.md`、`FOREMAN_REPORT_2026-10-18.md`、`HANDOUT_GATE_AND_TEMPLATE_REPAIR_2026-10-18.md`、`DOCX公式实测_2026-10-18.md`、MinerU 审计/设计/修复报告，以及 `tmp/audit-docx/REPORT.md`、`tmp/audit-perf/结论.md` 和 `.workbuddy/memory/2026-10-18.md` 的落地记录。
- 讲义设计、调研、清理盘点按代码接线与完成状态核对；技术选型文档按历史研究材料处理，本轮没有重新核验厂商价格、宣传速度或外部产品能力。
- 未发现独立的 10 月 19 日已落盘验收报告；当天完成声明以 `3099a47` 提交正文为准。不能把昨晚的不同时间快照混成当前状态。
- 主要方法：实际生产函数的合成反例、修改前后对照、真实服务/仓储组合、真实 Dexie 配合隔离内存 IndexedDB、现有全量测试及架构检查。不是仅搜索字符串后作判断。

审计产物：`local-run-artifacts/audit-2026-10-19/`。脚本使用 `.cjs`，未加入默认测试扫描。`importer-before.js` 等历史快照只在该目录保存。

## 2. 已确认的代码问题

### F01 · P1：冲突不是终态，第三份支持文件会复活答案

位置：`qisi-docx-producer-identity-contract.js:679–729`，生产调用 `qisi-production-docx-source-port.js:307`。

复现：同一题的三个答案文件依次声明 `A`、`B`、`C`。当前输出答案为 **C**，答案 provenance 又变成 `deterministic-source`；警告仍写着 A/B 已全部留空。

原因：冲突被编码成空字符串。下一次处理只看 `hasValue(candidate[field])`，把“因冲突拒绝”误认为“从未提供值”。消费者不读 rejected 状态，证据数量与文件处理顺序影响最终答案。

归属：`1dc4101` 字段级冲突实现的新缺口。现有生产测试只覆盖两份支持文件，不能证明第三份不复活。

修复不变量：按题目身份、字段聚合所有声明，`missing / unique / conflict` 独立于文本值；自动追加证据不能把 conflict 变回 unique。只有显式人工裁决才能解除。应验证输入排列、重复、分文件拆分不改变结论。

证据：`probes.json / three_support_files`。

### F02 · P1：单文件冲突的空记录仍被送进“必须有值”的字段接口

位置：`qisi-production-docx-source-port.js:256–307`；`qisi-docx-producer-identity-contract.js:654–655`。

复现：答案文件为 `答案：\n1. A\n1. B`。真实 parser → source port → contract 返回 **DOCX_DETERMINISTIC_SUPPORT_VALUE_MISSING**，整次 runner 失败。

原因：前段消费 `parsed.conflicts` 并清空字段，后段仍遍历 `parsed.answers` 中保留的空冲突行；契约把它当作非法正常值抛错。与“坏一道题只拒绝该字段、整份正常导入”不一致。

归属：`1dc4101` 新冲突协议未闭合。两文件测试使用桩 parser，没覆盖真实 parser 产生的空冲突行。

正确做法：解析结果的声明、冲突与可采用值必须有明确类型，统一 reducer 消费；不是在多个入口各加 `if (!value) continue` 掩盖协议差异。

证据：`probes.json / conflict_blank_enters_production`。

### F03 · P1：冲突处理越过文件角色，解析文件能够清空独立答案

位置：`qisi-production-docx-source-port.js:256–280`；角色判断直到 `:287` 才应用于正常值。

复现：先从 answer 文件得到 A，再读一个仅勾选 solution 角色的文件，其正文包含重复的答案 B/C 和解析。当前 A 被清空；rejected provenance 的 sourceId 还被记成题目文件 q，而不是实际冲突文件。

原因：冲突通道和正常值通道的角色授权不一致，冲突同样是字段写操作，却在角色过滤之外执行。

归属：`1dc4101` 新增通道的回归。应先限定来源角色和题目身份，再聚合证据；错误证据和正常证据都不能跨越角色边界。

证据：`probes.json / conflict_wrong_role`。

### F04 · P1：同源抽取去重与真实冲突仍靠文本启发式区分

位置：`qisi-support-text-parser.js:74–83、111–126、187`。

已复现三种表现：

1. 两个独立的 `1.【解析】x=1` 与 `1.【解析】x=10`，最终只留下 **x=10，零冲突**。该值能经生产 runner 进入候选。
2. `题号：1 2 / 答案：A B / 答案：1.C 2.D` 最终仍是 A/B，零冲突；`tableNumbers` 按题号跳过了另一处独立声明。
3. A/B/C 三个答案，行内保存了三个候选，但 `collectConflicts` 去重时只取第一次 warning，输出冲突清单只剩 A/B。信息在跨层协议上不完整。

原因：`includes` 只能证明字符串包含，不能证明来自同一个原文位置；按题号排除重复抽取也不能证明后一处就是表格单元格。分别抽取、清洗、截断后再合并，缺少原文区间身份。

归属：子串策略随 `1dc4101` 引入；表格跳过属于此前修复的残余。应以 sourceId + 原文范围去重同一次声明，保留不同范围的声明并比较规范化值。冲突证据不要依赖不断叠加的 warning 文案。

证据：`probes.json / substring_conflicting_solutions、conflicting_solutions_production、table_inline_conflict、third_conflict_value`。

### F05 · P1：带标签优先只覆盖局部样例，未解决步骤与题号同形的问题

位置：`qisi-support-text-parser.js:207–302`。

复现取自现有测试：`答案：1.A 2.B / 解析： / 1. 由题意得 x=2。 / 2. 当 x>0 时 f(x) 递增。 / 3. 综上。`。输出三条解析：第 1 题只剩首句，第 2 题得到步骤，第 3 题得到“综上”。没有歧义记录。

`tests/support-ambiguity.test.js` 中名为“the numbered step ... stays part of that solution”的测试，仅断言第 1 题包含首句，没有断言步骤仍归第 1 题，也没有断言不得产生第 3 题，因此全绿不能证明它修好了。

原因：`chosen` Map 只处理同号重复，靠后面出现同号、带标签的真题头纠正。若不存在这种后续证据，步骤仍被赋予题目身份。

归属：旧问题未闭合，不是本轮观察到的全新回归。算法必须保留 Word 结构/层级与明确题头证据；文本无法唯一决定时留下候选和歧义，不能按“缺少另一解释”确认归属。

证据：`probes.json / numbered_steps_without_later_label`。

### F06 · P1：答案标题修复只接了一半，题目切块仍使用旧正则

位置：`qisi-batch-importer.js:459、899、920–934`。

当前 `SUPPORT_HEADING_PATTERN` 能识别 `参考答案：`、`【参考答案】`、`答案详解`；但 `buildQuestionBlocksFromDocumentXml` 停止切题仍使用自己的旧正则。

复现：一条题目 + 上述标题 + `1.【答案】A`。支持标题检测为 true，切题却输出两个 block，并把标题附进第一题。对照不带冒号的 `参考答案` 才只有一个 block。full 角色随后可能因重复题号拒绝；无论后续是否拦住，切块结果已错误。

原因：修复了“支持文本从哪开始”，没有统一“题目区在哪结束”。同一文件拥有两套章节边界定义。

归属：标题变体修复未完成。应让章节扫描只产出一份区间表，题目提取、编号展开和支持提取消费相同区间。

证据：`structural-probes.json / support_heading_boundary`。

### F07 · P1：自动编号的坐标系不一致；括号题号也仍未打通

位置：`qisi-batch-importer.js:423–438、182–204、920–924`；`qisi-docx-numbering.js:124–152`。

复现：空段落 + 两道 Word 自动编号题 + 参考答案标题。`splitDocxParagraphs` 去掉空段落后得到 headingIndex=2；`DocxNumbering.expand` 按原始 XML 段落计数，第二题已被当成答案区，只有第一题展开。最终两道题变成一个 block。

另一个独立证据：`（1）求函数值 / （2）求实数根` 当前产生 **0 个 block**。编号模块能生成 `(1)`，不等于下游 `parseLeadingQuestionMarker` 能识别它。

原因：用过滤后的数组下标约束未过滤的 XML；编号呈现语法与题号识别语法也没有闭合。应使用稳定段落 ID/XML 范围保留原始坐标，把结构编号作为字段传递，而不是生成文本再交给另一条正则猜回去。

归属：空段落问题来自新编号集成；括号题号为既有未完成项。

证据：`structural-probes.json / numbering_blank_paragraph_coordinates、parenthesized_question_numbers`。

### F08 · P1：重复候选仍会丢短题，冲突字段仍按主候选择一

位置：`qisi-production-import-output-port.js:185–229、290–301、389–417`。

复现一：同一来源、同题号，题干分别为“求函数的定义域”“求函数的值域”。均不足 10 字，被排除出 meaningfulStems，两个草稿合成一个，第二个 ID 进入 removedIds。

复现二：相同题干但答案 A/B，最终只保留一个答案，另一答案写进 trace；主候选仍先按 `qualityScore` 排序。不同值并没有变成不可采用的冲突字段，较长解析等内容还能与另一候选组合。另一解析只存前 200 字、题干只存前 100 字，不能等同于保留完整候选供人工选择。

原因：字符数/显示质量不是“是否同一题”的身份证明；“保留主候选”仍然是自动择一，不能用增加 warning 改变这个事实。

归属：长度阈值是此前补丁；最新凭证择优修改仍未消除旧的排序入口。修复应将题目身份冲突与同题字段冲突分开；身份无法证明时保留所有候选。合法缺失字段可以合并，不同有效值须进入显式冲突。

证据：`probes.json / short_distinct_questions、same_stem_conflicting_answers`。

### F09 · P1：保护已提交草稿行，却在同一次去重中删除其图片

位置：`qisi-draft-maintenance-service.js:172–195`；`qisi-production-import-output-port.js:329–338`。

用真实 maintenance → persistence → repository 组合、仅替换内存数据库复现：一条 submitted 和一条 pending 各有一张草稿图片。去重后两条题目行仍在，**submitted 对应的 draftImages 已从存储消失**。

原因：去重只收到非 submitted 题目，却收到全部图片；图片重绑函数把“不在本次候选集合”的 questionId 当成孤儿删除。上层补回 submitted 行时没有补回它的关联图片。这是调用方对下游输入集合含义的依赖导致的回归。

归属：`1dc4101` 新增跳过 submitted 的改动引入。修复应把不可变题目及其资产闭包作为一个分区保留；可变分区独立去重后再合并。测试需要断言关联图守恒，不能只断言 submittedQuestionId 在。

本次只证明草稿图片证据丢失，没有证明正式 images 表被删除。

证据：`structural-probes.json / dedupe_submitted_images`。

### F10 · P1：共享选项扫描器缩小了 DOCX 已支持的输入语法

位置：`qisi-utils.js:184–191`；`qisi-batch-importer.js:698–713`。

同一合成 DOCX block 做 `1dc4101` 与当前提交对照：

| 文本 | 修改前 | 当前 |
|---|---|---|
| `A 甲 / B 乙 / C 丙 / D 丁` | 四个选项正确 | 四项全空 |
| `A.甲 / B.乙 / C.丙 / D.丁` | 四个选项正确 | 四个选项正确 |

原因：旧 DOCX 支持有明确后续内容的无标点标签，新共享正则要求标点。代码减少了重复，但把某一调用路径的语法限制传播到了稳定链。

归属：**`3099a47` 可直接做前后对照的新回归**。应先定义共同词法事实和各路径的判定条件，再统一；不应靠放宽一个全局正则解决所有上下文。

同时存在旧的数学掩码不一致：相同 `已知集合 $\{ A: x>0, B: y>0 \}$，求交集。`，页级 parser 把数学表达式截成题干与两个选项，DOCX 调用方先做 math mask，保持原文。因此“共享函数”也不代表各消费者已经拥有同一合同。非选择题 PDF 编辑投影在本次对照中正确保留全文，不能把页级反例泛化为所有路径都坏。

证据：`option-regression.json`、`structural-probes.json / math_option_consumers`。

### F11 · P2：公式门禁与打印不共用输入，存在已复现的漏放

位置：`qisi-handout-formula-gate.js:96`；`app.js:4457–4462、4568–4605、4876`。

复现：裸 `\frac{1}{` 或 `\begin{cases}\badcommand\end{cases}`，门禁返回 **ok=true**；打印的 formatLatexForPrint 再补 `$`/`$$`，随后 KaTeX 报错。已有定界符的同类坏公式会被门禁发现。

原因：门禁扫描原文，打印扫描规范化并补定界符后的文本。复制 `normalizeMathExpressionForPrint` 并没有统一完整处理流程。

归属：新门禁引入时即有此缺口。FOREMAN 报告中“不会漏放红字”的判断应撤回。本次还确认 gate 扫描所有 answer/solution，不随打印显示范围变化；这是潜在误拦边界，尚未做完整 UI 验收，不当作已复现的额外事故。

正确做法：先形成实际导出内容的统一片段模型，门禁和渲染消费同一模型；避免两套预处理互相承诺“保持一致”。

证据：`print-probes.json`。该脚本复用真实 Utils/KaTeX 与当前格式化步骤，不代表完整打印 UI 已验收。

### F12 · P2：DOCX 未匹配支持内容仍在桥接层丢失

位置：`qisi-production-docx-source-port.js:296–303、338`；`qisi-production-import-bridge.js:623–625`；`app.js:1916、2738`。

静态调用链确认：DOCX runner 返回 `unmatchedAnswers`，bridge 只读取 `sourceResult.unmatched`，缺省成为 `[]`；app 再把这个空列表保存到 batch.unmatchedAnswers。即使先修字段名，展示端仍读取 `sourceFile` 和 answer，来源实际是 sourceFileName，solution 类记录也需要正确展示。

归属：昨天已发现、当前仍未修，不能列入“全部完成”。本轮为源码数据流证据，未另做完整 UI 回放。

应定义统一的未归属支持记录协议 `{sourceId, sourceName, questionNumber, field, value, evidence}`，生产者、持久化和展示都消费它；不能仅改一个属性名后关闭问题。

## 3. 哪些修复可以确认有效

| 项目 | 本轮结论 | 证据与边界 |
|---|---|---|
| 人工编辑后重新确认 | 修复成立 | `markFieldsManual` 对所有路由重置 pending/manualConfirmed/confirmedAt，submitted 仍禁止直接改；新增测试与全量通过 |
| 题库图片 N+1 | 算法已改对 | `app.js:3061–3096` 收集 ID 后一次 loadImageRecords，用 Map 查图；未复测昨天的毫秒数，不把旧性能数字当新实测 |
| 单题保存事务 | 本轮成功与失败回滚都成立 | 真 Dexie + fake-indexeddb，正常题图均写入；图片不可克隆导致失败时题图均未留下 |
| 备份创建/恢复两套限制 | 实现已统一 | inspectBackup 不再有 generatedHere 特权，压缩比超限用 STORE；现有备份回归与全量通过，未触碰用户备份目录 |
| 混合答案表、多选单元格 | 覆盖的正常场景成立 | A/2/C/4、AB 单元格现有测试通过；不能推导跨路径冲突已解决，见 F04 |
| 已提交行保留 | 行级保护存在，但不能整体关闭 | 保留提交凭证的测试通过；关联图片存在 F09 |
| 软删除底层墓碑保留 | 服务/仓储部分已有有效实现 | 现有软删回归通过；不代表 UI 已上线，也不证明所有读出口完成 |
| MinerU 核心证据修复 | 报告限定范围大体与当前代码一致 | 统一 evidence、范围和归属校验存在，现有离线测试通过；本轮未重跑六份实际 PDF 的逐页视觉验收 |

## 4. 报告与实际完成状态对照

| 报告/声明 | 当前审计判断 |
|---|---|
| `今天改了什么` 中的重复答案整份拒绝、保存风险待查等 | 是早期快照；当前实现已变化，不能当当前验收结果 |
| `.workbuddy/memory/2026-10-18.md` 最终“保留首条+警告、1999通过” | 又被 `1dc4101` 改为字段拒绝；旧八项全完成表不能继续复用 |
| `HANDOUT_GATE_AND_TEMPLATE_REPAIR` 中“事务修改回滚、冲突修改回滚” | 与当前大幅事务重写及字段冲突代码不符；“main.html 只加 script”也不是最后状态 |
| `FOREMAN_REPORT` 中“标题、编号、合并、未匹配”等 | 一部分后来有修改，一部分仍未闭合；必须按本报告 F01–F12 更新，不能一键全标已修 |
| `3099a47` 的编辑状态修复 | 与代码一致，已验证 |
| `3099a47` 的“单题软删上线” | **仅底层接口完成**。全仓生产代码没有调用 deleteDraftQuestion，app 返回值/main.html 也无对应单题删除入口 |
| `3099a47` 的“可见集合读出口收口” | 列表与统计使用 visibleDraftRows，但 `loadDraftReview` 仍返回 deleted 行；本轮删除后直接读取已复现。尚无 UI 接线，不据此声称用户已能绕过删除 |
| `3099a47` 的“选项标签口径收敛” | 常见有标点形式收敛了；无标点 DOCX 发生回归，数学掩码仍由各消费者自行负责 |
| `MINERU_UNIFIED_REPAIR_REPORT` 的已完成/未完成边界 | 相对诚实：明确未接正式 UI，未解决任务/资产生命周期，未恢复 OCR 漏字。这些未完成项目前仍在，不能因核心测试通过改成全部完成 |
| MinerU 报告的旧 HEAD、未提交状态、最终全量待填 | 已过时；当前代码已提交，最新全量为2026/2026。本轮未替写历史日志 |
| `DOCX公式实测` 的211/212可渲染 | 只能说明该批次渲染成功率，不能作为数学内容正确率，也不证明现在完整 DOCX 导入链通过所有边界；本轮没有重跑该真实样本 |
| `HANDOUT_DESIGN/RESEARCH` | 属于方案，不是交付；三预设已进入旧打印链，但 qisi-handout-model/html 仍是 dormant，文字块/完整新编排流程未接入 |
| `CLEANUP_SURVEY` | 历史数量需要更新；“沉睡不等于可删”的原则仍适用。本轮没有按旧清理清单删除文件 |
| `PDF_FAST_PARSE_MODEL_SELECTION` 的速度/成本与瓶颈结论 | 不是当前代码验收。历史串行Qwen和MinerU结构绑定的口径不同，不能用其耗时推断今天速度或把结构通过当内容准确 |

### 关于事务根因的特别纠正

`qisi-storage-repository.js:358–363、487–491`、写边界脚本与部分报告把“async 总是返回原生 Promise”进一步推成“Dexie 拿到 async 就提前提交”。后一结论不成立。

本轮用本机安装的 Dexie 做隔离实验：直接 `db.transaction(..., async () => { await putQuestion; await putImage; })` 正常提交；第二次写失败时第一写正常回滚。见 `dexie-probes.json`。这反驳了“async 本身必然导致提前提交”，**不反驳历史某条包装调用链曾经失败**。

当前 `.then` 修法的实测结果可以保留，但根因解释和广域 async 禁令的必要性需要重新论证。不要据这个错误推论继续重写其他模块，也不要把仓储改动与 Qwen 调度耗时相关性当作因果。真实应验证的是事务生命周期、异步工作所属范围和失败原子性。

## 5. 耦合问题的根本形态

1. **同一业务状态多头定义。** Parser 的空值+conflicts、source port 的 rejected、contract 的 hasValue、output port 的主候选保留互不一致。F01–F04/F08 是同一类证据状态机未统一，不是几个漏掉的 if。
2. **同一原文多套坐标和边界。** XML 段落、过滤后的段落、字符串题号、支持章节各自推导边界。F05–F07 应在结构化文档阶段一次确定可证明的身份/范围，而不是下游重复识别。
3. **分区操作只保题目，没有保关联资产。** F09 暴露“子集处理”契约缺失。仓储只验证行凭证集合不足以保证题目证据完整。
4. **共享实现没有共享完整合同。** 选项函数扩大了影响面，却没有对照每条既有路径的语法；打印门禁复制一个规范化函数，却漏掉上游格式化。这类耦合应通过统一输入模型、字段状态和不变量测试解决。
5. **完成状态与消费者脱节。** 有模块、有测试不等于老师能用；软删除、MinerU、新讲义模块需要区分 library-ready、接线、正常 UI、持久化恢复、导出验收几个层次。
6. **验证出口仍受目录内容影响。** 当前 `npm test` 未限定 tests 目录，本次2026项中含 `tmp/audit-db/db-audit.test.js`。不同机器的 ignored 临时文件能改变“全量”集合。审计工具应独立，正式套件应显式枚举范围。

架构检查通过证明当前登记与规则没有报错，不证明上述业务协议一致。不要把 runtime valid / app-shell accepted 替代内容守恒验收。

## 6. 建议实施次序与算法验收条件

本轮到审计为止，不直接修改。后续应按边界分任务，避免再同时改十几个无关文件。

### 第一批：统一支持证据与冲突处理（F01–F04、F12）

- 身份键包含导入/试卷来源、题号、字段；角色先过滤，原文证据保留独立 ID 与范围。
- 用纯 reducer 计算 empty/unique/conflict；集合去重基于同一原文声明，不靠子串或长短。
- 满足交换律、结合律、幂等性；conflict 对新增自动证据单调保持。人工选择单独带审计证据。
- producer、source port、contract、review 和 unmatched 展示消费同一协议，消除已清空记录再进入正常写接口的双轨流程。
- 测试：2/3/多文件、任意排列、同一来源重复抽取、真实不同来源相同内容、不同角色、缺值与冲突的区别、完整证据往返持久化。

### 第二批：文档结构与候选身份（F05–F08）

- 一次扫描生成稳定段落/章节区间及 Word 编号事实；空段落、公式展开不得改变标识。
- 将“题目结构身份”和“显示编号”分开；同一显示题号可在不同节存在。歧义不能由字数阈值消除。
- 同范围重复识别可以归并；不同有效字段值进入冲突；不同题目候选完整保留。
- 测试：空段落增删、自动编号/手打编号、标题变体、括号编号、章节重启、不同长度题干、解析分步。验证题目数、原文区间、内容和图片引用守恒，而非只验有没有首句。

### 第三批：维护操作的关联图守恒（F09及软删除边界）

- 明确可变/不可变分区；去重只重绑可变分区资产，其他行及其资产闭包原样保留。
- 列表、详情、统计、提交要有清晰的可见/审计读取接口；不要让低层隐藏规则在不同调用者中含义不同。
- 测试：submitted/pending/deleted 混合，有图无图、共享/未绑定图，前后资产身份与提交凭证守恒，失败原子回滚。
- UI 另行接线并验收，在此之前只称“底层能力完成”。

### 第四批：共享词法和实际打印模型（F10–F11）

- 先列出 DOCX、页级 parser、PDF editor 已支持的输入域，保留合法形式，不把自由文本全局当标签。
- 识别时保留原文偏移与数学区域；选项完整序列/上下文判定与单个标签词法分层。
- 打印只形成一份规范化片段模型，门禁扫描的必须是实际要渲染的内容与字段。
- 测试必须有修改前后差分、合法变体、数学内部相似字符串、裸公式、隐藏解析、模板切换以及正常 UI 打印验收。

每批先锁定本报告反例，再跑相关真实生产函数组合与 `verify:safe`。不得只增加一条“这个文件现在能过”的测试，不得靠改期望、取消冲突、扩大阈值或吞异常完成验收。

## 7. 本轮验证与局限

| 验证 | 结果 |
|---|---|
| `npm run verify:safe` | 2026通过、0失败；no-real-ai、语法检查、write-boundary均通过 |
| `npm run verify:docx-stable` | 8/8通过 |
| `npm run verify:pdf-known-bad` | 通过 |
| `npm run verify:batch-safety` | 通过 |
| `node scripts/verify-runtime-modules.js` | valid=true |
| `node scripts/verify-app-shell-architecture.js` | APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED |
| `git diff --check` | 通过；本轮未修改已有业务文件 |
| 生产函数反例、结构/图片组合反例 | 见 probes.json、structural-probes.json |
| 最近提交前后选项行为对照 | 见 option-regression.json |
| Dexie 提交/失败回滚及 async 命题核验 | 见 dexie-probes.json |
| 门禁/打印预处理对照 | 见 print-probes.json |

最初受限环境无法启动 Node 测试子进程（spawn EPERM）；随后获准在本地运行同一离线核验，完整通过。不是将 EPERM 当业务失败，也没有跳过失败项凑通过数。

审计反例脚本用于记录当前实际行为，因此脚本执行成功不代表产品行为正确；期待的不变量与实际结果已逐项列在 F01–F12。现有全量测试通过与这些反例失败可以同时成立。

未重跑付费 Qwen、MinerU 云解析；没有重新逐页视觉审核68页，也没有对全部真实 DOCX 进行新增浏览器回归。现有全量包含隔离浏览器测试，但这不能替代上述新反例的正式回归与用户路径验收。

DOCX stable chain impact: 本轮只审计；已发现当前实现中的稳定链回归，见 F02/F06/F07/F10。

DOCX regression command: `npm run verify:docx-stable`、`npm run verify:safe`。

Result: 现有套件通过；新增审计反例证明修复尚未闭合。

Review page data changed: 否。Draft schema changed: 否。Submit flow changed: 否。Batch flow touched: 否。PDF support changed: 否。

交付后停止审计实施，不自动进入修复阶段。
