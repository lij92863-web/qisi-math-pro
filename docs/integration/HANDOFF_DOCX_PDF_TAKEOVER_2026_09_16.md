# 交接：DOCX + PDF 导入收尾（2026-09-16，DeepSeek 接手轮结束）

本文是给"下一个窗口"的接手说明。**所有数字都来自实际命令输出，不是记忆。**

## 0. 一句话现状

仓库：`E:\备份\题库系统`，分支 `codex/integration-main-hardening`。
**HEAD = 远端 integration = `844b09a`**（已 push）；`origin/main` 仍是 `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`（未改、未 merge）。
工作树干净，只有未跟踪的 `artifacts/`（本地真实材料证据，**永不提交**）。

已验证：`npm test` **1364/1364**，`verify:safe`、`verify:batch-safety`、`verify:docx-stable`、`verify:pdf-known-bad` 全绿；
DOCX 全矩阵 G1–G11 在同一 HEAD 重跑：全部 `review`、**AI 请求 0**、MathType.exe 0。

## 1. 本分支上最近做了什么（按时间）

| commit | 内容 |
| --- | --- |
| `20bd59b` | Astra：普通 DOCX 改为确定性优先（`qisi-ingestion-context.js`、`qisi-docx-ingestion.js`、`qisi-docx-numbering.js`；app.js 净减 ~700 行；不再转 PDF、不发模型；去掉按数组/AI index 补答案；MTEF script template 27/28/29 与 nth-root 槽位修正；WMF/EMF 保留 `IMAGE_UNRESOLVED`） |
| `7c363e3` | Astra：PDF 检查/摄入模块接入 `app.js` + `main.html`（`qisi-pdf-inspection.js`、`qisi-pdf-ingestion.js`、`tests/pdf-ingestion.test.js`、`tests/e2e/pdf-inspection-import.test.js`） |
| `34d618c` | 本窗口：图片 token 归属（同行题号前的 token 归本题；独立行不猜给下一题） |
| `3b50adb` | 本窗口：答案区边界（答案区先切出，只给答案读取器；标题须"后段确为裸条目"；同题号两个不同值 → 不取任一） |
| `c3b7af9` | 本窗口：冲突坚持不取值（双方证据保留、字段交回空、后续候选不得回填） |
| `844b09a` | 本窗口：把冲突证据显示到题目上（q49 现在会显示"答案区对本题给出两个不一致的值（… / …）"并标 `answerConflict`） |

接手前请先跑：`git status --short` / `git log --oneline --decorate -10` / `git rev-parse HEAD origin/codex/integration-main-hardening origin/main`。

## 2. 真实验收工具（都在 `artifacts/audit-baseline/`，本地未提交）

```powershell
# 单组：真实 UI 批次 + 落盘草稿/文件行/批次行
node artifacts/audit-baseline/astra-docx-acceptance.cjs --id astra-G5 --full "C:\Users\Administrator\Desktop\题目与答案\高二.docx"
node artifacts/audit-baseline/astra-docx-acceptance.cjs --id astra-G2 --question "...\完整版题目.docx" --support "...\完整版答案.docx"

# 全矩阵 G1–G11（约 45 秒，AI=0）
node artifacts/audit-baseline/astra-run-docx-matrix.cjs

# PDF：零成本检查（不收费），结果写 astra-pdf-inspection.json
node artifacts/audit-baseline/astra-inspect-pdf.cjs

# MTEF 语料前后对比（证明改动只动了该动的）
cd artifacts/audit-baseline; node mtef-corpus-scan.js > mtef-corpus-now.txt
```

产物：`docx-batch-astra-G*.json`（含 `drafts`、`files`、`batch`）、`astra-docx-final-matrix-*.log`、`astra-pdf-inspection.json`。

## 3. 当前真实结果（同一 HEAD `844b09a` 矩阵）

```text
G1  简略版题目+完整版答案  review  6题  5答案  0扣
G2  完整版题目+完整版答案  review 12题 11答案  1扣
G3  题目+答案             review 14题 14答案  4扣
G4  周二晚测              review 12题  0答案  0扣
G5  高二                  review 56题 54答案  5扣
G6  题目+答案(另一份)      review 14题 14答案  4扣
G7  佛山一模              review 19题 19答案  8扣
G8  深圳高级中学           review 19题 18答案  4扣
G9  十二校一模            review 19题 18答案 10扣
G10 河北昌黎              review 19题 19答案  4扣
G11 武汉四调              review 19题  0答案  2扣
全部组 AI 请求 = 0
```

