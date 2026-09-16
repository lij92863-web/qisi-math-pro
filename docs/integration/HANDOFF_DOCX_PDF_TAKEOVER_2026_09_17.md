# 交接：DOCX/PDF 收口（2026-09-17 轮结束）

本文写给"下一个窗口"。所有数字都来自本轮实际命令输出，不是记忆。

## 0. 一句话现状

```text
仓库        E:\备份\题库系统        分支 codex/integration-main-hardening
起点 HEAD   377bc16（上一轮交接 57441c1 之后的交接提交）
终点 HEAD   bdded75（已 push，本地 = origin/codex/integration-main-hardening）
origin/main b15e6fbe（未动、未 merge）      工作树 clean      git ls-files artifacts = 0
门禁        verify:safe 1400/1400 · verify:docx-stable 20/20 · verify:pdf-known-bad 65/65 · verify:batch-safety passed
```

接手前先跑：`git status --short` / `git rev-parse HEAD origin/codex/integration-main-hardening origin/main` /
`npm run verify:safe`。

## 1. 本轮做完的事（按主题，全部有真实材料证据）

### 1.1 DOCX 三处真实缺陷（G7/G11 与六组末题）

| commit | 内容 | 证据 |
| --- | --- | --- |
| `f71f1cd` | 骨架把评分表单元格 `7.0` 当题号 → 武汉四调支持全被拒；块读取器拒绝"标记后只剩数字"的行 | G11 0 答 → 14 答 / 19 解 |
| `f71f1cd` | 答案槽里的"第一小问标记"（`(1)`）不再当答案（`Qisi.Utils.isSubQuestionMarkerValue`） | 撤掉 G7/G8/G9/G10 共 20 条伪答案 |
| `9c0a8b6` | `<w:tab />`（带空格）不被识别 → 选项粘连；详解插图被当题图写进题干 | 佛山 q3 恢复 4 选项；q17 题干 3 张图 → 1 张 |
| `d3cd1e3` | 答案区标题规则只允许 12 字前缀，长标题匹配不上 → 六组末题题干带答案表表头 | 6 处 → 0 处 |

### 1.2 全量核对（零成本，不看图）

```text
probe-answer-ownership.cjs    十一组客观答案 vs 渲染页答案表：逐题一致
probe-stem-ground-truth.cjs   209 题：204 题中文题干逐段落在卷面页上（其余 5 题为纯公式题）
probe-draft-integrity.cjs     题号/题干/选项槽位/图 token/withheld 原因：0 缺陷
```

### 1.3 DOCX 最终 matrix（同一 HEAD，AI=0，MathType.exe=0）

```
G1 6题5答0扣   G2 12题11答1扣  G3 14题14答3扣  G4 12题0答0扣（卷面答案表本身为空）
G5 56题54答4扣 G6 14题14答3扣  G7 19题14答6扣  G8 19题14答4扣
G9 19题14答9扣 G10 19题14答4扣 G11 19题14答5扣      withheld 合计 39
```

观察值：**WRONG MATCH = 0，SILENT WRONG CONTENT = 0**。

### 1.4 PDF 链（本轮改动最大，也是问题最多的地方）

| commit | 内容 |
| --- | --- |
| `d8f1084` | **mixed 页保留可读文本**：原来 `page.kind !== 'text'` 整页跳过，模型不可用即 0 题；现在 mixed 页照常分段（仍进 withheld），视觉转录到达时替换文本版 |
| `ba5758c` | **题号契约不再全有或全无**：`1,2,3,5,6` → segments `[[1,2,3],[5,6]]`、`missing [4]`、duplicate/backward/unknown 各自记录；缺口进 withheld（`contract-gap`） |
| `539f28f` | **每题区域**：每块带 `regionByPage`（该题各行 bbox 并集），"需视觉"计划里的 region 就是它；证明不了才回落整页 |
| `d8b90e0` | **逐题调用**：一页里每题都有 region 时，逐题裁图 + 逐题请求，提示词直接给定题号（"这是第 N 题所在的图片区域…"），模型不再负责定身份；返回题号必须等于给定值 |
| `8379ef4` | 支持侧也用区域（代码已加 `supportRegionsByNumber`，但见 §3.2 未生效） |
| `3bff42b`/`bdded75` | **脚本版本号**：`main.html` 里 5 个改动过的脚本换 `?v=`（这一条被我漏了两次，见 §5） |

零成本验收（AI 阻断 = 模型不可用）：`简略版题目` 6 题、`+完整版答案` 6 题、`完整版题目+答案` 11 题，
全部 0 页面错误、0 费用。

付费视觉（两次授权 6 + 24 次）：

```text
batch D  简略版题目 p1（逐题区域 6 次）→ 6 题，公式全回
batch E  完整版题目.pdf（12 次逐题）+ 完整版答案.pdf（4 次/页级）→ 12 题 q1-q12，公式全回
用掉 16 次（题目 12 + 答案 4），剩 8 次；正式题库始终 0 行
```

