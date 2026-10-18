# 总控报告（监工）｜2026-10-18

角色：foreman（只读裁决，未改任何代码/测试，未做 git 操作）
前提：全部结论按**当前工作区**核对，不采信口头描述里的行号。

> **重要：工作区在审计期间仍在变化，且改了三轮。** 初稿：`main.html` 21 行、`qisi-config.js` 未改、`qisi-support-text-parser.js` 未改。20:10：`main.html` 43 行、`qisi-config.js` +16（3 个讲义预设）、parser +74/-26（冲突→清空）。20:30：parser **+82/-27（冲突→抛错）**，行为再次改变。本报告所有涉及 parser 的结论以 **20:30 实测**为准；`main.html`/`qisi-config.js` 未再变。

---

## 一、一页结论

**可以继续改。但有 1 条 P0 必须在合并前修掉，否则老师导不进正常试卷。**

三条硬证据：

| 检查 | 结果 |
|---|---|
| `npm test`（全量，初稿时） | **1972 / 1972 通过，0 失败**，耗时 227s |
| `node scripts/verify-app-shell-architecture.js` | `APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED`，`errors: []` |
| Playwright 实载 `main.html` | 无 console 错误 / 无 pageerror，Vue 正常挂载，`Qisi.HandoutFormulaGate` 可调用 |

公式门禁在真页面里端到端有效（实测）：正常公式 `ok:true`；`$\ce{H2O}$` 被阻断；`$\includegraphics{a}$` 被阻断（这条 `throwOnError` 抓不到，只能靠显式规则表）；无 `confirm` 时 `failClosedNoConfirm:false`。
PDF 本地 worker 也成立：`vendor/pdfjs/pdf.worker.min.js` 存在（1.04MB），`express.static(ROOT)`（`qisi-local-server.js:230`）能直接兜住 `./vendor/...` 相对路径。

**3 件今天就该定的事：**

