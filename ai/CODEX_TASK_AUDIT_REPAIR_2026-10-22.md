# 审计后修改任务账

用户于 2026-10-22 明确要求按 REPAIR_PLAN.md 实施；覆盖方案中的连续实施顺序。原工作区及原索引保留，实际代码在隔离候选修复分支修改。默认离线合成库，禁止真实 AI/OCR、生产数据、依赖变更和原工作区破坏性清理。未擅自提交或推送。

基线：512a5d8427f4732ff14bcc54dd76de6b093625ad。分支：codex/app-split-audit-repair-20261022。
方案：原工作区 local-run-artifacts/golden-baseline/20261022-independent-split-audit/REPAIR_PLAN.md。
证据：原工作区 local-run-artifacts/golden-baseline/20261022-audit-repair/。

## 状态

| 任务 | 状态 | 说明 |
|---|---|---|
| P0 | 已完成 | 原索引/两层二进制 patch/原始文件已校验；259 项入账，246 文件副本，私密本地记录保留原位不读取 |
| G1 | 已验收 | 原协议日志 -32000 Promise was collected；Playwright 将其改写为 context destroyed。只调整 golden 的确认驱动方式：真实按钮一次 + 数据库和页面完成双观察；不重试写操作 |
| F1 | 已验收 | 定向 11/11；完整 safe 2311/2311；批量安全/架构/登记通过 |
| F2 | 已验收 | 定向 22/22；完整 safe 2321/2321；架构/登记通过 |
| C1/C2 | 已验收 | 定向 UI/冻结输入通过；完整 safe 2325/2325 |
| E1 | 已验收 | 完整 safe 2335/2335；定向会话/准入/架构及 batch-safety 通过；首轮四项失败日志保留 |
| E2 | 已验收 | 定向 41/41；完整 safe 2347/2347；batch-safety/架构/runtime/精确范围通过；真实删图失败和 DOCX/PDF 裁剪像素证据保留 |
| E3 | 已验收 | 定向 45/45；完整 safe 2362/2362；batch-safety/架构/runtime/范围通过 |
| I1 | 已验收（只读） | I1_CONSUMER_INVENTORY.md 与 I1-observations.json；历史读取/重跑/截图动态验证通过，运行树承接 E3 safe |
| I2 | 已验收 | 定向 36/36；safe 2365/2365；批量安全/架构/runtime/范围通过；退役执行反例、历史读取和截图输入验证通过 |
| I3 | 已验收 | I3a/G1b safe 2374/2374；I3b safe 2377/2377；分单元快照、失败证据及来源/生命周期契约保留 |
| L1 | 已验收 | 定向 25/25；完整 safe 2384/2384；最终 G1b 同步驱动随全量验证；原 F2 资源合同通过 |
| L2 | 已验收 | L2a safe 2393；L2b safe 2411；完整外部页面协调、真实按钮异常和图片关系 |
| L3 | 已验收 | 定向 17/17，恢复后 safe 2416/2416；诊断零写与显式迁移失败进度 |
| M1 | 已验收 | 定向 27/27，proof 定向 7/7，safe 2432/2432；完整手工录入生命周期 |
| M2 | 已验收 | 定向 15/15，safe 2441/2441；专用仓储原子树写入，失败保留输入 |
| M3 | 已验收 | 定向 18/18，safe 2455/2455；模板负责人及归一拒绝传播修复 |
| X1 | 已验收 | 定向 16/16、扩展真实浏览器 4/4；完整 safe 见 X1 日志 |
| X2 | 已验收 | 定向 26/26，safe 2477/2477；九种完整输出逐字对照 |
| X3 | 已验收 | 定向 22/22，浏览器 5/5，分页 3/3，最终 safe 2490/2490；六页实际 PDF 逐页检查 |
| A1 | 已验收（实施者自审） | safe 2496/2496、batch-safety/runtime-dependency/AST/scope 通过；完整 PDF 链及 11 表/Blob 恢复、18 实际 owner 接线 |
| W4a | 已验收（实施者对账） | 259 路径、196/70 两层片段及 28 处交叉全部有去向；旧删除测试保护已登记 |
| W4b/W4c | 目标冻结；最终状态以外部操作单为准 | 新建整合副本 safe 2496/2496，原两层还原→352 路径安装→回退已成功；此次状态文档修订后的准确 tree 与复验见 W4_FINAL_OPERATION.md |
| W4d | 待最终执行批准 | 尚无修复提交；原分支/索引/文件未切换；不推送、不启动服务、不改生产库 |

## G1 精确范围

scripts/golden/run.cjs；tests/e2e/golden-navigation.test.js；本任务账。无应用业务文件改动。
验收：真实确认成功/拒绝/意外导航，定向 golden 观察，原样 verify:safe。
回退：只撤回 G1 补丁；保留首次失败证据。

## F1 精确范围

app.js::confirmSelectedDrafts 两处失败身份引用；tests/e2e/review-batch-confirm-failure.test.js。app 中的循环局部变量错误必须在处理器修正，新模块无法修复未定义的局部 id。新业务逻辑：无。
修复前 7 项页面测试中 3 项明确以 id is not defined 失败，其他 4 项通过。修复后验证中。G1 完整门禁 2304/2304，定向 DOCX 回放 10/10；未跳过测试。