"扣"= `withheld`，原因都是**本题字段内仍残留未解析 MathType 公式**（见 §5.2）。

已单独核实的真材料事实：

- G2 第 8/11 题：题干现在带自己的 `[[IMAGE:…]]` token（修之前草稿里丢失）；其它题不得收到 token。
- G5 第 48 题 missing、第 49 题：真实 OLE 字节 `oleObject214.bin → MTEF_RECONSTRUCTED_OK → \left(-3,0\right)`，而答案区同题号又写 `9` → 现在 q49 为 **空答案 + 双方证据 + `answerConflict` + 可见提示**。
- PDF（三份真实材料，共 7 页）：**全部 `mixed`（`unmapped-glyphs`）**，不是扫描件；文本层有中文与版式、公式不可信（`完整版答案.pdf` 4 页 4556 字符/3 图/379 矢量、`完整版题目.pdf` 2 页 1900/3/83、`简略版题目（只有一页）.pdf` 1 页 1004/1/22）。**付费视觉调用 0 次。**

## 4. 架构现状（不要再重做）

```text
DOCX: file → qisi-ingestion-context.js（一次 unzip，XML/关系/OLE/MTEF 共享，含阶段计时）
          → qisi-docx-ingestion.js（确定性切题 + 支持解析 + 题号契约过滤 + 冲突不取值）
          → qisi-docx-numbering.js（numbering.xml 恢复 Word 自动编号）
          → review（AI=0）；
      app.js 只在既有入口处调用模块，普通 DOCX 不再转 PDF、不再发模型。
PDF : qisi-pdf-inspection.js（页面 text/mixed/scanned 判定 + 几何/字形证据）
          + qisi-pdf-ingestion.js（纯文本页直接成稿；失败页保留页图进 review）
MathType: qisi-docx-ole-reader.js + qisi-docx-mtef-reader.js + qisi-docx-pipeline.js（纯 JS，禁 MathType.exe）
```

## 5. 未完成工作（按建议顺序，含下一步精确动作）

### 5.1 给"答案区冲突→可见提示"补一个能稳定复现的 e2e fixture

- 现状：这条路径目前只有**真实材料**验收（G5 q49）。我试过的合成形态没有触发 `qisi-docx-ingestion.js` 的 `unmatched` 条目，已回退，仓库里没有半成品。
- 需要触发的判定（源码 `qisi-docx-ingestion.js`）：
  `keyValues.get(number(item)).size > 1` → `reason: 'conflicting-explicit-answers'`，`evidence: [两个值]`。
- 真实条目形态（务必照此写 fixture/断言，别再猜）：
  ```json
  {"question":"49","answer":"$\\left(-3,0\\right)$","field":"answer",
   "reason":"conflicting-explicit-answers","evidence":["$\\left(-3,0\\right)$","9"]}
  ```
- 困难点：该判定作用在 `parsed.answers` 上，所以 fixture 必须让答案条目真的被解析出来（`答案`/`参考答案` 标题 + 裸条目 `N．值`），同时**支持文本要从标题行开始**。

### 5.2 `MTEF_UNREADABLE` 类（20 条真实公式）

- 现象：`完整版题目.docx` q7（rId75 = 变量 `w`）等题因公式解析失败而 withheld。
- 已排除：不是数据缺失（OLE 载荷在，`oleObject37.bin` 216 字节）；不是"后段内容"问题（那一类已修：`parseMtef` 第一段为空时继续读后段，rId71 `1:27` 已恢复，语料 1048 条里只有 3 条变化且都正确）。
- 已定位到类：**记录游走在行区（LINE/CHAR）失步**。追踪工具：`artifacts/audit-baseline/mtef-trace.js <oleObjectN.bin> --trace`；rId75 的表现为在嵌套 LINE 处把 `0x68` 当 future record 导致越界，报 `Unterminated MTEF record list`。
- 下一步：按 MTEF5 行区布局（LINE/CHAR 的 options 位、RULER/preferences 边界）系统性校正游走，再跑 `mtef-corpus-scan.js` 前后对比（所有已解析公式必须逐字节不变），最后跑 G1–G11 看 withheld 是否下降。**禁止**为该类打"某题特判"补丁。

### 5.3 G3–G11 逐题视觉真值

