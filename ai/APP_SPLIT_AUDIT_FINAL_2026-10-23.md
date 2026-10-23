# app.js 拆分审计修复：职责与验收对照（2026-10-23）

这是实施者自审记录。代码位于隔离候选 `C:\Users\Administrator\Desktop\qisi-w2-candidate-20261021`，分支 `codex/app-split-audit-repair-20261022`，HEAD 仍为 `512a5d8427f4732ff14bcc54dd76de6b093625ad`。本文对应其上累积的未提交修复，不存在“新修复提交 SHA”。原工作区索引 SHA256 保持 `50D317DDC192E2738B969FA490C62DB7723CCB22A0ABFB416240F717EE032960`；原业务文件和生产 IndexedDB 未被回流修改。

方案与逐步范围：`CODEX_TASK_AUDIT_REPAIR_2026-10-22.md`；原方案位于原工作区 `local-run-artifacts/golden-baseline/20261022-independent-split-audit/REPAIR_PLAN.md`。所有首次失败、完整日志与每单元可恢复快照位于原工作区 `local-run-artifacts/golden-baseline/20261022-audit-repair/`。不能仅 checkout 512a5d8 就声称取得修复版，应连同验收快照/补丁查看。

## 1. 原 R1–R7 与最终负责人

以下 18 个既有切片均有真实浏览器消费者；没有为了数量新增空运行模块。`tests/app-split-complete-boundary.test.js` 保护关键 handler 和状态别名；`tests/e2e/app-split-live-owners.test.js` 实际验证每个模块只注册/加载一次、在 app 启动前就绪、浏览器导出与 Node 一致。它们补充旧九项冻结门禁，不替换九项 hash 或上调预算。