1. **解析器：两处已修好并有测试，一处修反了（当前唯一 P0）。** 20:30 实测：混合答案表 `A 2 C 4` → `A,2,C,4` ✔（`tests/support-parse-safety.test.js:18`）；重复答案 → `DOCX_SUPPORT_DUPLICATE` ✔（`:39`）；**但任何解析里含行首编号步骤的正常文件，现在整份被拒导**（`2. 分两种情况讨论` 被当成第 2 题，与真第 2 题撞车 → 抛"题号 2 出现了两条不同的解析…这份文件先不导入"）。更糟的是 `:26` 那条测试**在保护错误行为**：用例名说不新开块，断言却在验证"第 2 题拿到了步骤"。数据安全了，但老师用不了，**必须在合并前修 `markerRegex` 并改这条断言**。
2. **本轮 MinerU 的全部产出，目前老师用不到。** `app.js` 里 `mineru` 出现 **0 次**，`main.html` 没有加载任何 mineru/segmenter/ownership/pairing 脚本；4 个 block 模块的唯一消费者是 **tests/**。服务端确有 `/api/mineru/parse`（`qisi-local-server.js:823`），但前端没有任何调用点；`runtime-modules.json` 里也没有它们。→ 要么接线，要么明文"本期不上线"。**"19/19 在 16 秒内跑通"是脚本成绩，不是产品能力。**
3. **主理人描述与实际改动不符（范围还在扩大）。** "`main.html` 只加一个 script"→ 实际 43 行（模板卡片、字体 4 档、字号 5 档、两个勾）+ `qisi-config.js` 3 个讲义预设 + parser 三轮修改；改动文件 14→16。这段 UI 与预设**零测试覆盖**（`tests/`/`scripts/` 里 `selectedExamTemplate` 出现 0 次）。好消息：3 个新预设走既有打印链，不是新渲染器——与 C1 裁决一致。

---

## 二、失效清单（结论对不上当前代码的）

| # | 来源 | 原结论 | 现在的实际情况 | 处置 |
|---|---|---|---|---|
| 1 | 主理人转述 | "`main.html` 只加了一个 `<script>` 标签" | 初稿时 21 行（模板 `<select v-model>` 换成按钮卡片 + script）；收尾时 **43 行**，另加 `qisi-config.js` +16 行（3 个讲义预设：字体 4 档、字号 5 档、showAnswer/showSolution 两个勾、教师版联动） | **描述过期**；改动本身自洽，但零 UI 测试 |
| 2 | 主理人转述 | "`architecture/runtime-modules.json` 登记新模块（111 个）" | 111 是旧口径；实际 `modules = 113`，分组为 **browser 81 / dormant 23 / node 9**。多出的 2 条正是 `qisi-handout-model.js`、`qisi-handout-html.js`，且登记状态是 **dormant**（沉睡）——这独立证明了它们没接线 | 计数过期；且 dormant 状态本身就是"未接线"的书面证据 |
| 3 | `ai/HANDOUT_GATE_AND_TEMPLATE_REPAIR_2026-10-18.md:100` | "handout-formula-gate 11/11 通过" | 实际 `1..14`，14/14 通过 | 文档过期 |
| 4 | `tmp/audit-docx/harness.js:6-7` 注释 | "`qisi-question-content-policy.js` 引用未声明的 `splitQuestionForStorage`，ReferenceError 真实存在" | **不成立（浏览器）**。`qisi-utils.js` 是脚本顶层声明（非 IIFE），该名字是**全局词法绑定**：Playwright 实测 `typeof splitQuestionForStorage === 'function'` 且 `=== Qisi.Utils.splitQuestionForStorage`，但它**不是** `window` 属性（`hasOwnProperty=false`），所以 Node `require` 才抛。真页面零错误 | **删掉或降级为"Node 测试需注入端口"** |
| 5 | `tmp/audit-deep/version-conflict.test.js` 文件头注释 | "失败方用旧 version 重试会持续失败（卡死）" | 我用同一脚本在当前代码跑：`用旧 version 重试: fulfilled`。**只有"并发必有一方 rejected"成立** | **"卡死"这条不成立，勿据此改** |
| 6 | `ai/HANDOUT_RESEARCH_2026-10-18.md` 引用的 4 处行号 | `qisi-config.js:117`、`app.js:4523-4790`、`main.html:1437-1498`、`app.js:4547-4560` | 全部仍然对得上（`EXAM_LAYOUT_PRESETS` 起于 117；`renderLatexForPrint` 4532、`buildQuestionContent` 4672、`openPrintWindow` 约 4723；配置面板 1437 起） | **有效，可照做** |
| 7 | 主理人转述 | 门禁调用在 `printExam` | 实际在 `app.js:4870`（不是 4829） | 仅行号漂移 |
| 8 | `tmp/audit-docx/REPORT.md` P0-2 引用行号 | "`qisi-support-text-parser.js:133,187` 按行首编号切块" | `markerRegex` 实际在 **152** 与 **219** 行（docx 报告写作时是 149/203，之后文件被改又后移；133 是 `formulaAnswerRegex`） | 照结论做，别照行号跳 |
| 9 | `ai/CLEANUP_SURVEY_2026-10-18.md:§2.1` | "runtime 当前 111 条：browser 81 / dormant 21 / node 9" | dormant 实际 **23**（+2 为 handout 两模块） | 仅计数需同步，其余结论已抽检有效 |
| 10 | `tmp/audit-docx/REPORT.md` 的"现状"描述 | C10 → `1=A`（静默）、A5 → 静默选一条、C2 → 整表丢 | **已被就地修三轮**：中间版本改成"清空 + 写 `conflict`"（更差：`conflict` 无读取方，等于静默空答案）；**20:30 版本改为抛 `DOCX_SUPPORT_DUPLICATE`**，C10/A5 行为已变；C2 已能输出 `A,2,C,4` | 问题诊断仍成立（根因未动），"现状"必须按 20:30 读，见 P0-1/P0-2/P0-3 |

**已到，且我已核对行号与代码的产出**：
- `docx-chain-audit` → `tmp/audit-docx/REPORT.md`（364 行）。我逐条核对了 P0-1/P0-2/P1-1/P1-2/P1-3/P1-4/P1-5 的文件与代码片段，**全部对得上**（唯一漂移是 P0-2 的 `133,187` → 实际 `149,203`）。它比我先给出更严重的 P0：**解析串到下一题**。本报告已采纳，并把它排在自己原来的 P0 之前。
- `perf-audit` → `tmp/audit-perf/结论.md`（37 行）。与我按 bench5 判读的结论一致；它多给了一条"已改、无需再动"（`app.js:4906-4942` 模板保存不再全库 `loadData`），我核对属实。
- `cleanup-survey` → `ai/CLEANUP_SURVEY_2026-10-18.md`（53KB）。结论与我一致：**根目录 `qisi-*.js` 绝大部分别动**；它另指出 4 个"空转"OCR scaffold 模块（加载但无消费者）。

**仍然缺失，无法裁决**（不编结论）：
- `deep-bug-audit`：`tmp/audit-deep/` 仍只有 1 个验证脚本，无报告；且其中"卡死"结论已被实测推翻（见失效清单 #5）。
- `mineru-diff-audit`：任务标记 completed，但 `tmp/audit-mineru/` 仍只有 probe 与 preview HTML，无 diff 结论。

---

## 三、冲突裁决表

| # | 甲方主张 | 乙方主张 | 证据强度 | 裁决与理由 |
|---|---|---|---|---|
| C1 | `handout-builder`：新建 `qisi-handout-model.js` + `qisi-handout-html.js`（自带 `<style>`、`@page`、`@media print{body{padding:0}}`） | 主理人 + 调研报告：讲义 = 现有组卷打印链的第 3 个预设，复用打印 CSS | 甲：39 个测试全绿，但**零接线**；乙：已有 20+ 版式字段与打印链，且 `qisi-handout-html.js` 自己也在复用 `.exam-question/.question-row/.print-answer` 同一批类名 | **判乙。** 讲义模块只能当"HTML 片段生成器"接入 `openPrintWindow`，**必须删掉它自带的 `@page` 与 `@media print{body{...}}`**（`qisi-handout-html.js:141-143`）。理由：① 稳定链优先；② 它自己的注释已写明要压过 app.js 的 `.gaokao-option` 同权重规则，说明作者也认定要与打印 CSS 共存，那就不能同时输出第二份 `@page`。 |
| C2 | 主理人刚放宽：成绩表（题号/一/二/三/总分/得分）不再让整卷失败 | MinerU 新逻辑对答案表更严：题号非正整数、空答案、重复题号一律 `throw` | 双方都有实测：probe1 case1 现返回 `null`（放宽生效）；case2 `1-5` 仍 `THROW`；case6 单题坏字段 → `valid=false` | **不冲突，共存。** 放宽的是"这张表是不是答案表"（判定层），收紧的是"确认是答案表之后内部是否自洽"（校验层）。但加一条硬要求：`MINERU_ANSWER_TABLE_INVALID` 必须能落到 UI 的可操作文案（哪张表、哪一行），否则等价于"整卷失败且不知道原因"，违反准则 2。 |
| C3 | `deep-bug-audit`：并发保存失败方会持续卡死 | 实测：重试 `fulfilled` | 我已用**甲自己的脚本**复跑；甲随后复核确认"报告正文写的是不会永久卡死，只有脚本第 3 行注释写错了"，并已修注释 | **判乙，双方已收敛。** 有效部分是：同一 batch 并发保存必有一方 `DRAFT_PERSISTENCE_VERSION_CONFLICT`；触发条件是 **batch 级单版本计数器**（不限"两道题"——同一题连点两次也会），根因是读改写不在 `withRepositoryLock` 内。甲定级 **P2**，我同意（落败那次只留在内存、刷新回滚，不锁死）。真实 IndexedDB 窗口未实测，不得写成已证实。 |
| C4 | DOCX 链：同题号答案冲突 → 静默保留（等长取第一个，更长者覆盖） | MinerU 链：重复题号 → 直接 `throw` | 两侧都实测：C10 输出 `1="A"`（"C" 消失，无 issue）；MinerU `答案表题号重复` throw。DOCX 侧还违反 `STABLE_CHAINS.md` §2「重复标记必须停止挂载」与 `AGENT_CONSTITUTION.md` §3 | **判 DOCX 侧必须改，且改成抛错**（不是"产 issue 放行"）。我最初倾向"产 issue 不阻断"，复核章程后改变判断：重复标记是明确禁止项，静默挂其中一条就是错挂答案。体验问题用**错误文案**解决（列出题号 + 两个原值 + 来源文件），不要用"放行"解决。 |
| C7 | 我的初判：重复答案产 issue，交 review 待确认即可 | `docx-chain-audit`：必须抛 `DOCX_SUPPORT_DUPLICATE` | 甲的出发点是"不打断老师"；乙有章程明文（§2/§3）与 runner 层已有错误码 | **判乙。** 理由同上：**错挂答案 > 流程顺畅**。本报告 P0-3 已按抛错写。 |
| C5 | `docx-chain-audit`：`splitQuestionForStorage` ReferenceError 真实存在 | 浏览器实测正常 | 甲是 Node 直连 `require` 的上下文；乙是 Playwright 真页面 | **判乙。** 这是"基于错误运行环境下结论"的典型，报告里必须写明运行环境。 |
| C6 | 主理人："`main.html` 只加一个 script" | 实际 43 行（初稿时 21） | git diff | 不算冲突，算描述过期；但**正因为描述过期，任何按"main.html 没动"做的判断都要复核**。 |

---

## 四、统一行动清单（唯一一份，已去重）

> 排序标准：① 会不会错挂答案/丢题 ② 会不会静默失败 ③ 老师今天能不能用 ④ 可维护性/性能

### P0（会丢答案 / 会挂错解析 / 会静默给错东西）

**P0-1（唯一未修）解析里的行首编号步骤 → 正常文件被整体拒导**
- 位置：`qisi-support-text-parser.js:152`、`:219`（两处 `markerRegex`）
- **20:30 实测**（生产 parser，非读代码）：
  - 正常文件：`1.【答案】A / 【解析】因为…… / 2. 分两种情况讨论 / 综上选 A。 / 2.【答案】B / 【解析】略。` → **抛 `DOCX_SUPPORT_DUPLICATE`（question=2）**，提示"题号 2 出现了两条不同的解析……这份文件先不导入"。
  - 对照：同样的文件去掉中间那行编号步骤 → 正常输出 `1:因为……, 2:略。`。
  - 所以判据完全落在那行 `2.` 上，与答案对不对无关。
- 为什么是 P0：分类讨论、分步求解在高中数学解析里极常见；一旦出现，**整份文件拒导**，老师当天无法导入这份卷子。数据是安全的（fail-closed），但可用性归零，命中准则 ③。
- 根因（docx 复核确认，我同意）：`anchor` 过滤救不了——`2` 本来就在答案题号集合里，所以 `guarded` 仍会把它当块；`guarded.length*2 < all.length` 的回退（`:183`）只在"编号步骤多到过半"时才关锚点，属于误伤式兜底。
- **耦合点**（docx 补充，我确认）：`parseAnswerAndSolutionItemsFromText` 末尾的 inline 补空（`:318-327`）只判 `hasQuestion`，**不判该题号是否在答案锚点集合里**，所以"步骤 3"会变成悬空 `question='3'`。修 P0-1 时 inline 结果也要按 anchor 过滤，否则悬空解析会换个入口回来。
- 改法：开新块要求"标记行本身或紧邻下一行出现 `【答案】/【解析】/答案：/解析：`"；两处 regex 同改。**不要**改成"表格命中就 return"（会丢混合文件的逐题答案）；正确做法是把已消费的 `题号…`/`答案…` 行在副本里置空，再跑 `pairRegex`/`formulaAnswerRegex`——当前实现已这么做，`A 2 C 4` 因此修好。
- 验收断言：上述正常文件 → `solutions: 1="因为……", 2="略。"`，且**不抛错**；真冲突（表 2=B + 列表 2=C）仍必须抛 `DOCX_SUPPORT_DUPLICATE`。
- **新增测试在保护错误行为**：`tests/support-parse-safety.test.js:26-37` 的用例名是"numbered steps inside a solution do not start a new question block"，但断言是 `byNumber['2']` 匹配 `/当 x>0 时/`——这恰恰等于承认"步骤被挂成了第 2 题解析"。按当前实现，该输入还多出一个悬空的 `question='3'`（`综上。`）。**修实现前先改这条断言**，否则测试会把 bug 固化成期望。
- 风险：**碰 DOCX 稳定链**，需 `verify:docx-stable` + 全量测试 + 双 DOCX 手工导一份。
- 与已改内容重叠：**同文件正在被改（已三轮）**，动手前先冻结。

**P0-2（已修，已有测试）混合答案表整表丢失**
- 位置：`qisi-support-text-parser.js:96-125`
- 原问题：`answerCells...split('')` 按单字符切 + 强制全 A-F，`A 2 C 4` → 整表 `return []`。
- **20:30 实测已修**：`1=A, 2="2", 3=C, 4="4"`。修法：按格子切 + 允许非字母，并把表格已解析的题号放进 `tableNumbers`，后续 `pairRegex` 遇到同号条目直接 `return ''` 跳过（`:98/:117/:125`）。
- **这个"跳过"有个副作用**（docx 20:40 指出，我核对代码属实）：它对"表 2=B + 逐题列表 2=C"是**整条跳过列表项**，真冲突永远到不了 `pushUniqueQuestionItem`。更稳的做法是把已消费的 `题号…`/`答案…` **两行置空**再跑 `pairRegex`，这样列表项能进来、真冲突会抛、混合文件也不丢逐题答案。
- 测试：**已补**，`tests/support-parse-safety.test.js:18-24` 断言 `A,2,C,4` 四个值都在（与我的实测一致）。这条可以关。
- 闸门补充（docx）：单选/多选/填空空答案会被 `qisi-review-draft-normalization-policy.js:155` + admission `requiresAnswer` 拦住；**解答题 answer 非必填 → 空答案可入库**，所以这条以前对解答题是静默的。

**P0-3（已修，已有测试）同一题号答案冲突静默择一**
- 位置：`qisi-support-text-parser.js:54-84`（`pushUniqueQuestionItem`）
- 原问题：`1.答案：A` + `1.答案：C` → 留 A，无 warning；runner 的 `DOCX_SUPPORT_DUPLICATE` 只看到去重后的条目。
- **20:30 实测已修**：A5 / C10 均抛 `DOCX_SUPPORT_DUPLICATE`，错误文案可读（"题号 2 出现了两条不同的解析：…和…，请核对源文件里的题号"）。
- 测试：**已补**，`tests/support-parse-safety.test.js:39-57`（不同值抛 `DOCX_SUPPORT_DUPLICATE`；同值去重不抛）。这条可以关。残余风险：**与 P0-1 的假阳性共用一个错误码**，老师无法区分"我真有重复"和"工具把步骤当题"；修 P0-1 后歧义自然消失。
- 注意：曾有中间版本改成"清空字段 + 写 `conflict`"，那个方案更差（`conflict` 全库无读取方，等于静默空答案），已被当前抛错方案覆盖，**不要再回退到清空**。

> P0-1 仍未修；P0-2/P0-3 已修且有测试（但 P0-1 的测试断言是错的）。三项都在 `qisi-support-text-parser.js` 一个文件、同一条稳定链：**冻结改动方 → 一次收口 → 跑一次 `verify:docx-stable` + 全量**。

### P1（今天就影响老师 / 决定本轮工作是否有意义）

**P1-1 MinerU 接线决策（决策项，不是代码项）**
- 事实：`app.js` 0 处 mineru；`main.html` 0 个相关 script；4 个 block 模块只被 tests 引用；服务端路由无前端调用方。
- 二选一：**(a) 接线**（`main.html` 加 4 个 script + `app.js` 在导入入口加调用 + 接错误文案）；**(b) 明文写"本期不上线"**，并把 `ai/MINERU_*.md` 的措辞从"已跑通"改为"链路已备、未接线"。
- 风险：选 (a) 要改 `main.html`/`app.js` —— 与主理人本轮已改文件**重叠**，必须串行；选 (b) 零风险。
- 与已改内容重叠：**重叠**。

**P1-2 讲义模块接线（若决定上线）**
- 位置：`qisi-handout-html.js:141-143`、`qisi-handout-model.js`，接线点 `app.js` `openPrintWindow`
- 现状：未接线（只被 tests require），却已自带 `@page` 和 `@media print { body { margin:0; padding:0 } }`。`openPrintWindow` 的 `body` 是 `padding:24px`（`app.js`，openPrintWindow 内联样式第 9-14 行）。两份样式同时在页面里 → 打印边距由加载顺序决定，**不可预测**。
- 改法：只产出片段（题目区 HTML），删除自带的 `<style>` 整段；`@page`/`body` 只由 `openPrintWindow` 负责；若必须保留讲义样式，则全部选择器加 `.handout` 前缀且不含 `body`/`@page`。
- 风险：中。不碰导入链，但打印是老师的主交付物；改完必须真机打一份 7 页 PDF 看页边距。
- 与已改内容重叠：**重叠**（同一 `printExam` 路径，门禁刚插在 4870）。

**P1-3 题库加载：图片查询 N+1（perf-audit 唯一的"必改"）**
- 位置：`app.js:3061-3094`（`attachQuestionImageUrls` 在 `for (const q of items)` 内逐题 `loadImageRecords`）
- 数据（bench5，真实 repository）：n=10000 → 逐题 3374ms（占 `loadData` 92%），改一次 `anyOf` + Map 后 37ms；n=1000 → 73ms vs 4.9ms。
- 改法：循环外收集全部 image id → 一次 `loadImageRecords` → Map 查找。签名/调用点不变，函数体 20 行内。
- 风险：低；但 3061 是 `loadData` 热路径，改后跑全量测试。
- 与已改内容重叠：**不重叠**（主理人改的是 3959 粘贴落库、4004 提交互斥、4906 模板保存）。
- **条件改（现在可挂起）**：`main.html:1245`（确认页）、`main.html:639`（草稿导航）无分页，每条至少 1 次 KaTeX；一次勾 300+ 题时 0.5–2s。纯展示层 `slice(0,50)` + "显示更多"，不碰数据。
- **反面对照（perf 测过但明确不要做）**：ZIP 压缩参数（`qisi-backup.js:322-328`，四种参数输出都是 29.5MB，仅差 15%）；12 处 `loadData()` 改增量（要动 `deletedAt`/`objectUrls`/指纹 Map 语义）；`objectUrls` 增量 revoke（生命周期易泄漏）；搜索加索引（万题 20ms 已够）；KaTeX 预览加防抖（会毁掉所见即所得）；备份二次校验（是"会不会丢题"的兜底）。

**P1-4 DOCX「参考答案：」这类标题识别不到 → 答案区被当题目 / full 角色下解析=题干**
- 位置：`qisi-batch-importer.js:458`、`:953-957`
- 现状（docx 报告 P1-1，我核实行号与正则属实）：正则要求整行**完全等于** `参考答案/答案及解析…`，带冒号 `参考答案：`、带方括号 `【参考答案】`、单写 `答案`、`答案详解` 全部不匹配。后果：题目文件尾部的答案被当成新题（题号重复脏草稿）；`full` 角色且无答案区标题时，`supportText` 回退成**整篇文档**，解析字段变成题干。
- 改法：正则放宽（可选 `【】`/`《》`、可选尾部 `：`、允许单独 `答案`）；`full` 且未声明答案区时，只从第一个 `【答案】/【解析】` 之后取 supportText。
- 风险：中（改的是切题边界，DOCX 稳定链），需 `verify:docx-stable`。

**P1-5 DOCX 重复题号被自动合并 → 丢题**
- 位置：`qisi-production-import-output-port.js:265-305`
- 现状（docx 报告 P1-5，我核对 `:275-277` 属实）：按 `sourceKey::questionNo` 分组后按启发式质量分选一条、另一条 `duplicateMergedFrom` 后丢弃，只留 warning。题号分段重启（两个大题都 1-10）或题干第二段以 `2.` 开头时发生。
- 改法：有答案文件时应由 `DOCX_SUPPORT_QUESTION_AMBIGUOUS` 拦住（现状如此），无答案文件时至少把"合并了两条不同内容"升级为待确认，而不是自动选一条。
- 风险：中；同一文件，建议与 P0 三项**分两次**改（先 P0 再这条），避免一次改动面过大。

**P1-6 DOCX 人工改过已确认草稿后仍是 `reviewed`，可直接入库**
- 位置：`qisi-review-controller.js:37-40`、`:64-69`
- 现状（docx 报告 P1-3，我核对属实）：`markFieldsManual` 只对 `pdf-multimodal-v1`/`pdf-external-v2` 把状态重置为 `pending`，DOCX 草稿改完仍是 `reviewed` + `manualConfirmed=true`，提交时直接入库。
- 改法：去掉 `routeId` 条件，任何 `markFieldsManual` 都重置为 `pending`（`submitted` 除外）。这是 DOCX 向 PDF 对齐，不是新功能。
- 风险：低-中；会让"改完直接提交"变成"改完要再确认一次"，属行为收紧，需在验收里写明。

**P1-7 DOCX Word 自动编号 / `（1）` 题号 → 整卷 0 草稿（工具侧丢题）**
- 位置：`qisi-batch-importer.js:192-195`（`parseLeadingQuestionMarker`）、`:902-933`（`expandWordLetterNumbering` 只处理选项 A-D 的 `upperLetter`）
- 现状（docx 报告 P1-4，我核对正则属实）：题号只认文本里的数字；Word `w:numPr` 自动编号不展开 → `blocks=[]` → 0 草稿 → 桥接层以 `raw-or-empty-draft-output` 拒绝。整卷丢失，但报错对老师不可解释。部分题号自动编号时，未编号的题会被并入上一题。
- 改法：按 `numbering.xml` 展开 lvl0 的 `decimal`（前缀 `N. `）；或在 0 块时给出明确诊断「题号可能用了 Word 自动编号」。`（1）` 建议显式支持为块标记。
- 风险：中（切题边界）；与 P1-4/P1-5 同批改更划算。

**P1-8 DOCX 未匹配答案没落盘（静默消失）**
- 位置：`qisi-production-import-bridge.js:613-615`（只读 `sourceResult.unmatched`，而 DOCX runner 给的是 `unmatchedAnswers`）；展示侧 `app.js:2738` 用 `x.question / x.sourceFile`，runner 给的是 `questionNumber / sourceFileName`
- 现状（docx 报告 P1-2，我核对属实）：答案文件多出的题号（如答案 21、题目 1-20）不会错挂，但也不会出现在审核页，`batch.unmatchedAnswers` 恒为空。
- 改法：`unmatched: data.sourceResult.unmatchedAnswers ?? data.sourceResult.unmatched ?? []`，并统一展示字段。**不改变挂载行为，风险最低的一条 DOCX 修复。**
- 风险：低；可并入第 1 步一起改。

**P1-9 MinerU 错误粒度：单题坏字段拖垮整卷（已知未修）**
- 位置：`qisi-block-ownership.js:232-242`（`assembleExam` 把单题 issue 汇总成整卷 `valid=false`）；`qisi-mineru-client.js` 答案表 `throw`
- 证据（probe1）：case6 单题字段错误 → `valid=false`；case2 答案表 `1-5` → `THROW`。
- 改法：整卷 `valid` 与单题 `valid` 解耦，单题降级为 `reviewRequired`。
- 风险：中高（改的是判定语义），且**优先级被 P1-1 卡住**——链路没接线，改了老师也感知不到。
- 与已改内容重叠：与 `qisi-mineru-client.js` 相邻但文件不同，不冲突。

**P1-10 跨路径冲突仍被静默跳过（与 P0-3 的"抛错"策略不一致）**
- 位置：`qisi-support-text-parser.js:318-327`（`hasQuestion` 守卫）
- 现状（docx 复核指出，我读代码确认）：有**两条**独立机制都会让真冲突消失：
  1. `:125` 表格号集合 `tableNumbers` 命中即 `return ''`，逐题列表里的同号条目被整条跳过；
  2. `:318-327` inline 补空的 `hasQuestion` 守卫，只在"该题号还不存在"时才 `pushUnique`。
  结果是"汇总表 2=B + 逐题列表 2=C"静默保留表值，**不会**触发 P0-3 的 `DOCX_SUPPORT_DUPLICATE`。同一份文件里"同路径冲突抛错、跨路径冲突静默"，策略不一致。
- 改法：把行内结果也交给 `pushUniqueQuestionItem`（让它按同一规则抛错），或至少在跨路径不一致时产可见提示。
- 附带：`:313-315` 的注释仍在解释"会触发同题号冲突清空"——**"清空"策略已被废弃**，注释过期，会误导下一个人。
- 风险：低-中；与 P0-1 同一文件，建议同批处理。

**P1-11 行内答案紧跟标签时，第一题答案被静默丢掉（现存，非本轮引入）**
- 位置：`qisi-support-text-parser.js` 行内 `pairRegex`（`:118-125` 附近）与 `splitAnswerSolutionSections` 的衔接
- 现状（20:35 实测）：`答案：1.A 2.B` → 只剩 `2:B`；`答案：1.A\n2.B` → 只剩 `2:B`。但只要标签后**有空格或换行**（`答案： 1.A 2.B` / `答案：\n1.A 2.B`）就正常。`答案：A B C D`（无题号）→ 空（这是"不猜"，不算 bug）。
- **根因（20:40 与 docx 对齐）**：`splitAnswerSolutionSections` 只切"解析"，答案区的 `答案：` 原样留在 `answerPart` 开头；`pairRegex` 的边界类是 `(?:^|[\n\s，,；;、])`，**不含 `：`**，于是 `1.A` 粘在标签后不匹配，而带空格的 `2.B` 正常。
- 为什么是 P1 而非 P0：只在"`：` 紧贴数字"的紧凑写法出现；但一旦出现就是静默丢第 1 题答案，且现有 4 条安全测试用的是同一段输入却没断言答案，漏掉了。
- 改法：剥标签后若首字符紧随分隔符/冒号，先把该分隔符归一为空再跑 `pairRegex`；并补一条断言 `答案：1.A 2.B` → `1:A, 2:B`。
- 风险：低（局部），但仍属 DOCX 稳定链，随第 1 步同批验证。

### P2（不急，但别忘）

| # | 位置 | 事项 | 与已改内容 |
|---|---|---|---|
| P2-1 | `qisi-handout-formula-gate.js` `normalizeForKatex` vs `app.js` `normalizeMathExpressionForPrint` + `formatLatexForPrint` | 两套规范化并存：门禁只看原文，打印先做 `normalizeBareLatexForDisplayText` 与裸环境包 `$$`。结果只会"门禁偏宽"或"偶发误拦"，不会漏放红字。建议门禁直接吃 `formatLatexForPrint` 的输出，单一真源 | 与门禁同源，改动小 |
| P2-2 | `tests/e2e/browser-harness.js:24` | 仍写死 `unpkg.com/pdfjs-dist@3.11.174`，源码已本地化但**测试脚手架没跟着改** → 断网时 E2E 会假失败 | 无重叠 |
| P2-3 | `qisi-utils.js` 顶层词法声明 | 所有工具函数是**全局词法绑定**，不是 IIFE；Node 里 `require` 后仍需 `globalThis` 桩。这是 C5 那条"假 bug"的真正来源。短期不要包 IIFE（会动全站），只要求：README/审计报告写清"Node 侧必须注入端口" | 无重叠 |
| P2-4 | 文档 | `runtime-modules.json` 111→113；门禁测试 11→14；`ai/HANDOUT_GATE_...md` 的验证段需同步 | 无重叠 |
| P2-5 | `tmp/` | `npm test` 会把 `tmp/**/*.test.js` 收集进去（本次 1972 条里含 `tmp\audit-deep\version-conflict.test.js`）。审计脚本放 `tmp/` 会被当测试跑：一旦某个审计脚本失败，全量测试变红。另外 `case-parser-fragility.js` 现在会在 C6 处抛错中断，C6 之后的用例根本不再执行——重跑审计前要先给它加 try/catch | 无重叠，合并前清 |
| P2-6 | `qisi-block-ownership.js:10`、`qisi-paper-segmenter.js:9` | 浏览器回退分支 `root.Qisi.MineruEvidence` 目前**没有任何 script 给它赋值**。当前这两模块不在浏览器加载，所以是潜伏雷；将来接线时若忘了加 script 标签，第一次 `assemble` 就 `Cannot read properties of undefined` | 与 P1-1 同一批 |
| P2-7 | `qisi-draft-persistence-service.js:497-548`（读改写）、`:176-178`（lock 边界）、`:274-277`/`:179-183`（batch 版本重读）、`:513-524`（draft.version 比对） | 同一 batch 并发保存必有一方 `DRAFT_PERSISTENCE_VERSION_CONFLICT`。**触发条件不是"两道题"专属**：同一题连点两次保存、两道题各改一次后快速切换、保存与"标记确认"重叠，都会触发。根因是 **batch 级单版本计数器** + 整批 `delete+bulkPut` 的读改写不在 `withRepositoryLock` 内。落败那次只留在内存、不落库、刷新回滚，**不锁死**。改法：把读改写整体包进 `withRepositoryLock`，或改单条 draft upsert；**不要**按"卡死"方向改，不要动持久化格式 | 无重叠；deep-bug 定级 P2，我同意 |
| P2-8 | `qisi-production-import-bridge.js:707-745`、`qisi-storage-repository.js:553-556` | 重新导入一个**已提交**的批次：仅 `status==='review'` 且幂等键匹配才回放；已提交走新 requestId → 先 `delete` 再 `bulkPut`，会抹掉草稿的 `submitted` 关联与审计痕迹。**正式题库表不受影响**（所以不是数据事故），但 UI 文案会让人以为"什么都没变" | 无重叠 |

**已验证、不需要再动（防止有人重复改）**：
- PDF worker 本地化：`qisi-browser-document-source.js:314`、`:373`、`qisi-browser-pdf-renderer.js:65` 全部本地；`vendor/pdfjs/pdf.worker.min.js` 存在；`express.static(ROOT)` 可服务。源码里仅剩的 `unpkg` 都在备份/测试/`tmp` 里。
- `main.html` 脚本顺序：`qisi-utils.js`(1642) → … → `qisi-handout-formula-gate.js`(1709) → `app.js`(1710)。门禁依赖 `Qisi.Utils.tokenizeLatexSource`，顺序正确，真页面已验证。
- 成绩表不再整卷失败（probe1 case1 返回 `null`）。
- `qisi-mineru-evidence.answerKey` 标点剥离：`['A.']→A`、`['（A）']→A`。

---

## 五、无人认领的风险

1. **MinerU 前后端断链**（最严重）：服务端有路由、有 500 行模块改写、有 6 个测试文件，前端 0 调用。没有任何子代理认领"接线"这件事——审计只看链路内部，实现只做到 Node。
2. **模板选择器改版零覆盖**：`main.html:1442-1456` 从 `<select v-model>` 改成按钮卡片。`tests/`、`scripts/` 里 `selectedExamTemplate` 出现 **0 次**，没有任何 E2E 会在改版后失败。这类"界面改了但测试全绿"最容易带着问题上线。建议至少真机走一遍：切系统模板 → 改字号 → 切自定义 → 刷新 → 再切回。
3. **讲义样式与打印样式的全局规则冲突**：`qisi-handout-html.js:142` 的 `@media print { body { margin:0; padding:0 } }` 是**全局选择器**，一旦接进 `openPrintWindow`，会把主理人调好的 24px 内边距抹掉。这条不属于任何审计（DOCX/PDF 都不看打印 CSS），属于典型三不管。
4. **DOCX 与 MinerU 对"答案冲突"的处置相反**（C4）：两条链各自合理，合起来是产品级不一致；没人对"跨链一致性"负责。
5. **`qisi-mineru-evidence` 的浏览器回退永远拿不到值**（P2-6）：只在"以为能跑"的时候才炸，正常审计发现不了。
6. **4 个"空转"模块**（`cleanup-survey` §2.2）：`qisi-performance-monitor.js`、`qisi-ocr-engine-registry.js`、`qisi-ocr-local-adapter.js`、`qisi-ocr-shadow-mode.js` 被 `main.html` 加载，但全库无任何 `Qisi.*` 消费点。它们不产生功能，却是 `architecture/layers.json` 的 scaffold 记录 + 6-9 个测试的依赖 → **现在删会连测试一起拆**。建议：只从 `main.html` 摘 script 标签（省 4 次请求），不要删文件；这件事没人认领。

---

## 六、建议的下一步顺序

**第 1 步（串行，必须单线）：冻结 `qisi-support-text-parser.js` 的改动方，只收口 P0-1**
**注意：这个文件 20:10→20:30 内被改了两次（清空→抛错），现在 `git diff` 是 +82/-27。** 先确认谁在编辑并要求暂停，否则每轮复核都会作废。
只剩一条要修：**解析里的行首编号步骤不能再开新题块**。修完必须同时满足五个断言：
1. 正常文件（含 `2. 分两种情况讨论` 这类步骤）→ `solutions: 1="因为……", 2="略。"`，**不抛错**（现在抛 `DOCX_SUPPORT_DUPLICATE`）；
2. 真冲突（表 2=B + 列表 2=C）→ 仍必须抛 `DOCX_SUPPORT_DUPLICATE`；
3. `题号 1 2 3 4 / 答案 A 2 C 4` → `1=A,2=2,3=C,4=4`（20:30 已通过，用测试固化）；
4. `1.答案：A` + `1.答案：C` → 抛 `DOCX_SUPPORT_DUPLICATE`（20:30 已通过，用测试固化）；
5. `tests/support-parse-safety.test.js:26-37` 的断言必须改成"只有 q1 一个解块、包含全部三步、不产生 q3 悬空解析"，否则测试会把 bug 固化成期望；
6. inline 补空（`:318-327`）要按答案锚点过滤，避免"步骤 3"变成悬空题；
7. 表格修法从"`tableNumbers` 命中即跳过"（`:125`）改为"把已消费的 `题号…`/`答案…` 两行置空"，这样逐题列表能进来、真冲突能抛（P1-10）；
8. 3、4 两条已有测试（`:18-24`、`:39-57`），保持即可。
然后跑 `npm run verify:docx-stable` + 全量测试 + 手工导一份「题目 + 含数值答案的题号/答案表」双 DOCX。

理由：这是本轮唯一"会静默给错东西"的簇；docx-chain-audit 的完整证据在 `tmp/audit-docx/REPORT.md`，**问题诊断以那份为准**，本报告负责标注"哪些已被改、改成什么样、还差什么"。

**第 2 步（可并行，互不冲突）：P1-3 图片批量查询**
只动 `app.js:3061-3094`，与第 1 步不同文件。收益立刻可感知（1 万题 3.7s → 0.3s 量级）。

**第 3 步（需要你拍板，然后才动手）：P1-1 MinerU 接线 or 明确不上线**
- 选"不上线"：10 分钟改文档，本轮所有 MinerU 争议（P1-9、C2 的严格度）自动降级，不用再讨论。
- 选"接线"：排在 P0 之后**串行**做（要动 `main.html` + `app.js`，与主理人已改内容重叠）；接线时顺手把 P2-6 的 `MineruEvidence` script 标签一起补上。
- 不建议"边接线边改判定语义"（P1-9），会把两类失败混在一起无法定位。

**第 4 步（P1-1 决定后再排）：P1-2 讲义接线**
只做"片段生成器"路线：删 `qisi-handout-html.js:141-143` 的 `@page`/`body`，其余选择器限定 `.handout`，接进 `openPrintWindow`。`runtime-modules.json` 里这两个模块现在登记为 `dormant`，接线时要一并改成 `browser`，否则架构校验与实际不一致。
**不要**同时接讲义和 MinerU——两者都要改 `printExam`/导入入口，串行更安全。

**第 5 步（可并行，第二轮）：P1-4 / P1-5 / P1-6 / P1-7 / P1-8**
仍然全在 DOCX 侧，但**与第 1 步分两批**，避免一次改动面过大无法定位回归。P1-4（参考答案标题）、P1-5（重复题号合并）、P1-7（Word 自动编号）建议同批，三者都在动"切题边界"；P1-6（review 状态）单独一批，它改的是状态机不是解析；P1-8（未匹配答案落盘）只是字段改名 + 一行兜底，**可以直接并入第 1 步**。

**可以全程并行、随时做**：P2-1、P2-2、P2-4、P2-5（都是孤立小改，不碰稳定链）。

**合并前最后一道**：清 `tmp/` 里的审计脚本（P2-5），再跑一次全量测试，确认 1972 条里不再混入 `tmp/**/*.test.js`。

---

## 附：本报告的证据来源

- `npm test` 全量：**20:30 版本 1983 pass / 0 fail**（含 54 suites，173s）；初稿版本 1972 pass
- `node scripts/verify-app-shell-architecture.js`：`APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED`
- Playwright 实载 `main.html`（本机静态服务，三次独立运行）：无 pageerror；`typeof splitQuestionForStorage === 'function'`（非 window 属性）；`QuestionContentPolicy.createQuestionContentPolicy()` 在浏览器返回 ok；门禁对 `\ce`、`\includegraphics` 正确阻断、无 confirm 时 fail-closed
- `node tmp/audit-mineru/probe1.cjs`：成绩表 `null`、范围答案表 `THROW`、单题坏字段 `valid=false`
- `node tmp/audit-docx/case-parser-fragility.js`（20:30 复跑）：C2 → `1=A,2="2",3=C,4="4"`（已修）；C6 → 脚本在 C6 处直接抛 `DOCX_SUPPORT_DUPLICATE(question=2)` 而中断；C10 → 抛 `DOCX_SUPPORT_DUPLICATE`
- `node tmp/audit-docx/case-answer-attachment.js`（20:30 复跑）：A5 → `THROW DOCX_SUPPORT_DUPLICATE`（不再是 VALUE_MISSING）
- 自建对照探针（20:30）：同一份文件"有/无那行 `2.` 编号步骤"分别抛错 / 正常输出，证明判据就在那行编号上
- 三个审计员回执已并入：docx-chain-audit（闸门判定：C2 对解答题静默、C10 无闸门）、deep-bug-audit（并发触发条件与锁边界行号）、perf-audit（必改项 + 条件改项 + 反面对照）
- 自建最小探针（Node 直连生产 parser）：`A 2 C 4`、`1 2 3 4`、`A B C D`、`AB C`、`0.5 √3` 五组，用于定位 `pairRegex` 假冲突
- `node tmp/audit-deep/version-conflict.test.js`：并发一方 rejected，**重试 fulfilled**
- `node tmp/audit-perf/*`：bench5 n=10000 loadData 3659.5ms（attach 3373.6ms）；bench6 压缩参数无显著差异
- `tmp/audit-docx/REPORT.md`（364 行）：P0-1/P0-2、P1-1~P1-5，行号已逐条核对（除 P0-2 的 133/187 → 实际 149/203）
- `tmp/audit-perf/结论.md`（37 行）：唯一必改 = `attachQuestionImageUrls`
- `ai/CLEANUP_SURVEY_2026-10-18.md`（53KB）：根目录模块分级、4 个空转 OCR 模块
- `git diff`：初稿 14 个文件；收尾 16 个。`main.html` 43 行（模板卡片 + 字体/字号/两个勾 + 1 个 script）、`qisi-config.js` +16 行（3 个讲义预设）、`qisi-support-text-parser.js` +38 行（冲突处置，进行中）、`app.js` 75 行（模板 config 持久化、图片落库、提交互斥、门禁调用）
