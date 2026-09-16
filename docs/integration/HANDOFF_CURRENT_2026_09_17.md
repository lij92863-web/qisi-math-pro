# 奇思数学 Pro：DOCX / PDF 导入当前交接（2026-09-17）

本文是给下一位接手者的**当前状态入口**。它记录截至 `2987a58a27f7ec8ef73b0d1a52dede2257ec543e` 的证据、尚未证明的事项和下一步任务。本文之后如有新提交，应先重新核对 Git 与真实材料，再更新这里的数字。

历史文档 `HANDOFF_DOCX_PDF_TAKEOVER_2026_09_17.md`、`FINAL_CLOSEOUT_2026_09_17.md` 中的历史快照仍有调查价值，但不能直接当现状使用。特别是“支持 PDF 按 4 页调用”“必须 Ctrl+F5”“还有 8 次可用视觉额度”“全局 WRONG MATCH / SILENT WRONG CONTENT 为 0”均不是当前可采信的结论。当前审计细节优先看 `FINAL_CLOSEOUT_2026_09_17.md` 的 **CURRENT STATE** 段；其 `HISTORICAL / SUPERSEDED FINDINGS` 段只作历史记录。

## 1. 接手时的状态与硬边界

| 项目 | 当前事实 |
| --- | --- |
| 仓库 | `E:\备份\题库系统` |
| 分支 | `codex/integration-main-hardening` |
| 本地 HEAD / 同名远端分支 | 均为 `2987a58a27f7ec8ef73b0d1a52dede2257ec543e` |
| `origin/main` | `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`；未合并、未移动 |
| 工作树 | 本次交接写作前 `git status --short` 为空 |
| 本地证据 | `artifacts/audit-baseline/`，被 Git 忽略；`git ls-files artifacts` 为空 |
| 合并判断 | **NO**。DOCX 全局目视真值与成功的 PDF 视觉验收尚未完成 |

先执行 `git status --short`、`git branch --show-current`、`git rev-parse HEAD origin/codex/integration-main-hardening origin/main`，再读根目录 `AGENTS.md` 及其要求的 `ai/` 文件和相关技能。若工作树出现未说明的改动，先辨认所有者，不要覆盖。

当前用户规则：以最小修改解决现有问题；修现有函数、扩展现有 contract 优先；不为未来需求增加 service、manager、adapter、registry、平行 parser 或第二套事实来源。生产链只有 DOCX 和 PDF。不能凭语义猜答案、不能让 Vision 决定题号或题型、不能把不确定内容写入正式题库。不要改 `origin/main`，不要提交 `artifacts/`，不要替用户改变网络设置。新增付费请求、合并 main、删除真实数据、大规模不可逆迁移须另行明确授权。

`ai/CODEX_TASK.local.md` 目前仍写旧的 C8A bootstrap，不能用它推断本轮导入收口的现状或授权；当前任务范围以用户明确要求和当前代码、实测为准。

## 2. 两条正式链与事实归属

```text
DOCX  qisi-ingestion-context → qisi-docx-ingestion → evidence/candidate → review → formal admission
PDF   qisi-pdf-inspection → qisi-pdf-ingestion → evidence/withheld → review → formal admission
```

程序根据原始结构、题号顺序、页面锚点、section heading 与支持侧序列决定 identity、region、type 和答案归属。模型只提供视觉转录证据。确定性字段与视觉结果冲突时保留两份原值及冲突原因，交给人工复核；`[[PDF_UNMAPPED]]` 的明确缺口可以在同题证据约束下补全。审核后的正式入库仍由 FormalAdmission 控制。

支持侧只允许 `full`、`prefix`、`fail-closed` 三种安全结果。重复、跳号、回退或答案和解析序列不一致时，不按数组位置或语义相似度挂接。缓存只能由唯一事实来源重建；不得把缓存结果当题号或答案的权威来源。

## 3. 本轮已落地的修改与证据

