# 交接：DOCX 收尾 + PDF 收口（2026-09-16 下午轮结束）

本文写给"下一个窗口"。**所有数字都来自本轮实际命令输出**，不是记忆。上一份交接是
`HANDOFF_DOCX_PDF_TAKEOVER_2026_09_16.md`（它描述的 §8 顺序已按 1–4 步做完）。

## 0. 一句话现状

```text
仓库      E:\备份\题库系统        分支 codex/integration-main-hardening
起点 HEAD 615b7a5               终点 HEAD 57441c1（已 push，与 origin 同名分支一致）
origin/main 仍是 b15e6fbe（未改、未 merge）      工作树干净（artifacts/ 已进 .gitignore）
门禁      npm run verify:safe = 1385/1385 通过（本轮起点是 1364）
```

接手前先跑：`git status --short` / `git log --oneline -12` / `git rev-parse HEAD origin/codex/integration-main-hardening origin/main`。

## 1. 本轮做了什么（按时间，全部已提交）

| commit | 内容 |
| --- | --- |
| `f4558cc` | 答案区冲突→可见提示的稳定 e2e fixture（含"换单值答案键就不该提示"的敏感性反证） |
| `abe0d12` | MTEF：字符修饰列表里的"颜色记录"不再拒收整条公式（+11 条真实公式恢复） |
| `a909f55` | 账本：§22 记录（冲突 fixture + MTEF 真实失败分类） |
| `f427e18` | PDF：三份真实 PDF 零成本跑批结果 + 审核可见性缺口 |
| `ecbf36c` | MTEF：模板丢了内容槽位就 fail-closed（不再静默给出 `f(x)={ }`） |
| `74fde78` | 共享抽取层：Word 上下标 run → 行内 LaTeX（`z1/m2` → `$z_{1}$/$m^{2}$`） |
| `31fd13e` | 图片归属：锚在题号前的图归"下一个真正说要图的题"，并在题干末尾显示（不再压在题目上方） |
| `5f46820` | 选项：标签写在公式里的选项串（`$A.…$ $B.…$`）被读成真选项（佛山一模 q4/q6 恢复 4 选项+单选题） |
| `0a43c1c` | 选项排版：按真实宽度自动打包（短的一行、中等两个一行、长的独占一行） |
| `9180332` | **题库 schema**：可打开已是第 9 版的现有题库（详情见 §6） |
| `c249e1b` | 向量重音：多字母基底用 `\overrightarrow`（`\vec{BC}` 只盖住第一个字母） |
| `fcb5909` | 分段函数：花括号模板渲染它携带的 PILE 两行（`[[MTEF_UNRESOLVED:rId99]]` 消失） |
| `3d208a8` | **通用数学片段规则** `Qisi.Utils.promoteMathRuns`：所有字母/数字都进 LaTeX（替代旧窄规则，代码变少） |
| `01fb190` | 答案归属：裸数字不再当题号标记（表格单元格 `2` 曾把 `$P$` 挂到第 2 题）+ 取消单侧按位置配对 |
| `3bd795c` | 答案表：读取"带表头单元格、拆成两段"的表行，并在整篇文本里找答案表 |
| `57441c1` | 审核页：待核对原页现在显示原因码/区域/服务错误码与消息 |

（另有 `9de9ce5`/`4aa0fe8`/`e7d901e`/`d2319f5`/`cc5833f`/`aa6180b`/`9f0edd5`/`440df8a`/`6ba0998`/`9dbc7e4`/`bccdbad` 等文档与收尾提交，见 `git log`。）

## 2. 当前真实验收结果（同一 HEAD，AI 请求 0）

```text
组   文件                     状态   题  答  扣   备注
G1  简略版题目+完整版答案       review  6   5   0
G2  完整版题目+完整版答案       review 12  11   1   q7 的 w 公式仍 unresolved（fail-closed）
G3  题目+答案（2026-07-09）     review 14  14   3   q1/q10/q13 公式不可读
G4  周二晚测（单文件）          review 12   0   0   答案表在卷面上本来就是空的；唯一扣题已修好
G5  高二.docx（单文件）         review 56  54   4   48/49 按卷面正确留空（49 冲突）
G6  题目+答案.docx             review 14  14   3   与 G3 同一份卷子
G7  佛山一模                    review 19  19   6
G8  深圳高级中学                review 19  19   4   本轮 18→19（找回 1 个答案）
G9  十二校一模                  review 19  19   9   本轮 18→19，且第 2 题从错的 $P$ 修成 D
G10 河北昌黎                    review 19  19   4
G11 武汉四调                    review 19   0   2   **答案/解析全空，见 §5.1**
合计 withheld 36（起点是 41）
```

