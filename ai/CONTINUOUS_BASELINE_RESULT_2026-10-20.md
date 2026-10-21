# 连续推进结果 — 2026-10-20

> 2026-10-21交接：用户明确要求先停代码、写详细交接，再由Astra统筹规划。[完整交接](HANDOFF_FOR_ASTRA_2026-10-21.md)包含用户13条要求、已做、失误、未做、限制和恢复证据。打印拆分只准备快照与候选文字，未改app.js/qisi-handout-html.js/main.html；当前不再自动进入实现阶段。

> 最新修复进展：完整界面暴露的第8/10选项粘连、第18解答题误拆、第16表格文字被图片遮蔽已在PDF投影负责模块局部修复，并通过深圳卷同源前后比较；第11/14题的独立节标题显示混入同时消除。早期“尚未修复”的段落是当时事实，当前以文末“PDF投影修复”及对应验证记录为准。

> 后续整页复核更正：下文原阶段曾把第16题空续表描述为整题表格行未提取，这一推断过强。实际 p4b6 的 HTML 已包含棕色2/3；缺失的是独立续表块/图片表达和准确位置。最新21页及14张缓存图代理复核、19题独立填写页与记录校验见文末续作，旧证据保留，人工字段仍未确认。

状态（2026-10-21更新）：完整 verify:safe 2191/2191、write-boundary及批量安全通过；最新只读入边清单完成，未删文件或改生产业务。此前已补自动答案互斥计数、备份状态失败误报、打印坏图误报就绪；原有功能及数据保持。昨日2153/2154失败及导航故障仍保留，根因未确认，新增导航证据不代表业务故障已修复。9组真实导入配置均有隔离观察，但同卷格式不重复算独立样本，不能当人工金标准。真实十二校第1/19题不可转换解析仍被正式准入拒绝。深圳人工复核仍待填写。最新恢复点以各阶段full-source/result.json的实际结果为准；下文保留各阶段事实。

## 已交付

1. 修复审核测试旧按钮名称，保留元数据脏状态、离开保护、保存与确认断言，并检查确认本身不增加正式题目。
2. 修复两处测试中的识别响应顺序依赖。双 PDF 用例改用现有按源字节 SHA-256 回放器；17 场景矩阵为旧 envelope 注入显式源文件映射，逆序请求仍得到对应文件结果，未知字节拒绝。所有旧场景和业务断言保留。
3. 新建 scripts/golden 下的离线生产界面回放、逐题指标、相同输入比较与显式历史缓存诊断；合成套件及协议在 golden 目录。
4. 新增真实 IndexedDB 隔离演练：11 张表导出、归档验证、清空、受保护恢复、关闭重开和逐字节快照比较；正式题图、草稿图、嵌套文件字节及关联均保留。
5. 完成深圳卷原 PDF → 任务回执 sourceId → ZIP SHA → 由该 ZIP 导出的 content list 来源关联。旧探针与该 ZIP 有 5 个条目不同，保留两份证据，没有混用或覆盖旧文件。
6. 本地渲染并查看物理页 3、4、5、9、14、15、16、17，记录代理核对结果与逐题复核工作区。没有把代理复核伪装成人工认证。
7. 原页及缓存证实第 16 题题干跨页表格的后一行没有提取出内容；分段模块报告 empty-source-block，但 producer 原先没有传到对应题的审核提示。本轮只将空表格问题接入该题 warnings/taskProblems，复用现有来源确认门禁，不猜补单元格、不改变答案或序列绑定。
   同类问题已验证覆盖独立支持 PDF，提示带真实来源文件名与页码，并按题去重；不会给相邻题加同一个空表格提示。
8. 新增 docs/LIVE_MAP.md、docs/RUNBOOK.md，并纠正 ai/TESTING_GUIDE.md 对实际 verify:safe 顺序的过期描述。

## 真实材料的分层结论

来源：Desktop/题目与答案/广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf。
SHA-256：874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21。

这里只读本地文件和既有识别缓存，没有发送真实识别请求、改动原文件或写正式题库。

| 本层观察 | 结果 | 能说明什么 |
|---|---:|---|
| 分段层题号 | 19/19 | 找到对应题号；不是完整题干召回和整卷正确率 |
| 独立候选答案值 | 14 | 当前协议提取的字段数量，不是 14 道“自动获准入库” |
| 未提取独立答案值 | 5 | 第 15–19 题；不能一概称作 OCR 漏识别 |
| 找到解析区段 | 19 | 已定位区段，不保证所有解析内容完整 |
| 原始规则保留解析 | 18 | 第 16 题因 ambiguous-boundary 扣留 |
| 可精确文本对比的参考答案 | 14 | 与历史参考 11 个精确一致，另 3 个是文本差异，不能记成 3 道错挂 |
| 整卷错挂数量 | 未知 | 尚缺独立完整标注，必须保留 null |

关键原页代理复核说明：

- 原 PDF 第 9 页答案表与缓存的第 1–11 题答案值一致。
- 第 12、13、14 题在第 14 页可直接核对；三处与历史参考的文本差异为 LaTeX 空格或指数分组，不据此修改业务标准化规则。
- 第 15、16、17 题的分问答案摘要在原页和缓存中都存在；当前独立答案提取语法没有把它们提升为 answer 字段。因此“没有独立 answer”不等于“原文不存在答案”或“OCR 完全没读到”。
- 第 16 题原 PDF 第 16 页独立印着题号和 (1) 答案，但缓存把该起始行与第 15 题结尾合并到 p16b3，偏移 80。它需要明确边界证据，不应使用数学语义猜测。
- 只在离线反事实中向既有 parser 传入与源哈希、完整原始文本、偏移绑定的明确边界决策后，解析数量 18→19，题数仍 19、独立答案仍 14。没有把该代理决策接入普通 UI 或生产自动绑定。
- 原 PDF 第 5 页可见表格的“棕色内饰：2、3”一行，缓存 p5b0 却是无文本、无图片的 table 块。新增提示解决的是审核可见性，没有声称已恢复表格内容。
- 用真实缓存对生产 producer 做显式离线传输注入检查：新增表格提示只落到第 16 题，19 题/14 个候选答案/18 段解析及全部候选答案值不变，仍等待人工审核。该检查使用代用渲染页，只证明 producer 行为，不冒充完整真实浏览器验收。

实际缓存诊断、代理复核与人工复核严格分开。历史参考没有独立复核者、时间及完整题干/解析/图片标注，仍是 historical-reference-unverified。

## 合成完整流程基线

6 场景、9 道题：DOCX 稳定配对、PDF 全文、双 PDF 含图片、仅题目、重复支持题号、答案/解析来源冲突。

- 干净场景验证导入、重载、教师逐字段采纳、图片确认、确认不自动入库、显式提交、再次重载。
- 缺失、重复、冲突场景检查应该留空的字段仍留空。
- 指标区分候选答案与明确接受的自动绑定；同值来自错误文件仍失败；重复/漏题不能互相抵消；空分母返回 null。
- 解析片段命中和图片数量只证明被声明的检查项，不证明数学正确、整段完整或图片内容正确。
- 输入文件哈希、整套标注哈希、工具及运行时代码哈希固定。相同输入比较已验证 6 场景各项指标无回退；换了标注/来源会拒绝比较。
- 没有引入打分、预设阈值或新的自动绑定许可。

## 证据与入口

