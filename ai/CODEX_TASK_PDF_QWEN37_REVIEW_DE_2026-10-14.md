# 固定千问模型的审核与跨窗口软件接入

用户在固定千问 3.7 Flash 后要求“继续”。本轮完成剩余 D/E 软件范围，保留全部既有 dirty 工作与证据；不重新选择模型。复杂内容理解继续交给模型。

目标：新候选可实际人工采用；原页、完整模型候选及独立复核意见并排显示；来源冲突、遗漏、补页请求可见；跨窗口互斥覆盖读取、识别、费用留痕、草稿保存和最终读回，避免只锁模型调用而丢失并发账目。使用浏览器 Web Locks，不新增数据库 schema、租约或本地分题算法。

浏览器还复现 A/B 生成的“需要人工采用”说明被放进 warnings，导致全部人工采用后仍永久阻止确认。允许在同一 contract 中将该软件生成的说明改为独立 reviewNotice 信息，不删 AI 原 issues、原文警告或未解决任务问题，不放宽字段/序列门禁。

完整采用场景另证实 chooseCandidate 把非选择题的空 options 标为 manual，违反现有正式审核“缺失字段保持 missing”的规则。允许该函数对实际空字段保留 missing；不改 FormalAdmissionPolicy、不把空值伪装成证据、不降低题干/答案要求。

允许：qisi-pdf-external-contract.js（纯审核视图投影）、qisi-normal-ui-import-controller.js（完整正常导入执行的跨窗口互斥）、qisi-pdf-external-producer.js/qisi-config.js（浏览器能力门禁）、app.js（一个计算视图、导出和提示装配，约 3 行）、main.html/app.css（PDF 专用审核展示）、docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json（仅实际 AST 预算和行号，不改九个 handler hash）、tests/pdf-external-review-ui.test.js、tests/e2e/pdf-external-chain.test.js（新增/加强新协议场景，不弱化坏例）、本任务、ai/PDF_QWEN37_REVIEW_DE_2026-10-14.md，以及本轮 ignored 证据目录。

app.js 必须触及的区域：PDF 审核 computed 视图与模板导出、正常导入失败提示；浏览器复现另允许 choosePdfCandidate 的未保存编辑保护及已保存候选后的既有编辑器基准同步调用（2 行）。qisi 模块足以完成全部投影和并发逻辑，但 Vue 模板需要暴露计算值，既有 UI 事件负责刷新编辑器引用；不添加业务算法、不改九个受保护 handler。

另允许准备 ai/CODEX_TASK_PDF_QWEN37_PILOT_2026-10-14.md 和新 ignored 试验证据目录中的离线请求清单；准备过程没有真实调用权限。

禁止：DOCX 解析、正式入库门禁、生产数据、源材料、依赖、凭据、旧退役 PDF、服务重启、commit/push。真实调用另用具体任务、源页和预算记录，不把本任务直接当付费脚本。

验证：纯投影不改原证据，来源引用只按明确 ID/页码显示；新候选按钮可见、采用后仍需确认、未保存编辑不被覆盖；真实双浏览器页 Web Locks 拒绝第二次执行，锁覆盖最终持久化；刷新后模型/人工状态可区分。运行 verify:safe、app-shell guard 和本轮哈希保全。