- G1、G2 已完成视觉核对（记录在 `docs/integration/DOCX_VISUAL_GROUND_TRUTH_2026_09_16.md`），G3 只看了第 1 页。
- 渲染件已在 `artifacts/audit-baseline/rendered*`；LibreOffice 转换**必须在沙箱外执行**（沙箱内 180 秒超时，放开后 3 秒完成）：
  `soffice -env:UserInstallation=file:///<dir> --headless --norestore --convert-to pdf --outdir <dir> <file>`
  再用 `artifacts/audit-baseline/render-docx-page.js` 出 PNG 并**真的看图**。
- 未看过页面之前不得标 `VISUALLY_VERIFIED_*`。

### 5.4 PDF

- 已完成：inspection（零成本）+ 模块接入 + 定向测试；纯文本页直接成稿、失败页保留页图进 review、缓存/无假题/跨页隔离/未知题号拒绝均有测试。
- 未完成：真实 PDF 的 **ingestion 零成本跑批**、逐页/逐区域"需视觉"清单、UI 上"为什么 withheld / 哪一页 / 哪个 region / transport 原因"的呈现核对。
- 付费视觉：**必须先提交方案（哪几份/哪几页/哪些 region/模型/调用次数/预计人民币/为何确定性做不到）并取得明确授权**；存在 API key ≠ 授权。当前 0 次调用。

### 5.5 其它已知缺口

- G2 第 4 题的图乙（WMF 矢量图）不绑定到草稿（照片甲已内联）；第 8/11 题图形也是 WMF/位图混合，需要单独设计矢量化路径。
- `artifacts/` 目前**不在 `.gitignore` 里**（已确认仓库自身无 `artifacts/` 规则），所以**绝不能 `git add -A`**；若要加 `/artifacts/` 规则，先确认仓库内没有任何故意跟踪的 artifacts 文件。

## 6. 硬性规则（违反即视为失败）

- 不 merge `main`；不改 `origin/main`。
- 不重新依赖 `MathType.exe`；不把 DOCX 改回视觉优先。
- 不做文件名特判、题号特判、按"最近题目"猜归属、粗暴删长数字。
- AI/OCR 返回的题号只能当证据；不得按数组 index 补答案；不得语义提权答案。
- 单题失败/缺失不得导致整批 0 题；单公式失败不得拖垮整批。
- 未授权不得调用付费 API；不得为了测试绿灯削弱 fail-closed。
- `artifacts/` 不提交、不删除。
- `app.js` 改动必须同步更新 `architecture/post-seal-approved-blobs.json`（git blob + normalized sha256）与账本 `docs/integration/HARDENING_INTEGRATION_LEDGER_2026_09_15.md`，并按需调整 `tests/code-quality-boundaries.test.js` / `tests/app-shell-boundary.test.js` 的上限（当前 app.js 21478 行，上限 22137/22145）。

## 7. 环境与操作注意（都是踩过的坑）

- 沙箱内 `git add/commit/push` 需要提权；push 偶发 `Empty reply from server` / `Connection was reset`，**重试即可**（本次第三次成功）。
- LibreOffice 无头转换与浏览器真实批次需要沙箱外执行；本地服务 3001 常驻（PID 会变）。
- `git status` 可能显示 `M app.js` 而 `git diff --stat` 为空（CRLF 假象），以 `git diff --stat` 为准。
- 提交信息里不要出现 `$`、反引号、引号（PowerShell 会破坏消息）。
- 每次结构性改动后：定向测试 → `npm test`（当前 1364 例）→ `npm run verify:batch-safety` → 真实材料矩阵 → commit → push。

## 8. 建议的接手顺序（照抄即可）

1. 复核 Git（§1）与门禁，确认 `844b09a` 干净且已 push。
2. 跑一次 `astra-run-docx-matrix.cjs` 和 `astra-inspect-pdf.cjs`，把当前真实结果重新落一遍（§3）。
3. 做 §5.1（冲突提示的稳定 fixture），跑定向 + 真实 G5 验证。
4. 做 §5.2（`MTEF_UNREADABLE` 行区游走），用 `mtef-corpus-scan.js` 前后对比，再跑矩阵看 withheld 下降。
5. 做 §5.3（G3–G11 视觉真值），逐题分类 COMPLETE / SAFE PARTIAL / WITHHELD / MANUAL REVIEW / WRONG MATCH / WRONG CONTENT / FAILED，并明确 WRONG MATCH / SILENT WRONG CONTENT 的实际观察值。
6. 做 §5.4（PDF 零成本 ingestion + 需视觉区域清单 + review 可见性核对）。
7. 只在完成 6 之后，提交付费视觉成本方案并等待授权。
8. 最后：全量门禁 + Git 审计 + 最终报告（含 start/final HEAD、push 状态、真实材料观察值、未解决项）。
