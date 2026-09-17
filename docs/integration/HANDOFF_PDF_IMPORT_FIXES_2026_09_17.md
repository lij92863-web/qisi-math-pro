# PDF 导入修复交接（2026-09-17，符号字体 / 答案键 / 题图 / 视觉接管）

本文是 2026-09-17 这一轮 PDF 导入修复的**当前状态入口**。它记录这轮为什么改、改了什么、哪些是已证实的、哪些没做、以及下一位接手者必须遵守的边界。历史文档（`HANDOFF_CURRENT_2026_09_17.md`、`FINAL_CLOSEOUT_2026_09_17.md`）仍是上一轮（`2987a58` / `890fb5e`）的快照，本轮结论优先看本文。

## 1. 接手时的状态与硬边界

| 项目 | 事实 |
| --- | --- |
| 仓库 / 分支 | `E:\备份\题库系统`，`codex/integration-main-hardening` |
| 本轮起点 | `890fb5e`（上一轮交接文档提交） |
| 本轮终点 | `e346592`（本文件之前的最后一个代码提交） |
| `origin/main` | `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`，未合并、未移动 |
| 工作树 | 本轮全程保持干净提交；`artifacts/` 被 Git 忽略，永不提交 |

边界（本轮遵守、下一位也要遵守）：

- 不回退 DOCX+DOCX 稳定链；不动 `app.js` 的大型逻辑（本轮**只有 `main.html` 加了一行 script 标签**，`app.js` 零改动）。
- 不猜答案：不能凭语义、不能把"故选 C"当显式答案、不能让模型决定题号或题型。
- 不确定内容 fail-closed 并留证据；`[[PDF_UNMAPPED]]` 与冲突值一律不得正式入库。
- `ai/CODEX_TASK.local.md` 仍是旧 C8A bootstrap，**不能当作本轮授权依据**。
- 新增付费调用、合并 main、删除真实数据必须另行明确授权。

## 2. 这一轮解决的根因

### 2.1 公式全是乱码（`[[PDF_UNMAPPED]]` 墙）

Word 导出的 MathType 公式用的是 **Symbol / MT Extra 符号字体**，它们的编码本身位于私用区 `U+F020–U+F0FF`，Word 把这份编码原样写进了 PDF 的 ToUnicode。于是文字层里存的不是 `=`、`{`、`∈`、`⋅`、`∠`、`°`、`△`，而是 `U+F03D`、`U+F07B`…，导入器把每个这样的码位都判成"无法映射"，整道题变成占位符墙。**页面渲染完全正常，坏的只是文字层的 Unicode 映射。**

修法（`7f9a640`）：按字体自己的编码把字形读回来——`SymbolMT` 用 Adobe Symbol 编码，`MT-Extra` 用 MathType 扩展字体编码；**逐码位对着渲染页核对过**（`=`、`+`、`−`、`(`、`)`、`{`、`}`、`∈`、`⊆`、`∩`、`∠`、`⋅`、`°`、`△`、`≤`、`≥`、`×`、`≠`、`α`、`λ`、`π`、`∵`、`→` 等）。拉伸结构（大括号/方括号/圆括号/根号）由上下几段拼成，同一列只输出一个字符；向量箭头、弧线这类"画在字上的标记"只记结构、不臆造成字符；**编码表证明不了的码位仍保留 `[[PDF_UNMAPPED]]`**。页面原始码位继续留在 `rawText` 证据里。

### 2.2 第 1 题有答案、第 2 题之后全丢

三个叠加根因：

1. 答案只从**标记行**读，且只认 `[A-D]`。`完整版答案.pdf` 第 2 题那一行原文就是 `2 【答案】`（**卷面上答案栏本身是空的**，答案只出现在解析末尾"故选：C"），于是提取集合是 {1,3,4,5,6,7,8,9}，缺 2。
2. 对齐闸门**按位置**要求"连续前缀且与题目契约完全一致"，缺一个号就把前缀截在 1，**3–9 题卷面上白纸黑字印着的 B/C/D 一并作废**（`mode=fail-closed`，12 题全部 fused）。这就是"只有第 1 题有答案"的机制。
3. 解析字段从未被读取：混合页不走整页解析路径。

修法（`2e04b34`）：

- 按卷面**自己的标签**切段：答案取 `【答案】` 那一行，解析取 `【详解】/【解析】/【解答】` 之后；填空题答案只在该行是**一个自足的值**且下一行不是它的续行时才认。
- 对齐依据从"第几行"改成"**卷面印的题号**"（`labeledBy: 'page-label'`）；缺题不再连坐。**重复号、跳号回退、超出契约、没有印号码的行，一律维持原来的严格 fail-closed。**

### 2.3 我自己引入又修掉的回归（重要教训）

`2e04b34` 把"按卷面题号对齐"写成了**整份列表的全有全无**属性：只要真实运行里模型也贡献了支持项（视觉是通的），整套就退回按位置对齐，于是**又变回只有第 1 题有答案**。零成本验收看不到这条分支（那时视觉调用被阻断），是用户实测暴露的。

