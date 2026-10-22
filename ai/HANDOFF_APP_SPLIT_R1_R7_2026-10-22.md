# 交接文档：app.js R1–R7 拆分（2026-10-22）

> 前置阅读：`ai/HANDOFF_FOR_ASTRA_2026-10-21.md` 第 18 节（拆分任务卡）。
> 完成报告（含证据路径，git-ignored）：
> `local-run-artifacts/golden-baseline/20261021-w2-candidate/R1_COMPLETE_REPORT.md`。

## 1. 现在在哪

| 项 | 值 |
|---|---|
| 分支 | `codex/w2-candidate-20261021` |
| HEAD | `ed12630fde35a46276d1693c90ba21e091fe4edd` |
| 基线 | `3099a479ca4a8bd5e2a06f2365bb78bc5ff848af` + W2/W3 的 10 个提交（`e55ea3d`） |
| 隔离克隆 | `C:\Users\Administrator\Desktop\qisi-w2-candidate-20261021`（`node_modules` 指向原工作区的 junction，无 `.env`） |
| 原工作区 | `C:\Users\Administrator\Desktop\题库系统`，**未触碰**：HEAD `3099a47`、索引 SHA-256 `50d317dd…`、259 行状态 |

提交数：`3099a47..HEAD` 共 **32 个**（10 个 W2/W3 + 22 个拆分切片）。
app.js：5285 → **4799 行**；新增 **18 个模块**、**110 个单测**。

## 2. 新增模块（每个都有 `tests/qisi-*.test.js`）

| 领域 | 模块 |
|---|---|
| 审核只读投影 | `qisi-review-draft-read-model.js`、`qisi-review-image-projection.js`、`qisi-review-editor-projection.js` |
| 审核编辑/命令 | `qisi-review-editor-commit.js`、`qisi-review-session-commands.js`、`qisi-review-image-commands.js`、`qisi-review-batch-confirm.js` |
| 导入 | `qisi-import-run-commands.js`、`qisi-import-draft-command.js` |
| 题库读取 | `qisi-library-image-resources.js`、`qisi-library-snapshot.js`、`qisi-library-external-merge.js` |
| 录题/知识点/模板 | `qisi-manual-entry-model.js`、`qisi-personal-knowledge-model.js`、`qisi-exam-template-model.js` |
| 组卷/打印 | `qisi-exam-groups.js`、`qisi-exam-paper-parts.js`、`qisi-print-resources.js` |

模块统一写法：IIFE + `module.exports` 双导出，显式注入端口，失败关闭错误码，`Object.freeze`。
app.js 只保留页面状态（Vue refs）、存储调用与弹窗。

## 3. 每个切片的固定流程（照抄即可加新片）

1. 先写行为保护测试（纯函数契约 + 失败关闭码）；
2. 新模块 + `tests/qisi-<name>.test.js`；
3. app.js 改调用点，删除原实现（保留页面状态与存储/弹窗）；
4. `main.html` 加 `<script src="./qisi-xxx.js?v=rNx-20261022"></script>`（在 `app.js` 之前）；
5. 五份登记：
   - `architecture/layers.json`（id/file/layer/domainOwner/publicApi/allowedDependencies/forbiddenDependencies/status）
   - `architecture/owners.json`（`<domainOwner>: "<file>"`）
   - `architecture/runtime-modules.json`（`{file, runtime: "browser"}`）
   - `docs/architecture/layers.json`（层 `ownerIds`）
   - `docs/architecture/owners.json`（owner 对象）
6. 刷新 `docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json` 的
   `range`/`astSha256`（涉及 9 个冻结 handler 时）；
7. 跑 `npm run verify:safe`，单独提交。

刷新矩阵可以用临时脚本调用
`require('./scripts/verify-app-shell-architecture.js').astHash`，用 acorn 遍历
`FunctionDeclaration` / `VariableDeclarator`，按名字回填；临时脚本不要提交。

## 4. 门禁与已知假红（重要）

`verify:safe` = `verify:no-real-ai && check && test && verify-write-boundary`。

- 已知假红 1：`tests/golden-production-replay.test.js` 的
  `docx-stable-pair → mark-reviewed:1`，CDP `Promise was collected`（页面报
  "Execution context was destroyed"）。业务状态已写入 `reviewed` v2，页面存活。
  W2 隔离实验 42 次中 11 次复现。**处理口径**：全量门禁只因此失败时，再跑
  "排除该文件的全量套件"（2302/2302）并保留两份日志，不要把测试改绿。
- 已知假红 2：`tests/pdf-qwen-simple-pipeline.test.js` 的 windowed-organize
  仅在高并发全量时偶发，单独 36/36 通过。
- 本阶段最终证据：全量 2303 → 2302 通过 + 1 个假红；去该文件 **2302/2302**；
  `check`、`no-real-ai`、`write-boundary` 均通过。

## 5. 关键决策（已生效，别再问）

1. **DOCX 视觉兜底层退役**（2026-10-22 用户确认）：
   路由对 `docx-vision` 抛 `PRODUCTION_IMPORT_PRODUCER_RETIRED`，
   app.js 不再装配 reconciler/producer/runner，两个 loader 已移出 `main.html`；
   模块登记为 `deprecated` / `dormant`，文件与单测保留。
   详见 `ai/R3B_VISION_RETIREMENT_2026-10-22.md`。
2. **截图识别保留**：`qwenOcrRuntime` / `qwenDocumentOcrSource` 未改；
   后续任何"清理 Qwen"的动作都必须先证明截图识别不受影响。
3. 字体真实字重（CSS 4 个字重指向同一 ExtraLight、bold 为合成）是**独立任务**，
   见 `ai/FONT_WEIGHT_FIX_TASK_2026-10-21.md`，不在本次拆分范围。

## 6. 尚未做（接手可选）

- 物理删除退役文件（`qisi-docx-vision-reconciler.js`、
  `qisi-production-docx-vision-source-port.js`）及其单测；
- 桥内 vision 分支（路由不可达）是否一起删；
- `renderPdfRegion` 旋转/缩放的独立 e2e；
- PDF 登记对 `require` 依赖的补全；
- 独立人工评审（目前只有代理自评）；
- 合并候选分支 / 开 PR。

## 7. 如何继续

```powershell
cd C:\Users\Administrator\Desktop\qisi-w2-candidate-20261021
git log --oneline 3099a47..HEAD        # 32 个提交
npm run verify:safe                    # 约 4 分钟
node --test tests/qisi-*.test.js       # 只跑本次新增单测
```

加新切片时先看 `tests/qisi-exam-groups.test.js`（简单纯函数）和
`tests/qisi-review-editor-projection.test.js`（带端口注入）两种范式。

## 8. 回滚

候选分支独立于原工作区：切回 `e55ea3d`（W2 基线）或 `3099a47` 即可，
不需要动原工作区，也不需要恢复数据库。
