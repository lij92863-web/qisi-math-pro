# PDF Math Region Content Integrity Debug R1

Decision: `PDF_MATH_REGION_CONTENT_INTEGRITY_ACCEPTED`

Branch: `codex/debug-pdf-math-region-content-integrity-r1`

Implementation base: `b6a18d6`

## Outcome

简略版双 PDF（6 题）和完整版双 PDF（12 题）均通过正常 UI 导入、逐题预览、图片归属、图片位置修改、草稿保存、刷新持久化与内容审计。测试没有点击提交，正式题库写入数始终为 0。

用户报告的两个直接问题已经解决：

1. 第 11 题解析中的 `\text{}`、`\overrightarrow`、`\sqrt`、`\therefore`、`\cdot` 不再以裸 LaTeX 显示；新草稿在持久化前规范化，旧草稿在渲染边界兼容修复。
2. “图片位置”和“保存修改”不再因嵌套 Vue Proxy 导致 IndexedDB `DataCloneError`。右对齐、年份修改与刷新后的持久化均已由正常 UI 测试证明。

## Root causes

- 模型给出的图片 bbox 曾被直接信任，缺少 PDF 本地对象证据、唯一 owner 与污染扫描，可能把选项、相邻题文字或答案页整块内容错挂为题图。
- 完整版题目 PDF 的文本层缺少第 11 题 marker；仅依赖文本 marker 会丢失 Q11 的安全图片区域。
- 混合解析块可能把中文桥接文本和多个 LaTeX 命令一起包在一个数学分隔符中，KaTeX 无法把整段按“中文 + 多个公式岛”正确显示。
- 审核页只复制图片位置代码，没有修改题干/解析和数据库；`toRaw` 又只解开外层 Proxy，嵌套图片对象写 IndexedDB 时触发 `DataCloneError`。

## Bounded implementation

- `qisi-pdf-content-integrity.js`
  - 使用 PDF.js operator list 的内嵌图片放置矩阵作为本地证据。
  - 图片必须通过显式题号区域、唯一 owner、重叠率 `>= 0.90`、几何阈值、跨题污染和文字污染扫描。
  - 模型 bbox 仅保存为未验证证据，不自动绑定；不能证明时 fail closed。
  - 文本 marker 不完整时，只有题号序列与每题 page/bbox 都完整一致才允许使用 bbox fallback；边界歧义只排除不安全 owner。
  - 混合中文/公式块重新分段，同时保留合法公式内部的 `\text{...}`。
- `qisi-review-draft-state.js`
  - 题图默认居中进入题干；解析图在首个“如图/作图”提示后进入解析。
  - 左/中/右位置替换为纯函数；一键提交计划不再依赖“标记已确认”。
- `app.js`
  - 仅负责 PDF.js 证据接线、裁剪、审核动作和存储投影。
  - 源证据已验证的图片投影为 `confidence=1/status=bound`，题图和解析图分开展示。
  - 审核写库统一生成可序列化快照，防止嵌套 Proxy 触发 `DataCloneError`。
- `qisi-components.js` / `qisi-utils.js`
  - 预览组件直接调用显示兼容规范化；不再由 `app.js` monkey patch 组件。

