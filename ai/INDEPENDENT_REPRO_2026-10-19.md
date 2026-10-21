# 独立复现报告（reviewer-repro，2026-10-19）

> 角色：独立验证员。**不信任既有结论**，在未改动业务代码的前提下重跑 A/B/C 三项，并额外构造反例。
> 除本文件外未修改任何仓库文件；未执行 `git reset/stash/checkout/commit`；未运行 `npm test`；未访问任何真实 AI/OCR/PDF 外网接口（MinerU 全部走 `tests/harness/mineru-replay.js` 或本文件内的 fetch 桩）。
> 所有 node 命令均带 `NODE_OPTIONS=`；浏览器端口 32401–32406（A 沿用脚本内 32192，运行时空闲）。

## 0. 环境与代码基线（重要）

- 验证时工作区**不是干净基线**：`git status` 显示 `app.js / qisi-batch-importer.js / qisi-pdf-mineru-producer.js / qisi-mineru-* / qisi-production-*` 等均处于已修改或新增状态（其他人正在写）。本报告结论只对下述哈希对应的当次工作区成立。
- 关键文件 sha256（验证时）：
  - `qisi-pdf-mineru-producer.js` `38703d5b…bc052e`
  - `qisi-mineru-client.js` `832e28fa…4daa39`
  - `qisi-mineru-task-service.js` `c4e5ed4f…44bce`
  - `qisi-paper-segmenter.js` `5b0e4835…f8b4a9`
  - `qisi-batch-importer.js` `4c7d118d…2c73ef`
  - `qisi-support-text-parser.js` `32fd021c…22ad4c`
  - `qisi-production-docx-source-port.js` `268334f9…12c540`
- 真实 DOCX 源文件：`C:/Users/Administrator/Desktop/题目与答案/广东佛山市第一中学2026届高三一模检测数学试题.docx`，sha256 `3341420384d4546c5ffb2ba385be46efab7980832e5485753bd87a551ebaf4cf`（运行前后一致）。

---

## 1. A：真实 DOCX 整卷（真跑）

### 原始证据

命令：

```bash
NODE_OPTIONS= node local-run-artifacts/sol-repair-2026-10-19/real-docx.cjs
```

运行前把旧结果备份到 `local-run-artifacts/diagnose-2026-10-19/repro-real-docx-result-prior.json`，避免覆盖证据。脚本退出码 0（内部 assert 全部通过），关键输出：

```json
{"sha256":"3341420384d4546c5ffb2ba385be46efab7980832e5485753bd87a551ebaf4cf",
 "durationMs":9251,"status":"review",
 "drafts":[{"q":"1","answer":"D"},{"q":"2","answer":"A"},{"q":"3","answer":"B"},
 {"q":"4","answer":"C"},{"q":"5","answer":"C"},{"q":"6","answer":"D"},{"q":"7","answer":"D"},
 {"q":"8","answer":"A"},{"q":"9","answer":"AD"},{"q":"10","answer":"ACD"},{"q":"11","answer":"ABD"},
 {"q":"12","answer":"$- 4$"},{"q":"13","answer":"14"},
 {"q":"14","answer":"$\\left( {\\frac{8}{3},\\frac{7}{2}} \\right)$"},
 {"q":"15",...},{"q":"16","answer":""},{"q":"17",...},{"q":"18",...},{"q":"19",...}]}
```

脚本内已断言并通过：
- 19 道草稿，`questionNumber` 严格等于 `["1".."19"]`；
- `batch.status === "review"`；
- `snapshot.questions.length === 0`（正式库 0 条）；
- `page.reload()` 后 `drafts.length === 19`（刷新后仍在）；
- 源文件 sha256 前后不变。

与备份结果逐题 diff：**第 1–14 题答案完全一致**；唯一差异是第 18 题解析里的图片 id `docx_img_support_rId915_6_1792410922175` → `…1792411804612`（时间戳型 id，非内容差异）。solutionLength/images 全部一致。

### 结论

**通过（1–14 题答案无偏差）**。但有两个**任务要求之外**的新发现，必须单列：

