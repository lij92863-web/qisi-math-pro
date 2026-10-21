# 交接审计与续做结果（2026-10-19 第二棒）

对象：`ai/SOL_COMPLETE_HANDOFF_ROOT_CAUSE_AND_REPAIR_2026-10-19.md`（下称"交接文档"）。
本文件记录：交接后已有什么、哪些没做、做了什么、验证到什么程度，以及仍未闭环的部分。
所有数字来自本机实测，命令与日志路径都写在正文里；没有 commit、没有 push、没有真实外呼。

---

## 0. 一句话结论

- **交接文档里 S0–S5 的主体工作，在这次接手前已经由一个 AI 做了大约七成**：PDF 已经真的换成本地 MinerU，旧 Qwen 执行链已从页面卸载，架构登记也补了大部分。
- 但它留下了**三处会直接伤到用户的问题**：①三文件 PDF 组合的"拒绝"被悄悄放宽；②MinerU 草稿绕过 PDF 复核门禁；③**运行中的旧服务进程会让页面白屏**（新增脚本被 404）。
- 这三处已修，另有 8 项登记/测试/诊断问题已修；`npm run verify:safe` 现在是 **2043/2043 通过、exit 0**（交接文档记录的是 2010/2011；我接手后第一次全量是 2039 项、2027 通过、**12 红**）。
- **没有做真实外网整卷验收**（需授权）。旧 PDF 执行文件仍在磁盘上，退役只完成到"页面不加载 + 登记降级"。

---

## 1. 交接文档 S0–S7 逐项状态

| 阶段 | 交接要求 | 接手时状态 | 本次处理 | 现在状态 |
|---|---|---|---|---|
| S0 接管与冻结基线 | 保存 status/diff/hash，修 R15，建可比基线 | 有 `local-run-artifacts/sol-repair-2026-10-19/baseline/` 快照与日志 | 复核基线、记录接手时的 12 个红项 | **完成** |
| S1 固化反例与错误可观测性 | R03/R04/R05 进正式回归；错误结构统一 | `tests/audit-class-repair.test.js` 已含 4 条反例测试，27/27 通过 | 复核并追加边界测试（DOCX 支持边界 8 条） | **完成**（错误结构仍只部分） |
| S2 DOCX 边界所有权 | 倒序/重复不吞并、不二次猜题号、歧义显式 | 已实现"块内不造新题号、单条声明不判冲突" | 复核 + 补 8 条回归；真实佛山卷复验 19 题 | **完成**（跨源冲突仍缺，见 §5） |
| S3 PDF canonical 边界与旧记录适配 | 新 route 不伪装旧 route；历史可读 | 新增 `qisi-pdf-review-records.js`（记录层）+ `qisi-pdf-mineru-contract.js` | 复核；发现与旧契约**重复实现 5 个函数**（未合并，见 §5） | **基本完成** |
| S4 MinerU 任务/资产闭环 | job 身份、端到端超时、回执、图片落盘 | 已做：sha 绑定 job、磁盘 receipt + ZIP、deadline、明确拒绝分类 | 复核结论见 `ai/` 中 mineru-chain 报告；补了 3 类测试 | **基本完成**（3 个生命周期残留，见 §5） |
| S5 生产适配 + 页面切换 + 旧链退役 | 正常 PDF 只剩一个入口；旧执行代码清掉 | 生产适配与页面切换**已完成**；旧文件仍在，登记仍写"生产在用" | 修 3 处登记失真、迁移 3 个锁旧链的测试、退役旧链 e2e | **切换完成，退役一半** |
| S6 真实材料与视觉验收 | 真实 PDF 走正常 UI + 逐页视觉 | 未做（无授权） | 只做了真实 DOCX 离线复验 | **未做（需授权）** |
| S7 最终复审与交付 | 独立复审、输出关闭清单 | 未做 | 两个独立复审员正在跑（结果见 §6） | **进行中** |

---

## 2. 接手时真正红在哪里（12 项）

接手后第一次全量门禁：**2039 项，2027 通过 / 12 失败**。逐项归因：