## F2 精确范围与消费者证据

app.js::loadData/attachQuestionImageUrls、旧 objectUrls 与指纹投影接线；qisi-library-image-resources.js；qisi-library-snapshot.js；qisi-components.js::QuestionCard.setup 资源持有及卸载；architecture/layers.json 和 docs/architecture/owners.json 对应两项；冻结矩阵仅范围偏移（九项 AST 哈希先校验未变）；tests/qisi-library-refresh-lifecycle.test.js、tests/e2e/library-refresh-failure.test.js 与现有两项模块测试。
实测消费者：QuestionCard.setup 捕获 q.images 作为长期 editImages，成功刷新后该数组仍可能展示。故增加与真实组件寿命一致的资源持有；不向持久化题目附加方法或改 schema。
所有 fallible 读取/图片/指纹准备先完成；同步发布后等待 Vue nextTick，再退役旧作用域；失败释放本次作用域，代次/卸载使晚结果失效。app 仅保留装配、ref 发布和错误提示，完整资源状态放入现有两个模块。

## C1/C2 精确范围

tests/e2e/pdf-region-crop.test.js、tests/e2e/review-readonly-projection.test.js、tests/qisi-review-image-projection.test.js、tests/qisi-review-editor-projection.test.js。仅补能力保护，不改变业务代码或恢复退役生产者。PDF 区域入口直接使用现存 0..1000 坐标合同，四组旋转/缩放输出真实像素，缺页/坏 bbox/空白区域拒绝。审核实际筛选保留焦点/未保存源及数据库字段。新增冻结输入保护覆盖 DOCX/PDF 图投影、0/2/4 选项。

## E1 精确范围

app.js::审核 refs、loadBatchImportData、dirty/beforeunload、openBatchReview/selectDraftQuestion、保存准备/保存/同步；qisi-review-session-commands.js；qisi-review-editor-commit.js；两者已有测试及新增 tests/e2e/review-session-isolation.test.js；architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 对应负责人；冻结矩阵仅范围偏移且先校验九项 AST 不变。
会话创建 15 个原有 refs，app 仅别名读取，旧返回接口保留；来源/预览回调只做既有只读投影。持久化经既有 service，保存候选先克隆原题。保存失败保留输入；保存途中继续输入或切批次不覆盖新会话；统计失败明确报告已保存的事实并阻止后续自动动作。
E2/E3 的旧图片/确认处理器仍直接使用同一组 refs，会在各自任务迁移，未声明审核全组已完成。

E1 全量首轮：2331/2335，4 项失败；首次日志 E1-verify-safe.log。修正 editor-commit 层级为 2（实际依赖 layer-2 controller）；额外精确允许 tests/base-migration-execution-gate.test.js 与 tests/qisi-app-display-cleaners-r3-ownership-audit.test.js：前者用独立无模块 fixture 维持 scaffold 反例并增加 delta/无调用断言；后者将已迁移警告调用的审计定位到真实负责人，并继续断言 app 旧实现不存在。原判定断言不放宽。

## E2 精确范围

app.js::confirmDraftImages/deleteDraftImage/savePdfManualCrop/saveManualCropToDraft/loadImageForCrop/bindUnassignedImage/deleteUnassignedImage/openSourcePageCrop/closeCropModal 及图片命令装配；qisi-review-image-commands.js 承接图片命令和浏览器像素端口；qisi-review-session-commands.js 增加受身份保护的持久化结果接纳接口；既有 tests/qisi-review-image-commands.test.js、tests/qisi-review-session-commands.test.js 及新增 tests/e2e/review-image-atomicity.test.js、tests/e2e/review-crop-atomicity.test.js；architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 对应职责/依赖；冻结矩阵只校验九项哈希后偏移范围。
app 必须修改是为了退出旧页面内图片业务实现，约 300 行原逻辑移入既有负责人，app 留调用/DOM尺寸/导航接线；不增加新大业务。无 schema/正式入库/识别路线/真实端点改动。
明确修复语义：失败不先改页面；有未保存编辑时要求先明确保存或放弃；来源文件、批次、题号身份/页号不一致拒绝；页面输入或批次改变时晚结果不覆盖新缓冲。默认离线合成图/PDF，图行与草稿/token 仍经原有 service 同一事务。门禁为定向 Node/真实 UI、safe、batch-safety、app-shell/runtime、精确 diff-scope；不扩大冻结 hash 或预算。

E2 结果：图片命令/浏览器像素均归既有 ReviewImageCommands；会话只接纳同一次页面访问的持久化回执，保留晚到的新编辑，提交失败不提前改变页面。app 本单元净减少约 242 行，九项冻结 AST 不变。新增零草稿批次的未分配图片删除保护；原工作区索引 SHA256 仍为 50D317DDC192E2738B969FA490C62DB7723CCB22A0ABFB416240F717EE032960。未提交/推送、未操作生产库或真实 AI。

## E3 精确范围