1. **第 16 题答案为空且无任何 warning**：`answer=""`、`fieldProvenance.answer.status="missing"`、`warnings=[]`、`unmatchedAnswers` 也没有该题。真实源文件答案区第 16 题首段为
   `16．(1)血液中药物浓度与代谢时间是高度相关的，理由如下：`，随后是 `(2)…`，中间夹着 OLE 公式对象（本次按 `<w:p>` 抽取的顺序号为 244 的段落，含 `<w:object><v:shape … type="#_x0000_t75">`）。
   用合成 supportBlock 复现了置空机制：
   ```
   "16．(1)甲，理由如下：\n(2)乙，结果如下："      => answer="(1)甲…\n(2)乙…"
   "16．(1)甲，理由如下：\n[[IMAGE:eq1]]\n(2)乙"   => answer="(1)甲…\n[[IMAGE:eq1]]\n(2)乙"
   "16．(1)甲，理由如下：\n[DOCX不可显示图片:eqId1]\n(2)乙" => answers=[]
   ```
   即：多小问答案区只要包含 `[DOCX不可显示图片:…]`，`qisi-support-text-parser.js:313-319` 的 `multipart` 判定为假，且没有其它兜底分支，答案声明**整条消失**（不是留空证据、不是 conflict、不是 unmatched）。这与真实第 16 题的 OLE 公式位置吻合。属于**静默丢答案**；docx-boundary 已在追加复验中修复可见性（见第 9 节），答案仍不自动挂载。
2. 第 18 题解析中的图片 id 每次运行都变（`Date.now()` 派生），导致同一源文件两次导入的 `answer` 字符串不完全相等。若下游有基于字符串的幂等/去重，需要注意（本次未发现因此重复建题）。

---

## 2. B：新 PDF 链端到端（离线注入）

探针：`local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain.cjs`（新增文件，仅测试代码）
结果：`local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain.json` 与 `.log`
写法：`startBrowserApp` + `installMineruReplay`（`tests/e2e/browser-harness.js` + `tests/harness/mineru-replay.js`），浏览器层拦截 `/api/mineru/**`，无任何外网请求。

### B.1 上传→草稿→字段非空→sourceSha256

命令：

```bash
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain.cjs
```

`pdf-question.pdf` 1 页，注入 2 道题 + 1 张图 + 答案/解析。关键输出：

```json
"B1_basic": {
 "batchStatus":"review","questions":0,"parseCalls":1,
 "sourceShaMatchesFile":true,
 "sha":"184b8e41…1ea524",
 "detail":[
  {"q":"1","stemLength":3,"options":["甲","乙","丙","丁\n[[IMAGE:…]]\n图1"],
   "answer":"A","solutionLength":17,
   "pdfReviewSha":"184b8e41…","traceSha":"184b8e41…","answerProvenance":"rejected",
   "images":[{"position":"stem","sourceSha256":"184b8e41…","assetPath":"images/figure.png","urlPrefix":"data:image/png;base64,iVBORw0K"}]},
  {"q":"2","stemLength":3,"answer":"B","solutionLength":17,"pdfReviewSha":"184b8e41…"}
 ],
 "imageSourceIdsAllMatch":true,
 "pageErrors":[],"consoleErrors":[]
}
```

- 题干/选项/答案/解析均非空；每题 `pdfReview.sourceSha256` 与 `sourceTrace.sourceSha256` 均等于源文件 sha256。
- 取图请求实际为 `…/api/mineru/image?job=<sha>&sourceId=<sha>&name=images/figure.png`，`job`/`sourceId` 都是该文件自身 sha。
- `answerProvenance="rejected"` 是既有设计（PDF 视觉结果需人工采纳），不是失败。

**结论：通过。**

### B.2 支持文件同号但倒序声明

题目文件 1–3 题；答案文件答案按 `3,2,1` 倒序声明。关键输出：

```json
"B2_reversed_support": {
 "batchStatus":"review",
 "drafts":[
  {"q":"1","answer":"","solutionLength":0,"warnings":["…: number-not-increasing (2)","…: number-not-increasing (1)"]},
  {"q":"2","answer":"","solutionLength":0,"warnings":[同上]},
  {"q":"3","answer":"","solutionLength":0,"warnings":[同上]}
 ],
 "batchUnmatched":[
  {"code":"number-not-increasing","no":"2","after":"3","side":"support"},
  {"code":"number-not-increasing","no":"1","after":"2","side":"support"}
 ],
 "parseCalls":2
}
```

