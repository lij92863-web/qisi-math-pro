# QISI-MATH-PRO ENGINEERING CLOSURE R2

## Phase 0.5 → Phase 8 连续工程闭环总任务

> 本任务用于 Codex Full Access。
> 一次接收、连续执行、阶段化提交、阶段化审计、遇到停止条件立即停止。
> “一次性完成”不等于一次巨型改动，而是由 Codex 自动完成从仓库现实审计到 Git 封存的完整工程闭环。

# 0. 角色、使命与执行原则

你在本任务中依次承担以下角色：

1. **Phase 0.5：仓库现实审计负责人**
2. **Phase 1：首席架构师**
3. **Phase 2：高级工程实现负责人**
4. **Phase 3：反事实攻击测试负责人**
5. **Phase 4：代码质量审计负责人**
6. **Phase 5：架构一致性审计负责人**
7. **Phase 6：Benchmark 审计负责人**
8. **Phase 7：最终 CTO 审查人**
9. **Phase 8：Git 发布与封存负责人**

必须形成完整闭环：

```text
仓库现实审计
→ 架构设计
→ 工程实现
→ 反事实攻击
→ 代码质量审计
→ 架构一致性审计
→ Benchmark 审计
→ CTO Go/No-Go
→ Git 封存
```

不得只写方案。不得只改代码。不得只跑单元测试。不得用自动测试代替真实浏览器验收。不得因为模型更强就扩大无边界修改。不得为了减少行数而复制代码、移动屎山或破坏稳定主链。

# 1. 项目信息与已知基线

Repository：

```text
https://github.com/lij92863-web/qisi-math-pro
```

Local path：

```text
C:\Users\Administrator\Desktop\题库系统
```

Expected branch before start：

```text
main
```

最近已确认干净基线：

```text
da699b53abbe8a6715bb8a8ffae5a954f6b514af
```

已知状态：

- `working tree clean`
- local `HEAD == origin/main`
- `tests/`、`scripts/`、`skills/`、`tools/` 已恢复
- Execution gate：15/15
- Route-B hold：6/6
- Controlled-write ownership：21/21
- BM-AUTO BMR1-BMR10 已结束
- BMR11 不允许自动进入
- DOCX+DOCX 是稳定主链
- PDF+PDF 定位为 `safe partial + manual review`
- controlled-write 是唯一正式写入真值闸门
- Route B answer-only 永久保持 research-only
- app.js 仍约 2 万行
- 现有自动门禁较完整，但浏览器真实交互、OCR Benchmark、长期架构和性能治理仍不足
- Windows 环境存在 `core.autocrlf=true`、index LF / worktree CRLF 的历史状态问题

如果当前 HEAD 已晚于 `da699b5`：

1. 记录真实 `START_HEAD`
2. 审计 `da699b5..HEAD` 的全部提交
3. 不丢弃任何后续合法提交
4. 以真实当前 HEAD 为本任务基线

# 2. 总目标

## G1：仓库治理与可恢复性

解决：

- 行尾策略不明确
- tracked / untracked / ignored / 临时产物混杂
- 日志、测试、脚本、审计文档边界不清
- 清理时误删 tests/scripts 等核心目录的风险
- 缺少清晰回滚点

最终要求：

- 有 EOL 政策
- 有资产清单
- 有清理分类
- 有文档索引
- 有 baseline tag
- 有可复现回滚说明

## G2：批量识别质量

必须分别测量和优化：

1. OCR 文字转写
2. 数学公式转写
3. 版面阅读顺序
4. 题号识别
5. 题干与选项拆分
6. 答案与解析拆分
7. 题目—答案—解析归属
8. 图片归属
9. 审核页显示
10. 人工修正成本

不能把所有问题都统称为“OCR 不准”。

## G3：可插拔 OCR 架构

支持：

- 当前 qwen-vl-plus
- 本地传统 OCR
- 本地文档视觉模型
- 后续其他引擎

所有 OCR 只能产出 candidate。任何 OCR 不得直接写题库。

## G4：测试真实性

解决：

- 测试复制生产函数
- 只 grep 源码、不执行生产路径
- Node 测试通过但浏览器白屏
- main.html script 漏加载
- 上传、审核、入库、刷新、导出没有完整 E2E

## G5：app.js 架构瘦身

目标不是机械减行，而是移除不属于 UI Shell 的职责。

最终 app.js 应主要负责：

- Vue 顶层状态
- 页面生命周期
- UI 事件入口
- 调用 controller/orchestrator
- 视图状态映射
- 顶层错误展示

以下逻辑不得继续新增到 app.js：

- OCR 具体调用
- JSON repair
- 答案归属
- storage 实现
- export 实现
- parser 细节
- 大型 review domain logic
- 题库查询业务逻辑

## G6：性能优化

必须先 Benchmark，后优化。

重点：

- upload-to-review
- 审核页首次渲染
- 切换题目
- KaTeX 重复渲染
- 大图片/base64
- storage 全量读写
- 题库列表
- 搜索与筛选
- 导出
- 主线程长任务
- 页面内存

## G7：长期可维护性

最终应具备：

- 清晰分层
- 单一 owner
- 数据契约
- runtime dependency gate
- production-linked tests
- browser E2E
- Benchmark
- attack suite
- release/rollback 文档

# 3. 不可违反的产品原则

## 3.1 DOCX 稳定主链

任何 OCR、PDF、架构、目录、性能、存储优化都不得破坏 DOCX+DOCX。

DOCX 主链至少包括：

```text
上传
→ 解析
→ 题号骨架
→ 题干/选项
→ 答案/解析
→ 审核
→ 编辑
→ 确认
→ 入库
→ 刷新持久化
→ 导出
```

## 3.2 PDF safe partial

PDF 允许：

- 题目缺失
- 答案缺失
- 部分公式原文保留
- 人工补录
- manual review required

PDF 不允许：

- 错挂答案
- 错挂解析
- 错挂题号
- raw JSON 当题干
- 识别失败占位题进入审核或题库
- AI 猜测内容进入 confirmed
- 断号后继续强行挂载
- 回跳后继续挂载
- answer/solution 不一致仍继续写入
- solution rejected 但 answer 单独保留

## 3.3 controlled-write 唯一正式写入入口

合法链路必须是：

```text
SourceAsset
→ RecognitionCandidate
→ NormalizedCandidate
→ StructuredQuestionDraft
→ ValidatedQuestionDraft
→ controlled-write decision
→ ReviewDraft
→ Manual Confirmation
→ Repository
```

任何 adapter、parser、review controller、OCR、UI 都不得直接写正式题库。

## 3.4 Route B 冻结

