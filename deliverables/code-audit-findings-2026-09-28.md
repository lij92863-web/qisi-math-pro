# 奇思数学 Pro — 代码审计交接报告

> **面向读者**：接手的 AI 或工程师。
> **重要**：本项目作者是一位完全不懂编程的高中数学老师，全部代码由 vibecoding 产出。
> 请不要把本文件的技术内容直接转述给用户；给用户的结论请用生活化语言：会不会丢题、今天能不能用、要不要处理。

| 项 | 值 |
|---|---|
| 审计日期 | 2026-09-28 |
| 项目路径 | `C:\Users\Administrator\Desktop\题库系统` |
| 分支 / HEAD | `stage/program-c-corrective-r1` / `3794f4f` (2026-07-14 14:50) |
| 审计方式 | **只读**，全程未修改任何源码（已复核 `git status`） |
| 代码规模 | 89 个 `qisi-*.js` / 34,654 行；231 个测试文件 / 33,820 行；403 篇 md / 1,618,314 字符 |

---

## 0. TL;DR

**当前 HEAD + 当前工作树状态下，浏览器界面处于"完全无响应"状态**（点击无效、无法保存、无法切换页面）。
这不是渐进退化，是**硬故障**，可以稳定复现。根因已通过 A/B 对照实验锁定：

> 2026-07-24 一次「CDN 依赖本地化」改造，把 Vue 从 **3.5.39 降级到 3.4.27**，
> 触发了代码中一个早已存在的猴补丁缺陷，导致 Vue 渲染 effect 无限递归、后续 patch 全部中止。

**已验证的最小修复**：将 `vendor/vue/vue.global.prod.js` 换回 3.5.39（原始字节就在本仓库缓存目录中）。
零业务代码改动。实测修复后 5 项功能全部恢复、控制台错误归零。

其余问题（安全、数据可靠性、测试注水、文档失控、技术债）均为**中长期项**，不影响当日可用性。

---

## 1. 环境准备与复现

### 启动
```bash
cd "C:/Users/Administrator/Desktop/题库系统"
node qisi-local-server.js          # 端口 PORT || 3000
# 入口 http://localhost:3000/main.html
# 健康检查 http://127.0.0.1:3000/api/health
```

### 复现 P0 故障（30 秒内）
1. 浏览器打开 `http://localhost:3000/main.html`，打开开发者工具 Console。
2. 观察到一条形如 `[QISI_LOG] {stage: application}` 的 error（**此文本经过脱敏，看不出真实错误**）。
3. 点击顶部任何导航按钮（新题目录入 / 批量录题 / 题库与检索 / 智能组卷台 / 个人管理 / 极客排版配置）。
   → **全部无反应，永远停在"新题目录入"。**
4. 在题干区输入内容后点「确认无误，保存入库」→ 输入框不为空、数据未落库、页面无变化。

### ⚠️ 排错前提：先把日志脱敏关掉，否则看不到真相
`qisi-secure-logger.js` 会劫持 `console.error` 并把原始报错压缩成 `{stage: application}`。
这是本故障长期未被发现的**直接原因**。

用 playwright 把该脚本替换成桩件即可还原原始报错：
```js
await page.route('**/qisi-secure-logger.js*', route => route.fulfill({
  status: 200, contentType: 'application/javascript',
  body: 'window.QisiSecureLogger=(function(){return{createSecureLogger:function(){return{install:function(){return console;}}}};}())'
}));
```
还原后的真实报错：
```
RangeError: Maximum call stack size exceeded
  at app.config.errorHandler (app.js:5046)
  at trigger / triggerEffects ... （无限 ke→Nt→trigger 递归）
```

> **另一个坑**：若要替换 `vendor/` 下任何资源做实验，`main.html` 里的 `integrity="sha384-..."` SRI 校验
> 会让替换后的脚本被浏览器拒绝执行（症状是整页空白）。实验时必须同时把 `integrity` 和
> `crossorigin="anonymous"` 属性剥离。

---

## 2. P0 界面完全无响应（必须最先修）

### 2.1 根因链