- 初始源码快照：外部 stage0-20261020-03，见阶段 0 报告。
- 外部本轮日志目录：C:/Users/Administrator/.codex/visualizations/2026/10/19/01a15551-7096-7170-a1b9-aae70343c32c/continuous-20261020。
- 合成固定基线：local-run-artifacts/golden-baseline/20261020-baseline/report.json。
- 第一次完整门禁通过后的回放：local-run-artifacts/golden-baseline/20261020-current/report.json。
- 比较报告：local-run-artifacts/golden-baseline/comparison-20261020.json。
- 空表格修复后的最终回放：local-run-artifacts/golden-baseline/20261020-final/report.json；最终比较 comparison-final-20261020.json，6 场景无回退。
- 包括支持 PDF 同类修复的最新回放：local-run-artifacts/golden-baseline/20261020-product-final/report.json；最新比较 comparison-product-final-20261020.json，6 场景无回退。
- 旧探针诊断：local-run-artifacts/golden-baseline/20261020-historical/cache-report.json。
- 已核验来源的新缓存：local-run-artifacts/golden-baseline/20261020-source-bound/content-list.json。
- 来源证据：同目录 source-provenance.json；逐题待复核包 annotation-workspace.json；关键原页代理核对与反事实 agent-visual-review.json。
- 真实缓存的 producer 层最终提示验证：同目录 producer-warning-check-final.json，记录实际 producer 代码哈希；其渲染页为测试替身，禁止当作真实原页证据。
- 给独立复核者的可勾选清单：同目录 REVIEW_CHECKLIST.md；未代替人工勾选或签名。
- 原页 PNG 保存在外部日志目录的 pdf-review 下。输入材料、历史参考和已有缓存保持原样。

## 验证记录

| 命令/检查 | 结果 |
|---|---|
| 审核针对回归 | 2/2，通过 |
| 双 PDF 与源身份顺序置换 | 通过，含正序/逆序与未知源拒绝 |
| 17 场景生产矩阵 | 通过，全部断言保留 |
| 合成完整回放 | 6/6，通过 |
| 逐题指标、非法输入与比较负例 | 通过，纳入默认测试 |
| 11 表真实 IndexedDB 恢复演练 | 通过，二进制和关联保持 |
| 固定输入比较 | 通过，6 场景无回退 |
| 空表格提示红绿回归 | 修复前提示断言失败；修复后通过 |
| 第一次完整 verify:safe | 2071/2071、0 跳过、write-boundary 通过 |
| 空表格提示修复后的最终 verify:safe | 2073/2073，0 失败、0 跳过、0 取消，约 133.5 秒；write-boundary 通过 |
| 对应最终 verify:batch-safety | 通过，退出 0 |
| verify:diff-scope | 首次因沙箱 Git 子进程不可用失败；解除限制后通过；最终逐文件增量核对见外部 final-integrity.json |

第一次全量运行发现了先前未暴露的矩阵顺序问题；修复了有原始块互换证据的原因后再验证。不是通过重试掩盖失败。没有删场景、减断言、调整坏例或把 actual 写回 expected。合成冲突样例初稿使用了不支持的 full+额外支持角色组合；改为合法的 question/answer/solution 三文件输入来触发既定冲突场景，原有必须留空断言不变，首稿失败报告仍保存。

## 改动与保护边界

原有文件的本轮改动只限：

- tests/e2e/review-draft-command-ui-recovery.test.js。
- tests/e2e/true-import-pdf-safe-partial.test.js。
- tests/e2e/production-normal-ui-import-cutover.test.js。
- tests/harness/browser-engine-injection.js。
- ai/TESTING_GUIDE.md。
- ai/CODEX_TASK.local.md 仅增加当前任务/结果入口，历史正文保留。
- qisi-pdf-mineru-producer.js 的空表格审核提示。

最终日志分别为 verify-safe-product-final.log、batch-safety-product-final.log，退出码记录在 gate-results.json；空表格的修复前后日志为 empty-table-red.log、empty-table-green.log、support-table-red.log、all-table-green.log。早期失败日志保留，没有覆盖。

新增内容为 task/report、golden 工具与样例、相应回归和运行文档。最终逐文件哈希、增量范围、Git 状态及补丁在外部 final-integrity.json 及 associated evidence 中记录。初始 dirty 内容保全，暂存内容保持，不 stage/commit/push。没有改 app.js、main.html、DOCX、切题/绑定算法、依赖或架构清单。真实 AI/OCR 请求 0。

## 路线当前进度与剩余工作

| 阶段 | 当前实际状态 |
|---|---|
| 0 固定现状 | 已完成，保留当时失败事实；后续已修复阻断 |
| 1 基线与恢复 | 可执行工具、首批合成基线、真实缓存来源关联、关键原页代理复核及隔离恢复完成；12–15 份真实材料与独立人工金标准未完成 |
| 2 审核闭环 | 已验证现有采纳/保存/确认/入库重载链；修复空表格缺失不可见问题；完整人工修订事件历史尚未新增 |
| 3 按错误分布改进 | 已定位 multipart answer 与边界决策问题，并有离线反事实；没有以单卷样例扩大自动绑定 |
| 4 重构与清理 | 尚未实施；不以删行数为目标，不在缺乏等价性证据时删兼容路径 |
| 5 日常运维 | 已补当前链路与启动/备份/恢复说明，复用现有健康与实例能力；未安排正式数据破坏性演练 |
| 6 产品扩展 | 尚未实施；需按真实使用需求逐项立项 |

下一项实际依赖是独立复核真实标注，而非再增加识别引擎。准备好的 19 题复核包保留 reviewer/reviewedAt 为 null；没有独立标注前，不宣称整卷零错挂或用它校准打分。第 16 题的内容补全与明确边界确认也必须保留人工语义，不能把一次代理视觉判断转成自动绑定通行证。

## 用户选定深圳卷后的续作

用户已选择“使用深圳卷复核包”并要求继续。本次补看其余13页，累计21张完整原页均已查看，并将14张缓存图与原页对应关系作代理检查。新证据与可填写页面位于：

[打开独立复核页](<C:/Users/Administrator/.codex/visualizations/2026/10/19/01a15551-7096-7170-a1b9-aae70343c32c/shenzhen-review-20261020/review.html>)。

该页面支持题号切换、21页原图与放大链接、逐题六项判断、独立转录、JSON导出及导入续填。代理意见和历史参考折叠展示，所有人工判断初始均为 pending，姓名、日期、转录留空。填写只保存在页面内存，导出才得到独立记录；不连接正式应用，不写数据库，没有网络请求。浏览器检查生成的 TEST ONLY 记录属于测试证据，不能算作真实复核。

新增 scripts/golden/review-records.cjs 只读校验本次包字节哈希、原文件哈希、原复核工作区哈希、完整题号集合和显式判断；重复、漏题、错源、非法状态、无说明问题及非法复核者记录均拒绝。空白记录和部分填写可以保存，但不会得到完整复核标记；全部勾选仍需独立转录。即便结构完整也只进入独立校验，goldPromotionAllowed 固定 false，不自动生成 expected、绑定或正确率。新增8项针对回归全部通过。

### 整页检查后的诊断更正

| 题号 | 已核对的现象 | 当前正确分类 |
|---|---|---|
| 8、11、14 | 原始分段包含下一节标题 | 原始块展示边界问题；没有据此认定最终草稿污染或错挂 |
| 10 | 第3页空文本块对应跨页选项；C/D已存在第2页块 | 位置不准确，不能单凭空块判选项丢失 |
| 16 | 第5页续表块无文本/图片；第4页HTML已含全部8/12/2/3，图片仅含8/12 | 整题表格文字已合并，独立续图/位置不完整；纠正此前“棕色行丢失”推断。已有空表格提示仍是待对照信号，不证明整题内容缺失 |
| 16 | 原第16页的题号起始被合入p16b3偏移80 | 有明确原页边界依据，当前扣留继续保留；未采用代理意见自动放行 |
| 17 | 原题要求线面角正弦；数值摘要在p17b5 | 第17–18页原文可核对；不得误写成余弦或只标p17b2 |
| 18 | 第19页判别式推导部分只剩碎公式 | 存在文字/公式连接提取损失，解析数量不等于完整性；仍待独立核实 |
| 19 | 大量第20页证明合入p19b21，p20b0为空；部分第19页条件/连接文字只剩公式 | 内容存在与位置失真必须分开判断；数学论证完整性未认证。后文“(ii)略”前已有证明，不应误判为原卷无证明 |