Route B answer-only：

- research-only
- 不进入生产
- 不参与自动补答案
- 不参与 controlled-write
- 不因新 OCR 引擎而恢复
- 不因 Benchmark 分数提高而自动转正

## 3.5 禁止猜测

禁止：

- 语义猜题号
- 根据解析猜答案
- 根据题目关键词猜答案归属
- 根据相似公式猜题目归属
- 从非法 JSON 正则抽字段直接入库
- 为提高完成率伪造字段
- 将无证据字段标记为 confirmed
- 断号后“补齐”题号继续写入

## 3.6 测试必须覆盖真实生产实现

禁止：

- 在 test 内复制 production helper
- 测试一份“等价实现”
- 只验证函数名存在
- 只验证源码字符串
- mock 掉 controlled-write 后宣称安全
- skipped/timeout 当 passed

# 4. 全局 Git、文件和外部调用规则

## 4.1 禁止命令

禁止：

```text
git reset --hard
git clean -fd
git clean -f
git add .
git add -A
git commit --amend
git push --force
git pull
git rebase
```

除 Phase 8 明确允许的 `git merge --ff-only` 外，禁止 merge。

禁止删除 `.git/index`。禁止 `git restore .`。禁止 `git checkout .`。

## 4.2 真实 API 和模型下载

默认禁止：

```text
node scripts/pdf-master-browser-runner.js real-run
npm.cmd run test:ai-proxy
npm.cmd run test:ai-vision-proxy
```

真实 OCR/API Benchmark 只有在以下条件同时满足时才允许：

```text
QISI_ALLOW_REAL_OCR_BENCH=1
```

并且：

- 用户凭证已配置
- 不输出 key
- 有调用预算说明
- 使用隔离 Benchmark
- 不进入正式题库
- 输出 requestId、engine、duration，不记录私密原文

模型下载只有在以下条件同时满足时才允许：

```text
QISI_ALLOW_MODEL_DOWNLOAD=1
```

并完成：

- 官方来源确认
- 许可证审计
- 磁盘空间审计
- CPU/GPU/显存审计
- Windows 兼容性审计
- `models/` 已 gitignore
- 不向 Git 提交权重

## 4.3 禁止提交

禁止提交：

- 模型权重
- 私有 PDF/DOCX
- 用户原始答卷
- API key
- `.env`
- 大型 base64 dump
- 本地 OCR 缓存
- 临时截图
- 运行日志
- Benchmark 私有原件
- Desktop 恢复证据文件

# 5. 连续执行、状态与提交策略

## 5.1 起始检查

执行：

```powershell
cd "C:\Users\Administrator\Desktop\题库系统"

git status --short
git branch --show-current
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git ls-remote origin main
git log --oneline -20
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
```

要求：

- branch = `main`
- working tree clean
- local HEAD == origin/main == live remote main
- 不存在 staged、unstaged、untracked
- 当前提交不早于 `da699b5`

不满足则停止。

## 5.2 Baseline tag

记录：

```text
START_HEAD=<真实当前 HEAD>
```

创建 annotated baseline tag：

```powershell
git tag -a pre-engineering-closure-r2-<short-head> <START_HEAD> -m "Qisi Math Pro pre engineering closure R2"
git push origin pre-engineering-closure-r2-<short-head>
```

若同名 tag 已存在但指向不同提交，停止。

## 5.3 工作分支

```powershell
git switch -c stage/post-rc-engineering-closure-r2
git push -u origin stage/post-rc-engineering-closure-r2
```

所有 Phase 0.5—7 的修改都在此分支。

## 5.4 状态文件

新增：

```text
ai/POST_RC_ENGINEERING_CLOSURE_R2_STATE.md
```

必须持续更新：

- Start HEAD
- Baseline tag
- Current branch
- Current phase
- Current work package
- Completed items
- Pending items
- Blocked items
- Commits
- Gate results
- Browser E2E results
- Benchmark results
- Known limitations
- Next exact action

每完成一个 work package：

1. 更新状态文件
2. 跑 targeted tests
3. 跑 mandatory gates
4. 定点 `git add`
5. 原子 commit
6. push 工作分支
7. 自动进入下一包

不得在普通 checkpoint 等用户确认。只有触发停止条件才停止。

## 5.5 原子提交规则

每个提交：

- 只处理一个领域
- 原则上不超过 5 个生产文件
- 不把架构、OCR、性能、UI 混在一个提交
- 先测试后迁移
- 旧实现删除必须与真实生产调用切换同提交
- 不保留两个 production owner
- 不复制实现

# 6. 高风险文件变更协议

以下文件默认冻结：

```text
qisi-pdf-support-controlled-write.js
qisi-pdf-support-aligner.js
qisi-pdf-support-block-parser.js
qisi-pdf-answer-only-extraction.js
qisi-pdf-answer-extraction-quality.js
scripts/pdf-master-browser-runner.js
```

如果 Benchmark 和失败测试证明必须修改：

1. 单独创建 high-risk work package
2. 先写 failing regression test
3. 写明不变量
4. 只改一个高风险 owner
5. 单独 commit
6. 跑全量 mandatory gates
7. 跑 browser E2E
8. 跑 known-bad corpus
9. wrong attachment 必须为 0
10. 不得降低 fail-closed 条件

任何高风险修改不得与 app.js 瘦身、UI 或性能修改同提交。

# 7. Phase 0.5：仓库现实审计与工程地基

本阶段先审计，再进行极小治理。不得修改业务行为。

## 0.5.1 基线与恢复真实性确认

记录：

- OS
- Node/npm 版本
- Git 版本
- browser runner 可用性
- 当前 HEAD
- branch
- remote
- tracked 文件数量
- working tree clean
- 核心 gate 文件存在

执行：

```powershell
node --version
npm --version
git --version

Test-Path app.js
Test-Path main.html
Test-Path tests\base-migration-execution-gate.test.js
Test-Path tests\pdf-route-b-hold.test.js
Test-Path tests\pdf-support-controlled-write-answer-ownership.test.js
Test-Path scripts\pdf-master-browser-runner.js
```

输出：

```text
docs/architecture/REPOSITORY_REALITY_BASELINE_R2.md
```

## 0.5.2 EOL Policy Audit

检查：

```powershell
git config --show-origin --get core.autocrlf
git config --show-origin --get core.eol
git config --show-origin --get core.filemode
git config --show-origin --get core.ignorecase

Test-Path .gitattributes
git ls-files --eol
```

统计：

- LF index / CRLF worktree 数量
- 混合行尾文件
- 二进制文件属性
- `.bat/.cmd/.ps1/.sh` 行尾
- JS/JSON/MD/HTML/CSS 行尾
- 是否有自定义 filter