| 失败项 | 真实原因 | 性质 |
|---|---|---|
| 8 项 `tests/e2e/pdf-external-chain.test.js` | 全部在测已退役的 Qwen 协议（`Config.pdfExternal`、wire v2.2、receipt、model review） | 随协议退役 |
| 2 项 `tests/e2e/true-import-admission.test.js` | 断言 `controlled-write` 字段状态，新链路不再产生该状态 | 语义过期 |
| 1 项 `production-mineru-import.test.js` | 采用候选后状态语义变了（需二次确认） | 新链自己的测试未跟上 |
| 1 项 `app-shell-baseline.test.js` | **页面白屏**（见 §3.1） | 真实产品缺陷 |

另外 `node scripts/verify-pdf-known-bad.js` 当时是 **60/63**（3 红），`verify-app-shell-architecture.js` 是 **BLOCKED**（9 个函数行号漂移）。这两项不在 `verify:safe` 链路内，容易被漏掉。

---

## 3. 本次修的真实问题

### 3.1 P0：运行中的旧服务会让页面白屏（用户可感知）

`qisi-local-server.js` 有一条静态白名单：启动时读一次 `main.html`，把里面引用的文件做成允许清单，不在清单里的路径一律 404。

于是：**页面新增任何 `<script>` 之后，只要本地服务还是改代码之前启动的那个进程，这 5 个新模块就全部 404，Vue 挂不上，页面一片空白，且没有任何中文提示。**

实测证据（修复前，端口 3000）：`qisi-mineru-evidence.js`、`qisi-paper-segmenter.js`、`qisi-pdf-review-records.js`、`qisi-pdf-mineru-contract.js`、`qisi-pdf-mineru-producer.js` 全部 404，`#app` 内容为空；同一份代码用新起的进程访问则完全正常。

修复：白名单改为按 `main.html` 的 mtime 重读（`qisi-local-server.js:224-243`），语义仍是"只放行页面真正引用的资源"。修复后同一路径全部 200，页面正常挂载，基线测试从"30 秒超时失败"变为 1.6 秒通过。

> 对用户的意义：以后改完代码，**不需要记得手动重启**；如果哪天又白屏，先看本地服务是不是老进程。

### 3.2 P0：PDF 组合规则（我改错了一次，又被交叉验证纠正）

一开始我按交接文档把"试卷 + 答案 + 解析各一个 PDF"恢复为**拒绝**（交接文档写的是"3 文件被拒"）。
但两个独立执行的子任务都说这是新链的**故意能力**：新生产端按 UI 里声明的角色分别取答案源与解析源，`mineru-task-lifecycle` 测试里已经有一条"两个分离来源都能贡献"的用例。

最终规则（`qisi-production-import-route-policy.js:128-145`）：

- 题目源必须**恰好 1 个**；
- 答案源 ≤ 1、解析源 ≤ 1（两个源抢同一角色 → 拒绝，`pdf-support-source-ambiguous`）；
- 1 题目 + 1 答案 + 1 解析 **允许**，且只能调用生产端一次。

两个方向都有测试：`tests/production-import-bridge.test.js`（两个 answer、两个 solution、两个 question 三组反例 + 一组正例）和 `tests/production-import-route-policy.test.js`（同规则）。

> 记录这次反复的原因：交接文档的"3 文件被拒"描述的是**旧链**能力；新链按角色分工后该限制不再成立。这正是"不要照文档打补丁"的反面教材——文档是某一时刻的事实，不是不变量。

### 3.3 P1：MinerU 草稿绕过 PDF 复核门禁

复核前的字段校验只认识 `pdf-external-v2` / `pdf-multimodal-v1`；新 `pdf-mineru-v1` 两头都不匹配，于是**掉进 DOCX 的通用校验分支**——那套校验不看"未归属内容 / 题型待确认 / 图片未确认"，等于新链的审核关卡失效。

