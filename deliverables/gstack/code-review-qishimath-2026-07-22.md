# 奇思数学 Pro 代码重新评审与专业评价报告

**日期**：2026-07-22
**场景**：代码审查 + 安全审计 + 代码质量分析（多成员协作，重审）
**参与成员**：产品评审员（架构/整体评价） + 安全官（OWASP+STRIDE 审计） + 排障手（代码质量/技术债/健壮性）

> 本次为 2026-07-17 首轮评审后的**重新评审**。评审对象不变：高中数学题库系统"奇思数学 Pro"，本地优先应用，392 个源文件、约 11.3 万行（含测试）。
> 协作方式：因团队创建工具不可用，采用降级单 Agent 直调模式——三位专家并行独立审阅，主理人汇编收口。

---

## 📌 TL;DR（执行摘要）

- 整体结论：**🟡 有条件通过**（维持首轮判断，但未改善）。
- **关键事实**：`git log --since 2026-07-17` 为空——代码自上次评审以来**零改动**，上次所有 🔴 项**全部未修复**。
- **新增恶化信号**：技术债非但没还，反因 7 月模块化重构而扩散——清洗/归一化 helper 由 8 处发散到约 45 个模块、调试级 console 新增 87 处、巨型文件未瘦身且新增多个 >30KB 文件。
- 阻塞项数量：**5 项 🔴（高）**（较首轮 4 项 +1，因 helper 发散升级）。
- 下一步：维持首轮优先级（明文密钥+开放代理、app.js 收缩、batch-engine-v2 拆分、错误上浮 UI），并**立即止血 helper 发散**。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🟡 条件 Go（与首轮一致，未改善，且技术债局部恶化） |
| 严重度分布 | 🔴 5 / 🟠 5 / 🟡 6 / 🟢 7 |
| 关键行动项 | 7 条 |
| 建议负责人 | 教师本人 + AI 协助（受 AGENTS.md 约束） |
| 较首轮变化 | 代码零改动；🟢 防护稳固；🔴 全未修；🟡→🔴 helper 发散恶化 |

---

## 1. 各成员核心结论

### 🔍 产品评审员（架构与整体评价）
- 核心判断：治理文档成熟度（AGENT_CONSTITUTION 把"污染题库比缺失更糟"做成不可谈判规则）远强于代码本身；但中心 `app.js` 仍靠 119 个 `window.Qisi.*` 全局耦合、不可单测，边缘模块却走向另一极端——89 个平铺文件里混着 1 行薄壳与 2053 行巨石，粒度两极分化。自 7/17 零改动，上次结论全部成立，仅命名税微增。
- 关键建议：冻结 app.js 增长（用 `verify:diff-scope` 工具强制）、给 app.js 装可测接缝（抽纯逻辑为带 `module.exports` 的 qisi 模块）、合并 1 行薄壳消去虚假分层。

### 🛡️ 安全官（OWASP+STRIDE 审计）
- 核心判断：安全态势较上次**无改善**——上次三项 🔴（明文密钥、无认证代理、0.0.0.0+CORS）全部未修复，仍为最高优先级；🟠 CDN 无 SRI 未修复；🟡 四项均未修但危害较低；🟢 XSS/归档/无原型污染防护稳固。
- 关键建议：立即收敛 F1（密钥移出仓库/用密钥库）+ F2（bind 127.0.0.1、CORS 限 localhost、AI/OCR 加 loopback 校验）；F3 自托管或加 SRI；F4 仅允许 http(s)/data 协议。

### 🔧 排障手（代码质量与技术债）
- 核心判断：健壮性骨架未塌（异步纪律、零吞 reject 仍保持），但技术债**恶化**——调试日志量上升（245 处，新增 87 处 info/debug）、巨型文件未瘦身且新增多个大文件、清洗/归一化 helper 由 8 处发散到约 45 个模块（如 `cleanDisplayTextForBatchSave` 在 11 个活跃模块重复定义）。能跑、有测试、有诊断模块已属难得，但距"可维护"仍远。
- 关键建议：全局错误处理器接入 toast/错误条（最小改动最大收益）；以 `qisi-secure-logger` 为唯一日志出口加级别开关；收敛同名 helper 到单一定义；彻底移除死备份 `.bm_a4_app_before.js`。

---