这些观察均是代理证据，不是人工校准结果。旧 source-bound 目录、旧诊断、原PDF、回执、ZIP、历史参考和全部人工空白字段均保留原字节。当前仍为19题、14个独立候选答案、18段保守保留解析；本轮没有修改生产解析器或扩大自动绑定。

本轮仅新增校验脚本与测试，局部增补本任务说明、golden/README.md 和本报告。完整安全门禁与本轮文件完整性结果保存于新外部包；以 verify-safe.log 和 final-integrity.json 的实际输出为准。未提交、未暂存、未改真实数据、未调用真实AI/OCR。

本次最终 verify:safe：2081项全部通过，54 suites，0失败、跳过或取消，write-boundary通过，退出0。独立校验回归8/8通过；本地浏览器19题、21页、导出导入、错源拒绝和两种布局通过，页面错误0、网络请求0。CLI空白记录合法但未复核，错源测试记录以退出1明确拒绝；没有使用测试记录污染真实标注。

## 后续：完整真实 PDF 界面离线验证

用户再次要求继续后，补齐此前代用 renderPages 的验证缺口。新增 scripts/golden/replay-real-cache.cjs，启动新端口和全新浏览器上下文，从普通 UI 选择原 PDF；仅 MinerU HTTP 使用现有按源哈希回放器，真实 PDF.js 渲染、producer、审核投影和持久化照常运行。入口核对原PDF/ready回执/ZIP/导出content list及图片来源，依赖固定哈希的已有本地worker；不下载，不读回执中的上传地址，不发真实识别请求。默认测试只使用临时合成文件。

[完整本轮结果](../local-run-artifacts/golden-baseline/20261020-real-ui/RESULT.md)及其目录保存真实页面、图片和机器报告。

- 完整选取并渲染21页，按题持久化20张来源页，未关联的第8页为已核对的空白页。实际来源页1191×1684，已校验不是代用像素图。
- 19题、14个独立候选答案、18段保留解析、12张字段图片。每张图片与原ZIP字节一致，token位于其声明字段；刷新后原始证据、字段、凭证和图片完全一致。
- 全部草稿保持待人工核对，存在的题干/答案/解析凭证仍拒绝自动接受；没有采纳候选、确认或提交，正式题目数0。
- 来源缓存诊断与UI的题号、候选答案文本和解析有无相同，但这不代表题面投影完整。

此次实际草稿确认了此前原始块检查未闭环的缺陷：第8题A留在题干且只有三个选项，下一节标题进入末选项；第10题B/C合并且只有三个选项；第18题解答题经过通用选项分隔，题干只剩“已知”；第16题原始HTML虽有两行，但 materialize 优先使用仅含前半表的图片，完整表格没有进入实际题面。原页、原始块、实际字段和截图均存入 projection-findings.json 与 final/report.json。这是后续 PDF 投影修复的明确输入，当前没有修改业务代码或 DOCX 通用分隔器。

本次新增2文件（回放工具、6项合成输入防护测试），局部增补任务、README与本报告。完整 verify:safe 2087/2087、54 suites、0失败/跳过/取消、write-boundary通过；verify:batch-safety通过；增量完整性与范围结果见本轮 final-integrity.json。继续保留原卷、缓存、旧人工空白记录及暂存区原字节；无提交、依赖安装、生产数据修改或真实AI/OCR。离线软件门禁通过与已知内容缺陷严格分开，不宣称整卷内容正确或零错挂。

## PDF投影修复

用户要求继续并明确不再逐阶段等待。先用独立合成输入复现四类问题：首轮8项测试6失败/2通过；增加损坏表格反例再次得到红例，再在既有 qisi-pdf-mineru-producer.js 内作局部修复。

- 已印为解答题、填空题时，不再调用选项分隔，保留命名点与所有分问。
- 仅明确单选/多选、数学区段和图token之外、显式完整且唯一A–D点标签时，为粘连标签加展示分隔；缺号、重复、损坏数学、未知题型不据此补标签或改题型。
- 只从展示材料中移除独立纯节标题；原始块、候选证据和图片字幕保留。
- 表格同时有文字与图片时两者均保留，简单矩形HTML按现有单元格文字展示。跨行跨列、不支持标记、损坏标签不平铺猜补，保留原始文字；图片原字节不改。新增明确的文字/图片/跨页核对提示，仍需人工范围确认。

最终针对性回归12/12通过（新增10项及原空表格2项）。深圳卷真实缓存UI前后比较通过：第8/10恢复4项，第18完整题干及无选项，第16包含棕色2/3与原图片，第11/14节标题显示污染消除；只有这6题的题面投影改变。19题、14候选答案逐值、18解析内容逐文、12张图字节与字段归属均不变，来源证据保持，全部待人工审核，正式题目0，第16解析仍按原边界规则扣留。

同一套合成基线SHA不变，6/6场景通过，相比旧报告所有计数差为0、无回退。未改 app.js、main.html、qisi-utils.js、DOCX、切题/对齐、正式准入、依赖或生产数据，也没有真实AI/OCR、暂存或提交。完整门禁、源码增量、原文件哈希与17项材料保护结果位于 local-run-artifacts/golden-baseline/20261020-pdf-projection-fix。

本次完整 verify:safe：2097/2097、54 suites、0失败/跳过/取消、write-boundary通过、退出0；verify:batch-safety退出0。测试数量增加来自10项独立合成投影回归，原有断言未削弱。

## 河北卷扩展检查与选项图修复

对未用于首轮修复的河北卷建立了新的源PDF→ready回执→ZIP→导出内容/图片哈希关联，未复用历史人工参考。首轮普通UI检查明确失败：图片token进入选项，图片元数据仍是stem。保存失败报告后独立复现，才继续修复，不靠重跑掩盖失败。

进一步核实第4题 C 并非漏识别：原始块 p1b12/image_caption/0 含 C.，parentId明确指向第三张图；缓存把该子块排在图后，导致B带两图、C为空。更正了初步“缺失标签”判断。现仅在已印为选择题、独立A–D字幕、父图精确匹配且整组完整唯一时，把字幕放在其父图前用于展示；不改原始证据顺序，不按几何位置或图片顺序猜标签。

拆分后图片position按精确token所在字段同步，题面候选包含全部stem及option图片，图凭证随之一致。没有父图关系、重复/缺失标签、空选项时不补配，保留原文并提示人工核对。针对性回归包括孤立后置C反例、精确父图C正例、候选采纳及隔离正式提交/重载；只有合成测试写自己的临时库。

河北真实缓存UI修复后19题、14候选答案、18保留解析、17张关联原页、12张字段图，全部待人工审核、正式题目0；第4题四幅选项图正确进入A/B/C/D，原始图片字节不变。第18题解析仍因既有边界问题扣留；未关联的第16/17页不能称空白，属于被扣留解析的来源范围。与修复前可比较报告相比，只有第4题显示变化，答案/解析内容逐值不变。同期复查深圳卷没有新增题面变化；固定六场景基线无退化。