MTEF 语料（1048 条真实流）：`extracted 1038 / unresolved 10`（起点 1027/21）。剩余的 10 条各有成因，
按项目规则 3 **保持 fail-closed、不再深挖 MathType**。

PDF 零成本跑批（3 份真实 PDF、共 7 页，全部 `mixed/unmapped-glyphs`）：0 假题、原页保留、
1 次视觉请求被阻断（付费调用 0）。细节与逐页清单见 `PDF_INSPECTION_STAGE_2026_09_16.md`。

## 3. 已完成、不要再重做的架构事实

- DOCX 主链未变：`shared ingestion context → qisi-docx-ingestion → evidence/candidate → review → formal admission`；
  PDF 主链未变：`qisi-pdf-inspection → qisi-pdf-ingestion → evidence → review/withheld → formal admission`。
  **本轮没有新增任何 parser/importer/review/store**，所有修改都落在既有模块或既有纯函数里。
- 本轮"变简单"的一处：`normalizeMathTextForLatex` 里旧的窄数学正则 **加上**配套 protect/restore 机制被
  `Qisi.Utils.promoteMathRuns` 一并取代（它自己就懂 `$…$` 段），全项目只有这一处决定"什么算公式"。
- `artifacts/` 已加入 `.gitignore`，本地证据与验收脚本永不提交（`git ls-files artifacts` 应为 0）。

## 4. 本轮修掉的真实缺陷（都有前后对照）

1. **题库打不开**：浏览器里存的题库是第 9 版（`codex/app-refactor-master-plan-r1` / `c59e4cb` 加的
   `handouts/handoutAssets/handoutRevisions` 三张表），而本分支只声明到第 8 版 → IndexedDB 拒绝
   降级打开，报 `VersionError (80) < (90)`。已在 `qisi-db.js` 按**逐表相同**的方式声明 `db.version(9)`：
   打开现有库不发生任何升级/删除，且与新库互相兼容。`main.html` 同步换了脚本缓存标记。
   证据：`artifacts/audit-baseline/probe-live-v9-bank.cjs`（手工建 v9 库→应用正常打开→原行仍在）。
2. **挂错答案（WRONG CONTENT）**：十二校一模第 2 题曾挂 `$P$`。根因是两条既有规则同时错：
   裸数字被当题号标记（把概率表单元格 `2` 后的 `$P$` 当作"详解标签前的答案槽"），以及
   `shouldMatchByOrder` 只要**单侧**缺号就按位置配对。两者已收紧，第 2 题现为 D（试卷答案表的值）。
3. **图挂错题**：佛山一模的 扇形 OPQ 图曾挂到第 11 题（页面画在第 12 题旁）。规则：只有"本题文本完全没有
   图形提示词 + 下一题以 如图/见图/下图/图中 开头 + 下一题还没有图"时才移交；其余只把自己的图从题干
   开头移到末尾。11 组的图**数量**一格未变，只有该处所有权改变。
4. **模板静默丢内容**：周二晚测第 8 题分段函数曾变成 `f(x)={ }`（无任何提示）。先改成 fail-closed，
   再实现"花括号模板渲染其 PILE 行"，现在输出正确的 `\begin{matrix}` 两行，且指数 `x^{2}` 正确。
5. **Word 上标被压平**：`z₁/m²` 曾成 `z1/m2`。修在共享抽取层（`markWordScriptRuns` +
   `attachWordScriptsAsInlineMath`），全语料只有该文件有 5 个此类 run。

## 5. 未完成（按优先级，含下一步精确动作）

### 5.1 G11 武汉四调：答案与解析 0/19（最高优先级）

> **2026-09-16 晚已修（见账本 §26）。** 根因不在 heading 切分：`supportText` 与 `parseSupport` 一直
> 是对的（18 答 / 19 解），被丢弃的是 **identify gate** —— 第 4 题的评分表单元格 `7.0`/`9.3`/`8.9`
> 让骨架多出 7/8/9 号题，骨架因此不再 authoritative，`expected` 为空，37 条支持全被标
> `unproved-question-identity`。修法：块读取器也拒绝"标记后只剩数字"的行（与文本层同一条规则），
> 并对 `(1)` 这类"第一小问标记"拒绝当答案。现在 G11 = 14 答 / 19 解 / 5 扣。

试卷文本里**什么都有**，草稿却是 0/19（答案与解析都空，所以不是"答案被过滤"）：

