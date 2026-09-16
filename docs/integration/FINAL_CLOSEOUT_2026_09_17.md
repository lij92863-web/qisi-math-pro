# 收口报告（2026-09-17）

## Git

```text
start HEAD（接手时）  377bc16（上一轮交接 HEAD，handoff 写的 57441c1 之前一轮）
final HEAD            ba5758c  （本地与 origin 同名分支一致，已 push）
origin/main           b15e6fbe（未动、未 merge）
working tree          clean（artifacts/ 全部未跟踪，git ls-files artifacts = 0）
push status           已 push（期间 4 次 schannel 握手/连接失败，重试后成功）
本轮提交              300fdaa d3cd1e3 9c0a8b6 f71f1cd 273595a 947fcd9 a67d73a 9491379 7a3bf8f
                      3bff42b d8f1084 ba5758c
```

## 修复清单（每一项：症状 / 根因 / 修法 / 回归 / 真实材料证据）

| # | 症状 | 根因 | 修法 | 回归测试 | 真实材料证据 |
| --- | --- | --- | --- | --- | --- |
| 1 | 武汉四调 19 题 0 答 0 解 | 骨架把评分表单元格 `7.0` 当题号 → 骨架不再 authoritative → 支持侧全被 `unproved-question-identity` 拒收 | 块读取器拒绝"标记后只剩数字"的行 | `tests/e2e/docx-table-cell-question-marker.test.js` | G11 → 14 答 / 19 解 |
| 2 | 十二校/佛山等 15-19 题挂 `(1) …` 当答案 | 视觉/文本把"第一小问"当成答案槽 | `Qisi.Utils.isSubQuestionMarkerValue` 在答案规范化漏斗里拒收 | `tests/qisi-utils-subquestion-marker.test.js` | 撤掉 G7/G8/G9/G10 共 20 条伪答案 |
| 3 | 佛山一模 q3 选项 0/4 | 选项由 `<w:tab />` 分隔，抽取器只认 `<w:tab/>` | tab/br 允许斜杠前空格 | `tests/e2e/docx-tab-options-and-solution-figures.test.js` | q3 = 单选题 4 选项，G7 四选项题 10→11 |
| 4 | 佛山 q17 草稿 3 张图（页面只有 1 张） | 详解插图被当题图并写进题干 | 按 token 来源分 `题中图形` / `解析插图`，后者不进题干 | 同上 | q17 题干 1 张；全矩阵"图数 = token 数" 0 例外 |
| 5 | 六组最后一题题干带答案表表头 | 答案区标题规则只允许 12 字前缀，长标题匹配不上 | 标题规则收敛为 `Qisi.Utils.isAnswerKeyHeadingLine` 一处 | `tests/qisi-utils-answer-key-heading.test.js` | 6 处 → 0 处，其余数字不变 |
| 6 | **浏览器里 PDF 导入 0 题** | mixed 页整页跳过（可读中文/题号被丢），模型不可用时整份 0 题 | mixed 页保留可读文本作 safe partial；视觉转录到达时替换文本版 | `tests/pdf-ingestion.test.js`（mixed 页回归）+ 更新那条旧期望 | 三份真实 PDF：0 → **6 / 6 / 11 题** |
| 7 | 视觉回复"读不出来" | 模型把 LaTeX 反斜杠写进 JSON（`\left` `\frac` 非法转义） | 按模型写法读回复（围栏/夹带文字/LaTeX 转义/截断扫描），失败也留原文 | `tests/pdf-ingestion.test.js` 三条 | 付费 12 次调用：一页 6 题、两页 11 题、答案卷 4 页 |
| 8 | 题号缺一个就整份失效 | PDF contract 要求全连续唯一 | safe segments + missing + conflicts | `tests/pdf-ingestion.test.js` gap/duplicate/backward/unknown | 连续文件行为不变（P3 仍 11 题） |

## DOCX 最终 matrix（同一 final HEAD，AI=0）