河北材料已因失败被用于开发修复，不再作为此后独立留出成绩宣传。它没有人工金标准或数学正确性认证，错挂总数仍未知。原始失败、红绿日志、比较报告及源文件保护记录均在 local-run-artifacts/golden-baseline/20261020-holdout-hebei。

最终 verify:safe 2102/2102、54 suites、0失败/跳过/取消、write-boundary通过；batch-safety退出0。较前一验证阶段增加的5项测试覆盖选项图字段、孤立/父图字幕与隔离审核准入重载，原断言未削弱。早期2100项日志是补充字幕用例过程中的中间结果，最终以 verify-safe-final.log 为准。

## 双PDF检查及纯展示模块提取

已缓存完整版题目/答案两个固定SHA的源关联分别核验后，从普通UI按 question 与 answer/solution 角色导入。12题、12候选答案、12解析、7图、6张关联来源页，字段来源严格区分主文件与支持文件，图片字节/token/声明字段一致，刷新完全一致；全部待人工审核、正式题目0。这是另一组材料，不能与深圳/河北19题混算，角色组合也不是新的独立样本数。证据在20261020-dual-pdf。

将producer内已经测试过的纯展示函数提取至 qisi-pdf-question-display.js；唯一适配是将题号前缀正则作为显式参数传入。归一化函数源码SHA前后一致：d09cbc4d689f478aff3142465ea24d0663338fa22f15f2545f4ec2be2cf61eeb。producer从370行减至303行，新模块78行，app.js不变；main只新增模块加载，5份架构视图精确登记层0纯owner及依赖。

Node/无IO浏览器作用域兼容、源块不变、原有投影/图片生命周期和架构闭包24项针对检查通过；APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED，原9个处理函数保持。深圳、河北和双PDF三组实际字段/图片/问题提示等价。完整verify:safe 2104/2104、54 suites、0失败/跳过/取消、write-boundary通过，batch-safety通过。

额外独立套件第一次5/6，DOCX场景报page.evaluate执行上下文被导航销毁，没有实测字段结果；该失败和比较报告完整保留。未改变业务逻辑、未加重试，仅加外部导航/调用事件追踪后，6/6通过，161条事件无错误，相同套件SHA和全部业务计数不变。原始间歇故障未复现，根因未确认，不把后续通过描述成已修复导航问题；完整safe中的同套生产回放已通过。所有证据位于20261020-display-module，人工数据仍未认证。

## 回放故障诊断增强

仅修改 scripts/golden/run.cjs 的步骤记录和错误报告，新增 tests/golden-diagnostics.test.js；生产业务文件、来源、标注、指标及等待策略不变。每个操作只执行一次；报告保留发生阶段、前序成功步骤、原始错误栈和耗时，清理错误另记，不替换最初失败。冻结异常对象也不会被强行写入属性。

5项故障注入/返回值测试通过。最终 verify:safe 2109/2109、54 suites、0失败/跳过/取消，write-boundary通过，退出0；verify:batch-safety退出0。6场景独立回放全部通过，套件SHA不变，相比固定基线各项计数差均为0。此次增强提高下次故障的可定位性，不是对旧导航故障的根因修复。没有加入重试、延时或弱化断言。

阶段证据位于 local-run-artifacts/golden-baseline/20261020-runner-diagnostics；其中 final-integrity.json 记录源文件增量、29项原始材料及原暂存区字节保护的实际检查结果。无Git提交。

## 源码整包检查点

在各阶段overlay保留的基础上，将当前源码汇成单个归档；本节在归档前写入，实际是否完成、归档哈希、文件数量和隔离解包比对以 local-run-artifacts/golden-baseline/20261020-verified-source/result.json 为准。只有完整门禁通过、全部文件SHA一致、路径安全和原暂存区/材料保护通过才记录成功。

此包包含当前Git跟踪及非忽略的源码文件、tests/fixtures测试素材和文档，另存只读Git状态/patch/index证据；根目录1.docx/test.pdf仅记哈希而排除归档。不包含生产浏览器题库、外部用户上传原材料、识别缓存、秘密配置或完整依赖环境。只解包至新隔离目录并核对字节，不覆盖当前工程、不运行Git还原、不宣称题库备份或全新电脑部署已验证。旧快照及阶段失败证据保持不变。

## 真实DOCX配对观察：流程通过但内容边界失败

固定源SHA的完整版题目/答案DOCX，通过默认确定性链普通UI得到12题、11候选答案、11解析和6张图；正式题目0、全部待审核、字段和来源重载一致。原ui/report.json的ok仅指既定流程断言，随后内容检查发现第1题解析吞入了带图的第2题答案标签及详解，第2题为空；projection-findings.json与原快照保留该实证，不能把流程通过宣传为整卷正确。

初始观察脚本的二进制遍历未覆盖ArrayBuffer/dataURL，manifest为空，这不能证明二进制已完整核对；后续严格观察会补齐这一缺口。原文件及原报告不覆盖，修复只在明确标签边界负责模块中开展独立合成红绿回归，不猜补第2题空答案。

### 两处DOCX负责模块修复与完整复验

qisi-support-text-parser.js 只允许完整图片token和空白位于题号与明确字段标签之间，并将这些图片保留在该题的解析范围；未知文字、数学、损坏token不能建立该边界，无标签分步仍不提升为题号，重复冲突保留。7项合成用例修复前4失败/3通过，修复后全过。

随后严格检查证明第8/11题的图片在renderableText里位于题号之前，stripQuestionNo错误地将其一并删除。qisi-batch-importer.js只保留这段已识别的原前缀，不改切题或标签算法；5项合成XML用例修复前3失败/2通过，修复后全过。与阶段原字节比较仅5行新增/3行删除；Git整体diff还含用户既有修改，不能都归因于本轮。原rawXml和图字节不改。

真实普通UI完整复验：12题、12候选答案、12解析、6图；只有第1/2题支持内容及来源、图片归属，以及第8/11题题干token发生变化，其余字段不变。第2题C来自未修改的SourcePort既有“唯一已定位解析末尾明确故选”规则，原句为“故选:C”；纠正此前预估该字段仍为空的说法，没有新增推断或阈值。parser单独仍不会从空标签发明答案。

两份原DOCX通过实际uploadPath data URL验证原字节，6张图逐一与本文件精确relationship id/ZIP条目/哈希对应，token字段和来源一致；6张图在实际审核DOM中均可见并成功解码。刷新后所有记录、源字节和图哈希一致。全部待审核，正式题目0；不是人工认证或整卷数学准确率，wrongAttachmentCount仍为null。

新增默认合成端到端用例 tests/e2e/docx-leading-image-boundary.test.js，不依赖本机真实卷。隔离浏览器只回放两份保留的旧JS字节时明确失败，当前代码通过；验证前置题图、标签间支持图、解析不串题、来源、解码、重载及零自动入库。旧脚本源字段位置误判与随后实际图片token失败均保留，未重写失败报告。

最终完整verify:safe 2122/2122、54 suites、0失败/跳过/取消、write-boundary通过，退出0；batch-safety通过；原SHA固定六场景全部通过，所有计数差为0。针对性组合29项及新增端到端用例通过。app.js、main.html、通用Utils、DOCX SourcePort、PDF producer、准入、依赖与既有测试预期未修改，无真实AI/OCR、生产数据修改或Git提交。完整结果、逐阶段失败、real-comparison.json和最终增量/34项材料/暂存区保护见20261020-real-docx。

## 三份Word真实材料观察