app.js::confirmAndSubmitDraft/confirmSelectedDrafts 及动作负责人装配，约 90 行旧协调逻辑退出，保留薄包装；qisi-review-batch-confirm.js 扩展为单题与批量审核动作负责人（同一 workflow 的保存/确认/提交顺序，既有纯选择 API 不变）；qisi-review-session-commands.js 增加保留编辑的动作读回/通用持久化回执别名；对应 tests/qisi-review-batch-confirm.test.js、tests/qisi-review-session-commands.test.js，新增 tests/e2e/review-action-boundaries.test.js；已有 F1 七项真实按钮测试继续原样；architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 只更新该职责/依赖；冻结矩阵只在九项哈希校验后更新范围。
明确行为：拒绝确认不提交；提交拒绝/抛错不自动重试，报告已完成确认；下一次明确动作沿用已确认版本；同批次重复动作不并发写；确认期间新输入/切换会话终止后续自动提交；批量确认始终不正式入库。题库刷新使用 loader 空批次入口，不在审核页面外另写编辑真值。真实 AI/生产库/依赖/schema/原工作区混合变更不动。

## I1 结果及 I2 精确范围

I1 盘点报告在原工作区证据目录 I1_CONSUMER_INVENTORY.md，动态观察 I1-observations.json。I2 允许 app.js::strictQuestionPageRecognizer 无用实例声明退出（约 19 行，只删除装配）；qisi-production-import-bridge.js::runDocxVisionShadow/prepared 能力声明和退役身份拒绝/recognition-source-loaded vision 分支；qisi-production-import-route-policy.js 中不可达 capability 三元分支；tests/production-import-bridge.test.js、tests/docx-producer-route-contract.test.js、tests/docx-producer-identity-architecture-gate.test.js、新增 tests/e2e/import-retirement-lifecycle.test.js；ai/R3B_VISION_RETIREMENT_2026-10-22.md 与新增 ai/IMPORT_ENTRY_CONSUMERS_AUDIT_2026-10-22.md；冻结矩阵仅哈希先校验后的范围偏移。
runDocxVisionShadow 保留同名退役拒绝墓碑，不再执行 ports；旧 source-port 纯投影测试和历史身份合同保留，页面不加载。截图/OCR runtime 与 PDF producer 不改；默认只用离线替身/合成库。门禁：退役入口反例、历史重开/重跑/截图真实 input、DOCX stable/PDF known-bad、safe、app-shell/runtime、范围。

I2 精确登记补充：architecture/layers.json 与 docs/architecture/owners.json 只移除 Bridge → 已退役 production-docx-vision-source-port 的依赖/反向 allowedCallers 边；该物理模块继续 dormant/deprecated，main/runtime 无加载变化。

## I3a 精确范围

app.js::五个旧文档缓存 Map 声明、browserDocumentSource 创建/三函数解构、normalUiImportController 创建和卸载接线；qisi-import-run-commands.js 承接真实 controller 的创建/请求访问身份/结束清理和导入结果 UI 应用顺序；qisi-review-session-commands.js 新增导航身份和受保护导入结果接纳；tests/qisi-import-run-commands.test.js、tests/qisi-review-session-commands.test.js，新增 tests/e2e/import-review-session-isolation.test.js；architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 只登记这些实际职责与依赖；冻结矩阵九项先哈希校验后只移动行范围。
缓存证据：I3-cache-consumers.json，正常 DOCX question+answer+solution 与离线 PDF-full 实测旧实例构造 1/执行 0；静态五 Map 只传给它，无生产导出/其他消费者。退出无用 app 实例和 Map，BrowserDocumentSource 物理文件/Node 保护/页面全局兼容工厂保留，不把它当当前 DOCX 或 PDF producer。
DOCX deterministic runner 已有完整 ProductionDocxSourcePort owner，本单元不再包一层空工厂；PDF producer 配置本单元逐字保留，I3b 单独迁移。新增明确行为：后台导入已落库后，若页面访问或未保存编辑发生变化，不强制覆盖当前审核页，提示从任务列表打开；重开时仍先设置 batchId 再读回。卸载取消可取消请求、阻止晚结果发布并释放请求访问记录；已有 controller 的跨窗口锁、幂等与 AbortSignal 保留。

I3a 精确测试补充：tests/normal-ui-import-production-owner.test.js 的原 createController 位置已迁移；保留原生产 Bridge/无旧链断言，新增 app→workspace→真实 controller→会话接纳的调用边断言，不放松原行为门禁。

## G1b：I3a 全量暴露的通用代理 Promise 生命周期

I3a 首轮 safe 2371/2372，唯一失败 tests/e2e/pdf-exam-print-preview.test.js:55 等待 openBatchReview，page.evaluate 执行上下文销毁；定向原场景一遍通过，未将首轮记为已证实假红。先在真实浏览器强制 GC，区分代理 Promise 失去强引用和真实导航。精确允许 tests/e2e/browser-harness.js::callProxy 及新增 tests/e2e/proxy-promise-lifetime.test.js；不改生产代码、PDF 断言或选择器，不重试任何写动作。目标是用 remote handle 持有实际返回 Promise 到值已观察后释放；原始 rejection/真实导航必须继续失败。I3a 保持待验收，修复机制通过定向后重跑原样全量，首轮日志保留。

## I3b 精确范围

