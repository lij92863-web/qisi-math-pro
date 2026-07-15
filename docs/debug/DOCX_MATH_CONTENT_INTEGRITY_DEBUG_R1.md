# 双 DOCX 公式与内容完整性 Debug R1 报告

## 决策与 Git

- Decision: `DOCX_MATH_CONTENT_INTEGRITY_ACCEPTED`
- Baseline commit: `d6b820f4696fa86ec6ddab1cf84891767666e858`
- Final implementation commit: `db23e999d68f577ad45121472c5938c499a44c3e`
- Branch: `codex/debug-docx-math-content-integrity-r1`
- Final evidence commit: 本报告所在的 release evidence commit（最终回复提供精确哈希）
- Git status: 报告提交后 clean；分支未修改 `main`，冻结 PDF 文件相对 baseline 无 diff。

## Root causes 与首次失真层

| 问题 | 首次失真层 | 根因 | 修复 |
| --- | --- | --- | --- |
| MathType/公式缺失 | DOCX math extraction | 公式主要为 MathType OLE/WMF，不是可直接读取的 OMML；旧链把预览当图片或占位内容 | 从 OLE `Equation Native`/WMF `AppsMFC` 提取 MTEF，先走本机 MathType translator，失败项由确定性 MTEF reader 补齐，缺任一公式即 fail closed |
| `\frac{1330$$\sqrt{2}}{3}\pi` 与相邻公式错误 | rich run serialization / display normalizer | delimiter owner 不唯一；相邻 `$...$` 拼成 `$$`；裸 LaTeX 补全跨越已保护的 math token | canonical normalizer 只返回主体；serializer 唯一加 delimiter；相邻公式插入不可见边界；display normalizer 分段保护既有公式 |
| 选项吞 section heading | question structure parser | 文本扁平化后的 option continuation 没有可靠 section/next-question 边界 | 独立题目状态机按 section、question、option 和 break 事件切分，section 不可进入 option |
| 答案为空、解析截断 | DOCX support producer/parser | 答案 DOCX 先压成普通文本，旧 marker repair 只保留部分段落；答案与解析 owner 不唯一 | 题目/答案共用 ordered rich blocks；support 状态机收集下一题前所有段落、公式与图片，并按显式 question key 对齐 |
| 解析图片数据存在但预览缺失 | support parser → ReviewDraft → preview | 题号前 anchored image 的 token 在去前缀时丢失；`recognizedSolutionImages` 未进入预览 image collection | 保留 leading image token 和 paragraph anchor；持久化 support rich blocks；预览合并 analysis image collection |
| 并发导入偶发缺公式 | local MathType service | MathType native API 跨 PowerShell 进程并发不安全；实测并发时答案仅 1/134 项由 native helper 成功 | 本地服务用可恢复的串行任务队列隔离 native MathType jobs；并发简略/完整版 E2E 均通过 |
| 第 12 题后半段显示 LaTeX 源码 | rich math serialization → preview | 一个 MathType 对象同时包含中文说明与公式，旧序列化形成 `$故\triangle ...$`；预览为避免把中文送入 KaTeX 而降级为普通文本，所以 Console 没有异常但公式未渲染 | 序列化层将混合对象确定性拆为中文文本与独立 math islands；浏览器审计移除 `.katex` 后扫描残留命令，防止“已送入 KaTeX 的都成功”掩盖“未送入 KaTeX”的公式 |

## Production call graph

```text
正常 UI 文件选择
→ batch/source manifest 与 deterministic DOCX route policy
→ qisi-batch-importer question/support producers
→ DOCX ZIP + relationships + media/OLE extraction
→ ordered rich paragraph/run blocks
→ canonical LaTeX / MTEF translation
→ question structure state machine + support state machine
→ explicit question-key alignment
→ ReviewDraft builder（richBlocks / solutionRichBlocks / image evidence）
→ Dexie IndexedDB persistence
→ reload
→ shared latex-preview renderer + anchored image renderer
→ semantic audit + DOM render audit
```