只读固定SHA材料，默认full角色普通UI、独立端口与浏览器上下文。佛山19题/18候选答案/19解析/8图，武汉19题/19候选答案/19解析/4图；结构、精确图关系/字节、token、实际DOM解码和刷新检查通过。没有人工标注，不能称整卷正确。

十二校卷明确失败、持久化0题。另一次只读验证追踪原函数结果且原样传递，定位为第1及19题solution的`[DOCX不可显示图片:公式:rId…]`占位符触发`admission-field-rejected`；ownership与controlled-write-evidence检查均拒绝，整批未进入草稿。这是被保留的实际失败，不是OCR请求失败或已修复问题，不能把软件门禁绿解释为该卷通过。原输入、失败快照和两次报告均在20261020-word-corpus，真实识别/正式题目均为0。

新增 docs/BASELINE_STATUS.md 汇总7组导入配置的当前分层观察；不把格式变体计为独立人工金标准。此观察只改文档，业务运行字节保持2122门禁版本。最终源码增量、40项保护及门禁记录以本阶段final-integrity.json为准。

## 不可转换DOCX解析保留审核，正式拒绝不变

仅修改 qisi-import-validation-service.js，新增22行的有限草稿保留分支：明确确定性DOCX、solution包含完整不可转换占位符、字段凭证为精确题号支持匹配、原值与unique证据及全部声明一致，且每个来源确在本次DOCX输入中并具有该题或显式solution角色。任何其他错误仍需逐项满足原规则；题干/选项/答案、PDF/视觉/人工、错源/伪造/空/冲突证据不能使用这个例外。

原FormalAdmissionPolicy、ProductionReviewValidator、审核内容检查、app.js、main、SourcePort、importer和支持文本parser的字节均与本阶段开始一致。没有删除、替换或补全公式占位符。6项新纯回归先2失败/4通过后全过，覆盖源值不变、相邻正常题、伪造证据/角色/状态及混合错误；与已有准入等针对性用例59/59通过。新增普通UI合成用例在旧验证模块下复现整批失败，当前代码通过：坏题确认与提交均失败，正常邻题可审核并提交到测试独立库，重载后坏题和证据仍在。

真实十二校卷离线复验从0道持久化变为19道待审核草稿，18候选答案、19段原解析字段、2图。第1/19题的原不可转换解析与此前失败时逐字节相同，警告及unique证据保留；它们仍被正式准入以solution field-rejected拒绝。第13题缺答案也继续以required-field-missing拒绝；其余16题只通过软件预检查，没有确认/提交。第1轮严格观察原先只预期两个拒绝，额外发现第13题缺失后保留失败，并在新报告明确断言三项拒绝，没有改变产品或旧expected。两张图精确关系/字节/token/DOM解码与所有字段/来源重载一致，真实正式题目0、真实识别0。19段字段不代表19段可用解析或数学正确。

最终verify:safe 2129/2129、54 suites、0失败/跳过/取消、write-boundary通过，退出0；batch-safety通过；固定SHA六场景全部通过，指标计数差为0。证据在20261020-docx-support-review：preservation-proof.json、summary-complete.json、默认端到端红绿和最终完整性报告；原0题报告保持不变。docs/BASELINE_STATUS.md已更新当前分层状态。未暂存、提交、安装或修改生产题库，人工金标准与错挂总数仍未认证。

## 最终源码恢复点

早期1467文件检查点保持历史原字节。本轮全部DOCX修复后的完整源码恢复点位于 local-run-artifacts/golden-baseline/20261020-verified-source-current；本节在归档前写入，实际成功与否、完整safe、源码/归档/解包数量和哈希以该目录result.json为准。仍只归档源码与测试素材，根目录两份散落文档仅记哈希；生产浏览器题库、原始上传材料、缓存、秘密配置和完整依赖不在归档中。新目录内逐文件解包校验，不覆盖当前工程或恢复Git暂存区。


## 已验证支持块的公式间斜杠原样提取

十二校第13题分层追踪证实原生MathType转换已成功，缺口在支持文本答案语法。仅在 qisi-support-text-parser.js 新增有限单行语法：expectedQuestion=true、已接受边界、明确answer/full角色、完整公式组间字面斜杠。保留原文字面顺序，不拆分、计算或解释斜杠。已有答案声明下的被拒重复边界只参与原冲突检测，不产生独立绑定；错号、错角色、损坏/多行/文字/连续斜杠保持拒绝。

新增7项纯回归及2项默认UI回归。原代码运行新UI测试1失败/1通过，当前2通过；ASCII未验证边界仍留空。初次正例错误使用ASCII题号，保留失败并改用producer原本可验证的全角题号，同时新增ASCII拒绝例；没有修改旧预期或producer。首次追踪在刷新后读取导致内存观察为空，第二个新上下文在刷新前保存，包装只返回原值。

真实普通UI复验为19题、19候选答案、19段保留解析、2图，全部pending、未确认、正式0。real-comparison.json证明第13题答案与先前捕获的support-p268字面文本完全一致；仅answer及其fieldProvenance/supportEvidence变化，其余测量字段、原始题面XML和图片字节不变。第1/19题解析正式拒绝保持；第13题原缺失已消除，但数学含义和正确性未经人工认证。初次比较器漏归一化图片凭证内的会话ID，导致第8题额外差异；核实精确XML rId、来源及字节后统一映射实际图片ID，原脚本和说明保留，未忽略其他凭证字段。

完整verify:safe 2138/2138、54 suites、0失败/跳过，write-boundary通过，batch-safety通过；固定SHA六场景9题指标无变化。证据目录为local-run-artifacts/golden-baseline/20261020-docx-answer-formula。相对1475文件基线仅parser、本任务/结果、状态文档及2个新测试允许变化；51项材料/历史包与原暂存区校验以final-integrity.json为准，增量保存source-overlay。无真实AI/OCR、生产数据写入、暂存或提交，人工金标准仍待填写。


## 合成审核入库至组卷打印预览

新增tests/e2e/exam-print-preview.test.js，业务源、app.js、UI模板和既有测试全部只读。全新33110端口/上下文以两份新建合成DOCX经普通导入、逐题图片确认/审核、明确提交到独立测试正式库，随后加入车、重排并刷新。题目卷、题目带答案新页、题答分卷三种真实blob预览均观察实际DOM：顺序与答案一致、题目卷无答案/解析、公式有KaTeX且无错误/残留图token、原GIF字节及解码一致、恶意形状标题仅作文本。仅新页面window.print替身记录按钮调用，不执行系统打印；新增失效选题时原门禁阻止打开任何预览，正式测试题原值不变。

首次用AppProxy存在判断刷新完成，观察到车空；原报告保留。定位onMounted在代理暴露后异步恢复车，测试改为先断言重排已持久化，再等实际车长度恢复；无固定延时/重试或业务修改，随后完整针对性用例通过。这是此新测试的就绪条件修正，不宣称修复历史导航上下文销毁故障。

证据在local-run-artifacts/golden-baseline/20261020-exam-preview；完整safe 2139/2139、54 suites、无失败/跳过/取消、write-boundary及batch通过；固定六场景比较全0差异。1477文件/54项保护、原暂存区及增量overlay以final-integrity.json实际结果为准。未执行真实材料审核、正式用户库写入、付费调用、暂存或提交；合成打印DOM检查不代表实际纸张/分页视觉验收。


## 单PDF与题答双PDF审核至打印预览