app.js::runProductionPdfImport 装配；qisi-import-draft-command.js 新增 createPdfProducer（将现存 getExistingDrafts 范围与源文件 evidence 写入映射移入已有 mapping owner）；tests/qisi-import-draft-command.test.js；architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 只登记该 owner 实际 layer-3 组合职责、PDF producer 和仓储依赖、repository-mediated-only 源证据权限；冻结矩阵仍先校验九项 AST 再偏移范围。DOCX runner、当前 PDF producer/协议/传输/解析算法、取消/锁与正式准入均不改。正常 getExistingDrafts 和 persistSourceEvidence 的原错误向上传递，不伪造空列表或成功。既有真实 PDF/重启/部分结果/未知与未配置/失败回放保护原样运行。

I3a/G1b 修复后 safe 2374/2374；G1b 根因机制实验见 G1B_ROOT_CAUSE.md。I3b 精确测试补充 tests/qisi-app-display-cleaners-r3-ownership-audit.test.js：当前 PDF producer 的 app 创建位置迁到 ImportDraftCommand，审计保留同一真实 producer 与 app→负责人→createProducer 调用边，并继续拒绝旧 PDF producer；未改业务预期。

I3b 批量安全首轮因 tests/pdf-projection-single-owner.test.js 的旧 app 创建位置断言失败（日志 I3b-batch-safety.log），运行数据场景未失败。精确允许该文件：验证 app→ImportDraftCommand→同一 PdfMineruProducer，并将旧 projection/外部/多模态 producer 禁止范围扩到新增装配负责人；单生产者/无 fallback 规则不放宽。

## L1 精确范围

qisi-library-snapshot.js 的分域读取与 loader（兼容总读取顺序和完整发布合同保留）；app.js::libraryLoader.publish/loadData/deleteQuestion/saveEditedQuestion 仅域选择/发布接线；新增 tests/qisi-library-domain-refresh.test.js、tests/e2e/library-domain-refresh.test.js，既有 qisi-library-snapshot/refresh-lifecycle/library-refresh-failure 保护原样运行；architecture/layers.json 和 docs/architecture/owners.json 只增加该模块公共读取 API/职责；冻结矩阵九项 AST 校验后仅移动行范围。
明确行为改善：成功题库编辑与软删只读题库/图片并更新指纹，不重读外部库、批次、模板和知识点；无该题的旧编辑事件仍保留原完整兼容刷新，F2 的真实模板晚失败资源保护继续通过此现有入口验证。不增加生产测试接口。
不同图片域各有资源作用域；分域请求只更新相应 refs，独立域并发不互相丢弃；完整读取仍顺序、原子发布，若被更新的域已有新请求则过时整包不发布；准备失败保留旧域，卸载/渲染失败和消费者租约沿用 F2 合同。所有测试离线合成库。

G1b 补充：L1 前置真实确认再次在 jsHandle.evaluate 等待出现上下文错误（L1-ui-before.log），未把它当作领域失败。进一步将 callProxy 改为单次同步派发，page-owned Map 持有任务/结果，随后只同步读取完成状态；不把 action Promise 返回给 CDP，也不重试写入。主 frame 导航明确失败；原 rejection 的 name/message/code/causeCode/browserStack 保留；结束只删除本任务记录及监听器。L1 在该机制修复后重新跑反例与全量。

L1 定向 25/25；真实编辑已写库但旧完整刷新因无关模板故障保留旧视图的反例见 G1b-dispatch-and-L1-before.log，迁移后只刷新题库通过。原 F2 全量晚失败/资源消费者/打印保护不改断言继续通过。G1b 最终同步派发/结果只读观察同时由 L1 完整 safe 验证；增加单次调用、任务结果记录释放和监听器不累积断言。

## L2a 精确范围与验收设计

先针对 LibraryService 现有外部合并/撤销与包图片关系写反例；精确允许 qisi-library-service.js::commitExternalMerge/undoExternalMerge，qisi-export-service.js 的图片 token 精确重绑定，app.js::importQuestionBankPackage 仅调用该模型；tests/library-formal-repository-boundary.test.js，新增 tests/external-image-rekey.test.js、tests/e2e/external-merge-safety.test.js；architecture/layers.json、docs/architecture/owners.json 只登记新增已有模块 API/职责；冻结矩阵九项先校验后移动范围。
拟验证/修复：同一已 added/filled 来源不得被旧确认操作重复写入；撤销前必须证明待删除/恢复题目仍等于本次合并写后的内容，后续教师编辑不得被覆盖；改写包图片 ID 时显示字段中的同一 ID token/旧 includegraphics 必须同步，原始证据不改。具体缺陷以反例为准，不能仅凭审阅宣布成立。
若撤销反例成立，新 mergeBatches 审计记录可附带版本化写后快照作为安全撤销证据；不改变 IndexedDB 版本/表/索引或备份格式，历史记录照常读取，但缺少充分证据的撤销应明确拒绝。该兼容影响单独报告。L2b 再迁完整包预览/输入/结果协调，业务规则仍由 LibraryService/ExportService 承担。默认离线合成库，不碰生产数据。

## L2a 结果与 L2b 精确范围

L2a 定向 15/15，safe 2393/2393、九项冻结 AST、runtime、diff-scope 通过。真实 ZIP 旧图 token 与导入图 ID 不一致、真实合并后教师编辑被撤销删除均由反例复现；重复来源命令亦复现。新合并记录保存写后题目/来源状态证据，撤销在同一事务核对全部证据后才修改。历史缺证据记录仍可读，但撤销明确拒绝。全跳过记录原 deleteMany 空数组返回非 Promise 的问题随统一事务链修正。来源状态被后续处理覆盖亦拒绝旧撤销。事务仓储会包装错误，服务只在仓储完成回滚后重新暴露原领域拒绝；磁盘错误原样保留。失败日志 L2-before.log、L2a-targeted.log 留存。

