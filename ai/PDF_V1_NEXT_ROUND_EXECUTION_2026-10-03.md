# PDF V1 下一轮执行记录 — 2026-10-03

当前代码和局部 UI 安全闭环已验证；完整规划仍未全部达成。已建立 38 题源页字段参考、完成四类原始响应归因、删除 6 个旧 PDF 专用模块并收缩共享分支。付费对照实验与最终全卷质量验收尚未执行，不能称为“深圳/河北已经修复”。

## 当前阶段与真实缺口

| 阶段 | 本轮成果 | 状态和缺口 |
| --- | --- | --- |
| A 源页/金标 | 两卷源 SHA256 复核，40 页本地文本证据，38 题字段核对参考，重看全部题目页和争议解析页 | 尚不是全部解析的逐字 LaTeX 金标；深圳 5 源减号仍需原生 PDF 查看器核对 |
| B 错误归因 | 题型、跨页、归属、图框四组追踪；19 个有原响应的请求元数据；同阶段候选内容比对 | 已完成本轮代表性归因，不能外推成整卷错误率 |
| C 单因素实验 | 4 个基线/候选配对，预算合计最多 8 次，配置和评分指标已准备 | **未执行**；账户恢复没有明确消息，未用请求探测余额 |
| D 最小胜出配置 | 生产 model、prompt、window、渲染、Token 配置保留 | **没有胜出数据，不发布假定改善的 prompt/config** |
| E 旧链退役 | 删除 6 个专用模块、17 个纯旧实现测试；新 PDF 唯一正常 UI 路线；无旧 projection fallback；旧 native PDF engine 拒绝 | 产品不再加载旧 controlled-write；该文件完整删除仍与用户保护 smoke 的 require 冲突，具体迁移未获回复 |
| F 最终验收 | 删除后两卷原 HTTP 响应回放、失败保留、2 题真实审核/入库/重开/图片回读 | 这是旧模型结果的流程验证；不是新模型实验，也不是 38/38 题全文/质量/最终入库验收 |

前轮完整门禁为 1790 项；本轮因实施退役，当前全量 1631 项均通过。数量减少 159 不代表识别改善，纯旧实现测试删除/迁移必须按实际职责评估。

## 源文件勘误与字段参考

详见 `ai/PDF_V1_SOURCE_REFERENCE_2026-10-03.md`。两卷原卷分区均为 1–8 单选、9–11 多选、12–14 填空、15–19 解答；含证明小问不能改变整题原卷题型。

本轮纠正了旧报告和规划中两项事实：河北 8 原第 5 页答案表是 **B**，第 7–8 页详解也是 B，原模型 D 不能解释成源冲突；深圳 13 原第 14 页自身含孤立的 `0`，不能计为模型新增。这些是源核对勘误，不是代码猜改答案。

还固定了深圳 19 的 $xe^x+ae^x-1$、河北 7 的绝对值、河北 16 的 $4^n$ 与 $2^{n-1/2}$、河北 18 的椭圆形式/面积上界。历史报告、原响应和原规划字节没有覆盖，后续源核对应使用新的参考和本记录。

## B 的证据与结论

证据文件：`local-run-artifacts/pdf-v1-next-round-2026-10-03/raw-to-draft-diagnostics.json`。

| 组 | 抽查题目 | 已定位的重点 |
| --- | --- | --- |
| 题型 | 深圳 10；河北 5、10、11 | 初始草稿深圳 10、河北 10/11 都记为单选，与原多选分区不符；河北 5 是单选的正常对照。错误已在 raw item 中，不是审核清理器改型 |
| 跨页 | 深圳 3、16、17、19；河北 4、16 | 原选项 B 尾词、表格续行、小问、初始答案块里的证明与详解尾页要分别核查；不能选更长文本后宣称拼好了 |
| 归属 | 深圳 7、11、18、19 | 相邻解析图/重复引用的题干不能变成另一题题干；原 source_pages 及候选保留，用 exact exam+no 关联，不按位置顺移 |
| 图框 | 深圳 10；河北 10、17 | 目视原页和实际裁图，模型 bbox 过紧，漏 C1/Q、C 等边缘标签；未证实本地坐标变换错误 |

四组共 112 个观察项，其中 105 项找到同阶段实际候选，内容差异为 0。观察项含重叠重复，不能称为 105 道题或“全卷无改写”；其余 7 项没有匹配证据，不算通过。第一次/最后一次模型响应分别与其对应回放比，不交叉混用版本。

12 个成功响应（85–93、101、102、106）都是 finishReason=stop，completion_tokens 在 1517–5688，均低于 maxTokens=16384。没有证据把这些漏文归因于触及 Token 上限，所以没有盲目提高上限。

图框抽查 3 组都缺标注，不能外推为所有裁图错误率，也没有加入根据题意猜归属、自动扩大所有框或本地解题。

## E 的删除与保留