```text
82:  "《湖北省武汉市…数学试题》参考答案"（标题比标题规则允许的 12 字长）
83-108: "题号"/1…10/"答案"/C D C A A B D C BCD AD/"题号"/11/"答案"/BD   ← 每格一行
109: "1．C"  110: "【分析】…"  111+: "【详解】…"  114: "故选：C."  115: "2．D" …
375-378: 表尾同样内容的 "题号 1 …" / "答案 C D …" / "题号 11" / "答案 BD"
```

已排除/已确认（`artifacts/audit-baseline/probe-g11-support.cjs`）：

- `normalizeAnswerSolutionSource` 保留了 `1．C`、`2．D`、表尾两行；
- `splitAnswerSolutionSections` **不认识 `【分析】/【详解】` 形式**，所以答案区=解析区=整篇；
- ingest 的 support 标题命中在**答案表的表头单元格 `答案`（第 94 行）**，于是支持区从表格中间开始；
- 行内块标记仍能找到 50 个 → 块读取器拿到的东西是够的。

**下一步（唯一未查的一处）**：直接打印该文件 ingest 里算出的 `supportText` / `documentPart`
（`qisi-docx-ingestion.js` 里的 heading 切分是唯一能清空支持侧的地方）。修好后应能读回 1–11 的答案
（12–19 在解析里以 `(1)…` 形式给出，属正常），并跑 G1–G11 matrix 确认无回归。

### 5.2 佛山一模（G7）两处

> **2026-09-16 晚已修（见账本 §27）。** q3：选项是被 **Word tab** 隔开的（`<w:tab />` 带空格，旧正则只认
> `<w:tab/>`，tab 被丢掉后四个选项粘成 `A．98B．104C．106D．108`）→ 现在 q3 是单选题
> `["98","104","106","108"]`，G7 四选项题 10→11。q17：图是 3 张，因为**解析里的插图**被当成题图并写进题干
> （题图来源改为 `docx-inline-figure` / `解析插图：…` 两类）→ 现在题干只剩它自己那张，解析的两张留在解析里。
> 新增发现（未修，见 §27.3）：G7 q19 等六组的最后一题题干里还带着答案表的表头行。

- q3：答案与试卷一致（B），但**选项 0/4 缺失**（页面有 A.98 B.104 C.106 D.108）。属选项归属/抽取问题。
- q17：页面只画 **1 个**四面体图形，草稿挂了 **3 张**图（多挂与挂错同类风险）。

### 5.3 其余组的逐题视觉真值（本项目规则 5）

已完成：七份原件全部渲染（`artifacts/audit-baseline/rendered-g5…g11`）；**全部组答案归属逐题核对**
（高二 54/54、题目+答案 11/11、佛山 11/11、深圳 11/11、河北 11/11 与试卷答案表完全一致；十二校已修；
武汉四调待修）；佛山一模第 1、4 页亲自看过。
**未做**：G5、G6、G8、G9、G10、G11 的页面逐题看图，以及 G7 其余页 → 这些组**没有任何** `VISUALLY_VERIFIED`
标记，报告里必须如实写明。看图的低成本技巧：试卷**答案表**可以直接从"渲染后 PDF 的文本层"读出并逐题
比对（`artifacts/audit-baseline/probe-answer-key-text.cjs`），不必翻图片。

### 5.4 PDF 侧（规则 6–9，架构不要重写）

零成本主链已能跑；本轮补了**审核页可见性**（待核对原页显示 页/题号/原因码/区域/服务错误码与消息）。
仍需：PDF support answer/solution 归属的最终零成本验收（safe partial、跨页、重复题号、未知题号），
以及"为什么 withheld"在真实 PDF 上的逐页清单（`PDF_INSPECTION_STAGE_2026_09_16.md` 有当前事实）。

### 5.5 付费视觉（规则 7、10、11）

**仍未授权，付费调用 0 次。** 若要识别《完整版题目.pdf》这类 `mixed` 页面，先提交方案：哪份 PDF / 哪页
哪 region / 模型 / 调用次数 / 为什么确定性做不到 / 预计成本，得到明确授权后执行。视觉结果只能作为
现有主链的 unresolved-region evidence provider，**不得**直接生成正式题，也不得覆盖已确定的确定性证据。

### 5.6 观察到的、尚未修的小事

- 高二.docx 全部 56 题被标成"解答题"，实际均为填空题（选项为空是对的，类型可改进）；
- 周二晚测 q10 里 `2cos` 已在数学字体里但未写成 `\cos`（已带格式的段内不再二次改写）；
- 该题其余"未做格式"的 Word 正文仍是普通字体（要整段包公式需猜公式边界，故意不做）。