修复：`qisi-review-draft-normalization-policy.js` 增加 `pdfRecordContract(q)`，按草稿自己的协议找契约（12-18 行），三处调用点统一走它。新增 `tests/review-normalization-pdf-protocol.test.js`（3 项）证明：带未归属内容的 MinerU 草稿会返回"请先对照来源并确认本题范围"，且不会被 DOCX 清洗改写。

### 3.4 P1：三处架构登记与现实不符

| 失真 | 后果 | 修复 |
|---|---|---|
| `pdf-external-producer/provider/page-evidence` 仍登记 `production-wired` | 任何人（含 AI）读清单会以为旧链还在跑 | 两套清单同步降级为 `deprecated`，且测试断言"页面不得加载它们" |
| `qisi-mineru-client.js` 没有 owner 条目，却被三个模块写成调用方 | 所有者闭包测试红 | 补 owner + 层归属，改用"server require 链可达"判定 |
| `pdf-mineru-producer` 的 `allowedDependencies` 是空数组 | 清单声称它不依赖任何东西 | 补真实依赖（contract / review-records / identity-contract） |

### 3.5 P1：两处锁定旧链的测试（迁移而非删除）

- `tests/pdf-projection-single-owner.test.js`：原本要求 `app.js` 里出现 `PdfExternalProducer.createProducer`。现在改为锁"MinerU 是唯一 PDF 生产者"，并新增"四个旧执行模块不得被页面加载"。
- `tests/qisi-app-display-cleaners-r3-ownership-audit.test.js`：同一类断言，同步改为锁 MinerU。

### 3.6 P1：取消场景的假红（测试自身的时序缺陷）

`tests/e2e/production-normal-ui-import-cutover.test.js` 的取消场景原本"手动再调一次识别"再取消。但 App 本身在创建批次后 80ms 会自动启动识别；取消掉手动的那个之后，80ms 定时器又起了**第二个**识别，于是取消后仍落了 1 条草稿。

证据：阶段日志里出现两条 `started`，第一条 `cancelled`，第二条一路走到 `review-drafts-persisted`。

修复：删掉测试里多余的手动调用，改走真实路径（UI 自动启动 → 取消），并把失败信息补成带批次状态/调用/阶段的可诊断输出。17 场景矩阵修复后连续 2 次通过。

### 3.7 P2：counterfactual 场景绑在退役协议上

场景 17 原本靠"打坏旧 Qwen 契约"制造失败，新链路根本不用旧契约，于是导入成功、断言失败。修复：把同一条故障注入（契约校验抛错）也指向**当前**使用的 MinerU 契约——断言的性质没变（契约不成立必须整批失败、0 草稿、0 入库），只是对象换成了活着的那个。

### 3.8 P2：公式失败原因在顶层丢失

第 16 题两个 MTEF 未转换时，原生服务给出的失败码只藏在 `nativeEvidence` 里，顶层 `code` 只有本地 reader 的码。修复：顶层新增 `nativeCode`，两边的码互不覆盖（`qisi-docx-formula-source.js:115-125`）。`tests/docx-formula-source.test.js` 7/7。

### 3.9 旧链 e2e 退役（有备份、有迁移）

`tests/e2e/pdf-external-chain.test.js`（7 项，全部在测 Qwen 协议内部）已退役，备份在 `local-run-artifacts/sol-repair-2026-10-19/retired-pdf-external-chain.test.js.bak`。其中两条**与协议无关**的保证被迁到 `tests/e2e/pdf-import-ui-guarantees.test.js`：

1. 引擎未配置时，批次必须失败、0 草稿、0 外部请求、0 入库，原因码为 `MINERU_NOT_CONFIGURED`；
2. 两个真实浏览器页面不能同时重跑同一批次（跨窗口锁），且已完成的任务会被复用、不重复上传。

另：`tests/e2e/true-import-admission.test.js` 两个测试改为新语义——**人工编辑只把该字段变成 `manual`，其余未采用的机器字段保持 `rejected`，整题不得入库**。

---

### 3.10 独立复审带来的最后一组修复