删除的专用模块：

- qisi-production-pdf-sources-port.js
- qisi-pdf-import-coordinator.js
- qisi-pdf-candidate-projection.js
- qisi-pdf-ocr-support-parser.js
- qisi-pdf-question-boundary.js
- qisi-pdf-support-block-parser.js

`architecture/pdf-v1-retired-files.json` 记录 23 个删除文件的原 SHA256 和现行测试承接，其中 6 个模块、17 个纯旧实现测试。原字节保存为忽略目录 `before/*.before`，不会再次被递归测试发现。历史 counterfactual matrix 不覆盖，不用产品内两套识别路线回滚。

共享分支收缩：

- batch-engine-v2 从 2079 行缩到 606 行，删除 processBatchV2、文本/公式评分、题干/选项恢复、自动图归属、自测及原生 PDF boundary 重建；只保留 DOCX 视觉识别的两个工厂和必要 helper。未标记 convertedFromDocx 的原生 PDF 进入该入口会在渲染/识别前被拒绝。
- production-import-bridge 删除旧 PDF required projection port 和 fallback，仅接受 pdf-multimodal-v1；DOCX 协调路径和异常/取消/事务保护保留。
- import-validation-service 删除旧 PDF partial/controlled-write 放行分支与旧 pipeline 依赖。该 DOCX validator 拒绝 PDF 输入；V1 使用独立 Contract。
- production-import-output-port 保留当前 DOCX 使用的评分/合并；有 PDF format/mode/旧 producer route 的非 V1 输入拒绝进入评分。V1 字段直接旁路，公式、空格和原选项不清理。
- pdf-safe-partial-pipeline 只保留两项来源页 trace 元数据函数，删除旧 recognition facade。只测 facade 的 benchmark 情景移除，现行 benchmark 为 10 个；不把不同业务操作的时间当 V1 性能改善。
- app.js 只删除 projection 注入和无调用 helper；九个保护 handler 原 AST hash 全部匹配。main 与 manifest 同步实际加载和 API。

| 保留项 | 真实当前使用者/用途 |
| --- | --- |
| pdf-support-aligner | import-validation-service 的 DOCX expected sequence gate 调用 validatePdfSupportSequence；本轮保持冻结字节，V1 不调用 |
| safe-partial 的 attach trace | app 装配的 DOCX converted-source support 识别保留原来源页、页图与 raw evidence；不是旧 PDF 识别入口 |
| SupportTextParser / RecognitionStructurePolicy / StrictQuestionPolicy / VisualSupportSource | 当前 DOCX 支持来源和视觉链；不能按 PDF 字样整文件删除 |
| PageQuestionParser / review normalization 的非 V1 路线 | DOCX 和历史草稿的显示/审核；V1 有独立字段旁路 |
| BrowserDocumentSource / PDF.js / BrowserPdfRenderer | 当前本地渲染、原像素裁图和 DOCX 转换后的页面读取 |
| producer identity / admission 的历史 route 常量 | 原草稿/正式题的安全读取验证，不执行旧识别，不批量改用户 source/route |
| pdf-support-controlled-write | **产品已不加载，runtime=dormant、owner=deprecated**。受保护 tests/base-migration-smoke.test.js:69 直接 require 原函数，是暂不能删除的明确约束；不能宣称文件退役已全部完成 |

保护 smoke 的独立校验值仍为 `3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea`，原文件没有修改。完整规划第 316 行禁止修改用户保护测试，因此一般“继续”没有被解释为改该测试的具体许可。

已准备 `local-run-artifacts/pdf-v1-next-round-2026-10-03/protected-smoke-migration.patch`，只迁移旧 truth-gate 一条测试到 V1 canonical/来源 evidence/未自动确认约束；`git apply --check` 通过，**没有应用**。这份具体补丁可用于确认例外范围，其他保护测试代码保持。

## 删除后实际 UI 回放

回放入口仍是实际正常 UI，上传原授权 PDF，经过实际 PDF.js 渲染、真实裁图、producer/Contract、审核与 repository 事务。只在 HTTP 模型边界 fulfill 保存的原响应，不注入最终草稿；全部在隔离 origin，未访问生产 IndexedDB。

| 回放 | 草稿 / 裁图 | 失败窗口 | 模型边界回放次数 | 本地导入墙钟 |
| --- | --- | --- | --- | --- |
| 首轮深圳 | 19 / 20 | 0 | 7 | 8291 ms |
| 首轮河北 | 19 / 8 | 3 | 10 | 6087 ms |
| 深圳致命账户失败 | 17 / 7 | 2 | 4 | 4805 ms |
| 河北最后响应 + 107 无原结果停止 | 19 / 7 | 1 | 2 | 4041 ms |

墙钟是本地回放导入时间，不含真实模型延时，也不是端到端教师审核成本。失败响应产生的预期 502 console resource 日志保留；pageErrors、unexpected、forbiddenRequests 都为 0。

