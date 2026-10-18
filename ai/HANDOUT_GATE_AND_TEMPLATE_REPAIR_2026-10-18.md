# 讲义前置修复：模板配置持久化 + 公式门禁 + 离线 worker

日期：2026-10-18
分支：`stage/program-c-corrective-r1`
性质：对现有「组卷打印」链的有界修补，**不新建功能页、不重写 app.js**

## 一、为什么做这三件事

调研讲义功能时发现：软件里**已经有一套完整的组卷打印链**（`app.js` 4500-4800：
`renderLatexForPrint` / `buildQuestionContent` / `openPrintWindow`，A4 + `@page` +
`break-inside: avoid` + KaTeX + 图片转 dataURL + 等字体就绪再允许打印）。
老师说的「讲义」，本质是这套链的第 3 种预设，不是从零新建。

但这套链有三个会直接毁掉讲义体验的断点，必须先修：

### 1. 自定义模板存不住版式（P1，功能承诺落空）

`customTemplates` 只存 `{ id, name, code }`，**不存 `examConfig`**；
而 `examPresets` 把所有自定义模板的 config 硬写成
`{ ...DEFAULT_PRESET_KEY.config, title: tpl.name }`。

后果：老师在右侧面板精心调好的字体、字号、主题色、答题表，
一旦「保存为新模板」，**全部退回默认值**。这与「编辑自己的专属模板」的承诺直接矛盾。

同时 `watch(selectedExamTemplate)` 直接读 `EXAM_LAYOUT_PRESETS[key].config`，
绕过 `examPresets`，所以切到自定义模板等于把配置重置成默认。

更隐蔽的一条：`qisi_exam_config` 是**全局单一 key**，A 模板调好的字号会跟着到 B 模板。

修法（`app.js` 5 处，均是数据流而非新增业务逻辑）：
- `examPresets`：系统模板叠加 `templateOverrides[id].config`；自定义模板用 `tpl.config`
- `watch(selectedExamTemplate)`：改为按 `examPresets[key].config` 重建
- `onMounted` 恢复：改为 `默认 ← 模板自身配置 ← 本模板的临时改动`
- `saveNewCustomTemplate` / `updateExistingCustomTemplate`：写入 `config: toRaw(examConfig)`
- `qisi_exam_config` 写入格式加 `template` 标记，恢复时只认本模板的临时改动；
  旧格式（裸 config）仍兼容

### 2. 公式坏了照样导出（P1，直接对应「保证不乱码」）

`renderLatexForPrint` 的 `catch` 只 `console.warn`，然后把原文塞进
`<span class="latex-render-error">` 继续导出。老师在屏幕上点打印时看不到，
打开 PDF 才发现第 7 题是一行红字。

新增 `qisi-handout-formula-gate.js`（UMD，纯函数，无 DOM），导出前逐题逐字段扫描：

| 类别 | 判定方式 | 处置 |
|---|---|---|
| 定界符未配对 | `tokenizeLatexSource().issues` | **阻断** |
| KaTeX 编译失败 | `renderToString({ throwOnError:true })` | **阻断** |
| 能编译但输出空白 | 显式规则表 | **阻断** |
| 能渲染但有隐患 | `strict` 传函数收集 code | 只提示 |

**实测确认的关键事实**（katex 0.16.47）：
- `\ce{H2O}` → 抛错 `Undefined control sequence`
- `\label{a}` → 抛错
- `\includegraphics{...}` → **不抛错，渲染为空** —— 只靠 `throwOnError` 抓不到，必须显式拦
- 全角空格 → `unicodeTextInMathMode` 警告，但公式照样能印
- 未闭合 `$` → `tokenizeLatexSource` 报 `unclosed-math`，该段完全不进 math

`confirmBeforeExport()` 是唯一出口：返回 `true` 才允许导出；
没有 `confirm` 环境时返回 `false`（fail-closed），不允许悄悄放行。
确认框文案列出前 6 处问题的题号与字段，老师点「取消」回去改题。

`normalizeForKatex` 复制了 `app.js` 的 `normalizeMathExpressionForPrint` 规则
（`\overparen` / `\wideparen` / `\overarc` → `\overset{\frown}{}`）。
**这两处必须同步**，否则会出现「门禁说通过、打印却报错」。测试锁住了这条。

### 3. PDF 文字提取仍从境外 CDN 取 worker（P1，断网即失效）

`vendor/pdfjs/pdf.worker.min.js` 本地就在（1.1MB，版本 3.11.174，与
`vendor/pdfjs/pdf.min.js` 完全一致），但 `qisi-browser-document-source.js`
两处仍兜底到 `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`。

后果：断网时 PDF 文字提取失败；联网时白下 1.1MB。
`qisi-browser-pdf-renderer.js` 早已用本地路径，只有文字提取这两处漏了。

改为 `./vendor/pdfjs/pdf.worker.min.js`。

## 二、同批修复：DOCX 双文件链的三处静默丢数据