| 提交 | 根因和局部修复 | 已有证据 |
| --- | --- | --- |
| `9c49275` | 普通刷新可能继续使用旧 HTML/JS；本地服务对 HTML/JS 返回 `Cache-Control: no-store` | HTTP header 与条件刷新回归；不再靠逐个改 `?v=` |
| `31fb0c7` | PDF Vision 曾可能整题替换确定性内容，独立支持文件角色不一致，文本 bbox 会裁掉右侧图，题型可能被模型猜错；在既有 PDF inspection/ingestion、FormalAdmission 中收紧证据合并、角色、区域、题型与未映射标记 | 冲突/补洞/区域/跨页/支持角色/题型等回归；真实卷零成本 mock 为题目 12 + 支持 12 个逐题请求 |
| `667642b` | G5 Q25 的 MathType OLE payload 与 Word 可见预览相反，曾静默生成错误公式；只拒绝该已证实的陈旧 payload | G5 Q25 重跑后显示 `[[MTEF_UNRESOLVED:rId133]]` 并暂扣；该 guard 不保证所有 OLE 都一致 |
| `b6f202f` | G7 Q10 的 `P(A)` / `P(B)` 被识别成选项 A/B；现有选项切分器跳过完整数学片段内部的字母 | 真实 G7 重跑保留三个概率条件、四个选项和印刷答案 `ACD` |
| `2e9e981` | 真实上游故障返回 `AI_PROXY_FETCH_FAILED` 时，后续区域仍继续请求；既有 PDF 导入函数将代理获取失败、超时、鉴权错误列入文件级停止码 | 两页多区域 mock 在第一处失败后只调用一次；真实故障发生在修复之前 |
| `db60038`、`9572df1`、`2987a58` | 审计记录、目视边界与 24 次授权调用结果 | `FINAL_CLOSEOUT_2026_09_17.md` 和 `DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md` 顶部当前更正 |

PDF 每题区域现为页面内容宽度内的纵向带，由当前题锚点、下一题或小节边界裁定。真实题目 Q8 的右侧图进入该题区域，邻题与页脚不进入。跨页 Q6 在题目卷和支持卷均由同一固定题号携带两页区域。无法证明独立图形归属的页面仍需人工复核，不能声称几何规则覆盖所有版式。一个计数 mock 中 PDF 打开/整页渲染为优化前 3/3、优化后 1/1，裁图均为 2；这是资源次数结果，不是实际耗时提升的证明。视觉缓存键已有 `VISUAL_SCHEMA_VERSION`。

## 4. DOCX：同一代码版本的真实导入矩阵

以下是 `2e9e981` 代码版本下，经浏览器批量导入路径重跑的 G1–G11。此后只有文档提交。全部批次在 `review`，阻断的 AI 请求数均为 0；运行记录在忽略目录 `artifacts/audit-baseline/docx-batch-takeover-G1.json` 至 `G11.json`。

| 组 | 原始材料 | 草稿 | 答案 | 解析 | 暂扣 | 目视核对现状 |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| G1 | 简略版题目 + 完整版答案 | 6 | 5 | 6 | 0 | 逐题页面记录已有 |
| G2 | 完整版题目 + 完整版答案 | 12 | 11 | 12 | 1 | 逐题页面记录已有；未解公式保留 |
| G3 | 题目 + 答案 | 14 | 14 | 14 | 3 | 逐题页面记录已有；三处未解公式暂扣 |
| G4 | 周二晚测 | 12 | 0 | 0 | 0 | 原答案表为空；Q4/Q6 当前已恢复四选项，Q9 仍无结构化选项 |
| G5 | 高二 | 56 | 54 | 0 | 5 | 22 页已看；Q15/Q19/Q25/Q28/Q34 暂扣，Q48/49 印刷答案表冲突留空 |
| G6 | 题目+答案 | 14 | 14 | 14 | 3 | 11 页已看；Q1/Q10/Q13 暂扣 |
| G7 | 佛山一模 | 19 | 14 | 19 | 6 | Q10 已按卷面修复；12 页渲染缺 Q16–19 解答后段 |
| G8 | 深圳高级中学 | 19 | 14 | 19 | 4 | 题目 Q1–19 与前 11 题答案表已看；渲染止于 Q8 详解 |
| G9 | 十二校一模 | 19 | 14 | 19 | 9 | 答案表文本已核；只有部分题目页样本目视，未完成逐题 |
| G10 | 河北昌黎 | 19 | 14 | 19 | 4 | 答案表文本已核；只有部分题目页样本目视，未完成逐题 |
| G11 | 武汉四调 | 19 | 14 | 19 | 5 | 答案表文本已核；只有部分题目页样本目视，未完成逐题 |
| **合计** | 11 组 | **209** | **168** | **141** | **40** | **不能给全局零错误证明** |