1. **未转换公式导致答案整条消失**（真实佛山卷 16 题）：改为保留为审核证据，同时进草稿 `warnings` 与批次未归属列表。
2. **倒序答案区两侧静默丢失**：被拒绝/未知的边界块现在带 `sourceId` 与原文范围留在未归属证据里，且单个倒序边界不再让整批失败。
3. **MinerU 契约的依赖与层属登记**：`pdf-mineru-contract` 补上 `pdf-review-records` 依赖并把 docs 侧层号对齐到 0；`qisi-mineru-evidence.js`、`qisi-paper-segmenter.js` 补进三套清单（此前只有 runtime 清单有它们，另外两套完全缺失）。
4. **图片归属的反例已被固定成测试**：选项后配图的错位问题不再只是"已知风险"，而是有断言盯着（修复方案仍待做）。

以上改动后重跑完整门禁：**2043/2043 通过**（`verify-safe-final3.log`），比上一版多 2 项新测试。

---

## 4. 验证结果（全部本机实测）

| 项 | 命令 | 结果 |
|---|---|---|
| 完整安全门禁 | `npm run verify:safe` | **2043/2043 通过，exit 0**（日志 `local-run-artifacts/sol-repair-2026-10-19/verify-safe-final3.log`；含本轮全部改动） |
| PDF 已知错误门禁 | `node scripts/verify-pdf-known-bad.js` | **63/63 通过**（接手时 60/63） |
| DOCX 稳定链门禁 | `node scripts/verify-docx-stable.js` | 8/8 通过 |
| 运行时模块清单 | `node scripts/verify-runtime-modules.js` | `{"valid":true,"errors":[]}` |
| 应用外壳架构 | `node scripts/verify-app-shell-architecture.js` | `ACCEPTED`（接手时 BLOCKED，9 处行号漂移；已按实际行号更新矩阵，函数 AST 哈希未变） |
| 零真实外呼 | `node scripts/verify-no-real-ai.js` | passed |
| 真实佛山 DOCX 整卷 | `node local-run-artifacts/sol-repair-2026-10-19/real-docx.cjs` | 19 题、1–19 连续、状态 review、正式库 0 条、刷新后仍在、源文件哈希未变；1–14 答案与交接记录一致（D,A,B,C,C,D,D,A,AD,ACD,ABD,-4,14,区间）；第 16 题答案仍为空（两个 MTEF 未转换，安全留空） |
| 17 场景生产矩阵 | `node --test tests/e2e/production-normal-ui-import-cutover.test.js` | 修复后连续 2 次通过 |
| MinerU 端到端 | `node --test tests/e2e/production-mineru-import.test.js` | 2/2 |

---

## 5. 仍然存在的风险（按"会不会错挂答案"排序）

### 5.1 P1 图片按读序归位，可能贴到最后一个选项

MinerU 块的图片如果排在选项行之后，会被切分逻辑归到最后一个选项文本里，而 `image.position` 仍写 `stem`。真实"选项后配图"的卷子会错位。正确做法是用图块 bbox 与选项行的几何关系判定，信息不足就留"未归属图"让老师绑定。

### 5.2 P1 整卷序列不连续 → 整批不产出

任一缺号/重号/倒序都会让整份试卷抛 `PDF_MINERU_QUESTION_SEQUENCE_INVALID`，**不产出可靠前缀**，错误里也不带具体题号。DOCX 侧的策略是"可靠前缀 + 未归属区段进审核"，PDF 侧目前不是。

### 5.3 P1 任务生命周期三个残留

①`prepared` 阶段进程崩掉会留下永久 `MINERU_TASK_BUSY`；②`SUBMISSION_UNKNOWN` 没有恢复查询路径，只能手工删 `local-run-artifacts/mineru-extractions-v2/<sha>.json`；③同一文件并发解析会共享第一个调用者的取消信号。

### 5.4 P1 审核需要逐字段采用，不是"一键确认"