## 2. 综合审查发现（去重合并后按严重度排序）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源成员 |
|---|--------|------|------|---------|------|---------|
| 1 | 🔴 | 安全 | `.env:1`；`qisi-local-server.js:44,152-158,675` | 明文 `DASHSCOPE_API_KEY` + `/api/ai/chat`、`/ocr` 无认证 + CORS `origin:true` + 监听 `0.0.0.0`；局域网/恶意网页可借浏览器以教师密钥中继 | 密钥移出仓库/用密钥库；bind 127.0.0.1；CORS 限 localhost；AI/OCR 加 loopback 校验 | 安全官 |
| 2 | 🔴 | 架构 | `app.js`（5,091 行） | 单体协调器，119 处 `window.Qisi.*` 全局挂载，单一变更点+无法单测 | 冻结增长，抽纯逻辑为带 module.exports 的 qisi 模块；`verify:diff-scope` 强制 | 产品评审 |
| 3 | 🔴 | 架构 | `qisi-batch-engine-v2.js`（2,053 行/≈293 函数） | 最大单体模块，≈7 行/函数，难测难改 | 按内聚性提 policy/service 或内联拆分 | 产品评审 |
| 4 | 🔴 | 健壮性 | `app.js:5045-5054` | 三处全局错误处理器仅 console.error（unhandledrejection 还 preventDefault），界面零提示 | 接入 toast/错误条，上浮 error 与 unhandledrejection | 排障手 |
| 5 | 🔴 | 质量 | 活跃源码（约 45 模块） | helper 发散恶化：clean/normalize/sanitize 类散布约 45 模块，`cleanDisplayTextForBatchSave` 在 11 个模块重复定义（首轮仅 8 处） | 收敛进 qisi-utils 单一定义，其余 import | 排障手 |
| 6 | 🟠 | 安全 | `main.html:11-20` | 8 个运行时库走 unpkg CDN 无 SRI，可被替换投毒 | 自托管 + 版本锁 + SRI | 安全官 |
| 7 | 🟠 | 架构 | `qisi-*.js` 命名 | 命名爆炸微恶化：contract 2→3、adapter 2→3；policy×11/service×7/port×6… | 改目录分层（`ports/`、`policies/`）替代 89 平铺文件 | 产品评审 |
| 8 | 🟠 | 架构 | `qisi-utils.js`（1,006 行/189 函数） | "杂物间"未拆，耦合高 | 按 LaTeX/normalize/校验分文件 | 产品评审 |
| 9 | 🟠 | 质量 | 活跃源码 245 处 console.* | 调试日志加剧：log87/warn42/error29 + 重构新增 info/debug 87（含 `[BATCH_DEBUG]`/`[BATCH_COST]`） | `qisi-secure-logger` 唯一出口 + 级别开关，止血 87 处调试日志 | 排障手 |
| 10 | 🟠 | 质量 | 巨型文件未瘦身+扩散 | app.js 5091、batch-engine-v2 2053、support-parser 1652、visual-support-source 1645 行数同首轮；新增 batch-importer 72KB、pdf-candidate-projection 54KB、storage-repository 38KB 等 >30KB 文件 | 对新增大文件做下一轮拆分，避免"拆出更多大文件"式重构 | 排障手 |
| 11 | 🟡 | 架构 | `qisi-ui-renderer.js`、`qisi-storage-facade.js` 等 | 名不副实：1 行薄壳（renderDraftSummary/createDraftRecord）、19 行/15 行透传壳，cargo-cult 分层 | 合并入调用方，消虚假分层 | 产品评审 |
| 12 | 🟡 | 安全 | `app.js:4379`、`qisi-components.js:118` | `img.url` 仅 escapeHtml 不校验 scheme，`file:///` 或外部 URL 外联风险 | 仅允许 http(s)/data | 安全官 |
| 13 | 🟡 | 安全 | `qisi-local-server.js:487,493` | `/api/convert/self-test` 泄露本地 LibreOffice 路径 | 生产隐藏或仅回环访问 | 安全官 |
| 14 | 🟡 | 安全 | `app.js:4500`、`tokenizeLatexSource` | 不可信 LaTeX 极端输入 ReDoS（KaTeX renderToString） | 输入长度/复杂度上限 | 安全官 |
| 15 | 🟡 | 安全 | `package.json:28` | `multer 1.4.5-lts.1` 过旧 | 升 2.x | 安全官 |
| 16 | 🟡 | 质量 | `.bm_a4_app_before.js`（22,813 行/1.17MB/504 console） | 死备份滞留根目录，已 gitignore 未删 | 移出工作树/归档 | 排障手 |
| 17 | 🟢 | 安全 | `qisi-components.js:74`、`app.js:4370,4504` | XSS 防护到位：escapeHtmlLocal + KaTeX trust:false，无 eval/new Function | 保持 | 安全官 |
| 18 | 🟢 | 安全 | `qisi-archive-security.js`、`qisi-backup.js:92` | 归档安全强：路径穿越/嵌套/压缩炸弹/比率全防护 | 保持 | 安全官 |
| 19 | 🟢 | 安全 | 全仓 grep | 无原型污染、无命令注入 | 保持 | 安全官 |
| 20 | 🟢 | 测试 | `tests/` 230 个 .test.js | 测试门禁真绿（verify:safe 含 check+test+smoke+no-real-ai） | 保持门禁 | 产品评审 |
| 21 | 🟢 | 安全 | PDF 支持链（宪法 §3） | 答案挂接仅 full/prefix/fail-closed 三态，禁语义/关键词挂接 | 保持 fail-closed | 产品评审 |
| 22 | 🟢 | 健壮性 | 全仓 grep | 异步纪律保持：0 处吞 reject 的 `.catch(()=>{})`、9 处 catch 均带处理体；无残留 TODO/FIXME | 保持 | 排障手 |