输出：

```text
docs/architecture/EOL_POLICY_AUDIT_R2.md
```

### 可选实施规则

如果 `.gitattributes` 缺失，可设计：

```gitattributes
* text=auto

*.js   text eol=lf
*.mjs  text eol=lf
*.cjs  text eol=lf
*.json text eol=lf
*.md   text eol=lf
*.html text eol=lf
*.css  text eol=lf
*.yml  text eol=lf
*.yaml text eol=lf
*.sh   text eol=lf
*.py   text eol=lf

*.bat  text eol=crlf
*.cmd  text eol=crlf
*.ps1  text eol=crlf

*.png  binary
*.jpg  binary
*.jpeg binary
*.gif  binary
*.webp binary
*.pdf  binary
*.docx binary
*.xlsx binary
*.pptx binary
*.zip  binary
```

但在写入前必须预览：

```powershell
git add --renormalize -n -- .
```

若预览将引发大规模 tracked 内容变化：

- 不实施 renormalization
- 不提交大规模 EOL diff
- 只记录推荐策略
- 将 EOL migration 标记为独立未来任务

若不会造成批量内容变化，可独立提交 `.gitattributes`。

## 0.5.3 仓库资产清单

统计：

- tracked 总数
- production JS
- qisi modules
- tests
- scripts
- skills
- tools
- docs/refactor
- docs/testing
- docs/architecture
- docs/release
- local-test-materials
- 最大 50 个 tracked 文件
- untracked
- ignored
- 大于 5MB、20MB、100MB 的文件
- `.log/.tmp/.bak/.old/.orig/.rej`
- recovery/debug/scan/result/dump 命名文件

输出：

```text
docs/architecture/REPOSITORY_ASSET_INVENTORY_R2.md
```

必须分类：

A. 生产运行必需
B. 测试与 gate 必需
C. 工程脚本
D. 活跃架构文档
E. 历史审计证据
F. 私有本地材料
G. 可删除临时产物
H. 需人工确认，不得删除

本阶段不得删除无法确认用途的 tracked 文件。

## 0.5.4 系统地图

输出：

```text
docs/architecture/SYSTEM_MAP_R2.md
```

必须画出并说明：

```text
Input
├─ DOCX
├─ PDF
└─ Image

Recognition
├─ DOCX parser
├─ PDF text/image path
├─ OCR/VL
└─ formula/image extraction

Normalization
├─ JSON repair
├─ wrapper cleanup
├─ text normalization
└─ formula display normalization

Structure
├─ question parser
├─ option parser
├─ answer parser
├─ solution parser
└─ page/source order

Safety
├─ schema validation
├─ sequence validation
├─ ownership validation
├─ safe partial
└─ controlled-write

Application
├─ import orchestration
├─ review
├─ library
├─ storage
└─ export

UI
└─ Vue/app.js/main.html
```

每个节点必须列：

- owner 文件
- public API
- callers
- tests
- risk level
- known debt

## 0.5.5 app.js Reality Report

输出：

```text
docs/architecture/APP_JS_REALITY_REPORT_R2.md
```

统计和定位：

- app.js 总行数
- 顶层函数数量
- async 函数数量
- 最大 50 个函数
- Vue refs/reactive/computed/watch
- DOM
- upload
- DOCX
- PDF
- OCR
- JSON repair
- review
- library
- storage
- export
- formula rendering
- AI proxy
- legacy compatibility
- dead/suspicious code

每个候选块记录：

- 函数名
- 行范围
- 直接依赖
- reactive state 依赖
- 副作用
- 测试
- 推荐目标模块
- 提取风险
- 是否允许本轮提取

## 0.5.6 清理政策

输出：

```text
docs/architecture/CLEANUP_POLICY_R2.md
```

明确：

- 永远禁止 `git clean -fd`
- 删除前必须有清单
- tracked 文件必须审计引用
- tests/scripts/skills/tools 不能按日志删除
- docs/testing/docs/refactor 属于审计证据链
- 本地模型和私有材料不进 Git
- cleanup 必须独立提交
- 删除后跑 mandatory gates

## 0.5.7 重构守则

新增：

```text
ai/REFACTOR_GUARDRAILS_R2.md
```

写死：

- app.js 不新增大业务函数
- 不复制 helper
- 不新增第二 owner
- 不直接 localStorage/IndexedDB
- 不直接 OCR
- 不绕 controlled-write
- 测试不复制实现
- 每次提取先有 production-linked test
- 每次 script dependency 改动必须跑 runtime dependency gate
- 每次浏览器路径改动必须跑 E2E

## 0.5.8 Phase 0.5 验收与提交

允许变更：