L2b 允许 app.js 中 getExternalMatchInfo、包解析/预览/导入、外部选择/确认/合并/撤销/删除/状态重算及相关状态声明/装配/卸载/watch 薄接线；规则移到 qisi-library-service.js::createExternalQuestionModel；包解析/可移植投影移到 qisi-export-service.js::createPackageService；qisi-library-external-merge.js 承接页面完整流程与唯一 refs。新增 tests/qisi-external-workspace.test.js、tests/qisi-external-package.test.js、tests/qisi-external-model.test.js，扩展 tests/e2e/external-merge-safety.test.js。architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 只更新现有模块职责/依赖/API，冻结矩阵九项仍先验证再调行范围。五份新切片登记无新文件加载变化。
明确行为改善：重复点击同一待处理操作只派发一次，取消/新预览/新导航/卸载不接纳旧预览；无效选择不打开空确认页；外部操作只刷新外部域或两题库域；提交已落库但读回失败如实报告，清掉已完成预览防误重试，不伪称未写；领域失败保持选择与待确认内容。历史填充找不到目标转新增合同保留，不借迁移改变匹配标准。数据库/schema/备份格式/真实 AI/生产库均不变。

L2b 门禁接线补充：tests/app-formal-storage-boundary.test.js、tests/app-storage-formal-repository-boundary.test.js 原断言要求 app 直接调用合并/撤销，按实际迁移改为 app→ExternalWorkspace→同一 LibraryService，并扩展直接正式写入禁止范围到负责人。tests/base-migration-execution-gate.test.js 的 app 最小 4000 行是假定旧体积，改为精确行数与 boot/setup/loadData 消费者完整性校验；保留 12000 行上限和原扫描标记约束。不是降低失败领域断言。首次 safe 日志保留。

## L3 精确范围

只读入口盘点见 ai/LIBRARY_MAINTENANCE_ENTRYPOINTS_2026-10-22.md。允许 app.js::auditQuestionLatexData/migrateSafeQuestionLatexData 的装配/薄别名，原 window 同名显式兼容入口保留，不在启动调用；qisi-library-service.js 新增 createQuestionMaintenance，诊断读取仅 repository.listTable，显式迁移仍经原 migrateSafeQuestionLatexData/migrateQuestions。migrateQuestions 仅补充中途失败的已完成数量/失败题 ID，不更改既有精确清理规则和版本校验。新增 tests/qisi-question-maintenance.test.js、tests/e2e/question-maintenance-entrypoints.test.js；tests/app-storage-formal-repository-boundary.test.js 保护实际调用链；architecture/layers.json、docs/architecture/owners.json 只登记现有模块 API/责任，冻结矩阵九项先校验后移行。合成库验证默认不迁移、诊断零写入、幂等、失败保留原行、明确重试和读回失败已写入提示。禁止生产库迁移。

## M1 精确范围（2026-10-23 继续）

L3 原 safe 会话中断，无 exit 文件，不计通过；确认无残留测试进程后保留原日志，L3-verify-safe-resumed.log 完整 2416/2416、exit 0。冻结九项/运行登记/范围通过。M1 允许 app.js::entryForm/entryTab 声明、syncEntryLegacyKnowledge、手工草稿恢复/watch、handleEntryImgUpload/handleEntryPaste/submitQuestion、return 内 changeEntryAlign/removeEntryImage/assignOcr/copyMainSnippet 的薄接线；实际负责人 qisi-manual-entry-model.js 增加状态/浏览器 FileReader 端口/提交协调；LibraryService 与 Repository 原正式写入不改变。新增 tests/qisi-manual-entry-workspace.test.js、tests/e2e/manual-entry-workspace.test.js；保留旧纯模型测试；两份 app 正式写入边界测试从 app 直接 save 改为 app→ManualEntryModel→同一 LibraryService，禁止直接写正式库不放宽。三份架构元数据登记职责/层/依赖/API；冻结矩阵九项 AST 先校验再移范围。
明确测试及改善：图片字节持久化成功后才发布图和短码，读失败/写失败不污染表单；刷新恢复图片可见且字节相同；删除/对齐只处理所选精确 ID 并保留邻图和其他文本，同步选项引用；手工保存固定输入快照、并发只派发一次，失败保留输入/偏好，晚到成功保留新输入与页面访问；成功后仅刷新题库，读回失败如实报告已写；卸载停止 FileReader 和观察器。截图 OCR 识别调用及其授权不变，新增逻辑无真实 OCR/AI 调用。旧 draft-v2 偏好键和数据库 schema 不变；图片库不做无依据删除，避免删除被其他题目引用的旧图片。

M1 门禁内范围补充：全量 2432 项中 2429 通过、3 失败，全部来自 proof-builder 旧单测将 app.js 第 3739 行当作固定样例，拆分后越界。允许仅修改 tests/qisi-app-display-cleaners-r3-proof-builder.test.js：独立合成 warning/controlled-write 代码片段，原允许/阻止结论不变，新增准确 parentFunction、lineText、dataFieldsWritten 断言；buildAll 仍扫描真实 app 并要求剩余 0 调用。生产工具、业务预期、冻结哈希均不改。保留 M1-verify-safe.log 原失败证据。