正常 UI E2E 没有 seed ReviewDraft、没有直接调用内部 parser、没有 final-candidate fixture，也没有跳过 persistence/reload。

## Active owners changed

- `qisi-docx-latex-content.js`: delimiter、canonical LaTeX、OMML text normalization、rich math serialization 的唯一 owner（含混合中文/公式 MathType 拆分）。
- `qisi-docx-ole-reader.js`: OLE/CFB `Equation Native` evidence owner。
- `qisi-docx-mtef-reader.js`: MathType MTEF deterministic fallback owner。
- `qisi-docx-rich-content.js`: ordered DOCX block/run、relationship image anchor 与基础 rich model owner（427 行）。
- `qisi-docx-question-structure.js`: section/question/option 状态机 owner（132 行）。
- `qisi-docx-support-content.js`: answer/analysis multiblock 与 explicit-key alignment owner（202 行）。
- `qisi-batch-importer.js`: production DOCX producer、integrity gate 与 ReviewDraft candidate owner。
- `qisi-review-draft-state.js`: rich evidence 进入 recognition/draft 的 schema bridge owner。
- `qisi-utils.js` + existing `latex-preview`: shared display normalization/render owner。
- `qisi-local-server.js` + `qisi-serial-task-queue.js`: native MathType translation endpoint 与并发隔离 owner。
- `scripts/audit-docx-import-content.js`: 自动语义完整性扫描 owner。

`app.js` 只做三处薄编排：support producer 调用、rich evidence 字段透传、analysis images 加入 preview collection；没有新增 parser 或大业务逻辑。

## Files changed 与原因

- Production: `app.js`, `main.html`, `qisi-batch-importer.js`, `qisi-docx-latex-content.js`, `qisi-docx-mtef-reader.js`, `qisi-docx-ole-reader.js`, `qisi-docx-question-structure.js`, `qisi-docx-rich-content.js`, `qisi-docx-support-content.js`, `qisi-local-server.js`, `qisi-review-draft-state.js`, `qisi-serial-task-queue.js`, `qisi-utils.js`, `tools/translate-mathtype-mtef.ps1`。
- Test/audit: `scripts/audit-docx-import-content.js`, `tests/batch-import-dual-docx-real-browser.test.js`, `tests/docx-content-audit.test.js`, `tests/docx-golden-truth.test.js`, `tests/docx-mathtype-translator-real.test.js`, `tests/docx-rich-content-answer.test.js`, `tests/docx-rich-content-formula.test.js`, `tests/docx-rich-content-real.test.js`, `tests/docx-rich-content-structure.test.js`, `tests/qisi-serial-task-queue.test.js`, `tests/qisi-utils-bare-latex-display.test.js`。
- Golden truth: `tests/fixtures/docx-golden/brief-docx-truth.json`，由 Word/LibreOffice 视觉、document XML、relationships、media 和 paragraph/run 顺序人工交叉核对，不由被测 parser 生成。

## Golden truth 与结构统计

### 简略双 DOCX

- 源题数 / 导入题数: `6 / 6`，题号 1–6，全部单选。
- 答案: `B, C, B, C, D, C`，覆盖 `6/6`。
- 解析: `6/6`，多段解析无截断。
- 题干图: 第 4 题 1 张；解析图: 第 2、6 题各 1 张；source/imported/reloaded/rendered `3/3/3/3`。
- UI math fragments: `97/97` rendered；reload 后仍为 `97/97`。

### 完整双 DOCX