深圳 5 和河北 4 共 **2/38 题**完成实际人工修订/确认/入库/重开。已验证编辑原文精确保留、修改/复认使旧确认失效、只失败窗口抵达模型边界、formal 四字段与确认版本一致。1+5 个真实图片 Blob 均有非零 bytes，其 hash 与原裁图一致。未把人工修改计入机器识别率，也未声称其余 36 题完成同样闭环。

“查看原 PDF”在 headless Chromium 验证为下载，下载 bytes 与原源 hash 一致；这不等于已目视原生 PDF 查看器。原生查看器工具曾因无法确定当前浏览器 URL 的策略守卫停止，本轮未完成深圳 5 的该项复核。

证据：忽略目录里的 lifecycle/fatal/hebei-final-summary.json、两份 lifecycle-actions.json、对应原页面和 crop 文件。所有回放均断言 7 个旧 PDF owner 不加载。

## 门禁与范围

| 检查 | 最终结果 |
| --- | --- |
| npm run verify:safe | 通过；全量 1631/1631，0 fail/cancelled/skipped/todo；check/no-real-ai/batch-safety 通过 |
| verify:pdf-known-bad | 61/61，通过；命令保留并承接当前 exact-key/协议/来源/缺失/错型/确认约束及共享序列 gate |
| verify:docx-stable / smoke:batch:mock | 8/8，通过；其中保留原 DOCX 三题 fixture，现使用实际 identity support-field owner，不伪装成 8 个独立 DOCX 文件 |
| runtime modules | valid=true，errors=[] |
| app-shell architecture | 9 个原 AST hash 匹配，errors=[] |
| 修改前范围对照 | 本轮 baseline 1190 个文件，61 个既有文件修改/删除，加 3 个新增审计/参考/执行文件；范围审计以最终 scope-audit.json 为准 |
| 原始证据/账本/保护 smoke | 原字节保持；未 reset/stash/commit/push，未改 .env、生产题库或 DOCX 源 |

前两次全量失败分别来自已退役测试路径、启动清单要求旧 owner、旧 benchmark 计数；修复的是这些有证据的迁移消费者，没有降低 DOCX、来源身份、字段证据、取消、失败、图片与事务断言。原 freeze approval 的 contentSha256 没有自动刷新；确实删除的 block parser 使用原 SHA256 退休记录，现存冻结文件仍按原值检查。

## 收费与续作前提

本轮新增收费请求 **0**。账本仍为 **107/150**，剩余 **43**；107 没有原结果也仍算尝试，不把它退回预算。账本 SHA256 仍为 `1305b0764c827188149b5b1638d8189c204653fd26eb515ef4318689a78e8b99`。

`experiment-spec.json` 已准备四对小样本：原卷题型区、完整解析转录、裁框边缘标签、窗口末页上下文。每对只改一项，保持模型/渲染/Token/wire/本地验证不变；最多 8 次。状态 PREPARED_NOT_EXECUTED，不是实验结果，也不是已发布配置。

后续依赖：明确账户恢复后才执行原授权范围内的收费实验；胜出数据存在才改最小配置；按最终版本重测两卷机器初始全文/图表/归属，并完成 38 题核对和最终事务验收。保护测试具体例外未获回复前，不能删除其 require 的 controlled-write 文件。深圳 5 原生源字形复核以及全解析逐字金标仍须补齐。当前不宣称全局最优、陌生样本泛化、全卷识别准确或完整规划完成。

## 第 21 节连续执行追加 — 2026-10-03

坏 JSON 成功缓存与正常 UI 无编辑重跑两个恢复问题现已修复；当前报告以 [恢复与成本总报告](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_COST_AND_RECOVERY_EXECUTION_2026-10-03.md) 为准。原历史报告/门禁数量保留，最终本轮门禁 1633/1633、PDF known-bad 62/62、DOCX stable 8/8，runtime/app-shell 通过；九个保护 handler 源字节/AST 保持，仅 controller 策略端口两行接线与真实矩阵位置/节点登记。

完成原 usage 费用分解（V1 已知 ¥.592884 + 11 项未知）、当前与多个候选共11张完整证据卡、最终版本两源各三次正常 UI 冷导入/重跑、本地合成10/20/30/50页量测与两个代表题事务/图片Blob回读。深圳重跑0、河北只三个失败窗口6次边界回放，六业务字段保持，不继承确认。回放不调用真实模型；prompt/model/窗口/图像规格均未改。

费用下降目标没有达标：当前完整最终prompt/河北正常单卷账、候选实测质量/时延/实付、38题完整逐字gold与全部教师闭环仍缺。账户恢复未明确，本轮新增收费0，107/150与原账本hash不变。保护smoke例外仍未给出，controlled-write仍只因该直接require保留dormant；不把本地绿门禁或零外发热跑写成完整规划/首次降费完成。