- **没有错挂到别的题**；3 道草稿答案全为空，`taskProblems` 每题都带 `number-not-increasing`，`batch.unmatchedAnswers` 保留了 2/1 两条具体原因。
- 代码机制：`qisi-paper-segmenter.js:151` 对非递增题号记 `number-not-increasing`；`assemble` 在 `issues.length !== 0` 时置 `admissible=false`，`qisi-paper-segmenter.js:276-277` 使 solutions map 为空，因此连合法的第 3 题答案也被一起清空（整份支持文件被拒，而不是只拒倒序的那两条）。
- 最小复现：两份 fixture（`pdf-question.pdf` / `pdf-answer.pdf`），答案 items 顺序改为 `3→2→1`，一次导入即可。结果固定为 3 题答案全空。

**判定：错挂 = 否；数据完整性 = 不通过（按业务口径）；但按当前宪法属"有意的 fail-closed"（已由 mineru-chain 确认）。**

补充确认（mineru-chain 回复）：`number-not-increasing` 进入 segment issues 后 `assemble` 的 `admissible=false`、solutions 整表清空，是既有的保守设计；宪法 §3 把 "Attach after jump-back" 列为 forbidden outcome，因此第 3 题即使自身顺序正确也不绑定。这不是漏挂/错挂，而是"缺答案可接受、错答案不可接受"。

仍应记录的缺口：① 业务上若答案卷确实允许 3→2→1，这是策略变更，需要 owner 改 segmenter/assemble 并同步宪法，不能由 producer 另写一套绑定规则；② 原报告指出"顺序正确的第 3 题答案为空但没有 unmatched 记录"。mineru-chain 已在 producer 侧补充**逐题证据**（见第 8 节追加复验），该缺口已修复；`batch.unmatchedAnswers` 仍保留段器原始的 2 条 `number-not-increasing`，第 3 题证据放在 `draft.pdfReview.taskProblems` / `draft.warnings`，避免两套 unmatched 语义。

### B.3 图片 `../x/1.png` 与跨源同名图片

浏览器侧实际发出的请求（含穿越名）：

```json
"browserImageQueries":[{"job":"184b8e41…","sourceId":"184b8e41…","name":"../x/1.png"}],
"browserImageQueryHasIdentity":[true]
```

真实本地服务端（`127.0.0.1`，非外网）直接探测 `/api/mineru/image`：

```json
"server":{
 "traversal":            {"status":400,"code":"MINERU_IMAGE_NAME_INVALID"},
 "nestedTraversal":      {"status":400,"code":"MINERU_IMAGE_NAME_INVALID"},
 "absolute":             {"status":400,"code":"MINERU_IMAGE_NAME_INVALID"},
 "backslash":            {"status":400,"code":"MINERU_IMAGE_NAME_INVALID"},
 "identityMismatch":     {"status":502,"code":"MINERU_ASSET_IDENTITY_REQUIRED"},
 "validIdentityNoReceipt":{"status":404,"code":"MINERU_JOB_NOT_FOUND"}
}
```

穿越名导致整批导入失败（`MINERU_IMAGE_NOT_FOUND` / 服务端 `MINERU_IMAGE_NAME_INVALID`），不会被接受。
跨源同名图片（题目与答案各有一份 `images/figure.png`、字节不同）：

```json
"B3b_cross_source_same_name":{
 "batchStatus":"review",
 "images":[
  {"position":"stem","sourceSha256":"184b8e41…","isRed":true,"isBlue":false},
  {"position":"solution","sourceSha256":"906cd821…","isRed":false,"isBlue":true}],
 "queryHitsOwnSource":[true,true]
}
```