## 2. 当前架构事实（不要重造）

```text
DOCX  qisi-ingestion-context → qisi-docx-ingestion → evidence/candidate → review → formal admission
PDF   qisi-pdf-inspection → qisi-pdf-ingestion → evidence/withheld → review → formal admission
本轮没有新增任何 parser/importer/review/store；所有改动都在既有模块或既有纯函数里
```

PDF 链现在的决策顺序（`qisi-pdf-ingestion.js`）：

```text
1. inspection 分页分类：text / mixed / scanned；mixed = 文本层可读但有不可映射字形（公式）
2. segment()：只有 scanned 跳过；mixed 也分段，块带 role/regions/regionByPage
3. contract()：按 text 层提供的题号做 safe segments + missing + conflicts
4. 题目侧：文本能证明的题先出草稿（safe partial，带"请重点核对"提醒）
5. 视觉侧：有 region 就逐题裁图逐题请求（题号由程序给）；返回题号必须等于给定值
6. 视觉结果到达时替换同号的文本草稿；失败/缺失 → withheld（带 errorCode + 模型原文留证）
7. 支持侧：answer 只接受"非字母"值，字母答案永不从模型重建；solution 直接采用
8. 支持闸门：full / prefix / fail-closed；序列断档一律不挂
```

## 3. 现在遇到的真实问题（按优先级）

### 3.1 【最高】老师浏览器里看到的仍是"文本兜底"的破草稿（截图：`▯▯▯`、`[公式语法错误：原文已保留]`）

老师 01:21 那次任务跑出 11 题，逐题都是文本兜底版：`已知集合 ▯▯▯，则下列命题正确的是（）`、
选项里一整行 `▯`。这不是错挂（每条都带"PDF 文本提取结果可能不完整，请重点核对"，答案/解析为空，
正式库 0 行），但**不可用**。

原因是两条路里的"文本那条"：

```text
这份 PDF 的文本层里，公式字形没有 Unicode 映射（PUA 字符，渲染成 ▯），
所以 mixed 页的文本兜底一定带洞；干净版本只能来自逐题视觉调用。
```

而我这边同一天用同一份文件跑逐题视觉（batch E）得到的是干净 LaTeX（见 §1.4）。

**排查顺序（下一个窗口照做）**：

1. 让老师 **Ctrl+F5**，然后在地址栏确认加载的是 `qisi-pdf-ingestion.js?v=per-question-region-02`
   （开发者工具 Network，或看草稿里是否出现 `$…$` 公式而不是 ▯）；
2. 重跑 `完整版题目.pdf`（两页 12 次调用）；若仍是 ▯，展开批次"待核对原页"，读那一行的
   **原因/服务错误**：
   - `AI_PROXY_FETCH_FAILED` / "DashScope upstream request failed." → 代理问题（见 §3.3）；
   - `MALFORMED_MODEL_RESPONSE` → 视觉回复读取问题（已修过一轮，会把模型原文留证）；
   - `VISUAL_REVIEW_REQUIRED` → 该页没有走视觉（region 或题号契约没证明）；
   - 其他服务错误码 → 上游本身失败，重跑一次再看。

### 3.2 【中】支持侧（答案卷）没有走逐题区域

batch E 里 `完整版答案.pdf` 只用了 4 次（按页），而题目卷用了 12 次（逐题）。代码里已加
`supportRegionsByNumber`，但**没有命中**：support 块的 `questionNumber` 与页面的 support anchors
编号没有对齐（需要打印两者比对）。结果：答案卷仍是页级请求，支持闸门 `prefix`，多数解析未挂。

**下一步**：把 support 块与 anchors 的编号对齐后再跑（预计 12 次调用；8 次余额不够，需要补授权）。

### 3.3 【环境】代理（TUN + fake-ip）会让 DashScope 不可达

```text
代理开启时：dashscope.aliyuncs.com → 198.18.0.246（假 IP，RFC2544 网段），HTTPS 超时；
            连真 IP（8.140.217.18 / 39.96.198.249 / 8.152.159.24 / 39.96.213.166）也超时；
            同时 github / baidu / aliyun.com / dashscope.console.aliyun.com 都正常
代理关闭后：DNS 立即返回真实地址，HTTPS 有响应（404 = 链路通），视觉调用成功
```

给老师的说法：**DashScope 是国内服务，不要让 `*.aliyuncs.com` 走代理直连规则**；要么关掉代理，
要么在代理规则里把 `*.aliyuncs.com` 指向一个可用节点。

### 3.4 视觉读数的质量差异（必须人工核对，不能自动胜出）

```text
q1 集合定义：视觉写 \sin\frac{m}{2}，卷面/文本是 \sin\frac{n\pi}{2}
q5 分数式第一项：DOCX 链 \overrightarrow{BA}\cdot\overrightarrow{AC} vs 视觉 \overrightarrow{BC}/|\overrightarrow{BC}|
题型：视觉把 3 道多选判成单选、3 道填空判成解答（完整版题目.pdf 的 q7-q12）
```