## M2 精确范围

允许 app.js 个人树/三级输入/选择 refs、personalKnowledgeCounts、flattenKnowledgeTree、全量 loader 的个人树首次装配、savePersonalKnowledge 与个人树 CRUD/展开命令薄接线及卸载；qisi-personal-knowledge-model.js 承担状态、纯树命令、事务写入与读回发布。新增 tests/qisi-personal-knowledge-workspace.test.js、tests/e2e/personal-knowledge-workspace.test.js，保留原纯模型测试；architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 现有 owner 的层/API/依赖；冻结九项 AST 先校验后更新行范围。
待反例确认的改善：持久化失败不更改可见树/输入/选择；事务中读取最新树再应用命令，保留其他来源新增的兄弟节点；删除/改名/展开核对准确节点/父级及用户所见子树，不覆盖后续修改；成功后才发布，重复点击同一待处理命令共用 Promise，期间新输入/选择保留。统计仍调用原 UiEvents.buildKnowledgeCounts，保留名称计数与祖先累计规则；改名/删树不批量改写正式题的个人知识点字段，历史题依然保留。
个人树状态由 workspace 唯一持有；兼容全库 loader 仅提供首次树快照，随后旧全量刷新不能覆盖命令结果；每次写命令从事务内规范记录出发。其他窗口修改后用页面刷新重新载入；现有备份恢复本来调用 window.location.reload，继续读取恢复后的树。无新增数据库版本、索引或真实 AI 调用。

M2 首轮 safe 2441/2441 测试通过，最后 write-boundary 拒绝个人模块 .transaction 调用。扩大精确范围到 qisi-storage-repository.js::updatePersonalKnowledgeTree（仓储内原子读→纯变换→写→读回），architecture/layers.json 登记专用 API，docs/architecture/owners.json 登记事务职责；个人模块仅提交纯树变换和时间。门禁脚本不改、不隐藏事务语法；所有数据库事务创建继续留在仓储。新增仓储方法的失败回滚仍由原 M2 实际存储/浏览器用例覆盖。

## M3 精确范围

允许 app.js::selectedExamTemplate/examConfig 与模板 refs 的装配/别名，getTemplateCard/allTemplateCards/examPresets、模板 CRUD/全局模板、模板初次载入及启动恢复/两项监听薄接线；examQuestionMeta/分组配置的持久化继续留待 X1，不混迁。qisi-exam-template-model.js 成为模板状态/选择/保存/配置恢复唯一负责人；qisi-storage-repository.js 增加 applyCustomTemplateChange 专用的带所见记录证据的原子更新/删除，不开放新通用写门。新增 tests/qisi-exam-template-workspace.test.js、tests/e2e/template-workspace.test.js；原纯模型测试保留。architecture/layers.json、docs/architecture/layers.json、docs/architecture/owners.json 仅更新已有 owner 的 API/职责/依赖；九项冻结 AST 不变，仅更新行范围。
预期合同：新模板写失败不提前规范化编辑文本；系统/全局模板偏好写失败不公布成功；保存捕获完整代码/字体/字号/布局快照，并发同命令只写一次；晚到保存不覆盖后续选择或编辑；已写入但列表读失败保留准确回执并防误重试；更新/删除核对事务内最新记录，失败保留输入和选择。启动先解析模板与带模板标记的临时配置，再启动持续偏好行为，防恢复中监听互相覆盖；切换模板隔离临时布局字段；卸载释放监听。模板表域刷新在原代码中已存在，此次保留，不冒称新改善。旧配置键和旧未带 template 标记偏好兼容，备份恢复仍按原流程 reload。

M3-before.log 首轮模板测试发现 AppProxy 发布不等于异步 mounted 恢复完成；新建/保存按钮可能被初始恢复重新命名，因此该轮超时不计业务反例。模板测试补充等待 editTplName 初始恢复完成后再交互，保留原日志，以 M3-before-ready.log 为实际反例证据。该等待不重试写操作。

M3 额外已证实仓储缺陷：vendor Dexie 3.2.4 中，归一错误时在 rejection handler 内抛出不同 Error，会让已被上层捕获的原错误仍触发全局 unhandledrejection。M3-normalizer-proof.log 对照 throw→RAW_FAILURE 未处理、return Promise.reject→无未处理，正常返回相同 NORMALIZED。精确扩大 qisi-storage-repository.js::run/atomic 两处错误归一返回方式及新增 tests/e2e/storage-rejection-normalization.test.js；仅改错误传播，保留归一 code/message 和事务回滚规则，vendor/版本/架构门禁不改。实际多表事务失败须证明前表写入完全回滚且无未处理拒绝。

## X1 精确范围