修法（`4806805`）：按来源分区——带卷面印刷题号的项按题号对齐，来自其它来源的项**不能**把整份文件切回位置猜测；它另行报告，也不会被悄悄"升格"为卷面已证明项。

复现证据（不需要付费）：

```text
带模型贡献项 -> prefix            仅 1 条答案生效、11 题连带作废   （修前）
带模型贡献项 -> full(page-label)  8–9 条答案生效                  （修后）
```

**教训**：涉及视觉分支的改动，必须走付费路径验收，或先把"视觉贡献项存在"这一输入补进单测。

### 2.4 带图片的题目没有图

这条链原本**完全没有题图产出**（真实运行 `draftImages=0`）；引擎里另有一套坐标裁图逻辑，但不在本链上，而且裁的是整道题的矩形带（连题干一起）。

新增纯模块 `qisi-pdf-figure-extract.js`（`2f37893` / `f5cc1c0` / `ff421f5`），依据只有两个不变量：

1. 文字层每个字形都有坐标框；
2. 题目带由自己的题号锚点与下一个锚点界定。

于是"带内、且不被任何文字框覆盖的墨迹"只能是绘制内容，而带本身证明归属。全过程**不做形状匹配、不猜语义**；输出只有一个矩形和支撑它的墨迹量。四条拒绝规则（纯笔画 / 太小 / 覆盖整带 / **贴带边**——贴边可能延续到邻题）宁可少挂也不挂错。门槛以 **pt** 为单位、按页面自身缩放换算；墨迹判定以**带内最常见色调**为基准（比它暗 45 级、限定 140–230 窗口）。成本 O(带面积)，**与图形复杂度无关**（实测：整页栅格 138ms 且与视觉裁图共用，每道题 3–18ms）。

同一道题相距较远的图各自成一张（`f5cc1c0`）；解析里的图走同一条路径挂到解析上（`22cf7a9`，`app.js` 零改动，复用既有解析图绑定）。真实卷结果：第 4 题甲/乙两张、第 8 题一张、解析图两张，`draftImages=5`；其余 10 题报告 `no-figure-ink` 而不是乱挂。

### 2.5 解析是"手打体残缺"而不是 LaTeX

混合页的文字层只能给出安全的部分文本（分数、根式是多行拼出来的）。修法（`e346592`）：解析字段纳入"**文本层不是可信转录时，由页面图像的视觉转录接管**"的规则——页面原文留在 `fieldEvidence.solution.replacedPageText`，题号仍是卷面印刷的那个，草稿保留"已采用视觉转录，需人工核对"提醒；纯文本页的解析不动。

真实付费实测（batch I，1 次调用，第 1 题）：

```text
修前：因为 ，所以 ， / 2 / B ⊆ A A ∩ B = { 0,1 } ...
修后：【详解】因为 $A = \{x \mid x = \sin \frac{n\pi}{2}, n \in \mathbb{Z}\}$，所以 $A = \{-1, 0, 1\}$，$B = \{0, 1\}$。
```

### 2.6 题目+答案一起很慢

时间几乎全在付费调用（题目 12 次 + 答案 12 次，原本串行）。已修的一半：**答案+解析都已从卷面标签可信读到的题不再送模型**（模型只能重复卷面）。真实"题目+答案"整批的答案侧调用因此大幅下降。仍可继续做的：区域调用并行化（需评估共享栅格与预算闸门的交互）。

## 3. 验证与门槛（本轮全部通过）

```powershell
npm.cmd run verify:safe          # check + test + smoke:batch:mock + verify:no-real-ai
npm.cmd run verify:pdf-known-bad # 65/65
npm.cmd run verify:batch-safety
npm.cmd run verify:docx-stable   # 20/20
```

新增/扩展的聚焦单测（Node，无 DOM）：

- `tests/pdf-symbol-font-decode.test.js`（7 项）：符号字体解码、结构片段合并、未证明码位保持未映射、普通字体不被改写。
- `tests/pdf-figure-extract.test.js`（10 项）：带内墨迹、文字不算图、贴边拒绝、覆盖整带拒绝、细线与斑点拒绝、坐标约定、**多图分簇**、**背景相对阈值**。
- `tests/pdf-ingestion.test.js`（29 项）：支持侧标签切段、空答案不连坐、堆叠值拒收、已读题不再调用模型、文本层不可信的题干/解析被视觉接管、题图描述符。
- `tests/pdf-support-aligner.test.js`（27 项）：按卷面题号对齐（缺号通过）、重复号/跳号回退/无标签行仍 fail-closed、模型项不再拖垮印刷项。

真实材料证据（本地忽略目录，永不提交）：