MinerU 草稿的字段初始都是 `rejected`（沿用旧语义），必须逐个"采用题目 / 采用答案 / 采用解析"，有图还要确认图片，有未归属内容还要勾"已对照原页"，否则 `markDraftReviewed` 与入库都会被挡。安全，但一份 22 题的卷子要 60+ 次点击。这是**产品决策**，需要你拍板：保持"逐字段人工背锅"，还是加一个"整题采用候选"的按钮（仍保留未归属内容必须确认）。

### 5.5 P2 新旧契约重复实现

`qisi-pdf-review-records.js`（241 行，5 个函数）与 `qisi-pdf-external-contract.js`（664 行）里同名函数各有一份：`reviewPanel / reviewProblem / retainReviewDrafts / editorSource / validateCanonical`。目前两份还能对上，但以后改一处忘另一处就会出现"历史草稿与新建草稿审核口径不同"。建议让旧契约改为委托 `createRecordContract('pdf-external-v2','pdfReview')`。

### 5.6 P2 协议判断散落在 10 处

`pdf-mineru-v1 ? ... : pdf-external-v2 ? ... : ...` 在 bridge（5 处）、output port（2 处）、formal admission（2 处）、app.js（1 处）里各写一遍。加第三种协议会牵动 10 个地方——这正是交接文档 §6.6 要求避免的。

### 5.7 P2 旧文件仍在磁盘

`qisi-pdf-external-producer.js`、`qisi-pdf-external-provider.js`、`qisi-pdf-page-evidence.js`、`qisi-pdf-multimodal-producer.js` 已不被页面加载、登记已降级，但文件与 6 个只测旧协议的单元测试还在。彻底删除需要同步改两套登记与测试，属独立一步（风险：删了没改登记会启动失败）。

### 5.8 P2 文件状态与证据不一致

`app.js:1903` 的 `parseStatus` 只看 `errors`，MinerU 的未归属内容在 `unmatched/unassigned` 里，所以**有未归属内容的文件仍显示 `success`**。证据列表能看到，但状态语义不一致。

### 5.9 未做：真实外网整卷与视觉验收

`.env` 里 `MINERU_TOKEN` 是有的（51 字符），但本次**没有**调用 mineru.net。要真正回答"深圳/河北整卷准不准、公式和图表有没有漏"，必须走一次真实上传，逐页对照。这一步需要你明确同意（涉及外发与可能的额度）。

### 5.10 静默丢答案：可见性已修，归属策略未放宽

独立复审用真实佛山卷与自造反例发现两个"没提示地没了"的场景，比错挂更隐蔽：

1. **佛山卷 16 题**：答案区含未转换公式占位 `[DOCX不可显示图片:公式:rId…]`，`qisi-support-text-parser.js` 的小问判定因此为 false，整条答案声明被丢弃 → 草稿答案为空、`status=missing`，却没有 warning、没有 conflict、`unmatchedAnswers` 也是空。
2. **合法的倒序答案区**（题目 1–3，答案区按 3→2→1）：DOCX 侧 `q1`/`q2` 的答案与解析静默丢失（只在批次级 `unmatchedAnswers` 标 `backward`，草稿级 `warnings` 为空）；PDF 侧同一份答案文件正序能全绑定、倒序则整卷答案全空且 0 冲突。

本轮修的部分（`tests/docx-support-boundary-regression.test.js` 四条）：

- 未转换公式不再让整条答案"消失"，而是作为审核证据保留，并同时出现在草稿 `warnings` 与批次未归属列表；
- 被拒绝/未知的边界块带着 `sourceId`/`range` 留在未归属证据里，不再只剩一个 `backward` 词；
- 一个倒序边界不会让整批失败，仍然可审核。

**没修的部分**：归属策略没放宽——倒序仍然不自动绑定，只是现在"拒绝"是可见的。
正确规则（下一步）：答案区是**显式编号**时，编号本身足以确定归属，倒序不等于歧义；应"按题号绑定已声明字段，未声明的题保留空值+证据，只对重复 / 未知 / 超出题目范围拒绝"，前提是先保证未归属内容可见（这一条已经具备）。

---

## 6. 独立复审结果（如实记录）