允许 app.js::cart/examTitle/exportMode/分值分组/拖排 refs 及对应计算、增删排序、拖排、持久化观察/启动恢复、打开组卷、删除正式题后的移除薄接线；qisi-exam-groups.js 现有模块扩展唯一状态/命令/快照负责人和带浏览器端口的拖排生命周期。打印仅接线一次 capture→hydrate→generate，页头/题答/窗口函数增加固定快照参数，完整文档算法搬迁留 X2，资源开窗搬迁留 X3。模板布局继续由 M3 单一状态通过只读端口提供。新增 tests/qisi-exam-workspace.test.js、tests/e2e/exam-workspace.test.js，原分组模型测试保留。三份架构登记改现有 owner 的 API/层/职责；冻结九项 AST 不变。
先验证：0 分不能被默认值覆盖；pointercancel 必须取消而不是重排；准备打印期间修改输入不得混入旧输出。命令拒绝缺失/重复题 ID、跨题型重排和不在试卷内的旧拖排来源；增删同步对应分值，恢复顺序保持；开始/结束/取消/导航/卸载释放监听、帧与延时动画；打印持有深层独立、冻结的同一状态快照，题目与答案按同一题型顺序编号。无数据库/生产数据/真实 AI 变更。

X1 首轮定向 15/16：原 DOCX→三模式打印均通过，但旧测试使用 toggleCart(缺失 ID) 安排陈旧车项。新命令提前拒绝缺失 ID，导致随后等待打印拒绝弹窗超时。允许 tests/e2e/exam-print-preview.test.js 先断言新命令明确拒绝且不加入，再直接注入合成陈旧车项代表恢复/其他窗口删除，保留原打印前拒绝、不开新窗口、正式库不变断言。非放宽业务拒绝条件。

## X2 精确范围

允许 app.js::formatLatexForPrint/escapeHtml/printImageHtml/applyPrintWritingRules/renderPrintPositionedImageBlocks/renderPrintTextChunk/normalizeMathExpressionForPrint/renderLatexForPrint、页头/题答/选项/完整题文生成迁入 qisi-exam-paper-parts.js；app::printExam 仅接 documentBuilder.buildPaper 的完整输出并沿用原打开方式，完整窗口 HTML/CSS/资源释放留 X3。明确端口为 HandoutFormulaGate.preparePrintSource/normalizeForKatex、Utils.tokenizeLatexSource、KaTeX.renderToString、QuestionImagePolicy.displayImageUrl、ExamGroups.groupQuestions 与常量；不得回调 app 私有业务或读取 DOM/数据库。
迁移前九种（3 模板×3 模式）完整 HTML 已固定在 X2-characterization.json，不随迁移后结果重生成。安装 tests/fixtures/exam-paper-characterization.json、tests/qisi-exam-document-builder.test.js 逐字对照、输入不可变、诊断、mode/题 ID 顺序拒绝；tests/image-display-url.test.js 从原 app 源码切片改为调用真实 DocumentBuilder.printImageHtml，保留全部 hostile/allowed/属性转义断言。三份现有 owner 架构登记更新 API/层/依赖/职责，九项冻结 AST 不变。原 HandoutFormulaGate 确认仍在实际打印入口，用同一捕获的 qs/模式字段；题答分卷/题后答案/仅题目字段范围不改。

## X3 精确范围

允许 app.js::printBusy 状态装配、hydrateQuestionsForPrint/openPrintWindow/printExam/finishExamBuild 薄接线和两份字体映射迁入 qisi-print-resources.js；完整窗口 HTML/CSS、FileReader 编码器、图片准备、公式确认协调、Blob URL、无 opener 链接开窗、分卷调度和预览生命周期归该现有 owner。新增 tests/qisi-print-workspace.test.js、tests/e2e/print-output-lifecycle.test.js；tests/e2e/exam-workspace.test.js 的异步准备测试改从真实新 factory 的 hydrate 端口注入等待，保留晚到修改不能混入输出的原断言。三份架构登记更新现有 owner；九项冻结 AST 不变。字体资产/依赖版本不改。
资源设计：每个文档唯一 BroadcastChannel+token，保留 noopener noreferrer；文档加载/就绪/资源错误/关闭有明确回执。关闭采用短暂重连+存活探测，允许实际 F5 与同一 URL 的活消费者；无打开回执才按失败期限释放，已打开文档不以固定 10 分钟当作消费完成证据；主工作区释放兜底。意外进程崩溃无 pagehide 信号的资源保留到父负责人卸载，此边界须如实报告。图片和字体样式完全就绪才能打印，坏图/缺图/样式错误保持禁止；窗口内容使用固定快照，图片已编码为自包含 dataURL。无生产数据/真实 AI 调用。
验证包含真实预览关闭/刷新、弹窗未确认、重复点击、资源失败、卸载，以及实际合成长卷 PDF 的逐页渲染。仅合成材料，不把该证据扩大为未授权真实试卷或实际打印机验收。

X3 首轮完整 safe 通过（见 X3-verify-safe.log），但真实六页长卷的 Poppler PNG 逐页检查发现：页 1/2 有大题标题孤悬，最后答案解析尾段另页。不能据门禁绿宣布版面完成。精确补充 qisi-print-resources.js 内 .group-title/.answer-section h2 的 break-after 约束、.answer-item 的 break-inside 约束；新增 tests/fixtures/print-long-paper.json、tests/e2e/print-long-paper-pagination.test.js 用真实 PDF 文本页关系证明标题与首题同页及最后答案块完整。原六页 PDF/PNG 保留在 X3-print-artifacts；修正版另存 X3-print-artifacts-v2。

## A1 精确范围

