# 奇思数学 Pro 代码评审与专业评价报告

**日期**：2026-07-17
**场景**：代码审查 + 安全审计 + 代码质量分析（多成员协作）
**参与成员**：产品评审员（架构/整体评价） + 安全官（OWASP+STRIDE 审计） + 排障手（代码质量/技术债/健壮性）

> 评审对象：高中数学题库系统"奇思数学 Pro"，本地优先应用，392 个源文件、约 11.3 万行（含测试）。
> 评审方式：三位专家在 GStack 工程团队内独立审阅、交叉印证，主理人汇编收口。

---

## 📌 TL;DR（执行摘要）

- 整体结论：**🟡 有条件通过** —— 作为一位高中数学教师用 vibecoding 写出的作品，其工程质量（治理约束、测试门禁、安全 fail-closed 设计）远超同类平均水平；但存在"结构过载"与"本地服务被忽视的安全风险"两类隐患，需优先处理。
- 阻塞项数量：**4 项 🔴（高）**，优先于功能扩展。
- 架构校正：项目并非纯前端——存在一个本地 Express 服务（`qisi-local-server.js`，监听 localhost:3000），攻击面大于"无服务端"假设，真实风险集中在此。
- 下一步：先修 4 项 🔴（明文密钥/开放代理、app.js 收缩、batch-engine-v2 拆分、错误向用户浮现），再做 🟠 项治理。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| Go / No-Go | 🟡 条件 Go（可继续迭代，但须先修 4 项高优问题） |
| 严重度分布 | 🔴 4 / 🟠 5 / 🟡 8 / 🟢 6 |
| 关键行动项 | 7 条（见行动清单） |
| 建议负责人 | 教师本人 + 可借助 AI 协助重构（受 AGENTS.md 约束） |

---

## 1. 各成员核心结论

### 🔍 产品评审员（架构与整体评价）
- 核心判断：这是 vibecoding 里"治理水平罕见之高"的一例——教师用自然语言驱动 AI 写出了复杂且安全关键的题库解析逻辑，并用 `AGENTS.md` / `AGENT_CONSTITUTION` 把"不污染题库、不确定则 fail-closed"钉成硬约束。代价是架构偏重：5,091 行 `app.js` + 89 个细粒度 `qisi-*` 模块 + 446 篇文档。微观代码合格，宏观结构过载。
- 关键建议：优先完成 `app.js` 收缩与 `qisi-batch-engine-v2.js` 拆分（两条 🔴）；收敛模块粒度（port/adapter/contract 多层、1 行薄壳 facade），治理 `qisi-utils.js` 杂物间，并为 446 篇过程文档瘦身。

### 🛡️ 安全官（OWASP+STRIDE 审计）
- 核心判断：本地优先显著缩小攻击面，客户端 XSS 与不可信导入内容处理已做防御；**真实风险集中在"被忽视的本地服务"**——`.env` 明文密钥、无鉴权的开放 AI 代理、CDN 依赖无 SRI。另需纠正"纯前端"假设：存在本地 Express 服务，CORS `origin:true` + 监听 `0.0.0.0` 使局域网/恶意网页可借教师浏览器以其密钥中继。
- 关键建议：🔴 三项（明文密钥+开放代理、CDN 无 SRI、img.url 协议未校验）优先修复；绑定 127.0.0.1、origin 白名单、本地令牌、密钥移出 `.env` 并轮换。

### 🔧 排障手（代码质量与技术债）
- 核心判断：作为非职业开发者产物，健壮性"超出预期"——异步纪律良好（969 await / 455 async，0 处吞 reject 的 `.catch(()=>{})`），全局错误处理器与诊断基建齐全，活跃源码无残留 TODO/FIXME。主要短板是生产代码调试日志噪音、错误不向界面上浮、巨型单文件理解成本。
- 关键建议：用 `qisi-secure-logger` 统一封装 console 并分级，把全局错误处理器接到用户可见错误横幅；上线前清理 `[BATCH_DEBUG]`/`[BATCH_COST]` 调试日志；清理死备份 `.bm_a4_app_before.js`；收敛 8 处 normalize/clean helper。

---

