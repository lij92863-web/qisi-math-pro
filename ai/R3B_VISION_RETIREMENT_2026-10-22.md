# DOCX 视觉兜底链退役记录（2026-10-22）

## 决定

用户确认：**只退役第 2 部分（DOCX 视觉兜底路由），保留第 1 部分（截图识别）**。

| 部分 | 内容 | 结论 |
|---|---|---|
| 1 截图识别 | `handleOcrFile` → `qwenDocumentOcrSource.recognizeManualQuestion` → `qwenOcrRuntime` | **保留**，行为未改 |
| 2 DOCX 视觉兜底 | `docx-vision` 生产者身份、`DocxVisionReconciler`、DOCX vision question/support producer、`runDocxVisionImport`、`strictVisual*` 装配 | **退役** |

## 已删除

- 路由：`resolveProductionImportRoute` 对 `docx-vision` 抛 `PRODUCTION_IMPORT_PRODUCER_RETIRED`（`docx-vision-retired`）；
- app.js 装配：`docxVisionQuestionReconciler`、`docxVisionQuestionSourceProducer`、
  `docxVisionSupportSourceProducer`、`runProductionDocxVisionImport`、
  `strictVisualPreparedPagesRecognizer`、`strictVisualQuestionProducer`、`docxToPdfConverter`；
- 桥端口：`runDocxVisionImport: runProductionDocxVisionImport`；
- 页面加载：`qisi-docx-vision-reconciler.js`、`qisi-production-docx-vision-source-port.js`；
- 登记：两个模块改为 `deprecated`（layers/docs owners）与 `dormant`（runtime）。

## 未删除

- `qisi-qwen-vision-source-port.js`、`qisi-ocr-qwen-adapter.js` 及 Qwen runtime：截图识别仍用；
- `qisi-batch-engine-v2.js` 的 strict visual 工厂、`qisi-docx-converter.js`：文件与单测保留，
  只是 app 不再装配；相关 owner 测试已改为"断言 app 不再装配"，防止重新接回；
- 桥内 vision 分支保留（路由已不可达），历史批次身份读取不受影响。

## 证据

- `0ff2e60`/`0016c04` 路由退役；`051d4c0` 装配与加载退役；
- 浏览器证据 / true-producer smoke / 生产矩阵第 2 场景 / phase-5 门禁均改为
  "拒绝且不进入生产者、不产生 OCR 调用"；
- 单测：2301/2303（两处已知假红：golden `Promise was collected`、pdf windowed-organize 负载偶发）；
  `check`、`no-real-ai`、`write-boundary` 通过。

## 重新接回的条件

若未来恢复 DOCX 视觉识别：路由恢复 `docx-vision` 许可 + 重新装配上述 producer + 恢复两个
loader + 把 owner 登记改回 production；不要把截图识别的 Qwen runtime 一起删。


## 审计修复 I2 补充（2026-10-22）

上文是 512a5d8 时的第一轮退役范围与当时日志，不代表审计后的闭合状态。I1 动态盘点见 IMPORT_ENTRY_CONSUMERS_AUDIT_2026-10-22.md。

本轮已移除 Bridge 的 vision 能力探测和生产执行分支；即使自定义 resolver 返回 vision，也在进入 producer 前明确拒绝。runDocxVisionShadow 只保留同名退役拒绝墓碑，不再委托任何端口。app 未用 strictQuestionPageRecognizer 装配退出；共享 Qwen runtime/截图端口及通用纯工厂仍保留。

历史 vision batch/draft 身份与原始证据继续可读；重跑不转身份、不写新草稿。独立 source-port 的纯投影/隔离 shadow 单测保留为历史研究材料，main/runtime 继续不加载。恢复执行链必须另行明确授权与重新设计，不能据上文历史恢复步骤自动恢复。


## 2026-10-23 当前交接口径

以 [审计修复交接](HANDOFF_APP_SPLIT_R1_R7_2026-10-22.md) 和 [最终职责对照](APP_SPLIT_AUDIT_FINAL_2026-10-23.md) 为当前入口。本文第一轮“两处假红”数字仅为历史日志，不再作为当前验收替代条件；修复阶段实际完整门禁按任务账记录。截图输入保留由真实离线入口测试持续验证，未恢复付费调用授权；旧 vision 历史身份及读取合同不删除。所有修复仍在 512a5d8 上未提交，原目录未回流。