- 取图入参始终带 `job` + `sourceId`，且 `job === sourceId === 该 block 所属文件的 sha256`（`qisi-pdf-mineru-producer.js:102-108` 用 `row.sha256` 组 URL）。
- 服务端在 `qisi-mineru-client.js:284` 先做名字校验（`..`、`.`、`\`、绝对路径、NUL 一律 `MINERU_IMAGE_NAME_INVALID`），再由 `qisi-mineru-task-service.js:187-191` 校验 `job===sourceId` 且 receipt 属于该 source，最后只在该 source 的 ZIP 内查名。
- **未发现串源路径**。

**结论：通过（fail-closed，且带 sourceId 身份绑定）。**

### B.4 页码越界（totalPages=1，返回 page=9）

注入 `page_idx: 8`（解析后 9 页）。关键输出：

```json
"B4_page_scope":{
 "batchStatus":"failed",
 "importError":{"code":"IMPORT_RECOGNITION_FAILED","causeCode":"PDF_MINERU_PAGE_SCOPE_INVALID",
                "stage":"pdf-mineru","retryability":"never"},
 "drafts":0,"questions":0,"pageErrors":[]}
```

- 校验点：`qisi-pdf-mineru-producer.js:57` 的 `result.pages.some(p => p.page > pages.totalPages)`。
- **fail-closed 成立**：0 草稿、0 正式题，批次 failed，原因是 `PDF_MINERU_PAGE_SCOPE_INVALID`。

**结论：通过。**

### B.5 连续两次"重新识别"

UI 层（replay）：

```json
"B5_rerecognize":{
 "firstParseCalls":1,"secondParseCalls":2,"parseCallDelta":1,
 "firstDrafts":1,"secondDrafts":1,"batches":1,"questions":0,"secondError":null}
```

- 第二次识别**没有重复建草稿/建批次**（draft 1→1，batch 1），但浏览器又向本地 `/api/mineru/parse` POST 了一次同样的字节（delta=1）。
- 原因：`qisi-production-import-route-policy.js:78-80` 的 `canReuseNormalUiCommittedRequest` 对 `producerMode === 'pdf'` 返回 `false`；`qisi-normal-ui-import-controller.js:51-58` 因此不复用 `idempotencyKey`，requestId 递增，生产者重新读文件、重新 POST。

上游是否复用（服务层，fetch 桩，零外网）：探针 `repro-mineru-reuse.cjs`。

```json
"first": {"calls":4,"urls":["POST https://stub.invalid/api/v4/file-urls/batch",
        "PUT https://upload.invalid/put",
        "GET https://stub.invalid/api/v4/extract-results/batch/batch-stub-1",
        "GET https://zip.invalid/a.zip"],"job":"184b8e41…","pages":1},