| 环节 | 证据 |
|---|---|
| 触发点（早已存在的地雷） | `app.js:4953` 调用 `installLatexDisplayNormalizer()`，定义于 `app.js:4301-4313` |
| 缺陷写法 | 该函数在运行时猴补丁 `LatexPreview.computed.htmlContent`，内部以 `originalHtmlContent.call({ ...this, content: …, options: …, images: … })` 调用原实现。`{...this}` 展开会把 `htmlContent` 自身一并读出，形成**同步无限递归** |
| 引爆条件（7/24 引入） | `main.html` 由 CDN `https://unpkg.com/vue@3/dist/vue.global.prod.js`（**未锁版本 = 取最新**）改为本地 `./vendor/vue/vue.global.prod.js`，后者为 **Vue 3.4.27** |
| 版本落差证据 | `vendor/vue/vue.global.prod.js` = 147,796 字节，`Vue.version` = `3.4.27`；<br>仓库缓存 `local-run-artifacts/r2-e2e-cdn-cache/0466824fb09aa2e344f0d1676d31a637a181baf3d473aba445e2889aa0b5b725.bin` = 164,901 字节，文件头为 `vue v3.5.39` —— 即 7/10–7/14 期间 E2E 实际使用的 CDN 版本 |
| 后果 | 首次渲染 `LatexPreview` 即抛出 RangeError → Vue 中止后续 patch → 所有由响应式状态驱动的更新（点击、保存、切页）全部失效 |

> 注意：`installLatexDisplayNormalizer` 自 git baseline（`809a2cb`）就存在，
> **它本身不是"最近引入的 bug"，而是被最近这次降级引爆的定时炸弹。**

### 2.2 A/B 实测数据（2026-09-28，磁盘零改动）

实验方式：`page.route('**/main.html*')` 剥离 SRI 属性 + `page.route('**/vendor/vue/vue.global.prod.js*')` 替换为缓存中的 3.5.39。

| 观测项 | 现状 Vue 3.4.27 | 仅换 Vue 为 3.5.39 |
|---|---|---|
| `Vue.version` | 3.4.27 | 3.5.39 |
| 公式预览渲染 | ❌ `.katex` = 0，停在空占位 | ✅ 正常渲染 |
| 保存入库（表单清空） | ❌ | ✅ |
| 切换页面（导航高亮） | ❌ 停在"新题目录入" | ✅ "题库与检索" |
| 题库检索到该记录 | ❌ | ✅ 显示"共 1 道试题"且公式正确渲染 |
| console error 数 | 1 | **0** |

对照组（**不推荐采用，仅证明机制**）：单独屏蔽 `app.js:4953` 那一调用，
同样可将预览恢复、错误归零。但会牵涉去留判断，见 2.3。

### 2.3 修复方案对比

| 方案 | 做法 | 代价 / 风险 | 建议 |
|---|---|---|---|
| **A（推荐）** | `vendor/vue/vue.global.prod.js` 替换为 3.5.39（源文件在 `local-run-artifacts/r2-e2e-cdn-cache/0466824f….bin`），并按新字节重算 `main.html` 中的 SRI `integrity` | 不触碰任何业务逻辑；但**必须同步更新 SRI**，否则页面直接拒绝加载 | ✅ 首选 |
| B | 改写/移除 `app.js:4301-4313` 的猴补丁 | 需先确认该补丁当初为解决哪个显示场景而加（cache-buster 名 `latex-display-options-guard-01` 提示为近期改动）。实验显示屏蔽后**裸 LaTeX（无 `$` 包裹）仍能正常渲染**，疑似已冗余，但需逐场景验证 | 次选，需谨慎 |
| C | 两者都做（升 Vue + 清理地雷） | 最彻底，但变更面扩大 | 有回归验证能力时推荐 |

### 2.4 修复后必须手验的清单（不要只信 `npm test`）
1. 打开 `main.html` → Console **零 error**。
2. 输入一道含 `\frac{}{}` 的题 → 右侧「完整题面排版预览」出现渲染后的公式。
3. 点「确认无误，保存入库」→ 输入框清空。
4. 切到「题库与检索」→ 能看到刚刚存入的题。
5. 逐个点开：批量录题 / 智能组卷台 / 个人管理 / 极客排版配置 → 均能进入。
6. 跑 `node --test tests/e2e/runtime-startup.test.js` → 应为 pass。

---

## 3. P1 重要项