新增 tests/app-split-complete-boundary.test.js 与完整职责/生产消费者/失败/释放/测试对照 ai/APP_SPLIT_AUDIT_FINAL_2026-10-23.md；扩展 tests/e2e/import-backup-portability.test.js，实际普通 PDF 导入→编辑/确认/正式入库→检索→组卷/预览→备份→新隔离上下文恢复，比较 11 表及 Blob 字节，并验证恢复后的个人树/模板。DOCX+DOCX 原整链路、PDF fail-closed 与截图识别保护一并复验。
更新 ai/HANDOFF_APP_SPLIT_R1_R7_2026-10-22.md、ai/R3B_VISION_RETIREMENT_2026-10-22.md、ai/LIBRARY_MAINTENANCE_ENTRYPOINTS_2026-10-22.md、ai/HANDOFF_FOR_ASTRA_2026-10-21.md 的修复状态/引用以及 ai/CODEX_TASK.local.md 入口索引，保留历史任务记录。旧九项 hash 不改，新 UI handler 用实际薄接线和完整入口测试保护，不上调预算。基线 SHA 与全部修复未提交的事实必须准确。
A1 前置自审补充：通用 PrintResources.hydrateQuestionsForPrint 为兼容纯 API，在缺 Blob 时保留原 url；实际打印负责人必须把未编码成 data:image 的图片改为仅输出缺图错误，不能从旧 blob/http URL 回退，更不能请求网络补图。精确允许 qisi-print-resources.js::createPrintWorkspace 的 detached portable image 投影与 tests/qisi-print-workspace.test.js 反例；原纯 helper 合同不变，正式题/原始快照不改。
收尾验收：safe、batch-safety、runtime/dependency/AST9/精确 scope，全量失败日志与限制保留。最终报告明确为实施者自审，独立人工数学/真实试卷/生产恢复不冒称完成。W4 原目录修改/提交仍不执行；先完成逐项对账、恢复演练和具体操作单再请求最终批准。

A1 整链路首次失败 A1-portability-targeted.log：正式题只改文字、传回已有 dataURL 图片时，saveEditedQuestion 重新构造 imageRecords，将原 createdAt 改成当前时间并丢弃原图片行其他元数据。精确补充 app.js::saveEditedQuestion 的既有图片行读取/保留接线，图片 Blob 新值仍经同一 LibraryService.replaceQuestion 原子写入；不修改题目/答案规则或事务实现。新增 imageRecords 以仓储 get 读到的旧行作为基底，仅覆盖传回 id/blob，createdAt 用旧值（含 0）或新图当前时间。仍保留整链路对全部非题目表不变的原断言，不以忽略元数据让测试变绿；九项 AST 不变，仅调整范围。

A1 接线验收补充精确文件：tests/harness/app-split-owner-inventory.js、tests/e2e/app-split-live-owners.test.js，列定原 18 个模块，浏览器逐个拦截注册、实际 script 顺序/次数与 Node 导出比对；静态覆盖新关键 UI handler 和单一 state 别名，不改旧九项矩阵预算。

## W4a–W4c 准备范围

原目录继续只读；全部对账、恢复包与演练/集成副本写在原 ignored local-run-artifacts 之内或既有外部 P0 目录。先核验原 HEAD/分支/index 与 P0 259 路径 raw 哈希，私密 .workbuddy 保留原位不读取内容；按 HEAD→index、index→work 两层记录，Git 规范化 blob 与原 raw SHA256 分开。逐路径引用原 W1/W2/W3 分组、e55ea3d 的纳入证明、512a5d8 后本轮修复 owner/测试；app.js 必须列每层 hunk，不用一个“候选已有 app”结束。
允许在新建隔离副本重建目标文件树与恢复原 HEAD/index/worktree，副本路径需先校验在约定 ignored 根内，不能进入 tests 递归。只读来源：P0、W1/W2/W3 证据及原/candidate Git 对象；不复制 .env 或读取 .workbuddy 内容；不改真实服务/快捷方式/生产库。准备完成前不请求抽象批准。原分支/索引写入、提交/推送和服务切换仍须具体操作单最后批准，本任务不自行解除禁令。

## W4a 验收与 W4b/c 冻结目标（2026-10-23）

W4a 已逐路径/逐层对账：259 路径，196 个 staged hunk、70 个 unstaged hunk、28 处相交均有明确取舍；app.js 12 片、main.html 11 片均映射当前负责人。246 个公开现存文件的 Git blob 全等于 e55ea3d2；1 项历史删除已进入 W2；12 项 .workbuddy 未读、留原位。未知业务片段 0。完整 ledger、原删除测试 8 声明/9 实例保护去向见原目录 ignored 证据 W4a-ledger/。原 HEAD/分支/index/raw 字节仍与 P0 一致。

W4b/c 将本工作树按明确允许文件冻结到 W4-source-snapshot，在新建 ignored 隔离 checkout 构造 Git tree 并重新运行完整门禁，再用另一隔离目录演练两层恢复、逐路径安装和回退。结果和准确 tree OID 写在证据 W4_FINAL_OPERATION.md；该外部报告更新状态，不回写已冻结源码而改变验证对象。源码目标包含此次任务记录更新；无新增运行逻辑。最终 commit SHA 只能在解除“本轮不提交”并批准具体操作后产生，tree OID 不冒称 commit SHA。W4d 此时未执行。