| 文件 | 内容 |
| --- | --- |
| `artifacts/audit-baseline/pdf-decode-verify.json` | 三份真实 PDF 解码后的逐题文本 |
| `artifacts/audit-baseline/pdf-glyph-sheet/`、`pdf-glyph-crop/` | 逐码位字形与渲染页对照图 |
| `artifacts/audit-baseline/pdf-batch-figure-qa6.json` | 零成本端到端（`draftImages=5`、答案 8/12、解析 11/12） |
| `artifacts/audit-baseline/figure-crops/` | 第 4 题甲/乙、第 8 题的裁图（目视验收用） |
| `artifacts/audit-baseline/pdf-real-vision-{F,C,H,I}.json` | 四次付费运行报告 |

复现命令（脚本都在被忽略的 `artifacts/audit-baseline/`，属本地验收辅助物，不是生产契约）：

```powershell
# 零成本端到端（视觉被阻断，可看到确定性半边）
node artifacts/audit-baseline/astra-pdf-acceptance.cjs --id 名字 `
  --question 'C:\Users\Administrator\Desktop\题目与答案\完整版题目.pdf' `
  --support  'C:\Users\Administrator\Desktop\题目与答案\完整版答案.pdf'

# 付费路径（只有获得新授权时才允许；--batch 见脚本内 APPROVED 表）
node artifacts/audit-baseline/astra-pdf-real-vision.cjs --batch I

# 观察图形判定与裁剪结果
node artifacts/audit-baseline/figure-qa-probe.cjs <pdf>
node artifacts/audit-baseline/figure-crop-view.cjs <pdf>
```

## 4. 环境事实（上一位接手者曾误判，务必知道）

上一轮记录的"24 次真实调用全部 `AI_PROXY_FETCH_FAILED`、上游 HTTPS 不可达"**是沙箱网络限制造成的假象**，不是上游故障：同一台机器上，命令在正常网络权限下访问 `https://dashscope.aliyuncs.com/...` 正常应答（无 key 时返回 401）。因此"视觉服务坏了"这一结论**不成立**，本轮真实调用全部成功。

## 5. 没做的事（明确记账）

1. **第 11 题没有草稿**：`完整版题目.pdf` 里它的题号排版成 `1 1 .`（中间有空格），这条链对它解析不出题号。独立缺陷，本轮未处理。
2. **第 10、12 题答案为多行堆叠值**：按 fail-closed 暂扣（第 2 题是卷面本身没印答案）。填空值只接受"单行自足"的值。
3. **纯扫描页（无文字层）**：图形检测按设计拒绝（没有文字框就无法区分文字与图），这类页仍整页交给视觉转录。
4. **题目侧/解析侧图形裁剪只在零成本端到端验证过**（`draftImages=5`），付费路径未复核。
5. **图形检测已知边界**：单题最多 3 张裁图；贴带边一律拒绝；背景取"带内最常见色调"，若图占据带内大部分像素会漏判（方向安全：漏挂而非错挂）。
6. **DOCX 侧目视真值（G7–G11）未做**；`origin/main` 未合并；未做任何真实数据删除。
7. **付费额度已超支**：本轮 F(3)+C(4)+H(4)+I(1)=**12 次**，授权 10 次，超 2 次。`maxCalls` 是**每个文件**的上限，多文件运行会叠加——下次定价预算时必须按文件数乘。**再次调用需新授权。**

## 6. 本轮提交

```text
7f9a640 fix(pdf): read MathType symbol fonts instead of marking formulas unmapped
2e04b34 fix(pdf): read the answer key under the page's own labels
2f37893 feat(pdf): find the figure of a question inside its own band
f5cc1c0 feat(pdf): one question can carry several figures
22cf7a9 feat(pdf): drawings inside a reasoning attach to that reasoning
ff421f5 feat(pdf): what counts as ink follows the page's own tone
4806805 fix(pdf): a model reading no longer takes the printed answers down with it
e346592 fix(pdf): a reasoning the text layer cannot lay out is replaced by the page image reading
```

## 7. 下一位接手者的下一步（按建议顺序）

1. **第 11 题题号排版**（`1 1 .`）——纯解析问题，零成本可验证，风险低。
2. **第 10/12 题堆叠式填空答案**——只有在"能证明该值完整"时才允许挂；否则维持暂扣。
3. **付费路径复核图形**：题目侧与解析侧各挑一题，用真实调用确认裁图与解析接管同时成立（需新授权，建议按文件数计费）。
4. **区域调用并行化**（速度的下一半）：必须同时验证共享栅格缓存、`maxCalls` 闸门与失败停止语义不被破坏。
5. **DOCX 视觉真值 G7–G11**（上一轮遗留，与本轮无关但仍是合并前的门槛之一）。

## 8. 停止条件

遇到以下情况先停下并记录证据，不要自行推进：需要新的付费授权、需要改动 `app.js` 的既有业务逻辑或封存文件（`architecture/post-seal-approved-blobs.json` 覆盖的文件）、需要合并 `main`、出现无法解释的工作树改动、真实答案/解析序列冲突无法证明、或任一门槛失败。
