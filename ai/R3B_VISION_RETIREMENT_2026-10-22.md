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