“答案字符串与渲染页文本层相同”只能证明该字段的候选值，不能代替看题干、选项、公式、图片和解答归属。旧报告里 G4 Q4/Q6 缺选项、G11 零答案、G9 Q2 为 `$P$`、G5 暂扣 4 等记录均是已被后续提交推翻的历史观察。G4 Q9 的四个公式选项仍留在题干、结构化选项为 0，需人工复核或在现有解析器中作有页面证据的最小修复。剩余不支持的 MTEF 应继续显式 `MTEF_UNRESOLVED` / 暂扣，不追求伪造完整率。

已发现的两处**历史静默错误**是 G5 Q25 陈旧 OLE 公式和 G7 Q10 概率事件字母截断，现已修复并针对性重跑。由于 G7–G11 尚未全部逐题目视，当前只能报告“已检查范围内未再发现错挂/静默错误”；**全局 WRONG MATCH 与 SILENT WRONG CONTENT 的实际最终值未证明**，不能写成 0。

## 5. PDF：零成本链与授权视觉实测

| 场景 | 观察值 | 结论 |
| --- | --- | --- |
| 真实题目卷 `完整版题目.pdf` + 支持卷 `完整版答案.pdf` 的零成本逐题 mock | 题目 12 区域、支持 12 区域；各自 Q6 跨两页；题号由程序固定 | 支持文件已重新按 support role 分段，不再是旧交接所述 4 次整页 |
| 模型传输被阻断的产品路径 | `review`、11 个文本草稿、6 个暂扣页面项、支持闸门 `fail-closed`、正式题库 0；Q11 仍没有安全文本草稿 | 模型不可用时保留可读正文和 `[[PDF_UNMAPPED]]` 缺口；缺口不得正式入库 |
| 已授权的真实视觉 batch E（修复 `2e9e981` 前） | `qwen-vl-plus`；题目 12 + 支持 12，共 **24 次尝试**，硬上限 12/文件、24/总；越额 0 | **24 次均为 `AI_PROXY_FETCH_FAILED`，返回视觉转录 0**；批次仍为 `review`，11 草稿，支持 `fail-closed`，正式题库 0 |
| 上游连通诊断 | 无凭据 TCP 443 成功；Node 与 PowerShell 的无凭据 HTTPS HEAD 均超时 | 只能定位为当前 HTTPS 上游路径不可用；不能断言具体代理规则，也不能凭失败响应确认账单 |
| 题型与冲突证据 | 卷面小节证明题目 Q1–6 单选、Q7–9 多选、Q10–12 填空；原页 Q1 有 `sin(nπ/2)`，旧 Vision 为 `sin(m/2)`；Q5 向量项也有差异 | 题型由小节证据决定；历史 Vision 值作为冲突回归，不能直接覆盖确定性字段 |

真实调用记录：忽略文件 `artifacts/audit-baseline/pdf-real-vision-E.json`。该文件保存的是**最近一次 24 次失败运行**；旧交接中的同名 batch E 曾描述一轮 12+4 请求，不能再从当前同名 JSON 复现。不要把“24 次尝试”写成“24 次成功计费”；实际账单未知。此次授权已耗尽，后续任何模型请求需要新的明确上限。连接诊断不得暗改用户 DNS、代理或路由。

PDF 当前还有几个未闭环的归属问题：真实 Vision 成功结果尚未在这轮代码和真实卷上验收；模型给出的 A–D 字母答案在支持侧现行代码中仍被直接排除，尚未实现“印刷的显式答案”与“详解里的故选 C”之间可证明的字段证据区分；Q11 没有安全文本草稿；无法仅靠当前几何证明的图形所有权需继续留在复核区。这些都不得由语义猜测或第二套 pipeline 解决。

## 6. 验证门槛与证据边界

最新代码修复后的门槛：`verify:safe` **1416/1416**、`verify:docx-stable` **20/20**、`verify:pdf-known-bad` **65/65**、`verify:batch-safety` 通过；`verify:no-real-ai` 包含在 safe 中。针对 `AI_PROXY_FETCH_FAILED` 的 PDF 单测也通过。最终文档提交前应再运行一次 `npm.cmd run verify:safe`，并记录输出。

检查材料的顺序应是：原页图像和原件 → 当前代码的真实草稿及原始 evidence → 定向回归 → 全量门槛。测试绿只能说明覆盖到的行为未退化；文本探针、答案键匹配或模型自报不能替代逐题目视。