- 源题数 / 导入题数: `12 / 12`，题号 1–12；单选 6、多选 3、填空 3、解答 0、多小题 0。
- 含公式题: 12（按题干/选项/答案/解析合并统计）；含题图题: 3（4、8、11）；解析含图题: 3（2、6、8）。
- 答案覆盖: `12/12`；解析覆盖: `12/12`；全部 12 题人工逐题核对。
- 题图 3 + 解析图 3；source/imported/reloaded/rendered `6/6/6/6`。第 8 题同时渲染题图与解析图。
- UI math fragments: `228/228` rendered；reload 后仍为 `228/228`。第 12 题由 16 个已渲染片段增至 24 个，KaTeX 外残留 LaTeX 命令为 0。
- MathType unique assets: full questions `61/61`、full answers `134/134` 均得到 canonical LaTeX。Native helper 直接成功 `58/61` 与 `126/134`，其余 11 个由确定性 MTEF reader 恢复；没有 AI/OCR 猜测。

### Question counts

- Brief source/imported/reloaded: `6/6/6`。
- Full source/imported/reloaded: `12/12/12`；题号缺失/重复/乱序均为 0。

### Formula counts

- Brief UI formula fragments source-to-render contract: `97/97`，reload `97/97`。
- Full UI formula fragments source-to-render contract: `228/228`，reload `228/228`；unique MathType assets `195/195`。

### Image counts

- Brief stem/analysis/total: `1/2/3`，rendered `3/3`。
- Full stem/analysis/total: `3/3/6`，rendered `6/6`。

### Answer coverage

- Brief `6/6`；full `12/12`；source 有答案但结果为空为 0。

### Analysis coverage

- Brief `6/6`；full `12/12`；截断、串题、punctuation-only、missing image 均为 0。

## Before / after evidence

- Before: `\frac{1330$$\sqrt{2}}{3}\pi`；after: `$\frac{1330\sqrt{2}}{3}\pi$`，KaTeX render success。
- Before: 第 7、12 题相邻公式被合并为嵌套 `$$`；after: 公式边界独立，逐题 DOM error 0。
- Before: 第 2 题题号前 analysis anchor 数据存在但页面无图；after: token、asset ID、solution rich block、reload 与 DOM image ID 一致。
- Before: 第 6 题“如图……”后内容/图片可能截断；after: 9 个源解析段全部保留且图片渲染。
- Before: Q2 明确解析写有“故选 C”但 answer 可为空；after: 只从显式 label 确定性派生 C，并保留 provenance。
- Before: section heading 可进入上一题 D option；after: semantic audit `sectionHeadingInOptions=[]`。
- Before: 第 12 题混合 MathType 块为 `$故\triangle ABC的面积S=...$`，预览安全降级后显示反斜杠源码；after: `故$\triangle ABC$的面积$S=...$`，24 个公式片段全部进入 KaTeX，DOM 中 KaTeX 外残留命令 0。

## Case 1–6

1. 集合题: set/trig/fraction/`\mathbb{Z}`、四选项、答案 B、完整解析均通过。
2. 折扇题: arc/angle/degree、源题图、B 选项、答案 C、解析通过；nested delimiter 0。
3. 圆锥内切球题: 答案 C、完整多段解析、analysis image 和归属通过。
4. 三角形选择题/section boundary: 源选项完整，section heading 未进入 D，下一 section 题号正常。
5. 点在角终边上的填空题: 答案 6，分式/向量公式与解析完整，不存在 punctuation-only analysis。
6. 正弦定理解析: `3\cos A\sin B+2\sin A\cos B=\sin A\sin B` 等键盘数学已规范化；第 12 题混合 MathType 中的中文保持普通文本，公式拆为独立 math islands。

## LaTeX、键盘数学与语义扫描

- LaTeX syntax/render errors: 0。
- Nested/unclosed delimiter: 0。
- Bare command/keyboard-style fragments: 0。
- Raw JSON leakage / placeholder leakage / punctuation-only analysis: 0 / 0 / 0。
- Scanner result（简略与完整）: `missingQuestionNumbers`, `duplicateQuestionNumbers`, `sectionHeadingInOptions`, `missingAnswers`, `missingAnalyses`, `missingAnalysisImages`, `latexSyntaxErrors`, `unrenderableLatex`, `unrenderedLatexFragments`, `keyboardMathFragments`, `unwrappedLatexFragments`, `rawJsonLeakage`, `placeholderLeakage`, `punctuationOnlyAnalyses`, `wrongAttachmentCandidates` 全部为空。