双 Word 审计发现三处**不报错但答案悄悄少掉**的问题。只修了证据充分、改法明确的三处：

### 2.1 混合答案不再整表作废

`题号：1 2 3 4 / 答案：A 2 C 4` 是真实排版（1、3 选择题，2、4 填空题）。
旧逻辑把答案行按**单个字符**拆并只接受 `A-F`，列数对不上就 `return []`，
**整张答案表作废，一次丢四题答案**。

改为：先按**单元格**拆（一个格子就是一个答案，多选 `AB` 不拆开），
列数对不上才退回单字符拆；接受 1-12 字符的任意答案。

实测：`1=A, 2=2, 3=C, 4=4`。

### 2.2 汇总表不再被位置匹配二次解析

`pairRegex` 会在整段答案区里按「数字 + 字母」猜配对，
`答案：A 2 C 4` 被读成「2 的答案是 C」，把表格里正确的「2 的答案是 2」冲掉。

改为：表格认出的题号记进 `tableNumbers`，`pairRegex` 遇到就跳过。

### 2.3 标签后没有空格时，第一题答案不再丢

`答案：1.A 2.B` 中 `1.A` 紧贴冒号，而 `pairRegex` 的边界类不含冒号，
第 1 题匹配不到 —— 首题答案静默缺失。

改为把冒号加入边界类。

实测：`1=A, 2=B`（原来只有 `2=B`）。

### 2.4 试过但回滚的两处（重要）

对 `pushUniqueQuestionItem` 和 `parseNumberedSolutionBlocks` 各改过一版，**均已回滚**：

- 「同题号不同内容 → 清空该题字段」：清空是静默丢数据，老师会以为源文件本来就没有；
- 「同题号不同内容 → 抛 `DOCX_SUPPORT_DUPLICATE`」：在解析切分本身不可靠的前提下，
  会把**正常文件**判成重复。监工用一份完全合法的题答合订稿复现了拒导
  （`1.【答案】A / 【解析】… / 2. 分两种情况讨论 / … / 2.【答案】B`）。

**未修的既有问题（本轮不引入新行为）**：
1. 同一题号出现两条不同答案时，旧逻辑仍然「保留更长的那段」—— 这是猜测，题号印错会错挂；
2. 解析里行首的步骤编号（`2. 当 x>0 时…`）仍可能被当成下一题，导致解析串位。

这两条要修，前提是先把「第 2 题的解析」和「第 1 题解析里的第 2 步」区分开 ——
纯文本信息不足，需要原页或额外证据。硬改只会把静默错挂换成拒导。

### 2.5 试过但回滚：仓库层的事务包装

`qisi-storage-repository.js` 的 `run()` 是 `async` 函数，`async` 会插一层原生 Promise
边界，理论上会让 Dexie 丢失事务 zone（表现为「题目已入库、界面却报保存失败」）。

改成原样返回 Dexie 的 Promise 后，**PDF 页并发测试立刻稳定失败**：
`page requests were serialized: 415ms`（3 页 × 138ms 串行执行），回滚后
同一个测试 36/36 通过。改一个底层的 Promise 包装会牵连并发调度，**已回滚**。

因此「保存失败但其实已经存进去了」这个风险**仍然存在**，只是不再恶化。
老师的操作规则：看到「保存入库失败」先去题库列表确认，不要直接重试。

## 三、app.js AST 预算调整说明

`scripts/verify-app-shell-architecture.js` 对 `app.js` 有节点预算。
本次净增 89 个 AST 节点、0 个函数，来自：

| 位置 | 增量性质 |
|---|---|
| `examPresets`（约 2878） | 叠加模板自身 config，多一层对象展开 |
| `onMounted` 恢复（约 3875） | `savedRaw.template` 判定 |
| `watch(selectedExamTemplate)`（约 3926） | 改读 `examPresets` |
| `printExam`（约 4820） | **仅 1 行**门禁调用，逻辑全在独立模块 |

九个人工复核函数的 AST 哈希与行号范围**未变**，`decision` 仍为
`APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED`。

预算由 27901 → 28077，`reviewedFunctionCount` 保持 586。

## 四、验证

- `node --check`：`app.js`、`qisi-handout-formula-gate.js`、`qisi-mineru-client.js`、
  `qisi-mineru-evidence.js`、`qisi-browser-document-source.js` 全部通过
- `tests/handout-formula-gate.test.js`：11/11 通过
- `tests/mineru-*.test.js` + `tests/block-ownership.test.js`：55/55 通过
- `scripts/verify-app-shell-architecture.js`：9 函数哈希未变
- `npm run verify:safe`：见 `ai/` 同批次日志

## 五、未做（明确边界）

- 没有新建讲义页面、没有改界面布局、没有动 `main.html` 结构
  （只加了一个 `<script>` 标签）
- 没有引入新依赖、没有导出 Word（调研结论：Word 路线公式必退化）
- 没有改题库数据结构，没有迁移任何既有数据
- MinerU 的「卷级判定拖垮全部题」未修（需要单独设计题粒度过期机制）