没有新增 npm 依赖，没有使用 MathType、Office COM、Python OCR 或新的本地模型。迁移到其他老师电脑时不会增加安装体积或会员要求。算法设计参考 [PDF.js API](https://mozilla.github.io/pdf.js/api/)，并对照 [PDFFigures 2.0](https://pdffigures2.allenai.org/) 与 [DocLayNet](https://arxiv.org/abs/2206.01062) 的布局/图形提取思路；本项目选择现有 PDF.js + 纯 JavaScript 证据门禁，避免引入重型 ML 运行时。

## Normal UI acceptance

| Dataset | Questions | Answers | Analyses | Stem figures | Analysis figures | KaTeX nodes | Render errors | Formal writes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 简略版 | 6/6 | 6/6 | 6/6 | 1/1 (Q4) | 1/1 (Q6) | 89 | 0 | 0 |
| 完整版 | 12/12 | 12/12 | 12/12 | 3/3 (Q4/Q8/Q11) | 2/2 (Q6/Q8) | 230 | 0 | 0 |

完整版答案序列：`B,C,B,C,D,C,ABD,AC,ABD,-19/13,6,(sqrt(2)+1)/2`。

Q11 专项结果：答案 `6`；预览中 25 个 KaTeX 节点、1 张归属 Q11 的题图、0 个渲染错误；DOM 文本中裸 `\text{}`、`\overrightarrow`、`\sqrt`、`\therefore`、`\cdot` 计数均为 0。

正常 UI 还验证了：

- Q4 图片“图片位置 → 靠右”写入 `wrapfigure{r}` 并持久化。
- 年份修改为 `2026` 后点击“保存修改”，刷新仍为 `2026`。
- 已验证图片在草稿行和内联引用中均为 `confidence=1/status=bound`。
- 页面不存在“标记已确认”，存在“一键提交本题”和底部“一键提交”；测试未点击提交。
- `DataCloneError`、`set-placement-failed`、Vue runtime error、未处理异步错误均为 0。

## Content audit

以下计数均为 0：

- 缺题、重复题、缺答案、缺解析、缺必需题图、缺必需解析图；
- 错误图片 owner、跨题污染裁剪、选项/正文污染；
- LaTeX 语法错误、不可渲染公式、数学块外裸 LaTeX、键盘式公式残留；
- JSON/Markdown/占位符泄漏、歧义对齐、controlled-write 越界；
- `DataCloneError` 与 Formal Admission bypass。

## Browser and Network evidence

- in-app browser 实际地址：`http://localhost:3000/main.html`
- 页面标题：`奇思数学 Pro | 题库架构拆分版`
- 最新资源：`qisi-utils r1-4`、`qisi-components r1-4`、`qisi-pdf-content-integrity r1-8`、`qisi-review-draft-state r1-3`、`app r1-8`
- 最新 reload：应用 error 0、page error 0；仅有项目既有的 Tailwind CDN production warning。
- 正常 UI 测试使用已捕获响应回放拦截 `/api/ai/chat` 与 `/api/ai/ocr`；本次修复没有真实 AI/OCR 调用或费用。
- 完整版第一次重跑曾因外部 Vue/KaTeX CDN 连接中断，页面未启动业务代码；服务健康为 200，随后连续重跑通过。该环境抖动不计为业务通过证据。

## Verification

- Targeted PDF/review/display suites: passed（含 Q11、合法内部 `\text`、figure ownership、one-click、placement）
- Brief captured-replay normal UI: passed
- Full captured-replay normal UI: passed
- `verify:docx-stable`: passed
- `verify:personal-stable`: passed
- `verify:pdf-known-bad`: passed
- `verify:batch-safety`: passed
- `verify:no-real-ai`: passed
- Route B hold: 6/6 passed
- Controlled-write answer ownership: 21/21 passed
- Frozen runner `preflight`: passed, `realApiCalled=false`
- Frozen runner `dry-run`: passed, health/browser/input checks passed, `realApiCalled=false`
- `git diff --check`: passed
- `verify:diff-scope`（13 个明确允许文件）: passed
- `npm run verify:safe`: passed（1017 tests，1012 passed，0 failed，5 existing skips）

## Safety and limitations

- `main` 未修改；冻结 runner 未修改；没有真实 AI/OCR 调用；没有自动写正式题库。
- 无法证明 owner 时仍会拒绝自动绑定并保留原始证据，宁可缺图也不把图挂错题。
- 页面仍依赖外部 CDN；断网或 CDN 抖动可能阻止 Vue/KaTeX 启动，这不是本次 PDF 算法范围内的改动。