## Image binding 与 persistence roundtrip

- 每张图片保留 relationship ID、media target、content hash、paragraph/run anchor、inline/anchor type 与尺寸。
- 解析图片按 support parser state 绑定，不按 media 顺序或最近题号猜测。
- 第 2/6/8 题 analysis images 的 asset ID 同时存在于 solution token、ReviewDraft、IndexedDB reload 结果与预览 DOM。
- Reload 后 6/12 题所有 stem/options/answer/solution、question/solution image IDs、rich block counts 与 reload 前深比较完全一致。
- Persistence roundtrip: passed。

## Browser / Console / Network

- 正常 UI 上传、角色选择、创建任务、等待 review、逐题打开预览、刷新、再次逐题检查全部通过。
- 简略/完整版还以两个并发 browser contexts 运行，验证 native MathType queue 不串批。
- Console（用户保留的 in-app browser，最终 14:16 刷新）: `errorCount=0`；只有 Tailwind CDN production warning、版本和 runtime boot 日志。
- Network: 每个任务两次 `/api/convert/mathtype-mtef` 均 HTTP 200；同源 failed requests 0；AI/OCR calls 0。
- White screen / locked buttons / unhandled exceptions: 0 / 0 / 0。

## Full gates

- `npm run verify:safe`: passed；961 tests，957 pass，4 expected skip，0 fail，0 todo；batch smoke 20/20；no-real-ai passed。
- `npm run verify:docx-stable`: passed，20/20。
- `npm run verify:batch-safety`: passed；DOCX stable、PDF known-bad 65/65、no-real-ai、batch smoke 全通过。
- `npm run verify:no-real-ai`: passed。
- `node --test tests/pdf-route-b-hold.test.js`: passed，6/6。
- `node --test tests/pdf-support-controlled-write-answer-ownership.test.js`: passed，21/21。
- `node scripts/pdf-master-browser-runner.js preflight`: passed，`realApiCalled=false`。
- `node scripts/pdf-master-browser-runner.js dry-run`: passed，browser chain/health/input checks passed，`realApiCalled=false`。
- `npm run verify:personal-stable`: 已实际执行；仓库未配置该 npm script，npm 返回 `Missing script`。没有新增同义脚本或伪造通过；所有已配置 mandatory gates 均通过。
- 禁止项 `real-run`, `test:ai-proxy`, `test:ai-vision-proxy` 均未运行。

## Safety counters

```text
wrong attachment                 0
fabricated content               0
raw JSON leakage                 0
placeholder leakage              0
controlled-write bypass          0
Formal Admission bypass          0
Bridge formal writes             0
legacy fallback                  0
real AI/OCR calls                0
```

Formal question table count remained 0 throughout browser tests; work stopped at ReviewDraft review.

## Known limitations

- Baseline repository has no `verify:personal-stable` npm script; this is reported as unavailable, not passed.
- 页面仍加载 Tailwind CDN 并产生现有 production warning；不影响本地 DOCX import/render，且无 Console error。
- Native MathType direct translator depends on the installed MathType DLL；unsupported items are recovered only by the deterministic MTEF reader and still fail closed if neither path can produce valid LaTeX。
- 本次第 12 题修复为纯 JavaScript，未增加依赖；但当前系统整体尚不是完全免安装/离线可迁移包：完整公式保真仍依赖目标 Windows 电脑上的 MathType 6 `MT6.dll`，前端 Vue/KaTeX/Dexie/JSZip 等仍从 CDN 加载。新 DOCX 主链不要求 Word，PowerShell 为 Windows 自带。若要实现“复制到老师电脑即可运行”，应另立便携发行任务处理 native MathType 替代与前端依赖本地化，不应夹带在本次公式显示 bugfix 中。

## Git status

报告提交后应为 clean，分支与 evidence commit 对齐。无冻结 PDF 文件改动，无源 DOCX/解压副本提交，无 main 修改。