"second":{"calls":0,"urls":[],"job":"184b8e41…","projectionIdentical":true},
"differentBytes":{"calls":4,"result":"a42d2fc5…"}
```

- 第二次 `parse` 命中 `qisi-mineru-task-service.js:68-72` 的 `receipt.state === 'ready'` 分支，**0 次上游请求**，投影结果完全一致；换文件名仍复用；字节变化才新建任务（4 次上游调用）。
- 因此"复用已完成任务"在**上游**成立；"不重复上传同一份字节"在**浏览器→本地服务**这一层**不成立**（设计上每次重新识别都重传，靠本地 sha 缓存挡住上游）。如果验收口径是字面上的"字节只传一次"，该项应判不通过；如果口径是"MinerU 任务/上传不重复"，则通过。这里按后一种口径判**通过，但附带上述偏差**。

---

## 3. C：DOCX 支持边界反例（离线）

### C.0 既有探针

命令：

```bash
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/handoff-probes.cjs
```

复跑结果与 `handoff-probes.json` 一致：`backward`（2→1）只产出 q2 的解析、q1 丢失；`parenthesis`（(1)(1)(2)(2)）`numbers:[] / blocks:[]`。

### C.1 纯括号主标题卷子（新探针）

探针：`repro-docx-boundary.cjs`（新增），结果 `repro-docx-boundary.json`。

```json
"parenthesisOnly": {
 "drafts":[
  {"q":"1","stem":"题一","answer":"","solution":""},
  {"q":"2","stem":"题二","answer":"","solution":""},
  {"q":"3","stem":"题三","answer":"","solution":""}],
 "warnings":[],"unmatchedAnswers":[]
}
"parenthesisOnlyFullWidth": 同上（3 题）
```

- **不是整卷 0 题**：半角 `(1)` 和全角 `（1）` 都能被识别为主标题（`normalizeDocxText` 先做全半角归一，`qisi-batch-importer.js:184-200` 的括号正则命中；`current === null` 时 `isSubquestion` 为假，`qisi-batch-importer.js:485-492`）。
- 只有当括号题号**重复**时才整卷 0 题：

```json
"parenthesisRepeated": {
 "drafts":[],
 "warnings":["DOCX_QUESTION_BOUNDARY_AMBIGUOUS：括号题号层级不明确，原文已保留待审核。"],
 "unmatchedAnswers":[{"code":"DOCX_QUESTION_BOUNDARY_AMBIGUOUS",
   "rawText":"(1) 题一\n(1) 小问一\n(2) 小问二\n(2) 题二\n(1) 小问三", "rawXml":"…"}]
}
```

  `(1) 题一 / (1) 小问一 / (2) 小问二 / (2) 题二` 与既有用例 `(1) 第一大题 / (1) 第一小问 / (2) 第二小问 / (2) 第二大题`（`tests/audit-class-repair.test.js` 的括号用例）都是 0 题。

**判定：lead 给的精确反例（1/2/3 互不重复）通过，不属于"判死合法卷子"。但"括号主标题 + 括号小问"这种真实排版会整卷 0 题。**
这属于**合理 fail-closed**：同一 `(1)` 既可能是第 1 题也可能是第 1 小问，仅靠文本无法区分；代码保留了原文 `rawText/rawXml` 并给出明确 warning（`qisi-batch-importer.js:515-527`、`1105-1110`），没有静默丢文件（`draftImportFiles` 仍保留上传文件）。代价是用户必须整卷重做/改用普通题号，且 UI 是否把这条 warning 显示到用户面前**未验证**（只验证了 importer 返回值）。

### C.2 题答分离、答案区倒序（新探针）

两个探针：
- `repro-docx-boundary.cjs`：只跑 `parseDocxFile + parseSupportText`，观察 supportBlocks/answers；
- `repro-docx-answer-reverse-runner.cjs`（新增）：走真实 `createProductionImportRunner` + 真实 coordinator + 真实 VM importer，观察最终草稿与 `unmatchedAnswers`。

正序对照（3 题全部正确挂上）：

```json
"orderedAnswers":{"drafts":[
 {"q":"1","answer":"A","solution":"第一题解法","answerProvenance":"deterministic-source"},
 {"q":"2","answer":"B","solution":"第二题解法",...},
 {"q":"3","answer":"C","solution":"第三题解法",...}],
 "unmatchedAnswers":[]}