| 原任务 / 模块 | 唯一职责 / 实际消费者 | 失败与生命周期合同 | 主要保护 |
|---|---|---|---|
| R1 / ReviewDraftReadModel | 草稿统计、筛选、图片 token 判定；审核列表 computed | 只读，不改源草稿、选择和编辑缓冲 | 原纯模型测试；review-readonly-projection |
| R1 / ReviewImageProjection | 当前题/真实题图/原页/预览投影；审核图片区 | 原页不混为题图，投影不写入持久化 | 原图投影测试；review-readonly-projection |
| R1 / ReviewEditorProjection | 源文本与预览字段投影；会话 prepare、审核预览 | 输入冻结可用，预览不反写原证据 | 原编辑投影测试；review-readonly-projection |
| R2a / ReviewEditorCommit | 源到草稿字段的 detached 准备；ReviewSession.save | 失败不先改原题；保留来源、版本和原证据 | qisi-review-editor-commit；会话失败 UI |
| R2b / ReviewSessionCommands | 15 个审核 refs、访问代次、dirty/保存原值/选题/持久化回执 | 晚到读取和保存不覆盖新批次、新源或元数据；卸载移除 beforeunload | review-session-isolation；review-action-boundaries |
| R2c / ReviewImageCommands | 确认/删图/绑定/裁剪命令与像素端口；真实审核图片按钮 | 同一来源/批次/题号；字节与 token 同事务；失败不先发布；裁剪端口销毁 | review-image-atomicity；review-crop-atomicity；pdf-region-crop |
| R2d / ReviewBatchConfirm | 单次确认并入库、批量确认编排；两个真实 UI handler | 串行、部分失败不误报、无自动重试；新编辑/导航阻止旧后续动作；批量确认不自动入库 | review-action-boundaries；review-batch-confirm-failure |
| R3 / ImportRunCommands | 有效 controller 的 run/cancel/rerun 与访问回执；普通识别入口 | 每批 pending 唯一；取消/卸载不重启；结果只能接纳到原访问 | import-review-session-isolation；原身份/锁/取消测试 |
| R3 / ImportDraftCommand | Bridge→草稿持久化映射与现有 PDF producer 端口装配 | 保留 DOCX/PDF 原生产者、来源证据和身份；不恢复退役执行链 | 原 import-draft-command；PDF 普通 UI / DOCX 身份测试 |
| R4b / LibraryImageResources | 图片 URL scope 和捕获资源持有；loader、真实 QuestionCard | 失败/过期只释放本次 scope；旧卡片仍使用的资源有 lease；卸载最终释放 | qisi-library-refresh-lifecycle；library-refresh-failure |
| R4a / LibrarySnapshot | 分域读取、指纹与准备后发布；libraryLoader | 原全量顺序保留；题库/外部库各自 epoch/scope；先完整准备再发布 | library-domain-refresh；原 F2 晚失败测试 |
| R4c / LibraryExternalMerge | 外部页面 refs、包预览/选择/合并/撤销/删除协调 | 失败保留决策；同命令锁；取消/新输入/导航/卸载不接旧预览；只刷对应域 | external-merge-safety；qisi-external-workspace/package/model |
| R5a / ManualEntryModel | 表单/页签、偏好、图输入、精确短码、明确保存；录题入口 | 图片先存字节后发布；恢复可见图；失败保留输入；保存晚到不清新输入；停止 FileReader/观察器 | manual-entry-workspace；截图保留测试 |
| R5b / PersonalKnowledgeModel | 个人树/三级输入/选择/纯命令/计数；个人知识点入口 | 仓储专用事务读最新树；失败不假发布；父子和目标证据校验；卸载停止接纳 | personal-knowledge-workspace；原树纯模型 |
| R5c / ExamTemplateModel | 模板和布局状态、选择/保存/覆盖/恢复/监听；模板与组卷配置 | 字体字号随模板；恢复不互相覆盖；失败不假成功；晚到保留新编辑；停观察器 | template-workspace；storage-rejection-normalization |
| R6a / ExamGroups | 试卷车顺序/分值/分组与偏好、固定快照；组卷 UI 与打印捕获 | 0 分有效；不插入失效来源；跨题型拒绝；pointercancel/Escape/导航/卸载清理事件/帧/动画 | exam-workspace；原 exam-print-preview |
| R6b / ExamPaperParts | 完整题答组合、选项/图/文本/公式纯渲染；DocumentBuilder | 不读 DOM/库/可变车；固定题号顺序和模式；显式公式端口、诊断与安全 URL | 九种迁移前完整内容逐字对照；image-display-url |
| R6c / PrintResources | 准备 busy、图片编码、公式确认编排、完整窗口、URL/channel、就绪/打印按钮；printWorkspace | 无 opener；自包含图片；坏图/缺字节/样式失败不打印；打开失败释放；刷新/活消费者保留；关闭/父卸载释放 | print-output-lifecycle；print-long-paper-pagination；六页 Poppler 视觉检查 |

R7 是贯穿验收：五份运行/架构登记按既有规则保持一致；未增加新运行文件，无新增 script。所有新增有状态负责人都通过注入端口应用到原页面，正式写入仍经现有 LibraryService/StorageRepository。PDF/DOCX 解析算法、数据库版本/索引、依赖锁和字体资产不在本轮变更内。

## 2. 关键缺陷修复与兼容影响

- G1 真实确认一次，随后观察数据库和页面完成；callProxy 使用页面持有的任务 Map，只同步派发/读完成状态，不把待写 Promise 交给 CDP，也不重试写入。首次 GC/context 失败日志保留，不再用排除 golden 文件替代完整门禁。
- 批量确认修正失败行身份引用；失败/部分成功、保存期间的新编辑与导航分别保护。独立确认不能偷偷变成正式提交。
- 外部重复来源阻止再次新增；撤销必须在同一事务证明当前题目/来源仍等于此次合并写后快照。历史缺证明的合并记录仍可读，撤销明确拒绝；不会删掉教师之后编辑的题。包图片 ID 与显示 token 一次性同步，原始证据不改。
- DOCX vision 执行/能力/自定义 resolver 绕行与 shadow 执行闭合；历史身份和草稿读取保留；截图识别路径保留且离线替身验证，不恢复真实调用权限。
- 仓储在 Dexie 3.2.4 的 rejection handler 内抛另一个 Error 会多报原始未处理拒绝；run/atomic 改为返回归一 rejected Promise，保留 code/message/回滚合同，真实多表失败回滚验证通过。
- 正式题只改文字但传回已有 dataURL 图片时，保留原图片行元数据/createdAt（包括 0），新 Blob 仍通过同一 replaceQuestion 原子写入。整链路非题目表相等断言保留。
- 打印使用点击时同一不可变快照，混合题型题答编号一致；缺字节不借用旧网络/Blob URL。坏图和样式失败明确禁止打印。标题与首题、同一答案块增加分页约束，实际六页 PDF 逐页复核。

