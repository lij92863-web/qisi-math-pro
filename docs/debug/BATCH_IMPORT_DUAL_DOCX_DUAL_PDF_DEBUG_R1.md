# BATCH_IMPORT_DUAL_DOCX_DUAL_PDF_DEBUG_R1

## 结论

`BATCH_IMPORT_DUAL_FORMAT_STABLE_BLOCKED`

阻断原因：

1. 完整版 DOCX 唯一真实验收失败。12 题确定性主链完成后，视觉补充仍有 1 题残留未转换公式图片；系统正确 fail closed，正式题写入为 0。
2. 完整版 PDF 唯一真实验收发现 wrong attachment：第 6 题草稿答案为 `B`，源文件答案为 `C`。依照 PDF fail-closed 规则和冻结边界，未修改 PDF parser / aligner / controlled-write，也未重跑完整版。
3. 指令要求的 `npm.cmd run verify:personal-stable` 在当前 `package.json` 中不存在。

因此不能发布稳定接受标记。

## 分支与范围

- 基线：`da699b53abbe8a6715bb8a8ffae5a954f6b514af`
- 分支：`codex/debug-batch-import-dual-format-r1`
- 未修改 `main` 分支。
- 未修改冻结的 PDF controlled-write、aligner、block parser、answer-only extraction、answer extraction quality 或 `scripts/pdf-master-browser-runner.js`。
- `app.js` 仅增加路由/编排胶水、视觉补充调用和诊断持久化；确定性策略与合并算法位于 `qisi-docx-pipeline.js`。

## 根因与修复

### DOCX 错误进入视觉主链

原生产流程在普通题目 DOCX 上优先执行 DOCX→PDF→整页视觉，导致简略输入产生 11 次真实调用并最终因支持文件视觉漏识别失败。

修复后：

- 题目 DOCX producer：`docx-xml-importer`
- route decision：`deterministic-docx-primary`
- selected source port：`docx-importer`
- 答案/解析 DOCX producer：`docx-text-support-parser`
- 只有检测到 WMF/EMF/OLE 公式占位时才进入视觉 supplement；视觉结果只能按权威题号补充缺失证据。

### DOCX importer 乱码与解析异常

- 修复选项标签正则中的损坏字符，消除 `RangeError: Invalid array length`。
- 将不可显示 WMF/EMF 输出改成可检测的中文占位标记，不再把超长乱码写入题干/选项。
- 简略题目 DOCX 含 33 个 WMF；完整版题目 DOCX 含 61 个 WMF。

### DOCX 支持文件题号证据

- 简略题目只有 1–6，而完整版答案含 1–12；7–12 被保存为 unmatched，不进入 1–6 的合并候选。
- 支持文件第 2 题题号在 DOCX 文本层表现为 `3941445800102【答案】`。只在权威 1–6 契约下，将长数字后缀修复为题号 2，并持久化 repair evidence。
- 第 2 题答案字段为空，但解析含明确的“故选：C”；使用既有 `finalChoiceAnswerText` 规则产生答案 C，并标记来源警告，不做语义猜测。

### AI 模型优先级

真实重现显示：

- `qwen3-vl-plus` 两页均在代理层 504 `AI_PROXY_TIMEOUT`；
- `qwen-vl-max-latest` 两页均为 403 `Access denied`；
- 已知可用的 `qwen-vl-plus` 原位于最后。

将 `qwen-vl-plus` 调整为视觉回退序列首项。修改后简略 DOCX 真实重试约 31 秒通过，避免先发生两轮必失败调用。

## 真实 UI 结果

所有测试均通过正常 UI 创建任务、选择角色和预计题数；任务运行后检查 IndexedDB、审核页和 reload 状态。未确认提交，正式题库始终为 0。

| 场景 | 结果 | 题数/顺序 | 答案安全 | 乱码/占位 | 正式题提前写入 |
|---|---|---:|---|---:|---:|
| 简略 DOCX + 完整版答案 DOCX | 通过 | 6，1→6 | `B/C/B/C/D/C` | 0 | 0 |
| 简略 PDF + 完整版答案 PDF | 通过 | 6，1→6 | 仅允许正确值或空；wrong attachment 0 | 0 | 0 |
| 完整版 DOCX + 完整版答案 DOCX | 失败并关闭写入 | 确定性链识别 12 | 未进入 ReviewDraft | 残留 1 题公式占位 | 0 |
| 完整版 PDF + 完整版答案 PDF | 阻断 | 12 题审核候选 | 第 6 题错误写为 B，正确为 C | 测试在错挂断言处停止 | 0 |

初始未修复简略 DOCX 复现产生 11 次真实 AI 请求，其中包含一次 502 `AI_PROXY_FETCH_FAILED`；随后所有开发回归均拦截最外层 AI transport 并返回原始兼容响应。只有阶段性真实验收解除拦截。完整版按指令各执行一次，没有重复跑完整版调代码。

## 系统行为

- 简略 DOCX/PDF：进入待审核，reload 后题号顺序 1→6，正式题为 0。
- DOCX 视觉补充不完整：任务状态为 failed，错误包含失败阶段与残留题数，正式题为 0。
- HTTP 504/403：控制台保留模型、HTTP 状态和代理错误，不再归类为普通内容解析错误。
- PDF wrong attachment：浏览器断言明确阻断，不发布稳定结论。

## 测试与门禁

通过：

- `npm.cmd run verify:safe`
- `npm.cmd run verify:docx-stable`
- `npm.cmd run verify:batch-safety`
- `npm.cmd run verify:pdf-known-bad`
- `npm.cmd run verify:no-real-ai`
- `node --test tests/pdf-route-b-hold.test.js`
- `node --test tests/pdf-support-controlled-write-answer-ownership.test.js`
- `node scripts/pdf-master-browser-runner.js preflight`
- `node scripts/pdf-master-browser-runner.js dry-run`
- DOCX pipeline、占位检测、模型优先级单元测试
- 真实文件、正常 UI、原始 transport mock 的简略 DOCX 浏览器回归

未通过/不可用：

- `npm.cmd run verify:personal-stable`：脚本不存在。
- 完整版 DOCX 真实浏览器验收：残留 1 题未转换公式证据。
- 完整版 PDF 真实浏览器验收：第 6 题 wrong attachment（B，应为 C）。

## 修改文件

- `app.js`：DOCX route manifest/identity/port 编排、确定性主链、受控视觉 supplement、模型优先级、诊断持久化。
- `qisi-batch-importer.js`：损坏正则和不可显示媒体标记修复。
- `qisi-docx-pipeline.js`：纯路由决策、契约分区、题号证据修复、视觉补充合并。
- `tests/docx-pipeline.test.js`：纯函数回归。
- `tests/batch-vision-model-priority.test.js`：可用模型优先级回归。
- `tests/batch-import-dual-docx-real-browser.test.js`：真实文件双格式 UI 验收套件（默认 skip，显式环境变量运行）。

## 下一步

需要单独授权的后续任务：在不修改冻结文件的前提下，先为完整版 PDF 第 6 题 wrong attachment 建立最小、可重复的原始证据 fixture；若必须修改冻结的 PDF truth gate，则需要新的明确任务文件。完整版 DOCX 的残留题也应在新的任务中用离线 importer/视觉响应 fixture 定位，不能继续重跑真实完整版碰运气。