```

倒序答案（`3.【解析】… / 2.【解析】… / 1.【解析】…`，题号齐全、顺序合法倒置）：

```json
"reversedAnswers":{
 "drafts":[
  {"q":"1","answer":"","solution":"","answerProvenance":"missing","solutionProvenance":"missing","warnings":[]},
  {"q":"2","answer":"","solution":"","answerProvenance":"missing","solutionProvenance":"missing","warnings":[]},
  {"q":"3","answer":"C","solution":"第三题解法","answerProvenance":"deterministic-source"}],
 "unmatchedAnswers":[
  {"questionNumber":"2","boundaryStatus":"rejected","boundaryReason":"backward","text":"2.【答案】B\n【解析】第二题解法"},
  {"questionNumber":"1","boundaryStatus":"rejected","boundaryReason":"backward","text":"1.【答案】A\n【解析】第一题解法"}],
 "warnings":[]
}
```

两题版本 `1. 题一 / 2. 题二 / 答案 2→1`：q2 正确挂上，q1 进 unmatched（backward）。

- **没有错挂到别的题**：绑定靠题号，`byQuestion` 精确查找；倒序项被标 `backward` 后 `qisi-support-text-parser.js:301/348` 直接跳过，不会写入相邻题。
- **但会丢答案/解析**：q1/q2 的 answer+solution 均为空；`unmatchedAnswers` 有 `boundaryStatus: "rejected"` 记录。本次首轮复现时 draft 级 `warnings` 为空；docx-boundary 追加修复后已带 `DOCX_SUPPORT_BOUNDARY_REVIEW`（见第 9 节）。UI 展示路径 `app.js:2729` 使用 `x.value`，追加复验确认 unmatched 已带 `value`；**仍未做像素级验证**。
- 机制：`qisi-batch-importer.js:1004-1010` 用 `index < nextIndex` 判 `backward`，并置 `sequenceRejected`，后续所有支持块继续被拒；`qisi-support-text-parser.js:348` 的 `if (rejected && !existing?.declarations?.length) continue` 决定"只有这一条证据时不产出 field"。

**判定：fail-closed、不会错挂；但对"合法倒序答案卷"是数据丢失（需人工从 unmatched 里恢复）。** 建议：`backward` 不应等于 `rejected`——只要有明确题号且题号在 expected 集合内，至少应产出证据并标记 `review`，而不是丢弃。

---

## 4. 通过/失败汇总

| 项 | 结论 | 说明 |
|---|---|---|
| A 真实 DOCX 19 题/题号/状态/正式库 0/刷新保留 | **通过** | 脚本退出 0，断言全过 |
| A 第 1–14 题答案 | **通过** | 与备份逐题一致；仅 q18 图片 id 时间戳变化 |
| A 第 16 题答案 | **可见性已修；仍不自动挂载** | 首轮：空答案 + 无 warning；追加复验：draft warning + unmatched 带 value（第 9 节），答案仍留空待人工 |
| B.1 PDF 端到端字段/sourceSha256 | **通过** | 2 题字段非空，sha 全等 |
| B.2 倒序支持文件 | **不通过（业务完整性）；按宪法为有意 fail-closed** | 不错挂，但 3 题答案全空；追加复验：3 题均有逐题 taskProblems/warnings（第 3 题不再是静默空）；策略变更需 owner 决定 |
| B.3 图片穿越/跨源 | **通过** | 400 拒绝；sourceId 绑定正确，无串源 |
| B.4 页码越界 | **通过** | `PDF_MINERU_PAGE_SCOPE_INVALID` fail-closed，0 草稿 |
| B.5 二次识别复用 | **有条件通过** | 上游 0 次重复提交；本地仍重传字节（与"不重复上传字节"字面不符） |
| C.1 纯括号 (1)/(2)/(3) | **通过** | 3 题正常；重复括号=0 题，属合理 fail-closed |
| C.2 倒序答案卷 | **可见性已修；仍 fail-closed（丢答案）** | 不错挂，q1/q2 答案+解析仍空；追加复验：draft warning + unmatched 带 value（第 9 节） |

---

## 5. 新发现的反例（本次主动构造）

1. **DOCX 多小问答案区含不可显示公式 → 答案整条消失**（真实卷第 16 题命中）。`qisi-support-text-parser.js:312-320` 的 `multipart` 条件包含 `!/\[DOCX不可显示图片:/.test(answerArea)`，一旦命中就落到"无答案"分支，不产生 declaration、不产生 conflict、不产生 warning。
2. **DOCX 支持块"倒序但题号齐全"被判 `backward` 并整块丢弃**（`qisi-batch-importer.js:1007` + `qisi-support-text-parser.js:348`）。合法倒序答案卷 q1/q2 答案+解析丢失；正序同内容则全部正确。
3. **PDF 支持文件倒序声明 → 连正确题号的答案也一起清空**。因为 `number-not-increasing` 让整个 `assemble` 的 `admissible=false`（`qisi-paper-segmenter.js:276-277`），不是只拒倒序项。
4. **括号主标题 + 括号小问 → 整卷 0 题**（`(1)题一/(1)小问/(2)小问/(2)题二`）。有 warning + 原文保留，但没有部分产出（不是"保留可识别题 + 标记歧义题"）。
5. **PDF 二次识别仍重传字节到本地**：`canReuseNormalUiCommittedRequest` 对 pdf 恒 false，`/api/mineru/parse` 调用数 1→2；上游任务不重复。若把"不重复上传字节"作为硬性验收，此项不达标。

---

## 6. 我认为最危险的 3 个问题（按"错挂答案 / 丢题 / 白屏"排序）

1. **会不会错挂答案**：本次**未发现错挂**。DOCX 与 PDF 都按显式题号绑定；倒序/冲突路径全部 fail-closed。最接近风险的是 B.2（PDF 倒序支持文件），但结果是"全空 + taskProblems"，不会把 B 的答案写到 A 题。
2. **会不会丢题/丢答案（最现实的风险）**：
   - 真实卷 q16 答案仍为空（可见性已修：draft warning + unmatched value，见第 9 节；但答案不自动挂载，必须人工补）。**最需要盯的是"老师是否真的会看 warning"**。
   - DOCX 倒序答案卷 q1/q2 答案+解析仍丢失（追加复验后 draft warnings 有 `DOCX_SUPPORT_BOUNDARY_REVIEW`，unmatched 带 value，不再静默）；PDF 倒序支持文件则 3 题答案全空（已确认是宪法 §3 的保守设计，不是错挂；追加复验后 3 题都有逐题提示）。这两条对"合法倒序答案卷"仍是数据丢失，是否放开需 team-lead/用户定策略。
   - 括号重复卷整卷 0 题（有 warning + 原文，但等于整卷返工）。
3. **会不会白屏**：**未发现**。B 全部场景 `pageErrors=[]`；失败场景（B3 穿越图、B4 越界页）都是批次 failed + toast/日志，页面未崩。需要说明：我只验证了 DB 状态与 `pageerror/console`，**没有做像素级 UI 核对**，因此"页面视觉正常"未验证。

---

## 7. 复现命令清单

```bash
# A（真跑，约 10s）
NODE_OPTIONS= node local-run-artifacts/sol-repair-2026-10-19/real-docx.cjs

# B（离线注入，5 个场景，约 40s）
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain.cjs
# B.5 上游复用（fetch 桩，零网络）
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-mineru-reuse.cjs

# C
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/handoff-probes.cjs
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-docx-boundary.cjs
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-docx-answer-reverse-runner.cjs
```

产物：
- `local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain.json` / `.log`
- `local-run-artifacts/diagnose-2026-10-19/repro-mineru-reuse.json`
- `local-run-artifacts/diagnose-2026-10-19/repro-docx-boundary.json`
- `local-run-artifacts/diagnose-2026-10-19/repro-docx-answer-reverse-runner.json`
- `local-run-artifacts/diagnose-2026-10-19/repro-real-docx-result-prior.json`（A 运行前备份）
- `local-run-artifacts/sol-repair-2026-10-19/real-docx-result.json` / `real-docx-snapshot.json` / `real-docx-review.png`（A 脚本本次输出）

---

## 8. 追加复验（mineru-chain 补充逐题证据之后）

触发：mineru-chain 根据本报告第 2 节 B.2 的提醒修改了 `qisi-pdf-mineru-producer.js`（新增逐题 `taskProblems`/`warnings`），并新增单测。独立复验不采信"测试 39/39"的结论，重新跑本报告自己的离线探针。

改动后文件哈希：`qisi-pdf-mineru-producer.js` = `4174d117d931d6daa251bf5e073f5ca2101a7de469d2744ae30f7b3e8d13ce01`（验证时）。

命令与结果：

```bash
NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain.cjs
# 输出：local-run-artifacts/diagnose-2026-10-19/repro-pdf-chain-after-fix.log
```

B.2（倒序支持文件）三题草稿的 `warnings`/`pdfReview.taskProblems` 现在都包含：

```
第1题答案未绑定：支持文件序列未通过整体校验（number-not-increasing），请对照原页确认。
第2题答案未绑定：支持文件序列未通过整体校验（number-not-increasing），请对照原页确认。
第3题答案未绑定：支持文件序列未通过整体校验（number-not-increasing），请对照原页确认。
```

`batch.unmatchedAnswers` 仍为 2 条（`no:2 after:3`、`no:1 after:2`），未新增第三套语义。**"第 3 题静默空"已修复。**

回归检查（同一轮探针，全部通过）：
- B.1：2 题 answer=A/B、solution 17 字，`pdfReviewSha === traceSha === 文件 sha`，取图 sourceId 正确；
- B.3：穿越图仍失败于 `MINERU_IMAGE_NOT_FOUND`，真实服务端仍 400 `MINERU_IMAGE_NAME_INVALID`；
- B.3b：跨源同名图仍分别取到 red/blue，无串源；
- B.4：page=9 仍 `PDF_MINERU_PAGE_SCOPE_INVALID`、0 草稿（新增的 `pages.totalPages` 合同校验未破坏该结论）；
- B.5：parse 调用仍 1→2，草稿/批次不重复，上游缓存结论不变；
- 所有场景 `pageErrors=[]`。

结论：**修复有效，未发现回归；B.2 的策略定性不变（仍是有意的 fail-closed），但提示强度问题已解决。**

---

## 9. 追加复验（docx-boundary 修复可见性之后）

触发：docx-boundary 按本报告 A-q16 与 C.2 的"静默"问题补充了可见性。独立复验仍不采信其测试数字，重跑本报告自己的三类证据。

改动后文件哈希（验证时）：
- `qisi-support-text-parser.js` = `8edd45328f1bb704096a72737839328b05693c478d89975fb93c37ea0940fb6b`
- `qisi-batch-importer.js` = `4d854ff6cc3ab3e056494034c97fc6b4ad3ee27548baac2e6e7de859c4d3de01`

### 9.1 合成 q16：答案不挂载，但 evidence 不再消失

```bash
NODE_OPTIONS= node -e '…parseAnswerAndSolutionItemsFromText(含 [DOCX不可显示图片:公式:rId703] 的 supportBlock)…'
```

输出：

```json
{"answers":[],
 "unmatched":[{"questionNumber":"16","field":"answer",
  "value":"(1)甲，理由如下：\n[DOCX不可显示图片:公式:rId703]\n(2)乙，结果如下：",
  "code":"DOCX_SUPPORT_ANSWER_UNCONVERTED_FORMULA",
  "unresolvedReason":"multipart-unconverted-formula"}],
 "conflicts":[]}
```

与修复前 `answers=[] / unmatched=[]` 相比：**答案仍不挂载（符合"不拿未转换公式冒充完整答案"），但证据/原因已保留。**

### 9.2 倒序 runner：不再静默

`NODE_OPTIONS= node local-run-artifacts/diagnose-2026-10-19/repro-docx-answer-reverse-runner.cjs`

```json
"reversedAnswers":{
 "drafts":[
  {"q":"1","answer":"","solution":"","warnings":["DOCX_SUPPORT_BOUNDARY_REVIEW：第 1 题支持区存在倒序边界，相关声明已保留原文待审核。"]},
  {"q":"2","answer":"","solution":"","warnings":["DOCX_SUPPORT_BOUNDARY_REVIEW：第 2 题支持区存在倒序边界，相关声明已保留原文待审核。"]},
  {"q":"3","answer":"C","solution":"第三题解法","warnings":[]}],
 "unmatchedAnswers":[
  {"questionNumber":"2","boundaryStatus":"rejected","boundaryReason":"backward","value":"2.【答案】B\n【解析】第二题解法"},
  {"questionNumber":"1","boundaryStatus":"rejected","boundaryReason":"backward","value":"1.【答案】A\n【解析】第一题解法"}]}
```

正序对照 `orderedAnswers` 仍为 3 题全对、unmatched 为空（无回归）。`app.js:2729` 的展示使用 `x.value`，现在不会渲染成空行。

### 9.3 真实整卷：q16 在真实数据上同样可见

重跑：

```bash
NODE_OPTIONS= node local-run-artifacts/sol-repair-2026-10-19/real-docx.cjs
```

（运行前把上一轮结果备份为 `repro-real-docx-result-before-docxfix.json`。）脚本仍退出 0：19 题、review、正式库 0、reload 后 19 条。`real-docx-snapshot.json` 中：

```json
"q16": {"answer":"","provenance":"missing","solutionLength":414,
 "warnings":["DOCX_SUPPORT_UNCONVERTED_FORMULA：第 16 题支持区含未转换公式占位符，答案/解析需人工确认。"]}
```

`batch.unmatchedAnswers` 新增一条 q16：

```json
{"questionNumber":"16","field":"answer","blockId":"support-p242","boundaryStatus":"accepted",
 "code":"DOCX_SUPPORT_ANSWER_UNCONVERTED_FORMULA","value":"(1)血液中药物浓度与代谢时间是高度相关的,理由如下:…[DOCX不可显示图片:公式:rId703]…"}
```

第 1–14 题答案与修复前完全一致；q16 答案仍为空（产品选择：不自动挂载）。

结论：**两条“静默”问题均已修复为可见证据；自动挂载策略未变（宪法/交接口径），是否放宽仍需 lead/用户决定。未发现回归。**