规则：视觉结果只能作为 unresolved-region 的补充证据；与确定性证据冲突时保留双方、字段留空、
人工裁决（本轮按此执行，未让任何一方覆盖另一方）。

### 3.5 其他待办

1. **G5–G11 逐题视觉真值**：只亲眼看 12 页（有图题 + 答案页），其余题未标 `VISUALLY_VERIFIED`。
2. **审核页原因码**仍是英文机器码（`unmapped-glyphs`、`ANCHOR-GAP`…），未做中文映射。
3. **MTEF 剩余 unsupported**：保持 `MTEF_UNRESOLVED / WITHHELD`，按规则不再深挖。
4. **q6 跨页**（完整版题目 p1 最后一题）被判 `cross-page-visual-block`，视觉路径也不出草稿；
   文本路径下 q11 曾缺失（视觉路径已补回）。
5. **文本兜底的可读性**：可以考虑给"带不可映射字形"的文本草稿更醒目的标记（例如题干里保留
   `[[PDF_UNMAPPED]]` 占位），目前只有一条"请重点核对"的警告。

## 4. 常用命令与脚本（都在 artifacts/audit-baseline/，本地证据、永不提交）

```text
DOCX 全矩阵       node artifacts/audit-baseline/astra-run-docx-matrix.cjs
矩阵对比          node artifacts/audit-baseline/summarise-matrix.cjs <before.log> <after.log>
单组 DOCX 验收    node artifacts/audit-baseline/astra-docx-acceptance.cjs --id astra-G7 --full "<file.docx>"
PDF 零成本验收    node artifacts/audit-baseline/astra-pdf-acceptance.cjs --id astra-P3 --question "<q.pdf>" --support "<a.pdf>"
PDF 真实视觉      node artifacts/audit-baseline/astra-pdf-real-vision.cjs --batch <A|A2|B|C|D|E>
                  （需要网络与授权；脚本里 APPROVED 列出每批的 maxCalls 与理由）
答案/题干/草稿核对  probe-answer-ownership.cjs / probe-stem-ground-truth.cjs / probe-draft-integrity.cjs
审核页可见性      probe-pdf-withheld-visibility.cjs "<file.pdf>"
```

## 5. 经验与坑（本轮踩过）

1. **改了 JS 必须换 `main.html` 的 `?v=`**——本轮漏了两次，老师看到的一直是旧脚本（第一次表现为
   "0 题"，第二次表现为"文本兜底破草稿"）。改动过的文件：`qisi-utils.js`、`qisi-docx-ingestion.js`、
   `qisi-batch-importer.js`、`qisi-pdf-inspection.js`、`qisi-pdf-ingestion.js`、`app.js`。
2. **`git push` 经常失败**（schannel 握手 / Recv failure / connect timeout），重试 2–3 次即可；
   `git add/commit/push` 需要提权。
3. **LibreOffice 渲染**必须在沙箱外、`outDir` 用绝对路径、每份文件用全新 profile。
4. **付费调用要留证据**：失败时也要把模型原文留住（本轮加进 `qisi-pdf-ingestion.js`），否则
   查不出"为什么读不出来"。
5. **`pageCache` 按 图片URL+模型+题号 去重**：同一会话内重复页/区域不再计费；跨会话会重新计费。
6. 改 `app.js` 必须同步 `architecture/post-seal-approved-blobs.json` + 账本（本轮的 app.js 改动
   都已按此办理）。

## 6. 下一步顺序（照抄）

1. 让老师 Ctrl+F5 后重跑 `完整版题目.pdf`，确认得到干净 LaTeX 的 12 题（预计 12 次调用）；
   若失败，读"待核对原页"的原因码并按 §3.1 分类处理。
2. 修 §3.2：support 块与页面 anchors 编号对齐，让答案卷也逐题调用（需要补授权，约 12 次）。
3. 让老师裁决 §3.4 的两处差异（q1、q5），确认视觉读数是否需要收紧提示词或加二次核对。
4. 继续 G5–G11 逐页视觉真值（人眼看渲染页，一条一条记进
   `docs/integration/DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md`）。
5. 收尾：原因码中文映射、文本兜底占位符、`FINAL_CLOSEOUT_2026_09_17.md` 更新，最后全量门禁 + Git 审计。

## 7. 硬性规则（来自主人本轮指令，违反即失败）

1. 不新增第三套生产链（DOCX / PDF 两条主链保持现状）。
2. 大模型负责识别，程序负责归属；禁止 `PDF → Vision → 直接生成正式题`。
3. 视觉结果不得覆盖确定性证据；冲突保留双方、人工裁决。
4. 宁可空，不能错挂；允许 SAFE PARTIAL / WITHHELD / MANUAL REVIEW，不允许 WRONG MATCH / SILENT WRONG CONTENT。
5. 真实付费视觉调用前必须先提交计划并拿到明确授权。
6. 小步封存：定向测试 → `verify:safe` → 专项 gate → commit → push；`origin/main` 不动，`artifacts/` 不提交。