### 3.1 依赖与版本控制（交付风险最高）
- `vendor/`（**2.9MB**，运行时 Vue / KaTeX / pdf.js / Dexie / JSZip / lucide 等）**未纳入版本库**，且未被 `.gitignore` 排除（`git check-ignore` 无命中）。
- 工作树存在**未提交改动**：`main.html`、`open-app.cmd`、`package.json`、`package-lock.json`。
- **后果**：换机、`git clone`、或任何 `git clean -fd` 后软件无法打开（依赖缺失）。
- **建议**：把 `vendor/` 提交入库（或改用包管理器 + 构建步骤），并先提交现有的四处改动。

### 3.2 测试套件当前为红灯
```
node --test --test-concurrency=1
→ EXIT=1 ; # tests 1692 ; # pass 1649 ; # fail 24 ; # cancelled 19 ; 耗时 ~8m48s
```
失败分布（`git diff` 无关，均为 HEAD 状态）：

| 文件 | 失败数 | 性质 |
|---|---|---|
| `tests/base-migration-execution-gate.test.js` | 6 | Windows `trash` 操作失败（环境相关），见 `[safe-delete] 操作失败` |
| `tests/base-migration-smoke.test.js` | 1 | 同上 |
| `tests/e2e/*.test.js`（14 个文件） | 17 | **与 P0 故障同源**，详见第 2 节 |

> 因此 `npm run verify:safe` **当前不通过**。在 P0 修复前，不要用"verify:safe 是否通过"作为验收标准。

### 3.3 测试有效性问题（约三成用例不验证任何行为）
| 类型 | 数量 / 位置 | 说明 |
|---|---|---|
| 断言 markdown 文档内容 | 24 个文件 | 例：`tests/ocr-quality-final-report.test.js:27` 断言报告中含有 `"i5-12400F"` 等字样；改报告即通过 |
| 源码正则 / 元测试 | 若干 | `tests/legacy-batch-owner-retirement.test.js:12-15`；`tests/true-producer-browser-authenticity.test.js:10-18` 读别的测试文件做断言 |
| 空壳断言 | 3 处 | `tests/qisi-app-display-cleaners-r3-shard-verify.test.js:31,48`；`tests/…-candidate-ranker.test.js:12` 为 `assert.ok(true)` |
| 同义反复（自写 PASS 再断言 PASS） | 66 处 | 例 `tests/post-r2-counterfactual-zip-bomb.test.js:22-24` |
| 仅断言文件存在 | 48 处 `existsSync` | — |
| CWD 依赖 | 13 个文件 | 用相对路径读文件，换目录运行时 3 个"通过"会变失败 |

**加分面**（这些确实扎实，别误删）：`tests/pdf-support-aligner.test.js`、`tests/review-controller-fail-closed.test.js`
等 **PDF fail-closed 与草稿评审两条链有真正的反面测试**（喂坏数据必须拒绝），质量达生产级。
模块覆盖率也很高：89 个模块中 85 个有测试引用。

**建议**：把 `*-audit / *-report / *-gate` 类文档审计测试迁移到独立 `tests/evidence/` 目录，
让 `npm test` 只保留行为回归，红灯才有威慑力。

### 3.4 门禁可被绕过
- `.git/hooks/` **无任何生效钩子**（改完代码可不经检查直接提交）。
- `scripts/verify-diff-scope.js` 仅读取 `git diff` 与 `git diff --cached` —— **提交后两者皆空，必然输出 passed**。
- `scripts/verify-no-real-ai.js:20-27` 的 `allowedFiles` 白名单包含 `app.js` 与 `qisi-local-server.js`（最可能真调 AI 的两个文件）；`warningMarkers` 分支为空实现死代码。
- `scripts/verify-docx-stable.js`（17 行）、`verify-pdf-known-bad.js`（22 行）、`verify-batch-safety.js`（44 行）**只是转发壳**，不是真实校验。
- `scripts/verify-app-shell-architecture.js`（250 行，acorn AST 真校验）是**唯一动真格的门禁**，请勿削弱。

### 3.5 架构清单双轨制 —— 修复前必须先迁移测试依赖，不可直接删除其一
- `architecture/layers.json`：`qisi.architecture-manifest.v1`，**5 层 / 74 模块**
- `docs/architecture/layers.json`：`qisi.program-c-layers.r3`，**6 层 / 68 模块**
- 消费者分叉：
  - 读根版：`tests/architecture-manifest.test.js:21-22`
  - 读 docs 版：`tests/c2-13-owner-runtime-closure.test.js:29-30`、`tests/corrective-single-owner.test.js:40`、`scripts/verify-app-shell-architecture.js`
  - 两边都读：`tests/c2-13-owner-runtime-closure.test.js:89-90`