新增tests/e2e/pdf-exam-print-preview.test.js，在33170/33171端口复用固定SHA合成套件pdf-full及pdf-dual-with-image，只有HTTP识别边界按文件字节回放；默认producer、准入、持久化与打印代码不变。验证导入和刷新后仍无正式题，未采纳提交被拒绝，逐字段明确采纳/图片确认后审核本身仍不入库，显式提交才进入独立测试库。再刷新组卷，实际blob题答预览核对题目/选项/答案/解析顺序及字段、图片所在选项和字节/解码、原正式记录不变，系统打印未执行。

首次及诊断轮单PDF通过、双PDF因比较器直接拿含IMAGE占位符的字段与DOM textContent比较而失败，原日志和诊断HTML/截图保留。实际KaTeX含MathML/TeX注释/可见HTML三份文本（图1在textContent中成为图111），不是视觉重复。比较器现按每个KaTeX的唯一源注释计一次，原IMAGE占位符独立核对所在选项数量及精确字节，不忽略图证据或其他文本。最终两项通过；没有修改业务或旧测试/标注。

first-evidence、diagnostic-evidence、final-evidence保留各轮；最后的-observed.json仅表示采集、validation=pending，对应不带后缀JSON才是断言全部通过的报告。已查看两份合成预览截图，未发现此夹具上的明显视觉错误；1px夹具不能证明真实试卷插图语义或纸张分页。原人工金标准和真实错挂总数仍未知。

本阶段同时以原固定SHA和原观察器复查佛山/武汉DOCX；只读结果及逐字段对比另存本目录，不采纳/确认/提交真实题。最终safe/batch、固定六场景与1478基线/57项保护、原暂存字节、增量overlay以final-integrity.json为准。全部运行代码保持本阶段开始字节，无真实AI/OCR、生产数据写入或Git提交。


本阶段最终门禁2141/2141、54 suites、0失败/跳过/取消、write-boundary及batch通过，固定SHA六场景指标全0差异。real-comparison.json记录佛山/武汉共38道待审核草稿与此前测量完全一致（分别18/19候选答案、8/4图片），没有确认或正式题。当前阶段完整源码可校验包在full-source，实际归档/隔离解包文件数与哈希以result.json为准；复用同阶段已完成门禁日志，未在解包目录安装依赖或另跑测试，生产浏览器题库不在包内。归档之后不为回填机器结果修改活动源码，历史归档/失败报告和人工空白记录保持原字节。


## 普通PDF导入暴露并修复完整备份文件名缺陷

新增tests/e2e/import-backup-portability.test.js，从固定SHA合成双PDF普通导入产生真实格式图片ID，明确采纳/审核并只提交第一题到独立测试正式库，第二题保持pending。首次和诊断轮在UI下载备份处失败；原backupStatus明确ARCHIVE_ENTRY_NOT_ALLOWED。原因是qisi-backup.js内部safeName只替换Windows保留字符，合法图片ID中的源块编码%2F仍进入ZIP路径，被原full-backup白名单拒绝。

唯一业务变化是safeName字符替换表达式改为原归档规则允许的ASCII字母/数字/点/下划线/连字符；原metadata图片ID、引用、内容、索引去重、截断和读取规则不变。没有放宽qisi-archive-security.js。新增6项纯回归：原生编码ID、Unicode/标点、清理碰撞、截断碰撞、旧包记录路径读取和完整合法包插入恶意条目的精确拒绝码。默认首次unit运行被Node spawn EPERM阻止，未计为红例；获准本地运行后原源2失败/4通过，当前6通过，相关备份/恢复19项通过。

修复后下载及跨来源恢复成功。首次深比较仅因JSON不保存6个undefined可选属性失败，原日志保留；比较器只排除undefined对象属性，其余定义值、数组、ID和Blob字节保持全量比较。最终33300→33301两个全新来源，UI恢复预览前不写数据、明确确认及恢复前安全ZIP保存通过；11表定义值/二进制、1道正式测试题、2道草稿、2份来源、正式和草稿各1图一致，邻题仍待审核，源库不变。恢复后的实际blob预览能解码同字节图并正确显示题目，系统打印被替身拦截。合成原ZIP、报告和已查看的截图在final-evidence；不代表用户生产题库恢复或真实数学质量认证。

本阶段证据目录20261020-import-backup-portability，含全部失败和诊断、backup-before.js及一行diff说明。最终safe/batch、六场景比较、1479基线/63项保护/原暂存区和精确overlay以final-integrity.json为准。完整源码恢复包另存full-source，其result.json是实际归档/隔离解包结果，门禁日志来自同阶段活动源码，并未在解包目录安装/另跑测试。无真实AI/OCR、生产用户数据写入、暂存或提交。

本轮备份缺陷修复最终verify:safe 2148/2148、54 suites、无失败/跳过/取消，write-boundary及batch通过；六场景9题固定输入对比全0差异。源码和旧材料/暂存区保护实际检查及包含修复的完整恢复点分别以final-integrity.json和full-source/result.json为准。


## 恢复前安全包写失败的真实UI保全

新增tests/e2e/backup-safety-write-failure.test.js，在33360/33361两个新浏览器来源分别仅在before-restore写入端口注入一次QuotaExceededError与NotAllowedError；备份、恢复Workspace、Repository和原生IndexedDB未替换，全部业务源码只读。UI明确确认后，首次失败检查原题/图与11表计数完全不变、主框架无跳转、没有成功安全包、写入中止、恢复状态和页面inert解除、预览和确认保留。另一次明确UI点击才重做恢复，原库安全包保存成功后incoming题/图生效，且安全包可读回原题和原像素。

首次两例在成功恢复的最终比较处发现合成输入缺少现有派生题目索引字段，现有creating hook按正常行为补齐；原安全保全断言均已通过，原失败日志保留。夹具改为用既有公开QuestionDuplicatePolicy构造完整当前索引字段，继续全字段精确比较，未削弱任何拒绝或保全断言、未修改业务，最终2/2通过。第二次显式点击是另一次用户动作，不是产品自动重试。fault-proof.json记录测试源SHA与上述边界。

证据在20261020-restore-safety-fault，最终safe/batch、固定六场景比较、1481基线/69项保护、原暂存字节和精确overlay以final-integrity.json为准。上一阶段包含备份修复的完整恢复包保持原字节，本轮只增加测试与文档。无真实AI/OCR、生产用户数据写入、Git暂存/提交或物理打印。

恢复前写失败阶段最终verify:safe 2150/2150、54 suites、0失败/跳过/取消，write-boundary及batch通过，固定六场景9题全0差异；最终范围及69项保护以final-integrity.json为准。业务运行字节保持2148修复版本。


## 原生IndexedDB恢复事务中途失败的原子性

新增tests/backup-restore-atomicity.test.js，全新临时页面与随机命名测试库使用原StorageRepository.restoreBackup、原生IndexedDB及真实snapshot policy。11表均准备旧/新记录，包含正式图、草稿图和嵌套来源Blob；仅测试库creating hook在第2表images或最后表draftImages投一次QuotaExceededError，不替换写入方法或事务实现，没有实际填满磁盘。

首轮2/2通过。逐表creating事件证明questions等前序新行写入已发起，故障在指定顺序发生并以quota-exceeded拒绝；事务结束后独立递归字节化比较确认11表完全等于旧记录/二进制。明确第二次调用才使11表完全等于incoming，原始Bytes/type/来源与图片引用都参与比较。无业务源码变化，也没有产品自动重试。

证据在20261020-restore-atomicity：targeted-first.log、fault-proof.json及测试源SHA；最终safe/batch、固定六场景、1482源码/72项保护、原暂存区和精确overlay以final-integrity.json为准。已有完整恢复包保持原字节，最新测试和文档作为独立增量。未写用户题库、调用真实AI/OCR、暂存或提交。

