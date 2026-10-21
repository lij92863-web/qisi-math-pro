# 离线回放与标注约定

本目录的 synthetic-suite.json 是 6 个合成行为样例，包含 9 道题。它验证当前生产入口、确定性 DOCX 解析、模拟 MinerU HTTP 响应后的处理、审核、持久化与入库。PDF 的缓存块是人为构造的测试数据，不是对这些 PDF 字节做出的真实识别结果；不得宣传为真实试卷金标准。

## 执行

在项目根目录运行：

    node scripts/golden/run.cjs --out local-run-artifacts/golden-baseline/new-run

输出目录需要使用新名称；已有 report.json 不会被覆盖。默认使用独立服务端口 32671–32676 和全新浏览器上下文。它不连接用户的 3000 服务，不使用正式浏览器题库。仅外层识别响应按原文件 SHA-256 回放；不注入最终草稿或跳过正式校验。

完整回放也由 tests/golden-production-replay.test.js 纳入默认 npm test / verify:safe；报告写在系统临时目录，用例会打印路径。需要解除受限环境的子进程限制才能启动 Node/Chromium，不应因此改弱验证。

每个新回放场景在浏览器启动后采集只读导航证据：主/子frame、loader、Document请求的发起类型/有限调用栈、执行上下文创建/销毁与崩溃事件。失败报告仍保留首个异常和阶段，不重试；观察器自身启动失败也使场景失败。URL去掉账号、查询参数和片段，不采集请求体；最多保留最近200条事件，并明确报告丢弃数量。成功报告中的导航记录或多次通过不代表历史间歇故障已修复；需要实际失败时的事件才能归因。

三个干净场景进一步模拟教师逐字段采纳、图片确认、标记确认、提交与重载，验证确认本身不自动入库。负面场景保留缺失、重复和冲突字段，检查不能被悄悄补上。人工审核分钟数始终为 null；运行耗时只是模拟流程的耗时。

## 输入协议

- schema 固定 qisi.golden.v1；每个样例有唯一 id。
- annotation.kind 区分 synthetic、historical-unverified、human-reviewed。后者必须记录 reviewer、reviewedAt；元数据记录不等于工具替人担保标注质量。
- sources 的 file 相对项目根目录，sha256 必须与实际 PDF/DOCX 字节一致；roles 使用真实 UI 支持的角色组合。MinerU 模拟输入 items 必须固定在样例中。
- 每题 number 唯一；stemIncludes 为独立选定的身份锚点；optionCount / imageCount 明确数量。
- answer 为参考值或 null。null 表示未标注，不能当作正确答案为空；withhold 才表示此情形必须留空。
- solutionIncludes 只检查一个已标注解析片段。它不能证明整段解析完整或数学正确；没有完整标注时不报告“解析准确率”。
- answerSourceFile / solutionSourceFile 指定字段必须来自哪个原文件；相同值来自错误文件仍失败。
- expectedAutomaticAnswers 固定本样例当前许可的自动接受数量。拒绝的 PDF 候选即使显示在 answer 中，也不计入自动绑定。
- 退出 0 表示本套样例满足既定行为与安全要求；非 0 必须查看逐题诊断，不能反写 actual 生成 expected。

指标按题号和题干身份锚点匹配，重复/漏题单独计算；零分母返回 null。报告区分候选答案和被接受的自动绑定，保留来源、字段凭证、问题、输入/工具/运行时代码哈希。自动率、人工耗时和真实 OCR 质量尚无真实人工样本支撑，不填猜测数字。

自动答案分母按三个互斥计数闭合：correctAutomaticAnswers + wrongAutomaticAnswers + ungradedAutomaticAnswers = automaticAnswers。重复组先保留可独立证明的错身份、错来源、错答案或显式扣留违规；其余无法选定唯一身份的自动答案计入未判定，绝不选择一条当正确。ambiguousAutomaticAnswers是未判定中的子集，不能再相加。未判定存在时automaticAnswerPrecision为null。违背显式answer扣留的自动接受计错，即使文本碰巧相同；未标注参考答案不能掩盖已知归属错误，也不能把一个答案同时计错与未判定。未知题号仍逐个计错，重复不会减少错误数。该计数修正只用于离线报告，不改变生产绑定或任何人工标签。

## 同输入比较

    node scripts/golden/compare.cjs --before old/report.json --after new/report.json --out local-run-artifacts/golden-baseline/comparison.json

两个报告的整套样例 SHA-256 必须一致。修改了来源或标注，就建立新基线并记录标注修订原因，不把它算成算法提升。比较门禁检查每个样例的身份召回、答案与解析锚点覆盖下降，以及任何错误/未标注自动接受；它不证明未知材料准确率。

## 历史真实缓存