- 磁盘实际 89 个模块 → **18 个未登记的黑户**，不受门禁保护。其中关键者：
  `qisi-batch-importer.js`(1001 行)、`qisi-docx-pipeline.js`(662 行)、`qisi-file-dispatcher.js`(68 行/18 处引用)、`qisi-runtime.js`、`qisi-db.js`、`qisi-components.js`、`qisi-config.js`。
- **严禁直接删掉其中一份**，会导致另一侧的测试崩。

### 3.6 文档失控
- 403 篇 md / 1,618,314 字符；`docs/refactor/` 214 篇、`docs/testing/` 73 篇、`docs/architecture(+adr)` 43 篇、`docs/release/` 30 篇、`docs/audit(s)` 13 篇。
- **201 篇（50%）** 文件名带 `_R1/_R2/_R3/_C2_11/_RC3/_WAVE/BATCH_001` 波次后缀；**155 篇（38%）** 小于 3KB。
- `docs/refactor/` 内有 26 篇 `BM_AUTO_A4_R3_CONT_BATCH_00X.md` 机器流水日志。
- `docs/archive/` 仅一个 274 字节 README（归档制度从未执行）。
- 另有 background：`ai/MODULE_BOUNDARIES.md` 引用了**不存在的** `docs/stages/*.md`；文档引用了 9 个已从代码中消失的模块（如 `qisi-batch-workflow.js`、`qisi-storage.js`）。
- **真正有价值的只有**：`ai/` 下 7 篇治理文档 + `skills/` 下 9 篇 SKILL.md + `scripts/verify-app-shell-architecture.js`。

### 3.7 安全性
| 级别 | 问题 | 证据 |
|---|---|---|
| 高 | 监听所有网卡 + 全站无鉴权 | `qisi-local-server.js:675` `app.listen(PORT, …)` 未传 host；对比 `local-ocr/server.js:318` 显式绑 localhost，说明是遗漏 |
| 高 | CORS 反射任意来源 | `qisi-local-server.js:44` `cors({ origin: true, credentials: false })` |
| 高 | 静态托管整个项目根目录 | `qisi-local-server.js:161` `express.static(ROOT)`；源码、`tmp/uploads`（上传的 DOCX）、转换产物、`local-run-artifacts/` 均可匿名下载（serve-static 默认忽略 dotfiles，故 `.env`/`.git` 不可达） |
| 高 | AI 代理无鉴权无限流 | `:152` `/api/ai/chat`、`:156` `/api/ai/ocr`，body 原样转发（`:92`），服务端注入 Key（`:109`）；可被匿名刷配额 |
| 中 | 环境变量投毒可执行任意程序 | `findLibreOfficeExecutable()` 从 `QISI_SOFFICE_PATH` / `SOFFICE_PATH` / `LIBREOFFICE_PATH` 取可执行文件路径（`:317-340`） |
| 中 | 上传无 MIME 校验 | 仅 80MB 限制（`:175`）+ 落盘后按扩展名拒绝（`:611-618`）；`:487` `/api/convert/self-test` 无鉴权可拉起 PowerShell/Word COM |
| 低 | `img src` 未做协议白名单 | `app.js:4379` 附近 |

**已做对的（勿破坏）**：模型名白名单 `/^qwen[-_.a-z0-9]+$/i`（`:55`）、上游 URL 常量化（`:28-29`）→ **无 SSRF**；
`spawn` 用参数数组且未开 shell（`:271-281`、`:383-396`）→ 无命令注入；
`.env` 已被 `.gitignore` 排除且未进提交史；
XSS 防护到位：全库 `eval` / `new Function` / `insertAdjacentHTML` 计数为 0，唯一富文本出口 `main.html:33` 的 `v-html` 上游已 `escapeHtmlLocal`（`qisi-components.js:76-80`）+ KaTeX `trust:false`（`app.js:4500-4504`）。

---

## 4. P2 技术债