```text
组   题 答 扣   备注
G1   6  5  0   与上一轮一致
G2  12 11  1   与上一轮一致
G3  14 14  3
G4  12  0  0   卷面答案表本身为空
G5  56 54  4   48/49 按卷面留空
G6  14 14  3
G7  19 14  6
G8  19 14  4
G9  19 14  9
G10 19 14  4
G11 19 14  5
合计 withheld 39（上一轮 36，+3 来自 G11 首次接上解析后带出的 MTEF token）
AI 调用 0    MathType.exe 启动 0
```

答案归属：十一组客观答案与**渲染页答案表**逐题一致（`probe-answer-ownership.log`）。
题干归属：209 题中 204 题中文题干逐段落在卷面页上，其余 5 题为纯公式题（`probe-stem-ground-truth.log`）。
草稿完整性：题号/题干/选项槽位/图 token/withheld 原因 0 缺陷（`probe-draft-integrity.cjs`）。

## PDF 最终零成本验收（同一 final HEAD，AI 阻断 = 模型不可用）

```text
输入                                     状态   草稿  待核对  阻断  页面错误  模型费用
简略版题目（只有一页）.pdf                review   6     1      1      0        0
简略版题目 + 完整版答案.pdf               review   6     5      1      0        0
完整版题目.pdf + 完整版答案.pdf           review  11     6      1      0        0
页类型：全部 mixed/unmapped-glyphs；支持侧 fail-closed；每页 region 目前仍是整页
```

## 付费视觉（已授权 12 次，全部用完）

```text
batch A   简略版题目 p1 + 完整版答案 p1   2 次   6 题（+ 支持侧 prefix 只接第 1 题解析）
batch A2  简略版题目 p1（诊断原文）       2 次   拿到模型原文 → 定位 LaTeX 转义根因
batch C   完整版题目.docx + 完整版答案.pdf 4 次  4 页答案卷转录，支持闸门 prefix
batch B   完整版题目.pdf                  2 次   11 题（q6 跨页 withheld）
合计 10 次用于产出、2 次用于诊断；正式题库 0 行
模型误读（与 DOCX 对照）：q1 的 n→m、q4"四千年左右"→"四千多年"；题型 6 处差异
```

## 总门槛（final HEAD）

```text
verify:safe         1397/1397 通过
verify:docx-stable  20/20 通过
verify:pdf-known-bad 65/65 通过
verify:batch-safety passed
```

## 实际观察值

```text
WRONG MATCH（错挂到别的题）      = 0（十一组答案归属逐题核对 + 草稿完整性核对）
SILENT WRONG CONTENT（静默错内容）= 0（六处已修；未解析公式一律 withheld 且带可见 token）
WITHHELD                        = DOCX 39；PDF 12 页（P1 1 / P2 5 / P3 6）
MANUAL REVIEW                   = 所有 PDF 草稿（safe partial，带"请重点核对"）+ DOCX 中被扣题目
```

## 仍未闭环

1. **PDF per-question region 未做**：region 仍是整页（`[0,0,w,h]`）。设计已确认：分段块已经带
   每行的 bbox（`blocks[].regions`），下一步是聚合成"每题区域"、按区域裁图再交视觉，模型不再
   负责定题号。这是主人列表第 8 项，也是本轮唯一没动的生产改动。
2. **G5–G11 逐页视觉真值**：只亲自看过 12 页（有图题 + 答案页），其余题目未标
   `VISUALLY_VERIFIED`（用文本层做了全量题干/答案核对，但那是文本层，不是眼睛看渲染）。
3. **MTEF 仍未解析的条目**：保持 `MTEF_UNRESOLVED / WITHHELD`，按规则不再深挖。
4. 审核页原因码仍是英文机器码（`unmapped-glyphs` 等），未做中文映射。
5. `完整版题目.pdf` 在文本安全部分下仍缺 q11（页级 withheld 覆盖，未单独列为缺口）。

## 下一步（按优先级）

1. per-question region（PDF）。
2. G5–G11 逐页视觉真值。
3. 原因码中文映射。