## 7. 下一步任务（按依赖顺序）

1. **完成 DOCX 视觉真值。** 先取得 G7/G8 答案文件的完整渲染页，再逐题补齐 G7–G11 的题干、选项、公式、图片及其归属、题型、答案和解析归属。现有 `rendered-g7` 至 `rendered-g11` 多数只保存前 12 页，不能以“看完现有页”声称看完整份。逐题记录 `COMPLETE / SAFE PARTIAL / WITHHELD / MANUAL REVIEW / WRONG MATCH / WRONG CONTENT / FAILED`，只给真正看过的内容标 `VISUALLY_VERIFIED`。若发现新错，先保留原页与当前草稿的对照，再做局部修复并重跑 11 组矩阵。
2. **核实 PDF 支持侧显式答案归属。** 在既有 `qisi-pdf-ingestion.js`、支持侧 aligner/controlled write 中追踪“独立印刷答案表/【答案】”和“详解结论”的证据，补一条真实材料或 fixture 能区分两者的回归。只有题号、序列和显式标签都证明时才允许客观题字母答案；无法证明则继续 `fail-closed`。不按模型字段或数组顺序自动挂答案。
3. **处理真实 PDF 上游连接。** 先复核健康检查及无凭据 HTTPS 路径，读取现有错误码和原始失败证据；向用户说明确认的故障范围。不得自行修改系统网络。连接恢复后，先提交新的逐题调用计划（文件、页、题号、区域、模型、预计调用数与成本、`maxCalls`、停止条件），取得新的明确授权才运行。
4. **做成功的 PDF 视觉验收。** 在可控调用预算下复核 Q1–12 与支持 Q1–12，尤其 Q6 跨页、Q8 右图、Q11 缺文本草稿、Q1/Q5 旧 Vision 冲突、客观答案显式来源、题型和 FormalAdmission。记录逐字段 evidence、`full/prefix/fail-closed`、假题数、错误归属数、实际调用和账单；任何冲突留在复核区。
5. **最后收口。** 以最终 HEAD 重跑 11 组 DOCX 与 PDF 零成本矩阵及四项门槛，更新 `FINAL_CLOSEOUT_2026_09_17.md` 的 CURRENT STATE。给出 DOCX/PDF 的实际 WRONG MATCH 与 SILENT WRONG CONTENT 值及未解项。只有这些证据齐备且工作树干净，才可向用户提出是否考虑合并；不要自行合并。

每一步只解决一个 coherent 问题、限制 diff 与新增状态。若局部 bug 需要跨十余个生产文件或引入新 manager/registry，先重新检查归属设计。旧代码或重复 helper 与当前错误无关时仅记录，不顺手清理。

## 8. 接手操作索引

```powershell
git status --short
git branch --show-current
git rev-parse HEAD origin/codex/integration-main-hardening origin/main
npm.cmd run verify:safe
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
```

- DOCX 当前同版报告：`artifacts/audit-baseline/docx-batch-takeover-G1.json` … `G11.json`；实际浏览器批次脚本：`artifacts/audit-baseline/astra-docx-acceptance.cjs`。脚本是本地验收辅助物，不是生产 contract。
- PDF 零成本报告：`artifacts/audit-baseline/pdf-batch-takeover-zero-cost.json`；24 次真实尝试：`artifacts/audit-baseline/pdf-real-vision-E.json`；不要在无新授权时执行真实视觉脚本。
- 目视记录：`docs/integration/DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md` 顶部当前更正及各组记录。其旧表格保留发现过程；顶部更正优先。
- PDF 初期页级证据：`docs/integration/PDF_INSPECTION_STAGE_2026_09_16.md`；当前收口状态：`docs/integration/FINAL_CLOSEOUT_2026_09_17.md` 顶部 CURRENT STATE。
- 改动 `app.js` 时，先按 `architecture/post-seal-approved-blobs.json` 与集成账本的封存规则处理；本交接没有授权大改 `app.js`。

### 下一位接手者的停止条件

遇到未获授权的付费调用、真实数据删除、`main` 合并、无法解释的工作树改动、意外跨范围 diff、真实答案/解析序列冲突或门槛失败时，先停下并记录证据。对可疑归属保持 `WITHHELD` / 人工复核；不要以“覆盖率更高”为由放行错误内容。