---

## ✅ 行动清单（具体可执行项）

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | 修本地服务安全：`.env` 密钥移出/密钥库；`qisi-local-server.js` bind 127.0.0.1、CORS 限 localhost、AI/OCR 加 loopback 校验 | 教师+AI | P0 | 立即 |
| 2 | 全局错误处理器接入 toast/错误条（app.js:5045-5054），上浮 error 与 unhandledrejection | 教师+AI | P0 | 本周 |
| 3 | 止血 helper 发散：收敛 clean/normalize 同名函数到 qisi-utils 单一定义，其余 import | 教师+AI | P0 | 本周 |
| 4 | 冻结 app.js 增长 + 装可测接缝：新逻辑禁入，抽纯逻辑为 module.exports 模块，用 verify:diff-scope 强制 | 教师+AI | P0 | 1–2 周 |
| 5 | 拆分 qisi-batch-engine-v2.js 为聚焦模块（按内聚性提 policy/service） | 教师+AI | P1 | 2–3 周 |
| 6 | main.html 运行时库自托管+版本锁+SRI；img.url 协议白名单 | 教师+AI | P1 | 2 周 |
| 7 | 统一日志出口 qisi-secure-logger + 级别开关；清理 `[BATCH_DEBUG]`/`[BATCH_COST]`；移除死备份 .bm_a4_app_before.js；合并 1 行薄壳 | 教师+AI | P2 | 后续迭代 |

---

## ⚠️ 待完善 / 已知局限

- **零改动警示**：自 2026-07-17 评审后无任何提交（git log 空），意味着首轮提出的修复项均未启动；本次重审价值在于确认状态并标记**新恶化项**。
- **技术债恶化**：模块化重构（7 月）把逻辑从 app.js 拆出时未收敛 helper，导致清洗/归一化函数发散到约 45 模块——"拆"本身没错，但缺统一抽象使可维护性不升反降。
- **评审范围**：覆盖架构/安全/质量三维；QA 发布、设计系统未纳入。
- **未实跑全量测试**：产品评审员未逐一执行 230 测试文件全量套件（结构确认门禁存在）。
- **调试日志统计口径**：活跃源码=根目录 *.js 排除 .bm_a4_app_before.js / node_modules / scripts / tests / local-ocr。

---

## 📚 成员产出索引

- gstack-product-reviewer（产品评审员）原始产出：架构与整体评价（含 git 零改动确认、app.js 119 处全局挂载统计、命名税恶化、薄壳确认、AGENT_CONSTITUTION 边界评审）
- gstack-security-officer（安全官）原始产出：OWASP Top 10 + STRIDE 重审（含 F1–F10 明细、较首轮逐项"未修复"标注、XSS/归档/无原型污染仍有效）
- gstack-investigator（排障手）原始产出：健壮性与技术债重析（含 245 处 console 实测、helper 发散 8→45 恶化、巨型文件+新增大文件、异步纪律保持证据）

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人（教师本人）复核。