## 2. 综合审查发现（去重合并后按严重度排序）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源成员 |
|---|--------|------|------|---------|------|---------|
| 1 | 🔴 | 安全 | `qisi-local-server.js:44,152,156,675`；`.env:1` | 明文 `DASHSCOPE_API_KEY` + `/api/ai/chat`、`/ocr` 无认证 + CORS `origin:true` + 监听 `0.0.0.0`；局域网/恶意网页可借浏览器以教师密钥中继（配额盗用、内容注入） | 绑 127.0.0.1、origin 白名单、本地令牌、密钥移出 `.env` 并轮换 | 安全官 |
| 2 | 🔴 | 架构 | `app.js`（5,091 行） | 单体协调器，`setup()` 内接线约 50 个 Qisi 模块；"单一变更点 + 无法单测"，回归风险集中 | 把 `setup()` 内本地辅助与编排下沉 `qisi-*`，仅留 UI 状态/事件/模块调用，每步 `verify:safe` 护体 | 产品评审 |
| 3 | 🔴 | 架构 | `qisi-batch-engine-v2.js`（2,053 行/293 函数） | 最大单体模块，"v2"后缀暗示前期返工；函数极多、难测难改 | 按 DOCX/PDF/视觉来源拆成 ≤400 行聚焦模块并补单测 | 产品评审 |
| 4 | 🔴 | 健壮性 | `app.js:5045-5054` | 三个全局错误处理器（Vue errorHandler / window.error / unhandledrejection）均只 `console.error`，界面无提示；教师遇崩只能开 DevTools | 全局处理器接到用户可见错误横幅，业务错误可保留 toast | 排障手 |
| 5 | 🟠 | 安全 | `main.html:10-20` | 8 个运行时库（Tailwind/Vue/KaTeX/Dexie/JSZip/pdfjs…）走 unpkg CDN 无 SRI，可被替换投毒 | 自托管 + 版本锁 + SRI | 安全官 |
| 6 | 🟠 | 安全 | `main.html:317/716/743/782/836`；`app.js:3964/4267` | 导入题库可控 `img.url`，经 `:src` 与 fetch 加载，恶意值可置 `file://`/外部 URL 触发外联/隐私泄露 | 协议白名单（http/https/data/blob） | 安全官 |
| 7 | 🟠 | 架构 | `qisi-*.js` 命名 | 后缀 policy×11、service×7、port×6、parser×4、source×3、coordinator×3、contract×2、adapter×2……本地单用户工具铺端口/适配器/契约多层，导航与接手成本高 | 合并职责重叠者，删/改名 1 行薄壳，降低单人接手成本 | 产品评审 |
| 8 | 🟠 | 架构 | `qisi-utils.js`（1,006 行/189 函数） | 成新"杂物间"，把本应避免塞进 app.js 的逻辑在 utils 里重现，有成为第二个 dumping ground 风险 | 按 latex/ocr/answer 领域归并 helper | 产品评审 |
| 9 | 🟠 | 质量 | 活跃源码 159 处 `console.*`（87 log/42 warn/29 error） | 生产调试日志散布（如 `app.js:1167 [BATCH_DEBUG]`、`app.js:1138 [BATCH_COST]`），无分级/聚合 | 用 `qisi-secure-logger` 统一封装分 level，上线条件化调试日志 | 排障手 |
| 10 | 🟡 | 架构 | `qisi-storage-facade.js`、`qisi-ui-renderer.js` | 名不副实：各仅 1 行（前者只导 createDraftRecord，后者只返 3 字段摘要），真实实现在 `qisi-storage-repository.js`/`qisi-components.js`，易误判 | 删除薄壳或改名对齐真实职责 | 产品评审 |
| 11 | 🟡 | 架构 | `qisi-batch-importer.js:778` vs `app.js`（PageQuestionParser） | `parseOptionsFromBlock` 同时现于 DOCX 与 PDF 路径，疑似无意分化导致漂移 | 确认是否重复实现，统一到单一入口 | 产品评审 |
| 12 | 🟡 | 安全 | `qisi-local-server.js:487`；`qisi-components.js:202-233` | `/api/convert/self-test` 返回本地 LibreOffice 路径（信息泄露）；不可信 LaTeX 经多正则极端输入可卡 UI（ReDoS 风险） | 不回显本地路径；对 LaTeX 输入加长度/复杂度上限 | 安全官 |
| 13 | 🟡 | 质量 | `.bm_a4_app_before.js`（22,813 行/1.17MB） | 死备份已 gitignore（未入库）但仍留根目录，含 319 处 console.*，易与活跃代码混淆 | 确认被 qisi-* 取代后删除/归档，补 `.gitignore` 注释 | 排障手 |
| 14 | 🟡 | 质量 | 8 处 normalize/clean/sanitize 函数 | `normalizeType`/`normalizedDrafts`/`normalizeQuestionNo`/`cleanOptions`/`sanitizeFilename`… 发散 | 收敛到 `qisi-normalize-utils` 单一入口 | 排障手 |
| 15 | 🟡 | 安全 | `package.json:28` / `package-lock.json:14` | `multer 1.4.5-lts.1` 过旧 | 评估升级或加固定版本锁 | 安全官 |
| 16 | 🟢 | 安全 | `renderLatexPreviewHtml` / `qisi-runtime.js:41-44` | XSS 防护到位：`escapeHtmlLocal` + KaTeX `trust:false`，counterfactual 测试佐证脚本不执行 | 保持现有转义纪律 | 安全官 |
| 17 | 🟢 | 安全 | `qisi-archive-security.js` / `qisi-backup.js:92` | 归档安全强：路径遍历/嵌套归档/压缩炸弹/比率全防护 | 保持 | 安全官 |
| 18 | 🟢 | 安全 | 全仓 grep | 无原型污染（无递归 merge 不可信数据） | 保持 | 安全官 |
| 19 | 🟢 | 测试 | 230 测试文件 | 测试门禁真绿：`verify:safe` 实跑通过，`smoke:batch:mock` 20/20 | 保持门禁，勿为过测改期望 | 产品评审 |
| 20 | 🟢 | 安全 | PDF 支持链 | 答案挂接仅 full/prefix/fail-closed 三态 + known-bad 夹具（jump-back/重复/答解不一致均 fail-closed） | 保持 fail-closed 纪律 | 产品评审 |
| 21 | 🟢 | 健壮性 | 全仓 grep | 异步纪律良好（969 await/455 async，0 处吞 reject 的 `.catch(()=>{})`），无残留 TODO/FIXME | 保持 | 排障手 |

