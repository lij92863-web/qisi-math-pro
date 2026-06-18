**只读审计报告**

确认：当前分支是 `stage-c2-next-safe-work`，本轮未修改任何代码、配置或文档。

**涉及文件**

- [main.html](c:/Users/Administrator/Desktop/gpttiku/main.html:1)
  批量录题审核页 UI、脚本加载顺序。关键是加载 `qisi-batch-importer.js`、`qisi-support-parser.js`、`qisi-support-repair.js`、`app.js`。

- [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:943)
  批量录题主控、批次创建、V2 调度、DOCX importer 接入、答案/解析 DOCX 结构化、草稿保存、审核页状态。

- [qisi-batch-importer.js](c:/Users/Administrator/Desktop/gpttiku/qisi-batch-importer.js:551)
  DOCX 题目 XML importer。负责从 `word/document.xml` 中抽题干、题号、选项、图片/公式占位。

- [qisi-batch-engine-v2.js](c:/Users/Administrator/Desktop/gpttiku/qisi-batch-engine-v2.js:720)
  V2 批处理 engine。DOCX 答案文件作为 evidence 进入 support 识别/合并链路。

- [qisi-support-parser.js](c:/Users/Administrator/Desktop/gpttiku/qisi-support-parser.js:1126)
  答案/解析 DOCX 的显式块解析与 coverage 校验。

- [qisi-support-repair.js](c:/Users/Administrator/Desktop/gpttiku/qisi-support-repair.js:1)
  答案/解析缺失字段的 fill-only 修复计划与应用策略。

- [tests/support-parser.test.js](c:/Users/Administrator/Desktop/gpttiku/tests/support-parser.test.js:1)
  support parser / coverage 回归测试。

- [tests/support-repair.test.js](c:/Users/Administrator/Desktop/gpttiku/tests/support-repair.test.js:1)
  support repair fill-only 策略回归测试。

**核心函数**

- 批次创建：
  `createDraftImportBatch` in [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:943)

- V2 批量识别入口：
  `runBatchRecognition` → `processDraftImportBatchV2` in [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:18830)

- DOCX 题目文件分流：
  `parseDocxQuestionFilesWithImporterForV2` in [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:16818)

- DOCX 题目 XML 解析：
  `parseDocxFile` in [qisi-batch-importer.js](c:/Users/Administrator/Desktop/gpttiku/qisi-batch-importer.js:849)

- DOCX 题目草稿归一：
  `normalizeDocxImporterDraftForV2` in [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:16613)

- 答案/解析 DOCX evidence：
  `buildDocxEvidence` in [qisi-batch-engine-v2.js](c:/Users/Administrator/Desktop/gpttiku/qisi-batch-engine-v2.js:642)

- 答案/解析结构化：
  `recognizeSupportDocumentFromEvidence` in [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:8825)

- 显式 support 块解析：
  `parseExplicitSupportBlocks` in [qisi-support-parser.js](c:/Users/Administrator/Desktop/gpttiku/qisi-support-parser.js:1126)

- coverage 闸：
  `validateSupportCoverage` in [qisi-support-parser.js](c:/Users/Administrator/Desktop/gpttiku/qisi-support-parser.js:1492)

- 缺失字段修复策略：
  `buildSupportRepairPlan` / `applySupportRepairsFillOnly` in [qisi-support-repair.js](c:/Users/Administrator/Desktop/gpttiku/qisi-support-repair.js:70)

- 最终草稿去重/图片回绑：
  `batchFinalGateDedupeDrafts`、`batchFinalGateRebindDraftImages`、`attachDraftImageTokensIntoStemsForV2` in [app.js](c:/Users/Administrator/Desktop/gpttiku/app.js:15690)

**DOCX+DOCX 数据流**

1. 用户在批量录题页上传 DOCX 题目 + DOCX 答案。
2. `createDraftImportBatch` 写入 `draftImportBatches` 和 `draftImportFiles`，随后触发 `runBatchRecognition(batchId)`。
3. `runBatchRecognition` 调用 `processDraftImportBatchV2`。
4. V2 将题目 DOCX 分到 `docxQuestionFiles`，答案 DOCX 留给 `engineFiles`。
5. 题目 DOCX 走 `QisiBatchImporter.parseDocxFile`：
   - 读取 `word/document.xml`
   - 构造题块
   - 解析题号、题干、A-D 选项
   - 识别 inline 图片 / 公式图片占位
   - 输出 drafts
6. `normalizeDocxImporterDraftForV2` 将 importer draft 归一为审核页草稿：
   - `sourceTrace.source = 'docx-importer-v2-primary'`
   - 保留题号、题干、选项、图片 token、元数据
   - 标记 “DOCX 已使用 XML importer 解析，未走 DOCX 转 PDF。”
7. 答案 DOCX 由 V2 engine 建 evidence；`recognizeSupportDocumentFromEvidence` 使用 support parser 解析答案/解析显式块。
8. `parseExplicitSupportBlocks` 输出 blocks、answerRaw、solutionRaw、diagnostics。
9. `validateSupportCoverage` 对 expected question numbers 做 fail-closed coverage 校验。
10. 如部分 answer/solution 缺字段，`qisi-support-repair.js` 生成 fill-only repair plan，只补缺失字段，不覆盖已有字段。
11. support answers/solutions 按题号合并回 drafts。
12. 最终进入 `batchFinalGateDedupeDrafts`、图片回绑、写入 `draftQuestions` / `draftImages`。
13. 审核页读取 `batchDraftQuestions`，用户逐题检查、确认、提交。

**回归测试入口**

命令行最小回归：

```powershell
node --check app.js
npm.cmd test
```

项目级检查：

```powershell
npm.cmd run check
npm.cmd test
```

浏览器侧 DOCX+DOCX 回归入口：

```js
window.__qisiTestBatchDocxGolden?.()
window.__qisiLatexDisplayNormalizeSelfTest?.()
```

人工回归路径：

1. `npm.cmd start`
2. 打开 `http://127.0.0.1:3000/main.html`
3. 批量录题
4. 上传 DOCX 题目
5. 上传 DOCX 答案
6. 开始识别
7. 进入审核页
8. 检查第 1-9 题 options
9. 检查答案/解析 coverage 没有缺题
10. 检查可标记确认、可提交入库

**本轮遵守情况**

未修 PDF+PDF；未加入低置信度质量闸；未修改 `validateDraftForReview`、`draftQuestionProblems`、提交/确认逻辑、parser、repair、PDF 渲染、prompt、模型、DB、C-2 merge。