# 交接入口：app.js 拆分审计修复（更新 2026-10-23）

先读本页，再读 [最终职责与验收对照](APP_SPLIT_AUDIT_FINAL_2026-10-23.md) 和 [逐步任务账](CODEX_TASK_AUDIT_REPAIR_2026-10-22.md)。本页替代第一轮“18 个小切片已完成”的交接口径；历史提交和首次失败仍保留。

## 当前源码身份

| 项目 | 实际值 |
|---|---|
| 候选目录 | `C:\Users\Administrator\Desktop\qisi-w2-candidate-20261021` |
| 修复分支 | `codex/app-split-audit-repair-20261022` |
| HEAD / 审计参照 | `512a5d8427f4732ff14bcc54dd76de6b093625ad` |
| 修复交付形式 | 该 HEAD 上累积未提交修改；没有新的修复 SHA，没有推回原仓库 |
| 原目录 | `C:\Users\Administrator\Desktop\题库系统`；原业务文件/索引保留，证据写入 ignored local-run-artifacts |
| 原 HEAD / 索引 | `3099a479ca4a8bd5e2a06f2365bb78bc5ff848af` / `50D317DDC192E2738B969FA490C62DB7723CCB22A0ABFB416240F717EE032960` |
| 依赖 | node_modules 借用原目录 junction；未做新机器独立安装验收 |

`3099a47..512a5d8` 实测是 33 个历史提交，旧 32 个统计截至此前文档提交。这个历史计数与约 2965 行 app 体积都不代表任务完成率。直接 checkout/fetch 512a5d8 只能取得审计前版本；修复内容要看当前工作树及证据快照。

## 18 个现有模块现在负责什么

| 模块组 | 完整负责人 |
|---|---|
| 审核只读 | ReviewDraftReadModel、ReviewImageProjection、ReviewEditorProjection：统计/筛选/图片/编辑源投影，只读且不动缓冲 |
| 审核编辑/命令 | ReviewEditorCommit：detached 准备；ReviewSessionCommands：单一会话与保存；ReviewImageCommands：完整图命令/像素端口；ReviewBatchConfirm：确认与批量/入库动作编排 |
| 导入 | ImportRunCommands：有效 controller 运行/取消/重跑与访问回执；ImportDraftCommand：持久化映射与有效 PDF producer 的来源端口装配 |
| 题库 | LibraryImageResources：URL scope/lease；LibrarySnapshot：分域读取/发布；LibraryExternalMerge：完整外部页面与输入/结果协调 |
| 录题/知识点/模板 | ManualEntryModel、PersonalKnowledgeModel、ExamTemplateModel：各自的单一状态、保存失败与恢复/卸载顺序 |
| 组卷/打印 | ExamGroups：顺序/分值/拖排/固定快照；ExamPaperParts：完整题答与纯渲染；PrintResources：图片准备/完整开窗/就绪/资源释放 |

实际规则仍由已有 LibraryService、StorageRepository、ReviewController/Workflow、FormalAdmissionPolicy、PDF/DOCX producers 等承担。完整逐模块消费者、失败、释放和测试映射见最终对照表。app 保留受冻结和既有协调胶水，不宣称整文件已无业务。

## 门禁口径

```powershell
cd C:\Users\Administrator\Desktop\qisi-w2-candidate-20261021
npm.cmd run verify:safe
npm.cmd run verify:batch-safety
node scripts/verify-app-shell-architecture.js
node scripts/verify-runtime-modules.js
node scripts/verify-qisi-runtime-dependencies.js
```

精确范围检查使用原证据目录 `allowed-A1.json` 中的逐文件白名单设置 QISI_ALLOWED_DIFF，再运行 verify-diff-scope；不能放宽为全仓。检查未跟踪、staged 和 unstaged 三部分。

旧九项 AST hash 从 512a5d8 保持不变，仅在验证相等后更新行范围。**不能自动刷新 hash 或抬高预算。**新关键处理器另由 app-split-complete-boundary 与实际浏览器接线测试保护。

历史 golden Promise/context 失败已经有驱动根因与修复：真实动作只派发一次，页面持有 pending 任务，再同步观察完成。不要再用“排除 golden 文件后全绿”作最终通过依据。首次失败日志留存；目前已验收单元均有完整 safe 绿色，A1 以任务账及最新 A1 日志/exit 为准。

## 已定决策与兼容变化

- DOCX vision 生产执行、Bridge shadow 和 resolver 绕行均明确退役；历史批次/草稿身份可读；重跑不偷偷改身份。[退役范围](R3B_VISION_RETIREMENT_2026-10-22.md)。源码物理删除不是目标。
- 截图识别保留，测试使用离线替身；没有真实 AI/OCR 调用授权。
- 缺充分写后证据的历史外部合并记录不允许撤销。新记录撤销须证明当前内容未被教师或后续操作改动。
- 默认启动不迁移正式题。诊断只读，历史修复仍是显式兼容入口。[入口盘点](LIBRARY_MAINTENANCE_ENTRYPOINTS_2026-10-22.md)。
- 打印固定点击时的题目/图/模式/布局，坏图或样式失败不能打印；预览无 opener，以独立 channel/token 管理生命周期，不靠十分钟猜测结束。
- 字体真实字重仍是独立既有任务；未在本轮替换资源。

## 证据、剩余工作与回退

原目录 `local-run-artifacts/golden-baseline/20261022-audit-repair/` 包含 P0 原目录保护、每单元失败/修复日志、`*-snapshot/` 源文件/二进制 patch/哈希、完整安全门禁、真实 UI 及合成六页打印 PDF/PNG。恢复材料不等于生产题库备份。

A1 已完成实施者自审：safe 2496/2496、批量安全/依赖/AST/范围通过。W4a 已对账完成；W4b/W4c 的隔离整合和恢复演练已有成功证据，最终冻结目标与复验结果见下方操作单入口。W4d 尚未执行，不能宣布原工作区已干净。原目录集成、提交、服务切换须先给出具体操作单、预期哈希和恢复演练结果，再取得最终执行批准；当前任务禁止自行提交。

未覆盖独立人工数学复核、真实整卷/打印机/生产恢复和独立依赖安装。候选绿色不能替代这些结论。

回退先保留当前修复快照/补丁，在独立干净 checkout 对照某个已验收单元；模块实现、调用、登记与测试一起恢复并复验。不要在含历史混合改动的原目录 reset/clean，也不要直接切旧提交覆盖当前未提交修复。

## W4 原混合改动对账已完成，整合准备证据入口

W4a：259 路径全部有去向；196 个暂存片段、70 个工作片段及 28 处相交逐项审查，app.js 12 片和 main.html 11 片逐片登记。原始两层恢复资料和旧删除测试保护去向在原证据 `W4a-ledger/`。W4b/c 对本次冻结源码的整合树、重新运行的门禁、恢复演练和具体操作单，以原证据 `W4_FINAL_OPERATION.md` 为准；未生成该报告前不能声称准备完成。该报告须给准确 tree OID 与待批准动作，不能拿 512a5d8 冒称修复提交。W4d 实际提交和原目录收口仍须最终明确批准，原生产数据不进入源码恢复流程。