### 4.1 上帝模块与重复代码
| 问题 | 证据 |
|---|---|
| 上帝模块 | `qisi-batch-engine-v2.js` 2053 行 / 56 函数，同时负责分题、DOCX/PDF 证据、图片框、批处理、视觉识别 |
| 大型多职责模块 | `qisi-support-parser.js` 1653 行；`qisi-visual-support-source.js` 1646 行；`qisi-pdf-candidate-projection.js` 1331 行 |
| 工具模块失守 | `qisi-utils.js` 1006 行，暴露 53 项，混合 LaTeX / bbox / 分页 / 筛选 / OCR 错误 |
| **重复：去重指纹算法** | `qisi-db.js:120-139` 与 `qisi-question-duplicate-policy.js:33-50` 各写一遍 |
| **重复：题号规范化** | `qisi-docx-pipeline.js:70-77` 与 `qisi-question-content-policy.js:339-347` |
| **重复：选项分割** | `app.js:792-845` 与 `qisi-batch-engine-v2.js:134-168` |
| **重复：bbox 规范化** | `qisi-batch-engine-v2.js:911-942` 与 `qisi-utils.js:614-643` |
| fail-closed 判定散落四处 | `qisi-pdf-support-aligner.js:409-460`、`qisi-pdf-candidate-projection.js:849-952`、`qisi-pdf-answer-only-extraction.js:128-263` |

### 4.2 app.js 边界违规（宪法明令禁止）
`ai/MODULE_BOUNDARIES.md:20-32` 要求 app.js 只做协调。现状：5091 行、约 182 个 setup 级函数、90 个响应式状态、38 个 computed。
仍含业务逻辑：选项解析 `:792-845`、OCR 规范化 `:1301-1392`、题库包解析 `:3382-3440`、直接事务写入 `:3487-3519`、
以及对 Vue computed 的运行时猴补丁 `:4301-4313`（**即本次 P0 地雷**）。
`scripts/verify-app-shell-architecture.js` 只锁了 9 个入口函数，覆盖面明显不足。

### 4.3 数据层
- Dexie `QisiMathVueDB` v8（`qisi-db.js:86-98`，12 张表）；v2→v7 迁移链完整，**v8 缺 upgrade**。
- `questions` 表**无唯一约束、无指纹索引**；去重在内存比对（`qisi-question-duplicate-policy.js:53-96`）→
  **并发批量导入存在竞态，可能产生重复题**。新增路径无乐观锁（仅 `updateQuestion` 有 `expectedUpdatedAt`，见 `qisi-storage-repository.js:352-362`）。
- 软删除字段 `deletedAt` 未建索引（`qisi-storage-repository.js:367`）→ 全表扫描。
- **无自动备份**（仅 `hasRecentFullBackup` 提醒，`:356`）；`restoreBackup`（`:891`）**仅被测试引用，UI 未接入**；恢复使用 `clear()+bulkPut`，有事务但无二次确认。
- 备份本身质量尚可：`qisi-backup.js` 含 manifest 计数比对，`qisi-archive-security.js:57-90` 有 zip 炸弹与路径穿越防护。

### 4.4 性能
- 实测（localhost）：首屏 **1,478ms** / **101 个请求** / **4,245,211 字节**。
- `qisi-local-server.js:161` 设置 `maxAge: 0, etag: false` → **完全禁用 HTTP 缓存，每次刷新重传 4.2MB**。
- `main.html:1519-1592` 顺序加载约 73 个 `<script>`，无打包器。
- 最大资源：tailwind 407KB、lucide 330KB、pdfjs 320KB、katex 277KB、app.js 272KB、vue 148KB。

---

## 5. 十维度评分（供参考）

| 维度 | 分 | 一句话 |
|---|---|---|
| 业务安全设计（fail-closed） | 9 | 宪法、代码、反面测试三处一致落地，优于多数商业软件 |
| 核心算法质量 | 8 | `qisi-pdf-support-aligner.js` 三态判定干净，无语义猜测 |
| 测试有效性 | 6 | 覆盖率 95.5%、核心链质量高，但约 30% 不验证行为 |
| 数据可靠性 | 6 | 迁移链完整，但无唯一索引、无自动备份、恢复未接 UI |
| 性能与依赖 | 6 | 够用，但全禁缓存 + 4.2MB 重传 |
| 工程门禁与流程 | 5 | 有真 AST 门禁，但无 git hook、两个门禁可绕过 |
| 安全性 | 5 | 单机离线无碍；公用网络下同网段可读题库 |
| 架构与模块划分 | 4 | 上帝模块、18 个黑户、两份打架的清单 |
| 代码可维护性 | 4 | 多处关键逻辑双写，app.js 边界失守 |
| 文档治理 | 3 | 403 篇多为机器流水，已开始自相矛盾 |