- docs/architecture/**
- ai/**
- 可选 `.gitattributes`

运行：

```powershell
npm.cmd run verify:no-real-ai
```

根据实际文件精确设置 `QISI_ALLOWED_DIFF` 并运行：

```powershell
npm.cmd run verify:diff-scope
```

提交建议：

```text
stage closure r2 establish repository reality baseline
```

Phase 0.5 完成后自动进入 Phase 1。

# 8. Phase 1：架构师模式

本阶段主要设计目标架构、数据契约、测试架构和 Benchmark，不进行大规模业务修改。

## 1.1 目标分层

目标依赖方向：

```text
UI / Vue Shell
    ↓
Controller / Orchestrator
    ↓
Domain Services
    ↓
Validators / Safety Gates
    ↓
Adapters / Repositories
    ↓
OCR / Storage / Export / External Services
```

禁止反向依赖。

输出：

```text
docs/architecture/TARGET_ARCHITECTURE_R2.md
```

## 1.2 责任边界

### UI Shell

允许：

- Vue state
- lifecycle
- event adapter
- loading/error view
- controller 调用

禁止：

- OCR 解析
- ownership
- JSON repair
- storage 实现
- export 实现
- controlled-write 规则

### Controller / Orchestrator

负责：

- 流程顺序
- progress
- cancellation
- error mapping
- state transition

不得：

- 实现 OCR
- 猜答案
- 直接写 storage
- 绕 validator

### Domain Service

负责：

- question draft
- review lifecycle
- library query
- import candidate aggregation
- deterministic alignment

不得操作 DOM。

### Adapter / Repository

负责：

- qwen API
- local OCR service
- DOCX/PDF input
- IndexedDB/localStorage
- export implementation

不得包含答案归属策略。

### Safety Gate

必须唯一拥有：

- sequence acceptance
- answer/solution ownership
- safe partial decision
- formal write decision

## 1.3 数据契约

设计：

### SourceAsset

```text
sourceId
sourceType
filename
mimeType
hash
pageCount
createdAt
```

### RecognitionCandidate

```text
engine
engineVersion
requestId
sourceId
page
rawText
blocks
formulas
images
rawEvidence
engineConfidence
warnings
durationMs
```

### StructuredQuestionDraft

```text
sourceId
sourceOrder
questionNumber
type
stem
options
answer
solution
images
provenance
confidenceByField
warnings
rawEvidence
```

### ValidatedQuestionDraft

```text
schemaValid
sequenceValid
ownershipValid
supportLevel
rejectedFields
manualReviewRequired
validationErrors
```

### ConfirmedQuestion

```text
id
schemaVersion
sourceMetadata
questionNumber
type
stem
options
answer
solution
images
knowledgePoints
difficulty
tags
recognitionEngine
provenance
manualEdited
confirmedAt
createdAt
updatedAt
```

要求：

- JSDoc typedef
- runtime validator
- schemaVersion
- 不引入 TypeScript
- 不默认补答案
- 旧数据兼容只补元数据，不改题目内容

输出：

```text
docs/architecture/QUESTION_AND_RECOGNITION_CONTRACT_R2.md
```

## 1.4 OCR Engine Adapter 设计

统一接口：

```text
healthCheck()
getCapabilities()
recognizePage(input, options)
recognizeDocument(input, options)
cancel(requestId)
```

支持：

- current qwen adapter
- local OCR adapter
- document-VL adapter
- mock adapter
- future adapter

所有结果返回 RecognitionCandidate。

输出：

```text
docs/architecture/OCR_ENGINE_ADAPTER_R2.md
```

## 1.5 Runtime dependency 架构

设计：

```text
scripts/verify-qisi-runtime-dependencies.js
```

要求验证：

- app.js 使用的 `window.Qisi.*`
- qisi 文件定义的 namespace
- main.html script 顺序
- module 文件存在
- app.js 前加载
- 无重复 owner
- 无未定义 namespace
- 无 script 404 路径
- 可维护 manifest

输出：

```text
docs/architecture/RUNTIME_DEPENDENCY_STRATEGY_R2.md
```

## 1.6 测试架构

定义测试层级：

1. Pure unit
2. Production-linked module tests
3. Contract tests
4. Gate tests
5. Browser startup
6. Browser E2E
7. Known-bad fixtures
8. Counterfactual attack
9. Benchmark
10. Manual acceptance

输出：

```text
docs/testing/TEST_STRATEGY_R2.md
```

明确禁止：

- inline duplicate production implementation
- 只 grep
- mock 掉核心 safety
- skipped 冒充 passed

## 1.7 Benchmark 设计

输出：

```text
docs/benchmark/BENCHMARK_SPEC_R2.md
```

### OCR 文本指标

- raw CER
- normalized CER
- line exact match
- formula token precision/recall/F1
- formula exact match

### 结构指标

- question detection precision/recall
- question number accuracy
- stem completeness
- option completeness
- answer extraction accuracy
- solution extraction accuracy
- image attachment accuracy

### 安全指标

必须单列，不得被平均：

- wrong answer attachment
- wrong solution attachment
- fabricated question
- raw JSON leakage
- placeholder leakage
- unsafe sequence accepted
- answer/solution mismatch accepted
- controlled-write bypass

### 人工成本

- 每套卷修正题数
- 修正字段数
- 修正时间
- 重新识别次数
- manual review rate

### 性能

- cold start
- upload-to-review
- first review render
- switch p50/p95
- save
- reload
- export
- peak memory
- image payload

## 1.8 ADR

新增：

```text
docs/architecture/adr/ADR-001-LAYERED-ARCHITECTURE-R2.md
docs/architecture/adr/ADR-002-CANONICAL-CONTRACT-R2.md
docs/architecture/adr/ADR-003-OCR-ADAPTER-R2.md
docs/architecture/adr/ADR-004-BROWSER-E2E-R2.md
docs/architecture/adr/ADR-005-STORAGE-REPOSITORY-R2.md
docs/architecture/adr/ADR-006-APP-JS-SLIMMING-R2.md
docs/architecture/adr/ADR-007-BENCHMARK-RELEASE-R2.md
```

每个 ADR：

- Context
- Decision
- Alternatives
- Consequences
- Risks
- Compatibility
- Rollback
- Tests
- Migration sequence

## 1.9 工程实施计划

输出：

```text
docs/architecture/IMPLEMENTATION_BACKLOG_R2.md
```

按依赖排序：

1. 测试真实性
2. runtime dependency gate
3. browser E2E
4. contracts
5. storage repository
6. library service
7. review controller
8. export service
9. import orchestrator
10. OCR adapter/shadow
11. OCR Benchmark
12. recognition quality fixes
13. performance fixes
14. repository cleanup

每个任务写：

- Goal
- Files
- Forbidden files
- Preconditions
- Tests
- Acceptance
- Rollback
- Commit message
- Stop conditions

## 1.10 Phase 1 验收

运行：

```powershell
npm.cmd run verify:diff-scope
npm.cmd run verify:no-real-ai
```

提交：

```text
stage closure r2 complete architect design
```

自动进入 Phase 2。

# 9. Phase 2：工程实现

Phase 2 必须按工作包顺序执行。每个工作包独立测试、提交、push。

## WP2A：测试真实性审计与修复

### 目标

保证测试执行真实 production code。

### 任务

扫描 tests：

- inline repair function
- duplicated parser
- copied helper
- source-string-only assertion
- mocked safety owner
- 永远为真的断言
- skipped/timeout
- production module 未加载

输出：

```text
docs/testing/PRODUCTION_TEST_LINK_AUDIT_R2.md
```

修复原则：

- 提取真实 helper 到生产模块
- test import/require 真实模块
- app.js 内不可测逻辑先最小提取
- 不为测试建立第二实现

新增 guard：

```text
tests/no-duplicated-production-logic.test.js
```

验收：

- 已识别复制实现全部列出
- 高风险 helper 有真实路径测试
- controlled-write 不被 mock 掉
- tests 不复制 production 算法

提交：

```text
stage closure r2 link tests to production code
```

## WP2B：Runtime dependency gate

实现：

```text
scripts/verify-qisi-runtime-dependencies.js
tests/qisi-runtime-dependencies.test.js
```

必须抓到：

- 删除 `qisi-review-draft-state.js`
- 删除 `qisi-ui-events.js`
- script 放在 app.js 后
- namespace 拼错
- module 文件不存在
- 两个文件定义同一 owner
- app.js 使用未定义 namespace

可选建立：

```text
qisi-runtime-manifest.json
```

但 manifest 不得成为另一份手工易漂移真值；应尽量由代码和 main.html 推导。

提交：

```text
stage closure r2 add runtime dependency gate
```

## WP2C：Browser E2E

优先复用现有 browser runner。

若已有 Playwright/Puppeteer：

- 复用现有依赖

若没有：

- 先评估现有 runner
- 不立即增加依赖
- 若必须新增，先 ADR + 独立 package commit
- 审计许可证和 lockfile

E2E 必须覆盖 mock 链路：

1. 页面启动
2. 所有 script 加载
3. DOCX mock 上传
4. PDF mock safe partial
5. 审核页打开
6. 修改题干
7. 修改选项
8. 修改答案
9. 修改解析
10. 确认
11. 入库
12. 刷新
13. 数据仍存在
14. 导出
15. 删除测试数据
16. recent task
17. Console 无项目红色错误

新增建议：

```text
tests/e2e/runtime-startup.test.js
tests/e2e/product-acceptance.mock.test.js
tests/e2e/persistence.test.js
tests/e2e/export-delete.test.js
```

不得调用真实 AI。

提交：

```text
stage closure r2 add browser product e2e
```

## WP2D：标准数据契约

新增建议：

```text
qisi-recognition-contracts.js
tests/recognition-contracts.test.js
tests/question-schema-compatibility.test.js
```

实现：

- createRecognitionCandidate
- validateRecognitionCandidate
- createStructuredQuestionDraft
- validateStructuredQuestionDraft
- validateConfirmedQuestion
- schema version
- provenance
- immutable normalization

兼容层：

```text
legacyDraftToStructuredDraft()
structuredDraftToLegacyReviewDraft()
```

只允许一个 compatibility owner。

要求：

- 不补答案
- 不改题号
- 缺字段返回错误
- 旧数据只补安全元数据
- raw evidence 保留

提交：

```text
stage closure r2 add recognition contracts
```

## WP2E：Storage Repository

目标文件建议：

```text
qisi-storage-repository.js
```

职责：

- load library
- save question
- update question
- soft delete
- restore
- recent tasks
- save/load draft
- schema migration
- transaction
- backup/restore
- image metadata reference

app.js 不再直接处理：

- localStorage
- IndexedDB
- serialization
- schema migration
- quota recovery

测试：

```text
tests/storage-repository.test.js
tests/storage-migration.test.js
tests/storage-failure.test.js
```

攻击覆盖：

- quota exceeded
- corrupt data
- version mismatch
- interrupted write
- duplicate id
- two-tab write conflict
- double confirm

提交：

```text
stage closure r2 extract storage repository
```

## WP2F：Library Service

目标：

```text
qisi-library-service.js
```

职责：

- search
- filter
- sort
- pagination
- batch select
- duplicate detection
- soft delete
- restore
- metadata query

不得：

- 操作 DOM
- 直接 OCR
- 直接 parser
- 实现 storage 底层

测试：

```text
tests/library-service.test.js
tests/library-large-dataset.test.js
```

数据规模：

- 100 questions
- 1000 questions
- 5000 metadata-only records

提交：

```text
stage closure r2 extract library service
```

## WP2G：Review Controller

目标：

```text
qisi-review-controller.js
```

职责：

- review draft lifecycle
- field edit
- manualEdited
- warnings
- provenance display model
- confirm/cancel
- validation request
- dirty state

不得：

- 直接写题库
- 修改 controlled-write
- 猜答案
- 修改 ownership

测试：

```text
tests/review-controller.test.js
tests/review-confirmation-safety.test.js
```

提交：

```text
stage closure r2 extract review controller
```

## WP2H：Export Service

目标：

```text
qisi-export-service.js
```

职责：

- export mapping
- filename
- progress
- cancellation
- error mapping
- image resolution
- schema compatibility

不得依赖 Vue reactive object。

测试：

```text
tests/export-service.test.js
tests/export-failure.test.js
```

提交：

```text
stage closure r2 extract export service
```

## WP2I：Import Orchestrator

目标：

```text
qisi-import-orchestrator.js
```

职责：

- source intake
- choose DOCX/PDF path
- progress
- cancellation
- candidate aggregation
- validator call
- review handoff
- error mapping

不得：

- 实现 OCR 细节
- 实现答案 ownership
- 直接写题库

测试：

```text
tests/import-orchestrator.test.js
tests/import-cancellation.test.js
```

提交：

```text
stage closure r2 extract import orchestrator
```

## WP2J：OCR Benchmark 基础设施

创建：

```text
benchmarks/ocr/README.md
benchmarks/ocr/schema/ground-truth.schema.json
benchmarks/ocr/scripts/
benchmarks/ocr/results/.gitkeep
scripts/benchmark/score-ocr-result.js
tests/ocr-benchmark-scoring.test.js
```

私有材料：

```text
local-test-materials/ocr-benchmark/
```

必须 gitignore。

Ground truth：

```text
documentId
sourceHash
page
questionNumber
stem
options
answer
solution
formulas
images
expectedSafePartial
notes
```

至少覆盖：

1. 清晰 DOCX
2. 电子 PDF
3. 扫描 PDF
4. 歪斜
5. 低分辨率
6. 多公式
7. 几何图
8. 长解析
9. 题号不连续
10. known-bad

若真实材料不足：

- 建立 synthetic fixtures
- 报告缺失
- 不伪造真实结果

评分算法：

- Unicode NFC
- 全半角 normalization
- raw CER
- normalized CER
- LaTeX token F1
- formula exact
- question detection
- option completeness
- ownership safety
- manual correction cost

结构匹配只允许：

- questionNumber
- sourceOrder

禁止语义强行匹配。

提交：

```text
stage closure r2 add OCR benchmark harness
```

## WP2K：OCR Engine Registry 与 Adapter

新增：

```text
qisi-ocr-engine-registry.js
qisi-ocr-qwen-adapter.js
qisi-ocr-local-adapter.js
local-ocr/README.md
local-ocr/server_contract.md
tests/ocr-engine-registry.test.js
tests/ocr-adapter-contract.test.js
```

Registry：

- registerEngine
- getEngine
- listEngines
- healthCheck
- capabilities
- timeout
- cancellation
- default selection

Qwen adapter 只包装：

- request
- response
- timeout
- requestId
- raw result
- error mapping
- RecognitionCandidate

不得在 adapter 内：

- 对齐
- 猜答案
- controlled-write

Local OCR contract：

- bind 127.0.0.1
- MIME allowlist
- file size limit
- no arbitrary path
- temp cleanup
- concurrency limit
- timeout
- no raw content logs
- no external upload

提交：

```text
stage closure r2 add OCR engine adapters
```

## WP2L：Shadow Mode

实现：

```text
Current engine → production candidate
New engine     → shadow candidate → benchmark only
```

Shadow 结果：

- 不进入 controlled-write
- 不影响审核页
- 不自动选优
- 不补答案
- 只记录结构化对比
- 不记录用户原文日志

冲突处理：

- 不字段级拼接猜测
- 标记 manual review
- 保留双方 evidence

提交：

```text
stage closure r2 add OCR shadow mode
```

## WP2M：识别质量加固

仅根据 Benchmark 证据实施。

### 图像预处理

可选：

- rotation
- perspective
- deskew
- contrast
- grayscale
- threshold
- denoise
- crop

要求：

- 每步可开关
- 原图保留
- 记录 transformation matrix
- 记录 metadata
- 不覆盖原图

### 版面与阅读顺序

block 至少：

```text
id
bbox
page
column
order
type
rawText
confidence
```

多栏不得只按 y 排序。

优先：

1. column region
2. question anchor
3. adjacency
4. source order

### 题号

只接受：

- 连续
- 明确 prefix
- fail-closed

拒绝：

- duplicate
- reverse
- gap 后继续
- rewind
- answer/solution 序列不一致

### 选项

每个选项保留：

```text
label
rawText
normalizedText
evidenceBox
confidence
missing
```

### Ownership

必须综合：

- expectedQuestionNumbers
- sourceOrder
- answer sequence
- solution sequence
- continuity
- duplicate
- rewind
- pairing consistency

禁止：

- 关键词 overlap
- 数学语义 token 猜归属
- answer-only 单独保留

### Provenance

每个字段可回答：

- 文件
- 页
- block
- engine
- repair
- manual edit
- accept/reject reason

如需改高风险文件，执行高风险协议。

提交按子领域拆分，例如：

```text
stage closure r2 improve OCR preprocessing from benchmark
stage closure r2 improve document reading order
stage closure r2 harden question structure evidence
```

## WP2N：app.js 瘦身

按顺序提取：

1. storage
2. library
3. review
4. export
5. import orchestration
6. 其他经审计确认的领域

每次：

1. 先 production-linked tests
2. 提取真实实现
3. 删除 app.js 原实现
4. app.js 调新模块
5. runtime dependency gate
6. browser E2E
7. mandatory gates
8. commit

硬规则：

- app.js 不新增 >30 行业务函数
- 不新增直接 storage
- 不新增直接 OCR
- 不新增 ownership
- 不新增 JSON repair
- 不新增 export 细节

成功指标：

- 责任明显收缩
- owner 唯一
- 无复制实现
- 无新循环依赖
- 建议行数下降 ≥20%
- 若安全下降不足 20%，报告原因，不强拆

## WP2O：性能优化

先建立 baseline：

```text
docs/benchmark/PERFORMANCE_BASELINE_R2.md
```

新增可关闭性能监控：

```text
qisi-performance-monitor.js
tests/performance-monitor.test.js
```

不得记录题目原文。

记录：

- import
- OCR
- normalize
- validation
- review render
- formula render
- save
- reload
- export

### 审核页

依据 Benchmark 选择：

- 当前题优先
- 邻近题预渲染
- 长解析折叠
- 图片 lazy loading
- formula cache
- 避免全量 KaTeX
- stable key
- 减少重复计算

### 图片

- content hash
- thumbnail
- 原图独立存储
- object URL 生命周期
- 删除无引用图片
- 题目对象不重复塞大 base64

### Storage

- per-question update
- transaction
- metadata first
- image lazy load
- debounce save
- confirm 时 flush

### 列表

- pagination
- search debounce
- filter index
- stable sort
- large dataset fixture

### Worker

只有 Benchmark 证明主线程阻塞才考虑。

提交按瓶颈拆分。

## WP2P：Repository Cleanup 与文档索引

先审计，后删除。

分类：

A. 可删除临时文件
B. 应 gitignore
C. 应保留审计文档
D. 应归档历史文档
E. 无法确定，不删除

禁止 `git clean`。

日志不得记录：

- OCR 原文
- key
- base64
- 用户文件内容
- 完整模型 response

新增：

```text
docs/README.md
docs/architecture/README.md
docs/testing/README.md
docs/benchmark/README.md
docs/release/README.md
docs/archive/README.md
```

文档状态：

- active
- superseded
- archived
- audit-only

提交：

```text
stage closure r2 clean repository and index docs
```

# 10. Phase 2 Mandatory Gates

每个 production work package 后至少运行：

```powershell
node --test tests/base-migration-execution-gate.test.js
node --test tests/pdf-route-b-hold.test.js
npm.cmd run smoke:batch:mock
npm.cmd run verify:safe
npm.cmd run verify:batch-safety
npm.cmd run verify:pdf-known-bad
node --test tests/pdf-support-controlled-write-answer-ownership.test.js
node scripts/pdf-master-browser-runner.js preflight
node scripts/pdf-master-browser-runner.js dry-run
npm.cmd run verify:docx-stable
npm.cmd run verify:no-real-ai
```

以及：

- 当前模块 targeted tests
- runtime dependency gate
- browser E2E（涉及 browser/runtime 时）
- OCR scoring tests（涉及 OCR 时）
- storage tests（涉及 storage 时）

要求：

- no failed
- no hidden timeout
- no skipped，除非明确平台不适用且报告
- preflight `realApiCalled=false`
- dry-run `realApiCalled=false`

失败处理：

1. 不进入下一包
2. 不提交失败代码
3. 最多 3 次小范围修复
4. 仍失败则停止并报告
5. 不扩大修改范围

# 11. Phase 3：反事实攻击测试

目标不是证明正常输入工作，而是主动尝试破坏系统。

输出：

```text
docs/testing/COUNTERFACTUAL_ATTACK_MATRIX_R2.md
```

## 3.1 Runtime 攻击

测试：

- 缺 script
- script 在 app.js 后
- namespace 拼错
- duplicate owner
- module 404
- init throw
- browser extension 错误与项目错误区分

期望：

- startup gate 捕获
- 不静默白屏
- 明确错误

## 3.2 JSON/LaTeX 攻击

测试：

- markdown fence
- trailing comma
- single backslash
- `\therefore` 与 `\t`
- nested JSON
- raw JSON stem
- invalid Unicode
- truncated JSON
- duplicate keys
- huge response
- malformed formula wrapper

期望：

- 只安全 repair
- repair 后仍 schema validate
- 失败 fail-closed
- 不抽字段入库
- 不吞原文

## 3.3 题号和归属攻击

测试：

```text
1,2,4
1,2,2,3
5,4,3
1,2,10,3
answer 1-10 / solution 1-2
solution rewind
missing answer
duplicate page
```

期望：

- 不错挂
- 不继续强挂
- safe partial/manual review

## 3.4 OCR 图像攻击

测试：

- 旋转
- 透视
- 低对比
- 模糊
- 双栏
- 水印
- 手写批注
- 公式跨行
- 图片压字
- 圈住题号
- A/B/C/D 嵌公式
- 多页顺序错乱

## 3.5 Storage 攻击

测试：

- quota exceeded
- corrupt JSON
- IndexedDB unavailable
- refresh during write
- double confirm
- two tabs
- delete then refresh
- schema mismatch
- partial image missing

期望：

- 不重复入库
- 不部分写
- 可恢复
- 明确提示

## 3.6 安全攻击

测试：

- `<script>`
- event handler
- javascript URL
- path traversal filename
- illegal MIME
- oversized file
- zip bomb 特征
- local OCR arbitrary path
- HTML 注入
- formula injection

期望：

- 转义
- 不执行
- 拒绝
- 不泄露本地路径

## 3.7 性能攻击

测试：

- 1000 questions
- 5000 metadata records
- 100 images
- long solutions
- complex formulas
- rapid switch
- repeated search
- repeated export
- long-running import cancellation

## 3.8 修复纪律

发现失败：

1. 先新增失败测试
2. 最小修复
3. 不顺手重构
4. 全量 gates
5. 每类攻击独立 commit

提交：

```text
stage closure r2 add counterfactual attack suite
```

# 12. Phase 4：代码质量审计

输出：

```text
docs/audit/CODE_QUALITY_AUDIT_R2.md
```

审计：

- 最大生产文件
- 最大函数
- 参数数量
- 嵌套深度
- broad try/catch
- catch 后吞错
- TODO/FIXME
- console
- dead branch
- duplicate helper
- unused export
- duplicate namespace
- mutation-heavy functions
- hidden global state
- repeated normalization
- repeated serialization

测试质量：

- 是否真实生产路径
- 是否复制实现
- 是否只测 happy path
- 是否 mock safety
- 是否永远为真
- 是否隐瞒 timeout/skipped

错误模型应包含：

```text
code
stage
recoverable
userMessage
technicalDetail
requestId
cause
```

质量阶段只允许低风险整改：

- 明确重复
- 未使用变量
- 无效日志
- 错误信息
- 测试不真实
- owner 冲突
- 无行为变化的局部简化

不得在质量审计阶段做新架构重写。

新增守卫：

- app.js 不新增大业务函数
- adapter 禁止 ownership
- UI 禁止 storage implementation
- OCR 禁止正式写入
- test 禁止复制生产实现

提交：

```text
stage closure r2 code quality audit fixes
```

# 13. Phase 5：架构一致性审计

输出：

```text
docs/audit/ARCHITECTURE_CONSISTENCY_AUDIT_R2.md
```

验证：

## 5.1 依赖方向

```text
UI
→ Controller
→ Domain
→ Validator
→ Adapter/Repository
```

无反向依赖。

## 5.2 单一 owner

以下只能一个 owner：

- controlled-write
- JSON repair
- storage repository
- OCR registry
- question schema
- answer ownership
- runtime script dependency
- formula display normalization
- export mapping
- review lifecycle

## 5.3 app.js

检查是否仍含：

- OCR 具体调用
- storage 实现
- ownership
- export 实现
- JSON repair
- 大型 review domain logic
- parser details

允许 remaining debt，但不得为清零强拆。

## 5.4 Runtime

必须：

- 无未加载 namespace
- 无 duplicate owner
- app.js 最后加载
- 依赖顺序确定
- browser startup 无项目红错

## 5.5 Safety

证明：

- OCR 不直接写题库
- review 不绕 controlled-write
- Route B 冻结
- adapter 只产 candidate
- validator 始终执行
- safe partial 未弱化

提交：

```text
stage closure r2 architecture consistency audit
```

# 14. Phase 6：Benchmark 审计

输出：

```text
docs/benchmark/BENCHMARK_FINAL_AUDIT_R2.md
```

必须使用与 baseline 相同：

- corpus
- truth
- normalization
- scoring
- hardware
- engine config

## 6.1 OCR 对比

报告：

- baseline
- final
- per-document
- aggregate
- fatal safety errors
- manual correction cost

禁止只展示最佳样本。

新 OCR 成为可选生产引擎的最低门槛：

1. wrong answer attachment = 0
2. fabricated question = 0
3. raw JSON leakage = 0
4. placeholder leakage = 0
5. structural accuracy 不低于当前引擎
6. 至少一个核心弱项明显提升
7. manual correction cost 下降
8. 可部署、可诊断
9. 失败安全回退
10. 不绕 validator

不满足则保持 shadow/research。

## 6.2 性能对比

报告：

- cold start
- upload-to-review
- first render
- switch p50/p95
- save
- reload
- export
- memory
- image storage

接受：

- 核心流程不得回退 >10%
- 至少一个确认瓶颈改善 ≥20%
- 无改善的复杂优化应撤销
- 不得通过关闭功能换性能

## 6.3 架构指标

报告：

- app.js baseline/final lines
- extracted responsibilities
- production lines added
- duplicates removed
- modules added
- dependency cycles
- remaining large functions
- owner conflicts

不能只报告减行。

提交：

```text
stage closure r2 benchmark final audit
```

# 15. Phase 7：最终 CTO 审查

默认不改代码。

输出：

```text
docs/release/CTO_FINAL_REVIEW_ENGINEERING_CLOSURE_R2.md
```

审查：

## 产品

- DOCX 稳定
- PDF safe partial 可信
- 上传/审核/编辑/入库/刷新/导出闭环
- 教师提示是否可理解

## 识别

- OCR 是否真实提升
- 结构是否提升
- 修正成本是否下降
- dangerous false attachment 是否为 0

## 架构

- app.js 是否责任收缩
- 是否真解耦
- 是否只是分文件屎山
- duplicate logic
- dependency

## 测试

- production-linked
- browser E2E
- counterfactual
- known-bad
- gate blind spot

## 性能

- Benchmark 可复现
- 是否真实变快
- 内存/存储风险

## 安全

- controlled-write
- Route B
- raw JSON
- XSS
- local OCR
- private files
- credentials
- model licenses

## 运维

- 启动
- 诊断
- 回滚
- OCR 切换
- 模型/cache 清理
- 数据恢复

## 技术债

分类：

- release blocker
- next release
- accepted limitation
- research-only

最终只能输出：

```text
ENGINEERING_CLOSURE_ACCEPTED
ENGINEERING_CLOSURE_ACCEPTED_WITH_LIMITATIONS
ENGINEERING_CLOSURE_BLOCKED
```

若 blocked：

- 最多回到 Phase 2 做两轮 targeted remediation
- 不无限循环
- 仍失败则停止

# 16. Phase 8：Git 封存

仅 CTO 非 BLOCKED 才执行。

## 8.1 最终测试矩阵

运行全部 mandatory gates：

```powershell
node --test tests/base-migration-execution-gate.test.js
node --test tests/pdf-route-b-hold.test.js
npm.cmd run smoke:batch:mock
npm.cmd run verify:safe
npm.cmd run verify:batch-safety
npm.cmd run verify:pdf-known-bad
node --test tests/pdf-support-controlled-write-answer-ownership.test.js
node scripts/pdf-master-browser-runner.js preflight
node scripts/pdf-master-browser-runner.js dry-run
npm.cmd run verify:docx-stable
npm.cmd run verify:no-real-ai
```

以及所有新增：

- contracts
- runtime dependency
- storage
- library
- review
- export
- import
- OCR adapter
- browser E2E
- counterfactual
- performance
- architecture guards
- benchmark scoring

要求真实 passed。

## 8.2 Remote main 检查

```powershell
git status --short
git fetch origin main
git rev-parse main
git rev-parse origin/main
git log --oneline origin/main..main
git log --oneline main..origin/main
```

要求：

- remote main 仍是 START_HEAD
- 无其他人更新
- working branch clean

若 main 已变化：

```text
STOP_REMOTE_MAIN_CHANGED
```

不得 merge/rebase/覆盖。

## 8.3 Final report 先提交

新增：

```text
docs/release/ENGINEERING_CLOSURE_R2_FINAL_REPORT.md
```

内容：

```text
Stage:
QISI-MATH-PRO ENGINEERING CLOSURE R2

Baseline:
- start commit:
- baseline tag:

Final:
- end commit:
- release tag:
- branch:
- pushed:
- working tree:
- local/origin equal:

Repository:
- EOL policy:
- tracked files:
- temporary files removed:
- gitignore updated:
- private files committed:
- models committed:

Recognition:
- baseline OCR:
- final OCR:
- text CER:
- formula accuracy:
- structural accuracy:
- wrong attachments:
- fabricated questions:
- raw JSON:
- manual correction cost:
- production engines:
- research engines:

Architecture:
- app.js baseline lines:
- app.js final lines:
- responsibilities extracted:
- modules added:
- duplicate owners:
- dependency cycles:
- remaining debt:

Testing:
- production-linked:
- runtime dependency:
- browser E2E:
- counterfactual:
- DOCX stable:
- PDF safe partial:
- controlled-write:
- Route B:

Performance:
- first render:
- switch p50/p95:
- save:
- reload:
- export:
- memory:
- image storage:

Safety:
- controlled-write bypass:
- Route B integrated:
- placeholder fallback:
- real AI called:
- model download:
- credentials exposed:
- private files pushed:

CTO Decision:

Known limitations:

Rollback:
- baseline tag:
- instructions:

Next stage:
```

提交并 push 工作分支。

## 8.4 Fast-forward main

只有 Phase 8 允许：

```powershell
git switch main
git merge --ff-only stage/post-rc-engineering-closure-r2
```

不是 fast-forward 则停止。

## 8.5 Release tag

建议：

```text
v1.1.0-rc1-engineering-closure-r2
```

创建：

```powershell
git tag -a v1.1.0-rc1-engineering-closure-r2 -m "Qisi Math Pro engineering closure R2"
```

## 8.6 Push

```powershell
git push origin main
git push origin v1.1.0-rc1-engineering-closure-r2
```

禁止 force。

## 8.7 最终确认

```powershell
git status --short
git rev-parse HEAD
git ls-remote origin main
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
git tag --points-at HEAD
```

要求：

- clean
- local HEAD == origin/main
- tag 指向 HEAD
- commits 全 push

# 17. 全局停止条件

出现任何一项立即停止：

1. 起始 working tree 不干净
2. local main != origin/main
3. live remote main 不一致
4. 需要 force push
5. 需要 reset --hard
6. 需要删除用途不明 tracked 文件
7. 需要绕 controlled-write
8. 需要恢复 Route B
9. 需要语义猜答案
10. 需要非法 JSON 抽字段入库
11. DOCX stable gate 失败
12. wrong answer attachment > 0
13. 浏览器白屏
14. 新测试只测复制实现
15. 私有材料将被提交
16. 模型权重将被提交
17. 未授权真实 API 调用
18. 同一 blocker 三次小修仍未解决
19. Benchmark 无法复现
20. 无法诚实证明通过
21. EOL 处理准备引发大规模无关 diff
22. remote main 在任务期间变化
23. 需要同时修改多个高风险 owner
24. 性能优化造成 >10% 核心回退
25. app.js 瘦身只能通过复制逻辑完成

停止报告必须包含：

```text
Blocker:
Current phase:
Current work package:
Current commit:
Changed files:
Completed tasks:
Failing gate:
Evidence:
Rollback status:
Remote status:
Next exact action:
```

不得把 STOP 写成 ACCEPTED。

# 18. 最终执行报告格式

```text
Stage:
QISI-MATH-PRO ENGINEERING CLOSURE R2

Start:
- commit:
- baseline tag:
- branch:

Phase 0.5:
- repository audit:
- EOL:
- cleanup policy:
- system map:
- app.js baseline:

Phase 1:
- architecture:
- contracts:
- OCR adapter design:
- test strategy:
- benchmark strategy:

Phase 2:
- production-linked tests:
- runtime dependency:
- browser E2E:
- contracts:
- storage:
- library:
- review:
- export:
- import:
- OCR benchmark:
- OCR adapters:
- shadow mode:
- recognition quality:
- app.js slimming:
- performance:
- cleanup:

Phase 3:
- attack suites:
- failures found:
- fixes:

Phase 4:
- code quality:
- duplicate logic:
- dead code:
- test quality:

Phase 5:
- architecture consistency:
- owner conflicts:
- cycles:
- app.js remaining debt:

Phase 6:
- OCR baseline/final:
- performance baseline/final:
- safety metrics:
- manual correction cost:

Phase 7:
- CTO verdict:
- blockers:
- limitations:

Phase 8:
- final commit:
- release tag:
- main push:
- working tree:
- local/origin equal:

Safety:
- controlled-write bypass:
- Route B:
- real AI:
- model download:
- private files:
- force operations:

Decision:
- accepted / accepted with limitations / blocked

Next recommended stage:
```