原子性阶段最终verify:safe 2152/2152、54 suites、0失败/跳过/取消，write-boundary及batch通过；固定六场景9题指标全0差异。docs/RUNBOOK.md已补充已验证的失败后处理和源码包/题库包区别，没有承诺断电/全部真实故障保证。最终72项保护、原暂存区及本阶段增量以final-integrity.json为准。


## 实际打印PDF中的含图选项异常分页与标签对齐

2152软件门禁后，仅证据目录生成实际PDF，活动源码保持原字节。旧合成短双题卷从普通打印HTML导出5页，题1的D项和图题注分散到多页；无图单题卷2页。原PDF/PNG/文本和同源CSS/字体完整加载的第二轮仍5页保留于20261020-print-pdf-qa。不是简单的缺字体；反事实只将含img的option-content设inline-block即2页，去外层grid仍5页。

新增tests/e2e/pdf-print-pagination.test.js，从固定SHA的单/双PDF普通UI导入、明确审核提交到自身测试库、真实blob预览导出PDF，再用原PDF.js独立读回文本和页数。原样式单卷通过、含图卷5!=2失败；唯一app.js变化为openPrintWindow打印CSS既有规则同行追加含图span选择器，没有增加行数、业务逻辑或新模块，也没有改主页面/字段/序列/准入。Blob打印文档不继承主页面样式，局部改动避免额外模块和接线。

初版inline-block虽2页，Poppler逐页PNG发现D字母落到图片题注基线。保留初版PDF和其完整2154检查，新增顶边一致断言在初版下独立失败；同一选择器加vertical-align:top后2项通过，最终版再次完整门禁，旧绿检查不冒充最终检查。最终两份实际PDF各2页，题目/答案分开、双卷1个原图片对象；pypdf独立验证及Poppler全部4页已查看，当前夹具没有剪裁或标签偏移。1px合成图不代表真实插图语义、整卷数学质量或所有复杂长题的分页保证。

证据在20261020-print-pagination-fix，包含两类红例、初版完整检查、最终PDF及分页/顶端对齐回归、app原始拷贝和pagination-proof.json。最终完整safe-final、batch-final、固定六场景、1483基线/75项保护与原暂存区及overlay以final-integrity.json为准。完整源码恢复包另存full-source，其result.json记录实际哈希和隔离解包；日志来自同阶段活动源码，不是在解包目录重测。没有真实材料审核、真实AI/OCR、物理打印、生产数据写入或Git提交。


## 最终完整门禁失败保全与停止

最终verify-safe-final.log退出1：2154测试、2153通过、1失败、无跳过/取消，最后write-boundary未执行，不能宣称完整门禁通过。失败为tests/golden-production-replay.test.js中的docx-stable-pair，在mark-reviewed:1调用AppProxy时发生Execution context was destroyed, most likely because of a navigation；此前步骤含导入/重载/测量/选题均通过，完整步骤和堆栈从仍在的临时报告复制为failed-full-golden-report.json。此前已知同类故障根因未确认；此次阶段更具体，但仍不能说是CSS导致、已修复或无关。

最终打印专项2/2、独立固定六场景与batch通过，但不足以覆盖失败的完整门禁。没有重跑刷绿、放宽旧预期或删除失败。按AGENTS.md停止条件“verify:safe fails and the cause is not clearly within scope”停止业务修改，仅保全证据与状态说明。gate-blocker.json记录实际退出、最后完整绿版本2152和停止依据；最终full-source仅准备脚本，尚未生成归档或result.json成功，不能把旧恢复点当作包含此打印修复的已验证包。

当前改动和专项PDF作为可审查证据保留，不发布/暂存/提交，生产数据、原暂存区、人工空白记录和旧包仍受保护。下一项需要以这次mark-reviewed:1的导航事件为独立故障定位范围，不能靠等待或产品重试推测解决。

## 2026-10-21：导航失败证据补齐，业务规则保持

用户无暇人工复核，要求继续软件工作。按现有授权保留1484份初始源码、79项受保护材料/旧失败报告及原暂存区；未填写任何人工字段。

先保留16次独立DOCX单场景观察，再保存常速、CPU降速4倍、8倍的完整六场景观察；均未复现昨日mark-reviewed:1导航上下文销毁。它们只说明这些观测通过，既没有定位根因，也没有证明间歇故障消失。未使用自动重试替换失败，所有原报告都在。

新增scripts/golden/navigation.cjs，只订阅CDP页面导航、Document请求发起类型/有限栈、frame/loader、执行上下文及崩溃事件。run.cjs在独立诊断阶段启用，成功/首个失败报告保留快照，浏览器上下文负责释放会话并移除订阅。URL去账号/查询/片段、请求体不采集；最多最近200事件，截断数量显式报告。观察器启动失败仍使场景失败；没有页面重载、方法重做、等待刷绿或审核/准入更改。工具SHA涵盖新模块。

新tests/golden-navigation.test.js与tests/e2e/golden-navigation.test.js合计8项；加原故障分层5项，专项13/13。先缺模块红例，再验证真实受控页面跳转破坏待处理evaluate、frame/loader/上下文证据存在、失败报告携带导航事件、观察器失败/首个原错误/清理与不重试。未改旧expected、共享harness或业务源码。

命令：专项exit0；npm.cmd run verify:safe exit0，2162/2162、fail/skipped/cancelled0，write-boundary通过；npm.cmd run verify:batch-safety exit0。固定六场景的独立报告与初始同SHA指标比较、增量范围、79项保护和原暂存区的实际结果见本阶段final-integrity.json。源码归档与新目录逐文件恢复结果以full-source/result.json为准；不能把源码包当生产题库备份或独立安装证明。

证据：local-run-artifacts/golden-baseline/20261021-review-navigation。Git分支及HEAD保持stage/program-c-corrective-r1 / 3099a479ca4a8bd5e2a06f2365bb78bc5ff848af；无stage/commit/push，无真实AI/OCR，无用户服务重启，真实正式数据未改。下一项只在本阶段完整性完成后登记；导航根因及人工金标准仍待解决。

## 2026-10-21：坏图不再误报打印就绪

用独立构造的正常GIF与损坏GIF分别通过普通DOCX题目/支持导入、显式审核提交至各自新测试库，再原生组卷打开Blob打印页。旧版本正常用例通过，损坏用例在按钮状态断言失败：complete=true、naturalWidth=0、decode拒绝，却显示“渲染已就绪”且按钮启用；红例1/2与截图保留。未通过改变数据库或绕过校验制造失败。

app.js只改openPrintWindow内联就绪脚本中btn.disabled、btn.textContent两条现有UI赋值：损坏图或现有missing-image占位时保持禁用并说明修复后重新生成。独立Blob文档需要就地更新状态；没有新增解析/绑定/业务算法、模块接线或行数，5286→5286，其他行及换行字节保持。tests/e2e/print-image-readiness.test.js新增两项原生UI回归；正常图可显式调用测试打印替身，坏图不再谎报就绪，正式测试记录和图片Blob字节全程相同，系统打印未实际执行。红/绿损坏页截图均已查看。

绿专项2/2、verify:safe 2164/2164（fail/skipped/cancelled0、write-boundary通过）、verify:batch-safety exit0。固定6场景和前后指标、1487份初始源码/85项材料/原暂存区检查的实际结果见20261021-print-image-readiness/final-integrity.json；源码恢复点实际结果以full-source/result.json为准。原有题库、原文件、真实材料和未填写人工记录未动；未提交或重启用户服务。该按钮检查不能阻止浏览器菜单打印，不能替代整卷目检或数学质量审核；历史导航间歇故障继续保留为未归因。

## 2026-10-21：有效备份下载不再因状态记录失败而误报