仓库已有一份深圳卷历史参考 JSON 和 MinerU 原始块。使用显式参数只读诊断：

    node scripts/golden/audit-cache.cjs --content-list CACHE_content_list.json --reference REFERENCE.json --out local-run-artifacts/golden-baseline/new-cache-audit

该入口只测提取结果到分段组装，记录两份输入及对应模块的 SHA-256。它不运行浏览器、上传 PDF、调用识别或写入题库，不是完整入口验收。参考文件尚缺原 PDF 身份绑定、复核者和完整字段标注，报告始终标 historical-reference-unverified，错挂数量返回 null，精确字符串不一致也不直接记为数学错误。

2026-10-20 已有历史诊断位于 local-run-artifacts/golden-baseline/20261020-historical/cache-report.json。真实金标准下一步需补原文件哈希、逐题完整身份、题干/选项/图片/答案/解析标注、字段应否存在和复核记录，并保留一部分未用于调规则的材料。

后续已建立与原 PDF/任务回执/ZIP 哈希关联的缓存与 19 题复核包，位于 local-run-artifacts/golden-baseline/20261020-source-bound。旧探针与来源关联 ZIP 有 5 项差异，不混用。source-provenance.json 记录关联证明；annotation-workspace.json 保留独立复核字段为空；agent-visual-review.json 记录关键 8 页的代理核对，不代表整卷人工认证。“未检出独立声明”表示当前提取协议没有产生独立 answer 值，不能推断原页或 OCR 缓存中完全不存在分问答案内容。

## 独立复核记录校验

用户选定的深圳卷现有独立填写包位于外部 shenzhen-review-20261020 目录。review.html 展示 21 张完整原页、19 题缓存原文及图片，代理意见与历史参考默认折叠；六项人工判断、独立转录与复核者信息均为空。填写只保存在当前页面内存，离开前导出 JSON，后续可导入继续；不写入正式应用或本地数据库。

    node scripts/golden/review-records.cjs --packet "<review-packet.json 路径>" --records "<导出的记录.json>" --out "<新的检查报告.json>"

校验绑定本次包的字节 SHA-256、原 PDF SHA-256、原始复核工作区 SHA-256 及完整题号集合。未知、重复、漏题、非法判断、非人工类型或无说明的问题记录会被拒绝。空白和部分填写可合法保存，但不会显示为完整复核；全部勾选仍需独立转录，才能进入下一步独立校验。该入口仅检查记录结构，不鉴定人的身份、内容正确性或数学推导；goldPromotionAllowed 始终为 false，错挂总数仍为 null，不修改 expected 或生产绑定。

整页代理复核的后续更正：第16题 p5b0 为空，但前页 p4b6 的 HTML 已合入棕色2/3，不能称整题表格数据丢失；对应表格图片仍只含前页部分，需要把文字完整性、图像完整性和原页位置分开核实。第19题后页证明被合入 p19b21，空续块不等于证明丢失；第18–19题另有部分条件/连接文字未完整提取。原页及旧报告均保留，不以这些发现自动猜补。

## 真实 PDF 与缓存的普通界面离线回放

    node scripts/golden/replay-real-cache.cjs --config "<显式缓存配置.json>" --out "local-run-artifacts/golden-baseline/<新的输出目录>" --port 32731

配置 schema 为 qisi.real-cache-replay-input.v1，source、receipt、zip、contentList 各带本机绝对 path 和 SHA-256。入口核对 PDF 字节、ready 回执的 sourceId/zipSha256、唯一 content list 导出内容与全部引用图片。任一哈希、关系或资产缺失即在启动浏览器前拒绝；配置中的其他旧回执信息不作为网络地址使用。需要已有固定哈希的本地 PDF.js worker，不会下载它。输出必须位于 workspace 的 golden-baseline 下且不能覆盖已有目录。

只有识别 HTTP 响应使用现有文件哈希回放器；普通 UI、PDF.js、生产 producer、审核投影与持久化照常运行，使用新端口和全新浏览器上下文。入口检查零正式题目、待人工确认、原页实际尺寸、每张题图与 ZIP 字节一致、token 位于声明字段，以及刷新后来源证据/字段/图片一致。它不采纳候选、确认或提交题目。

report.ok 仅代表这段离线软件验证通过，不能表示整卷内容正确。报告保存实际草稿、原页和图片哈希、运行代码哈希及界面截图；humanReviewRecorded 为 false、wrongAttachmentCount 为 null。真实材料不进入默认测试，默认仅运行合成输入防护测试。

首个深圳卷完整检查位于 local-run-artifacts/golden-baseline/20261020-real-ui/final。选取并渲染21页，按题持久化20张来源页（空白第8页无题目关联），19题/14候选答案/18保留解析/12张字段图片，刷新一致，正式题目0。投影诊断另记录8/10题选项拆分、18题题干误拆选项、16题表格文本与图片表达不同；这与原始缓存存在完整文字不是同一层，不能用流程通过掩盖它们。