---

## ✅ 行动清单（具体可执行项）

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
|---|------|--------|--------|---------|
| 1 | 修复本地服务安全：`.env` 密钥移出并轮换；`qisi-local-server.js` 绑 127.0.0.1、AI/OCR 代理加本地令牌 + origin 白名单 | 教师 + AI | P0 | 立即 |
| 2 | 收缩 `app.js`：把 `setup()` 内本地辅助与剩余编排下沉 `qisi-*`，仅留 UI 状态/事件/模块调用，每步以 `npm run verify:safe` 护体 | 教师 + AI | P0 | 1–2 周 |
| 3 | 拆分 `qisi-batch-engine-v2.js` 为 ≤400 行聚焦模块（DOCX/PDF/视觉来源）并补单测 | 教师 + AI | P0 | 2–3 周 |
| 4 | 全局错误处理器接到用户可见错误横幅（替换 `app.js:5045-5054` 纯 console 行为） | 教师 + AI | P0 | 本周 |
| 5 | `main.html` 运行时库自托管 + 版本锁 + SRI；`img.url` 加协议白名单 | 教师 + AI | P1 | 2 周 |
| 6 | 统一封装 console（`qisi-secure-logger` 分级），上线前清理 `[BATCH_DEBUG]`/`[BATCH_COST]`；删除/归档 `.bm_a4_app_before.js` | 教师 + AI | P1 | 2 周 |
| 7 | 收敛模块粒度与 helper：合并 port/contract/adapter 重叠者，治理 `qisi-utils.js`，归一 8 处 normalize/clean | 教师 + AI | P2 | 后续迭代 |

---

## ⚠️ 待完善 / 已知局限

- **架构校正**：原任务假设"纯前端无服务端"，实际存在本地 Express 服务，安全审计以此为准；若未来改为远程部署，需重做 A01/A07（鉴权）评估。
- **评审范围**：本报告覆盖架构、安全、代码质量/技术债三维；QA 发布/设计系统未纳入（如需可加派质量门神、设计师）。
- **未实跑全量测试**：产品评审员实跑 `check` 与 `smoke:batch:mock`（通过），但 230 测试文件全量套件未逐一执行。
- **重复逻辑待核**：`parseOptionsFromBlock` 是否为真重复实现，需进一步确认（发现 #11）。
- **本地服务端口/令牌方案**：建议的 127.0.0.1 绑定与本地令牌需结合具体部署形态细化。

---

## 📚 成员产出索引

- gstack-product-reviewer（产品评审员）原始产出：架构与整体专业评价（含 review skill 评估、约束文件研读、门禁实跑证据）
- gstack-security-officer（安全官）原始产出：OWASP Top 10 + STRIDE 审计（含本地服务架构校正、CDN/SRI、密钥/代理、XSS 防护证据）
- gstack-investigator（排障手）原始产出：健壮性与技术债分析（含 Grep 实测 console 计数、异步纪律统计、死备份与 helper 发散证据）

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人（教师本人）复核。