用户关心原有正常功能，保持1488份初始源码、91项材料及原暂存区。两条原生UI故障注入分别让qisi_last_full_backup_at或qisi_last_full_backup_report的一次Storage.setItem抛QuotaExceededError；其他存储和归档均为原生。两个红例的实际下载ZIP均可验证读回，11表及Blob字节与导出前完全一致，但UI显示“操作未完成（22）”，故原测试2/2失败，完整包与报告保留。

qisi-backup.js仅exportFullDatabaseBackup中两条记录写入包入try/catch并console.warn；创建、完整验证、下载仍在catch之外，原返回manifest不变。app.js及其他业务字节本轮未改。新增tests/e2e/backup-download-status-failure.test.js两项：故障后仍真实下载有效归档、状态准确、忙状态解除、当前11表/二进制不变，下一次明确点击仍成功；没有自动重试。新增tests/backup-download-status.test.js五项，证明仅记录错误可警告返回，DB读取/归档验证/下载错误仍拒绝且不写成功状态，原错误身份保留。

专项UI2/2、错误边界5/5；verify:safe 2171/2171，fail/skipped/cancelled0、write-boundary通过；verify:batch-safety exit0。原6场景同SHA逐项对比、1488源码/91项保护及原暂存区实际检查见20261021-backup-download-status/final-integrity.json；该阶段full-source/result.json为源码恢复副本实际结果。源码包不含生产题库、完整依赖或真实材料，不能当题库数据备份。

当前UI仍只声称发起下载，不能证明用户已把文件保存在磁盘，必须人工确认；没有吞掉实际创建/校验/下载失败。原有题库和原材料未动、深圳人工字段未填、真实AI/OCR0，无Git提交或用户服务重启。历史导航间歇故障依旧未归因。

## 2026-10-21：自动答案分母不再漏计或重计

只修离线scripts/golden/metrics.cjs；所有生产模块、app.js、原golden输入/标签、共享harness、人工字段和原始材料均只读。独立合成反例证明：重复题号自动答案进入总分母却不进任何计数；未标注值的错身份会同时计错与未知，错来源则只记未知；显式扣留字段被接受时甚至计正确。已保留原版7项全红及初次修复后重复组已知错误的2项红例，不以生产输出反写标签。

现在自动答案恰好属于正确、已知错误、未判定之一；三者合计等于总自动答案。重复组先记可独立证明的显式扣留/错身份/来源/答案值，其余才是无法选唯一身份的未判定；不选一条当正确、不凭分数绑定、不改变生产准入。ambiguousAutomaticAnswers仅为未判定子集，有未判定时automaticAnswerPrecision=null。未知题号仍逐个记错。原candidate指标、题号语法、API导出和6场景既有业务计数保持；新增计数字段向后兼容。

新tests/golden-automatic-accounting.test.js九项，连同原指标/比较断言专项21/21；另保存5个独立负例在原版/新版的输入SHA、计数和精度对照，输入未改、API导出集合保持。verify:safe 2180/2180，fail/skipped/cancelled0、write-boundary通过；verify:batch-safety exit0。固定6场景同输入SHA比较、1490源码/97项保护及原暂存区实际结果见20261021-automatic-accounting/final-integrity.json；源码恢复点实际结果见full-source/result.json。

不因此宣称任何真实试卷数学质量、错挂总数或人工审核时间已知。深圳人工金标准仍待填写，真实wrongAttachmentCount仍null；历史导航间歇故障未归因。无AI/OCR、正式数据修改、用户服务重启、依赖安装或Git提交。

## 2026-10-21：深圳、河北Word变体只读试导入

固定SHA的两份Word分别在新端口/新浏览器以full角色走默认确定性DOCX普通UI。深圳19题/19答案/19解析/11字段图；河北19/19/19/12。题号实际为1–19，每题pending、人工未确认、正式0；原始XML和来源字节保留，图按精确rId回查ZIP字节，IMAGE/FORMULA_IMAGE令牌字段唯一且位置一致，审核DOM可见/解码通过，刷新后完整快照一致，未检出不可转换占位符或警告。原文件、人工记录和业务源码均未改，外网与AI/OCR0。

这只是两份已观察PDF同卷的Word格式验证，不能增加独立人工样本数；19个答案/解析字段不是19个经认证正确答案/完整解析。完整自动观察和来源证明在20261021-docx-variants各case/report.json，summary.json保留humanGoldCertified=false、wrongAttachmentCount=null。当前源码恢复点仍为20261021-automatic-accounting/full-source；本阶段仅任务/结果/状态三份文档增补，另存source-overlay及完整性记录，无需复制生产题库或覆盖旧包。

用户询问原任务单完成比例：明确整体按验收项目粗估40%–50%，不是测试数换算，也不是准确率。安全、回放工具和主线检查较完整；人工金标准、统一存疑工作台、大规模app拆分/旧代码治理、定向识别/性能运维及远期功能仍有工作。对应清单写入docs/BASELINE_STATUS.md，后续按此汇报，避免只报测试术语。

本阶段最终safe/batch、固定6场景及1491源码/105项保护/原暂存区的实际结果以final-integrity.json为准；不以观察通过代替当前最终门禁。旧导航间歇故障未归因，无提交或用户服务重启。

## 2026-10-21：旧代码清理前的只读入边清单

复用既有runtime-modules登记/校验，新增tools/inventory.cjs与tests/inventory.test.js。只读扫描根入口、JS及tests/scripts/tools，跳过秘密配置、依赖/vendor、运行证据、tmp/deliverables与目录链接；Acorn只解析不执行，输出路径/哈希/引用位置，不输出源码正文。HTML脚本、静态require/import、文件名保守引用与入口可达性分开记录，孤立引用环不会自动算在生产使用；动态加载/解析不确定明确列出，平台登记不是生产入口证明。

先缺模块红例，再11项保护检查；初版实际扫描将有效CommonJS顶层return误作解析失败，保存初版报告，补独立红例后修正CommonJS解析上下文，非法.mjs返回仍存疑。最终扫描532份源/入口、123根JS目标、1461引用边：live98、dormant22、uncertain3、dead-candidate0。三个browser登记但缺静态生产路径文件为qisi-pdf-external-producer/provider与qisi-pdf-page-evidence；只标入口复核，不宣称登记一定错误或允许删除。动态模块加载20条，staticAnalysisComplete=false；不能凭此宣称不存在死代码。

原建议可立即删除的.bm_a4_app_before.js、qisi-app-facade.js、qisi-ui-renderer.js、qisi-review-view-model.js实际仍有诊断/测试入边，保留原文件；没有按候选删除。报告deletionAuthorized=false。输出只允许新运行证据目录、拒绝覆盖和目录链接越界；实际Windows junction位于tests白名单内的额外隔离验证也未读到外部假源码，清理没有改变外部假文件，proof绑定工具SHA。

专项11/11，verify:safe 2191/2191、fail/skipped/cancelled0、write-boundary通过；verify:batch-safety exit0。固定6场景、1491原源码/109项材料/原暂存区的实际核验见20261021-code-inventory/final-integrity.json；actual-final/report.json和report.md为引用报告，初版actual报告保持。新源码恢复点以full-source/result.json的实际结果为准，不含生产数据、完整依赖或真实卷子，不声称独立安装。

原任务单“入边清单”已完成，安全清理和app.js大规模拆分尚未完成；仍按整体40%–50%粗估，不拿测试数换算进度。无业务/主界面/架构登记修改，无tag/提交、真实AI/OCR、生产数据或用户服务重启。历史导航根因和人工金标准缺口仍保留。