## 6. 环境与操作注意（本轮踩过的坑）

- **LibreOffice 渲染必须在沙箱外执行**，并且：`outDir` 用**绝对路径**（相对路径会让
  `-env:UserInstallation` 变成坏 URL），**每份文件用全新 profile**（旧 `lo-profile` 会卡到 180 秒超时，
  删掉后 5 秒完成）。命令：`node artifacts/audit-baseline/render-docx-page.js "<file>" 12 "<绝对 outDir>"`。
- 本地服务在 `3000`（`open-app.cmd`，健康检查 `/api/health`）；浏览器需 **Ctrl+F5** 才会拿到新脚本
  （`main.html` 里 `qisi-db.js?v=schema-v9-01`）。
- `git push` 偶发 `schannel handshake failed`，**重试即可**；`git add/commit/push` 在沙箱内需要提权。
- 提交信息里不要出现 `$`、反引号、引号（PowerShell 会破坏消息）。
- **改 `app.js` 必须同步**：`architecture/post-seal-approved-blobs.json`（git blob + normalized sha256，
  可用 `artifacts/audit-baseline/astra-authorise-superscript-seal.cjs "<reason>"` 追加理由）+ 账本
  `docs/integration/HARDENING_INTEGRATION_LEDGER_2026_09_15.md`；当前 app.js 21671 行，上限 22137/22145。
- `artifacts/` 是本地证据与验收脚本，**永不提交、永不删除**（现已 gitignore）。
- 真实材料矩阵：`node artifacts/audit-baseline/astra-run-docx-matrix.cjs`（约 45 秒，AI=0）；
  PDF 零成本：`node artifacts/audit-baseline/astra-pdf-acceptance.cjs --id astra-P2 --question "<pdf>"`；
  MTEF 语料前后对比：`cd artifacts/audit-baseline; node mtef-corpus-scan.js > mtef-corpus-<tag>.txt`。

## 7. 下一步顺序（照抄）

1. 复核 §0 的 Git 与门禁（`verify:safe` 应 1385/1385）。
2. 修 §5.1（武汉四调支持侧），跑 G11 + 全矩阵 + `verify:safe`，提交。
3. 修 §5.2（佛山一模 q3 选项缺失、q17 多余图）。
4. 继续 §5.3：G5、G6、G8、G9、G10、G11 逐页看图（先用答案表文本层核对 answer，再按页看 stem/options/
   formula/image ownership），把实际观察值（`WRONG MATCH` / `SILENT WRONG CONTENT` / `WITHHELD` /
   `MANUAL REVIEW`）写进 `docs/integration/DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md`。
5. 出"DOCX 最终统一 matrix + 视觉报告"。
6. PDF：§5.4 的零成本最终验收 + 可见性核对。
7. 提交付费视觉方案（§5.5）等授权；授权后再做 PDF 最终视觉验收。
8. 全量门禁 + Git 审计 + 最终报告（含 start/final HEAD、push 状态、真实材料观察值、未解决项）。

## 8. 硬性规则（违反即视为失败，来自主人本轮指令）

1. 不新增第三套生产链；两条主链保持现状。
2. 验收脚本可独立，生产解析逻辑不得复制进脚本反向依赖。
3. MTEF 剩余 unsupported 保持 `MTEF_UNRESOLVED/WITHHELD`，不为覆盖率深挖。
4. 上下标必须修在现有共享抽取层，禁止第二套数学文本 extractor。
5. 逐题视觉真值：没亲自看过的不得标 `VISUALLY_VERIFIED`。
6. PDF 不重写架构；只补 support 归属/reason/region/transport/可见性/safe partial/跨页重复未知题号。
7. PDF 原则：模型负责识别，程序负责归属；禁止 `PDF → Vision → 直接生成正式题`。
8. 视觉结果不得覆盖确定性证据；冲突则保留双方、清字段或进 review。
9. PDF 审核 UI 在现有审核体系上扩展，禁止另造平行审核体系。
10. 付费视觉未授权；调用前只提交方案。
11. 不为"全识别"牺牲 fail-closed：允许 `SAFE PARTIAL/WITHHELD/MANUAL REVIEW`，不允许 `WRONG MATCH/SILENT WRONG CONTENT`。
12. 小步封存：定向测试 → `verify:safe` → commit → push；`origin/main` 不动，不 merge main，`artifacts/` 不提交。