## 3. 状态、启动与释放顺序

状态工厂在 setup 构造，app 对表单/个人树/模板/组卷/busy 只持别名。初次全量读取提供模板/个人树首快照；之后由各自负责人接管。每次个人树命令从事务内最新规范记录构建，模板单独读模板表，不用全量刷新覆盖其他域。备份恢复沿用原 reload，重新构造负责人读取恢复后的状态。

模板恢复在 guarded 区间解析模板标记与对应临时配置；组卷恢复前的题库发布不能先清空保存的车项。审核访问代次与来源/元数据签名决定能否接纳回执。Vue 卸载调用各 owner.dispose；剪贴板、DOM 选区、Canvas、导航和数学渲染只作为明确端口。

预览通过唯一 channel/token 回执报告 loaded/ready/error/closed。只有打开未获回执才按失败期限回收；活预览不靠十分钟定时器推定已结束。正常关闭后探测是否仍有同 URL 消费者；F5 重连保留 URL。进程崩溃且无 pagehide 信号时，资源由父负责人卸载兜底。这是明确边界，不冒称能可靠取得 noopener 窗口句柄。

## 4. 保留的 app 协调与历史兼容入口

不宣称整个 app.js 已无业务代码。本轮保留九项受冻结处理器、正常创建任务的表单/确认/DTO/存储/初始运行胶水、截图输出整理、既有 PDF 来源证据/保守对齐帮助函数及库编辑字段接线；它们不是本次新增实现。未为压行数改写 PDF 算法或未授权重写旧协调器。当前约 2965 行只是测量，不是完成判据。

`window.auditQuestionLatexData`/`window.migrateSafeQuestionLatexData` 为显式兼容入口；默认启动零迁移，前者只读，后者仅在明确调用后执行并报告部分进度。备份/安全检查的历史控制台入口保持原有授权边界。`AppProxy` 是实际 Vue 实例和现有测试/调试入口，迁移模块不回取它；测试用的 updateDraftQuestionField 兼容入口仍经过原 ReviewController 与草稿 persistence，未成为正式写旁路。

## 5. 实际证据与未验收边界

已完成单元门禁依次记录在任务账；截至 X3 最终 safe 为 2490/2490。A1 定向：完整普通 PDF 连续链路、新隔离环境 11 表及 Blob 对照、恢复后模板字号/个人树；18 个真实模块注册/导出/关键 handler；缺图片字节的便携打印拒绝；原 DOCX+DOCX、PDF fail-closed、截图保留与全部失败反例继续保留。A1 最终 safe 2496/2496，batch-safety/runtime-dependency/AST/scope 均通过，退出码全部 0；证据为 `A1-*` 日志与 exit 文件。最终自审完成，W4 原目录收口继续单独推进。

实际长卷：`X3-print-artifacts-v2/long-paper.pdf`，6 页 A4，8 题/8 答/3 图，公式与缺图错误零，题答对应；Poppler 六张 PNG 全部查看。初版孤悬标题和解析断页的 PDF/PNG、反例及修复均保留。它不是数学人工金标准、真实学校卷或实际打印机验收。

尚未覆盖：独立于实施者的人工/内容复核；真实整卷及生产换机恢复；字体真实字重独立任务；全新机器独立依赖安装（候选仍借用原 node_modules junction）。原混合工作区 W4 对账/集成/原索引更新仍单独推进，不用候选绿色冒称原目录已干净。没有提交/推送/PR，没有修改生产库或调用真实 AI/OCR。