- **独立复现（reviewer-repro）：完成**。报告在 `ai/INDEPENDENT_REPRO_2026-10-19.md`，共 9 节。它不信任任何人自报的数字，自己重跑了真实佛山卷、离线注入的新 PDF 链、以及自造的反例（倒序支持文件、跨源同名图片、越界页码、纯括号/倒序 DOCX），并**复验了后来所有修复**（取消窗口、q16 可见性、倒序可见性、图片穿越拒绝）。它发现的关键问题（q16 静默丢答案、倒序答案区静默丢失）都已转成修复并经它复核确认。
- **对立审查（reviewer-diff）：未完成**。跑了 16 分钟后因**账号级模型用量超限（429）**中断，额度到 **2026-10-20 19:39** 才重置。它没有产出报告，本文不复述任何它"本应给出"的结论。
- 作为部分补偿，主控自己做了**断言削弱自查**（对照 HEAD 逐个检查今天改过/删过的测试）：

| 测试改动 | 判定 |
|---|---|
| `production-normal-ui-import-cutover` 取消场景删掉一次手动识别调用 | **合理**。那次调用与页面自身的 80ms 自动启动竞争，会制造"第二个识别"，让取消后仍落库；删除后测的是真实用户路径（UI 自动启动 → 取消），且失败信息变详细了 |
| 场景 17 改名并把故障注入指向 MinerU 契约 | **加强**。断言性质没变（契约失效必须整批失败、0 草稿），只是对象从死协议换成了活协议 |
| `true-import-admission` 两个测试改为"未采用字段不得入库" | **更严**。旧断言验证的是机器自动接受（controlled-write）；新断言验证"没有人工背书的字段进不了题库"，成功入库路径由 `production-mineru-import` e2e 覆盖 |
| `pdf-external-chain.test.js` 整文件退役 | **随协议退役**，备份保留；其中与协议无关的两条保证（未配置零外呼、跨窗口锁）迁到 `pdf-import-ui-guarantees.test.js` |
| `pdf-projection-single-owner` / `app-display-cleaners` 改锁新 owner | **加强**。新增"四个旧执行模块不得被页面加载"的断言 |
| `c2-13` 的 server 直连 require 改为"require 链可达" | **放宽一格、换个不变量**。原断言会把"server 通过 mineru-client 间接使用 task-service"判死；新断言仍要求 node 生产模块必须从 server 可达，孤儿模块照样红 |
| 路由策略恢复"1 题目 + ≤1 答案 + ≤1 解析"并补正反例 | **先错后改**（详见 §3.2）。最终版本两个方向都有测试，不是单方面放宽 |

如果你希望明天额度恢复后补一份真正的对立审查，直接说一声，`ai/INDEPENDENT_REVIEW_2026-10-19.md` 那份报告可以再跑。

---

## 7. 建议的下一步（按收益/风险排序）

1. **先做一次真实 PDF 整卷**（需授权）：这一步的产出比再改十处代码都有用。
2. **定审核交互**（§5.4）：加"整题采用候选"，否则你可能录到第 5 题就烦了。
3. **修图片归属**（§5.1）与**整卷序列的 partial 策略**（§5.2）：这两个直接决定"会不会错挂/丢题"。
4. 再谈旧文件删除（§5.7）与协议集中化（§5.6）——它们不影响今天能不能用。
5. 数据安全提醒（与本次改动无关但一直成立）：题库在浏览器本地，**清缓存/换浏览器/换端口就会"看不见"**；自动备份只在手动选过目录且本次打开期间生效。

---

## 8. 没动的东西（免责）

- 没有 commit / push / reset / stash；没有改 `.env`、密钥、`node_modules`、锁文件；没有写生产 IndexedDB；没有调用真实 AI/OCR/MinerU。
- 新增的 15 个未跟踪文件已 `git add`（只入索引，未提交），防止被 `git clean` 误删；剩余未跟踪只有 `.workbuddy/`、`ai/*.md` 报告与 `local-run-artifacts/`（被忽略）。
- 本文件与两份独立复审报告都是新增文档，不改业务行为。