**综合 5.6 / 10**。强项集中在"业务领域判断"，弱项集中在"工程可持续性"——典型的 vibecoding 产物画像。

---

## 6. 建议优先级

| 优先级 | 事项 | 验收方式 |
|---|---|---|
| 🔴 立即 | 修复 Vue 版本（方案 A），同步更新 SRI | 第 2.4 节 6 项手验 + `tests/e2e/runtime-startup.test.js` pass |
| 🔴 立即 | 提交 `vendor/` 与现有四处未提交改动 | `git status` 干净；在临时目录 clone 后能打开 |
| 🟠 近期 | 让 security logger 对 error 保留关键信息（至少保留 `error.message`） | 制造一个异常，控制台能看到真实报错 |
| 🟠 近期 | 加 git pre-commit hook 串接真实校验 | 故意改 `app.js` 业务逻辑 → 提交被拦 |
| 🟠 近期 | 把文档审计类测试迁出 `npm test` | `npm test` 只保留行为回归 |
| 🟠 近期 | 合并双份架构清单，补齐 18 个黑户登记 | 两份清单合并后所有相关测试仍 pass |
| 🟡 中期 | `app.listen(PORT, '127.0.0.1')` + CORS 白名单 + 静态目录收窄 | 外部无法访问 `/src` 等非授权路径 |
| 🟡 中期 | 403 篇历史文档整体归档冻结 | 保留 `ai/` 7 篇 + `skills/` 9 篇 |
| 🟡 中期 | 题目表加去重索引；把备份恢复接进 UI | 并发导入不产生重复题；用户可自助恢复 |

---

## 7. 给接手 AI 的注意事项（务必先读）

1. **先读治理文档再动手**：`ai/AGENT_CONSTITUTION.md`、`ai/MODULE_BOUNDARIES.md`、`ai/STABLE_CHAINS.md`、
   `ai/ACCEPTANCE_CRITERIA.md`、`ai/TESTING_GUIDE.md`、`ai/CODEX_WORKFLOW.md`，以及 `AGENTS.md`。
   （注意：这 7 篇合计约 21,561 字符；若再叠加 9 篇 SKILL.md 共 41,913 字符，请自行判断上下文预算。）
2. **硬禁忌**：不得重写 `app.js`；不得往 `app.js` 加业务逻辑；不得调用真实 AI/OCR 端点；
   不确定时 fail-closed；**挂错答案比没有答案更糟**。
3. **不要破坏 UMD 双环境导出**：89 个 `qisi-*.js` 均以 `window.Qisi.*` + `module.exports` 双导出，
   这是 1692 个测试能脱离浏览器运行的**根本前提**（7 个例外：engine/importer/components/config/db 仅浏览器，
   local-server/temp-job-manager 仅 Node）。
4. **四条稳定链不可碰**：A DOCX+DOCX 导入 / B PDF fail-closed 对齐 / C 草稿评审区 / D 本地 AI-OCR 边界。
5. **不要用 `npm test` 全绿作为唯一验收**：当前 tests 为红且约三成用例不验证行为。**请以浏览器实跑 results 为准。**
6. **最小变更原则**：一次任务一处改动，禁止顺手"改善"无关代码、禁止改测试期望。

---

## 附录：本报告中每条结论的可复现命令

```bash
# 规模统计
wc -l qisi-*.js | tail -1                      # 34654
ls -1 tests/*.js | wc -l                       # 231
find docs -name "*.md" | wc -l                 # 403

# 全量测试（务必后台 + timeout，约 9 分钟）
timeout 900 node --test --test-concurrency=1

# 安全三件套
sed -n '44p;161p;675p' qisi-local-server.js

# Vue 版本证据
grep -o '"3\.4\.27"' vendor/vue/vue.global.prod.js | head -1
head -c 80 local-run-artifacts/r2-e2e-cdn-cache/0466824fb09aa2e344f0d1676d31a637a181baf3d473aba445e2889aa0b5b725.bin

# 工作树状态（审计前即为脏，本报告未造成任何改动）
git status --short
```

---

**审计人注**：本报告由一次只读审计产出，作者身份为 AI 助手。所有结论均附文件路径与行号，可自行复核；
对引用结果存疑时，请以第 1 节的实跑方法亲自验证，不要直接采信本报告的推断。
