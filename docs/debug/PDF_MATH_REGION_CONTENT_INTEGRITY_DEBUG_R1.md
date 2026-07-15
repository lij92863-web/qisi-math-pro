# PDF Math Region Content Integrity Debug R1

Decision:
PDF_MATH_REGION_CONTENT_INTEGRITY_ACCEPTED

Baseline commit: `7fefb3f2d726485ddf153936bd492c70eefd870c`

Final implementation commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`

Branch: `codex/debug-pdf-math-region-content-integrity-r1`

## Outcome

简略双 PDF 和完整双 PDF 均通过正常 UI 导入、逐题预览、内容审计和刷新持久化。完整数据集导入 12/12 题，简略数据集导入 6/6 题；正式题库写入数均为 0。第 12 题答案和解析中的公式全部由 KaTeX 渲染，不再以裸 LaTeX 结尾。

本次采用轻量混合算法，不依赖 MathType、Office 自动化、Python OCR 或新增大型运行时：视觉模型只负责页面转录；PDF.js 文本层提供显式答案和完整选项证据；PDF operator list 提供内嵌图片变换矩阵；纯 JavaScript 负责坐标、区域、公式、图片归属、污染检测和 fail-closed 控制写入。迁移到其他教师电脑时不需要 MathType 会员，也没有新增 npm 依赖。

## Root causes and first-failure stages

1. PDF 页的模型 bbox、PDF.js viewport 坐标和裁剪像素混用，轻微越界 bbox 会在后续裁剪阶段失真；无效裁剪此前可能退化为整页图。
2. 选项清理会把 `A = B`、`B \subseteq A` 等公式开头误当成重复标签，跨页选项又缺少文本层的完整 A-D 证据门。
3. PDF 公式在 page postprocess 到 draft persistence 之间被当作普通字符串再次清洗，裸命令、Unicode 数学符号、绝对值和碎片 delimiter 没有统一 canonical owner。
4. 题图/解析图只依赖模型 bbox 或邻近题号，缺少跨题区域的唯一 ownership、0.90 overlap 门槛及 crop contamination 检查。
5. 答案 PDF 的内嵌 raster XObject 没有从 PDF transform matrix 恢复页内 bbox，因此解析图无法可靠绑定到显式答案/解析区域。
6. 答案/解析写入没有优先使用 PDF 文本层的“题号 +【答案】”证据，图片及来源页审计字段又在 inline image normalization 时丢失。
7. 浏览器回放元数据曾按并发响应完成顺序编号，导致题目页的 capture page 错位；现按渲染图 SHA 映射回源 PDF SHA/页码并重建缓存键。

## Production call graph

`批量录题 UI` → `strict PDF page rendering` → `PDF.js text/operator layout` → `Qwen page transcription/OCR` → `Qisi.PdfContentIntegrity canonical normalization` → `local text-layer option and answer reconciliation` → `support parser/alignment` → `field-level controlled-write` → `draftQuestions/draftImages` → `unified KaTeX/image preview` → `reload roundtrip`。

模型结果不能直接决定答案或图片 owner。显式题号、source page、区域 overlap、连续序列和 controlled-write 决定是否可写；无法证明时拒绝写入并保留原始证据。

## Active owners changed

- `qisi-pdf-content-integrity.js`: 新的单一职责 owner，负责 canonical bbox、rotation、math rich runs、显式答案、跨页选项、XObject placement、figure ownership、crop contamination 和内容审计。
- `app.js`: 仅接线 PDF.js layout、现有识别链、draft projection、图片裁剪与预览元数据；无题号特例，无新增大型业务算法。
- `qisi-pdf-support-controlled-write.js`: 仅接收已由 PDF 文本层证明且题号唯一的显式答案证据，仍保持字段级 fail-closed。
- `main.html` / `package.json`: 加载并语法检查新 owner。

## Files changed and why

- `app.js`: 接入 text/operator evidence、canonical normalizer、可靠裁剪、解析图来源页和 persistence metadata。
- `qisi-pdf-content-integrity.js`: 新增纯函数实现，避免继续扩张 legacy coordinator。
- `qisi-pdf-support-controlled-write.js`: 显式 PDF 答案证据进入现有唯一 truth gate。
- `main.html`, `package.json`: 模块加载与 `node --check`。
- `scripts/audit-pdf-import-content.js`: 机器化内容/公式/图形/污染/旁路审计。
- `scripts/pdf-engine-replay-store.js`, `scripts/reindex-pdf-engine-replay.js`: 脱敏 capture、稳定 key、响应 hash、经证据校正的页码重索引。
- `tests/pdf-content-integrity-*.test.js`: geometry、math、figure、support 和 audit 单测。
- `tests/pdf-engine-replay-store.test.js`: 脱敏、cache key 和重索引回归。
- `tests/pdf-math-region-browser.test.js`: 正常 UI 上传、角色选择、Network replay、逐题预览、IndexedDB、刷新复核和 Formal Admission 计数。
- `tests/fixtures/pdf-golden/*`, `tests/fixtures/pdf-replay/*`: 独立人工 golden truth 与离线 mock replay。
- `artifacts/debug/pdf-math-region-content-integrity-r1/*`: 源页渲染、SHA 证据、15 条脱敏真实 engine response 和重索引映射。

未修改 `scripts/pdf-master-browser-runner.js`，未运行 `real-run`，未运行真实代理 smoke，未修改 `main`。

## Golden truth summary

| Dataset | Questions | Option slots | Answers | Analyses | Required stem figures | Required analysis figures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 简略 | 6/6 | 24/24 | 6/6 | 6/6 | 1/1（Q4） | 1/1（Q6） |
| 完整 | 12/12 | 36/36 | 12/12 | 12/12 | 3/3（Q4/Q8/Q11） | 2/2（Q6/Q8） |

完整答案序列为 `B,C,B,C,D,C,ABD,AC,ABD,-19/13,6,(sqrt(2)+1)/2`。Q6 选项精确为 `1:8, 1:9, 1:26, 1:27`。浏览器预览实际产生简略 89/89、完整 227/227 个 KaTeX 渲染节点，公式错误节点均为 0。

## Case P1-P6 findings

### P1 — Q1 formula structure

- 题号: 1
- source page: 完整题目 PDF 第 1 页
- source bbox: `[0.105,0.176,0.849,0.320]`
- actual result: `\sin`、`\frac`、`\in`、集合括号均为 math runs 并正常渲染；答案 B。
- expected result: 公式结构完整且没有裸 LaTeX。
- first failing stage: page postprocess → display/persistence normalization。
- root cause: PDF 字符串没有 canonical math/rich-run owner，二次清洗会破坏边界。
- fix commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`
- regression test: `tests/pdf-content-integrity-math.test.js`, `tests/pdf-math-region-browser.test.js`

### P2 — Q4 option and stem figures

- 题号: 4
- source page: 完整题目 PDF 第 1 页
- source bbox: `[0.105,0.530,0.849,0.890]`
- actual result: B 选项精确为 `$\frac{1330\sqrt{2}}{3}\pi$`；题图可见，foreign option content 为 0。
- expected result: 选项不串题、图形不丢失。
- first failing stage: option normalization / figure crop projection。
- root cause: option 标签识别过宽且裁剪缺少 canonical bbox 与 ownership gate。
- fix commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`
- regression test: `tests/pdf-content-integrity-math.test.js`, `tests/pdf-content-integrity-figures.test.js`, browser E2E。

### P3 — Q6 options, answer and analysis figure

- 题号: 6
- source page: 题目第 1 页；解析图来自答案第 2 页
- source bbox: question `[0.105,0.960,0.575,1.000]`; analysis figure `[0.617235,0.118446,0.871023,0.287778]`
- actual result: 选项 `1:8,1:9,1:26,1:27`，答案 C，解析图绑定到 Q6 并在刷新后保留。
- expected result: 无重复标签、无视觉猜测选项、解析图不整页回退。
- first failing stage: overflow question region / cross-page option evidence / support image ownership。
- root cause: 页底 bbox 超过 1000、选项缺少文本层完整序列门、答案 XObject 未定位。
- fix commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`
- regression test: geometry、support、figure suites 和 browser E2E exact-options assertion。

### P4 — Q7 delimiter integrity

- 题号: 7
- source page: 完整题目 PDF 第 2 页
- source bbox: `[0.148,0.150,0.652,0.260]`
- actual result: `\left`/`\right`、绝对值与复数公式全部渲染；broken option formula count 为 0。
- expected result: delimiter 成对且不跨页面/视觉行误合并。
- first failing stage: formula fragment assembly。
- root cause: 旧逻辑没有同页同视觉行约束和 Unicode math canonicalization。
- fix commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`
- regression test: `tests/pdf-content-integrity-math.test.js`, browser E2E。

### P5 — Q8 figure ownership and contamination

- 题号: 8
- source page: 题目第 2 页；解析图来自答案第 3 页
- source bbox: question `[0.148,0.276,0.870,0.420]`; analysis figure `[0.689803,0.199549,0.867395,0.366172]`
- actual result: 题图与解析图均可见，owner 为 Q8，foreign question overlap 为 0，刷新后来源页仍为 3。
- expected result: 不挂到 Q7/Q9，不把整页答案当图片。
- first failing stage: figure detection → ownership/crop。
- root cause: 缺少 PDF XObject transform placement、唯一 owner 和 contamination gate。
- fix commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`
- regression test: `tests/pdf-content-integrity-figures.test.js`, `tests/pdf-content-integrity-support.test.js`, browser E2E。

### P6 — Q11 vector formula and answer

- 题号: 11
- source page: 完整题目 PDF 第 2 页
- source bbox: `[0.148,0.658,0.880,0.776]`
- actual result: 答案 6；`\overrightarrow`、`\cdot`、`\sqrt`、`\therefore` 全部渲染，raw LaTeX 为 0。
- expected result: 向量解析完整且不以裸命令落库。
- first failing stage: support OCR math normalization → persistence。
- root cause: 解析字段未经过与题干一致的 canonical math normalization。
- fix commit: `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`
- regression test: math suite、audit suite 和 browser E2E。

## Validation details

- LaTeX syntax errors: 0
- Unrenderable LaTeX: 0
- Raw LaTeX outside math blocks: 0
- Keyboard-style math fragments: 0
- Duplicate option labels: 0
- Foreign/section content in options: 0
- Raw JSON / Markdown fence / placeholders: 0 / 0 / 0
- Wrong figure owners / contaminated crops: 0 / 0
- Ambiguous alignment / controlled-write rejection on accepted golden data: 0 / 0
- Missing source answers / analyses / stem figures / analysis figures: 0 / 0 / 0 / 0
- Wrong attachment / controlled-write bypass / Formal Admission bypass: 0 / 0 / 0

裁剪失败现在 fail closed，既不返回来源整页，也不创建绑定记录。题图要求唯一 owner 且 overlap `>= 0.90`；解析图要求答案 marker 连续、solution region 唯一且无相邻题污染。

## Persistence and browser evidence

正常 UI 流程使用真实 file input 上传、选择题目/答案角色、创建任务、依次打开全部预览。简略和完整数据集均在 IndexedDB `draftQuestions`/`draftImages` 中保存 rich fields、content integrity、normalized bbox、图片来源页和 bbox；页面 reload 后重新进入审核，Q6/Q8 图片仍可见且公式错误为 0。`questions` 正式表计数始终为 0。

直接读取当前 in-app browser 控制台：页面标题 `奇思数学 Pro | 题库架构拆分版`，`[QISI_RUNTIME][booted]` 正常，无 page error、应用 error 或 LaTeX render error。唯一 warning 是既有 Tailwind CDN production 提示。Network E2E 捕获并回放 `/api/ai/chat` 和 `/api/ai/ocr`，每个请求按 model、prompt SHA、image SHA、源 PDF SHA、页码、DPI、schema 和 endpoint 匹配。

本线程无附着的 stdout terminal；端口 3000 的 listener 已核实为 `node qisi-local-server.js`。冻结 runner dry-run 的 health 返回 200、service=`qisi-local-server`，browser chain 正常打开批量录题页。

## Real API and replay usage

- 简略 capture: 5 个真实 engine requests，题目第 1 页、答案第 1–2 页。
- 完整 capture: 10 个真实 engine requests，题目第 1–2 页、答案第 1–4 页；包含一次上游失败响应及受控重试/修复证据。
- 合计: 15 个脱敏响应；授权头、API key、原始 base64 图片均未保存。
- 后续浏览器测试全部 replay：稳定正常路径实际消费简略 4 个、完整 8 个响应，其余失败/旧修复响应保留为诊断证据但不再调用真实 API。
- 15 个 replay entry 的 filename/cacheKey 和 response SHA 已逐一复核。

## Full gate results

- New PDF content suites: 39/39 passed。
- Brief normal-UI captured replay: passed，6/6，89 KaTeX，0 render errors，reload passed。
- Full normal-UI captured replay: passed，12/12，227 KaTeX，0 render errors，reload passed。
- Offline mock normal-UI browser: passed。
- `npm.cmd run verify:safe`: passed；1001 tests，996 passed，0 failed，5 existing skips；mock smoke 和 no-real-ai passed。
- `verify:personal-stable`: passed（转发到仓库现有 `verify:docx-stable` 稳定门禁）。
- `verify:docx-stable`: passed。
- `verify:batch-safety`: passed。
- `verify:pdf-known-bad`: passed。
- `verify:no-real-ai`: passed。
- `tests/pdf-route-b-hold.test.js`: 6/6 passed。
- `tests/pdf-support-controlled-write-answer-ownership.test.js`: 21/21 passed。
- frozen runner `preflight`: passed，realApiCalled=false。
- frozen runner `dry-run`: passed，health/browser/input checks all passed，realApiCalled=false。
- `git diff --check`: passed。

## Safety counters

`wrong attachment / raw JSON / placeholder / controlled-write bypass / Formal Admission bypass = 0 / 0 / 0 / 0 / 0`。

DOCX+DOCX 稳定链、PDF known-bad fail-closed、Route B hold 均未回归。未新增依赖，未使用 MathType 或 Office COM，因此本次算法不会增加教师电脑的安装体积或授权要求。

## Known limitations

- 页面仍加载 Tailwind CDN，控制台会出现既有 production warning；与本任务的 PDF 内容链无关。
- 对无法从显式题号、连续 marker、PDF 坐标和唯一区域证明归属的内容，系统会保留原始证据并要求人工复核，而不会猜测补齐。

## Git status

实现、测试和脱敏 capture 已在独立分支提交为 `640f4c2d108176e8fab0c7f3ae4d6a6ab5e485c5`。本报告及机器结果作为随后单独 evidence commit 提交；`main` 未修改。
