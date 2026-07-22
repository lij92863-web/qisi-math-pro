
# TEX题库批量录题自动化阶段路线图

## 0. 当前基线

当前已完成：

```text
C8-0    Git 基线
C8-0.5  CODEX_TASK.local.md 本地忽略
C8A     Agent 宪法与 Skills
C8B     verify:no-real-ai 与 verify:diff-scope
C8C     verify:docx-stable / verify:pdf-known-bad / verify:batch-safety
C8D     local-test-materials 真实测试材料清单
```

当前关键提交：

```text
C8D commit: 9d17d5a stage C8D document local real test materials
```

本地真实材料：

```text
local-test-materials/
  case01-docx-docx-stable/
    01-question.docx
    02-support-answer-solution.docx

  case02-pdf-pdf-real/
    01-question.pdf
    02-support-answer-solution.pdf
```

重要说明：

```text
local-test-materials/ 里的文件都是完整真实试卷文件。
默认不得读取内容。
默认不得调用真实 AI/OCR/API。
真实文件验证必须单独开阶段。
```

---

## 1. 全局自动化原则

### 1.1 权限原则

用户可能离开座位，并对 Codex 权限弹窗点击 yes。

但是：

```text
权限 yes ≠ 任务授权
```

Codex 只能执行当前任务文件明确允许的动作。

即使权限被批准，也默认禁止：

```text
1. 读取 local-test-materials/ 中未授权的真实文件
2. 调用真实 OCR/API/AI
3. 反复运行真实识别
4. 把真实 DOCX/PDF 加入 Git
5. 自动写入正式题库
6. 修改 app.js 做大规模补丁
7. 放宽 fail-closed 规则
8. 删除或弱化测试
9. 越过当前阶段进入下一阶段
```

---

### 1.2 默认禁止项

除非当前任务明确允许，否则一律禁止：

```text
app.js 大改
main.html 大改
app.css 大改
qisi-*.js 大改
真实 API/OCR/AI 调用
读取完整 PDF 内容
读取完整 DOCX 内容
修改 tests/fixtures 中的既有基准
删除测试
跳过 verify
提交 local-test-materials/
```

---

### 1.3 每阶段固定执行流程

每个阶段都必须执行：

```text
1. 预检 git status --short
2. git status 非空则停止
3. 读取 AGENTS.md
4. 读取 ai/AGENT_CONSTITUTION.md
5. 读取当前阶段相关 ai/* 文档
6. 读取相关 skills/*/SKILL.md
7. 只修改允许文件
8. 不修改禁止文件
9. 执行当前阶段指定测试
10. 执行 verify:diff-scope
11. git diff --stat
12. 提交
13. git status --short 确认 clean
14. 停止，不进入下一阶段
```

---

### 1.4 每阶段任务模板

每个阶段必须包含：

```text
Stage:
Goal:
Non-goals:
Allowed read:
Forbidden read:
Allowed modify:
Forbidden modify:
AI/OCR/API permission:
Required tests:
Acceptance criteria:
Stop conditions:
Commit message:
Next recommended stage:
```

缺少上述任一部分，不得执行。

---

## 2. 测试等级标准

### L0：Git 工作区预检

```bat
git status --short
git branch --show-current
git log --oneline -10
```

标准：

```text
git status --short 必须为空。
否则立即停止。
```

---

### L1：语法检查

```bat
npm.cmd run check
```

适用：

```text
修改 JS 文件时必须执行。
```

---

### L2：完整单元测试

```bat
npm.cmd test
```

适用：

```text
修改 tests/
修改 qisi-*.js
修改 parser / aligner / controlled-write
修改批量录题相关逻辑
```

---

### L3：批量录题 mock smoke

```bat
npm.cmd run smoke:batch:mock
```

作用：

```text
验证 DOCX+DOCX mock 主链
验证 PDF known-bad 不错挂
验证 mock 流程不访问真实 AI/OCR endpoint
```

---

### L4：AI/OCR 禁用红线

```bat
npm.cmd run verify:no-real-ai
```

标准：

```text
默认任务必须通过。
除非当前任务明确声明允许真实 API/OCR。
```

---

### L5：领域专项验证

```bat
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
```

标准：

```text
DOCX 主链任务必须跑 verify:docx-stable。
PDF support 任务必须跑 verify:pdf-known-bad。
批量录题相关任务必须跑 verify:batch-safety。
```

---

### L6：默认安全总验证

```bat
npm.cmd run verify:safe
```

标准：

```text
每个阶段提交前必须通过。
```

---

### L7：diff 范围验证

PowerShell：

```powershell
$env:QISI_ALLOWED_DIFF="允许范围"
npm.cmd run verify:diff-scope
```

标准：

```text
每个阶段必须设置 QISI_ALLOWED_DIFF。
只允许当前阶段声明的文件进入 diff。
```

---

### L8：真实文件验证

真实文件验证不得进入默认 verify。

真实文件验证必须单独阶段执行，并明确：

```text
允许读取哪些文件
是否允许调用 AI/OCR/API
最多调用几次
失败是否允许修代码
输出结果写到哪里
是否允许保存中间文本
是否允许生成 fixture
```

---

## 3. 后续阶段总览

后续阶段分为六组：

```text
C9：真实样本验证与问题固化
C10：DOCX 主链修复与增强
C11：PDF support 安全修复
C12：审核页与草稿体验修复
C13：app.js 边界收缩与模块化
C14：最终回归与阶段封版
```

总原则：

```text
先验证，再固化，再修复。
先 DOCX，后 PDF。
先 mock，后真实。
先小模块，后 app.js。
宁可空，不错挂。
```

---

## 4. C9：真实样本验证与问题固化

### C9A：真实 DOCX+DOCX 验证，只记录

Goal：

```text
读取真实 DOCX case01，验证当前 DOCX+DOCX 主链现状。
```

Non-goals：

```text
不修代码
不碰 PDF
不调用 AI/OCR/API
不入正式题库
不修改测试
不生成 fixture
```

Allowed read：

```text
local-test-materials/case01-docx-docx-stable/01-question.docx
local-test-materials/case01-docx-docx-stable/02-support-answer-solution.docx
```

Forbidden read：

```text
local-test-materials/case02-pdf-pdf-real/
其他真实文件
```

Allowed modify：

```text
docs/testing/C9A_REAL_DOCX_VALIDATION_REPORT.md
```

Forbidden modify：

```text
app.js
main.html
app.css
qisi-*.js
tests/
scripts/
package.json
package-lock.json
local-test-materials/
```

AI/OCR/API permission：

```text
不允许。
```

Required tests：

验证前：

```bat
npm.cmd run verify:docx-stable
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

验证后：

```bat
npm.cmd run verify:docx-stable
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

diff scope：

```powershell
$env:QISI_ALLOWED_DIFF="docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

```text
1. 两个 DOCX 文件是否存在
2. 是否成功进入现有 DOCX 解析流程
3. 识别题目数量
4. 答案数量
5. 解析数量
6. 选项是否异常
7. 图片是否异常
8. 是否出现错挂
9. 是否出现乱码
10. 是否出现 missing_answer / missing_solution
11. 当前结论：pass / partial / fail
12. 是否需要进入 C9B
```

Stop conditions：

```text
发现需要改代码，停止，只记录。
需要读取 PDF，停止。
需要调用 AI/OCR/API，停止。
真实文件路径异常，停止。
```

Commit message：

```text
stage C9A record real DOCX validation
```

---

### C9B：DOCX 真实问题转最小 fixture

前置条件：

```text
仅当 C9A 发现真实 DOCX 问题时执行。
若 C9A 完全通过，可跳过 C9B。
```

Goal：

```text
将 C9A 中发现的问题转成脱敏、最小、可重复的 fixture 或测试。
```

Non-goals：

```text
不修业务逻辑
不提交真实 DOCX
不复制完整真实题目
不调用 AI/OCR/API
```

Allowed read：

```text
docs/testing/C9A_REAL_DOCX_VALIDATION_REPORT.md
必要时可读取 case01 DOCX，但只能提取最小结构特征，不得复制完整试卷内容。
```

Allowed modify：

```text
tests/fixtures/docx-real-case-minimal.js
tests/docx-real-case.test.js
docs/testing/C9B_DOCX_FIXTURE_REPORT.md
```

Forbidden modify：

```text
app.js
main.html
app.css
qisi-*.js
package-lock.json
local-test-materials/
```

AI/OCR/API permission：

```text
不允许。
```

Required tests：

```bat
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

diff scope：

```powershell
$env:QISI_ALLOWED_DIFF="tests/**,docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

```text
1. 真实问题被转成最小可重复测试
2. fixture 脱敏
3. 不包含完整真实试卷内容
4. 不依赖 local-test-materials/
5. 当前行为被稳定记录
6. 后续 C9C 可以据此修复
```

Stop conditions：

```text
必须复制大量真实题目才能复现时，停止。
需要改业务代码时，停止。
需要调用 AI/OCR/API 时，停止。
```

Commit message：

```text
stage C9B add DOCX real-case fixture
```

---

### C9C：修复 DOCX 最小问题

前置条件：

```text
C9B 已建立可重复 fixture。
```

Goal：

```text
只修复 C9B 暴露的 DOCX 问题。
```

Non-goals：

```text
不碰 PDF
不大改 UI
不重构 app.js
不新增真实文件
不调用 AI/OCR/API
```

Preferred allowed modify：

```text
qisi-batch-importer.js
qisi-support-parser.js
qisi-support-repair.js
tests/
docs/testing/C9C_DOCX_FIX_REPORT.md
```

原则上不允许修改：

```text
app.js
```

若必须修改 `app.js`，立即停止，写报告说明原因，不直接修改。

AI/OCR/API permission：

```text
不允许。
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:no-real-ai
npm.cmd run verify:safe
```

diff scope 示例：

```powershell
$env:QISI_ALLOWED_DIFF="qisi-batch-importer.js,qisi-support-parser.js,qisi-support-repair.js,tests/**,docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

```text
1. C9B fixture 通过
2. 原 DOCX stable 仍通过
3. PDF known-bad 仍通过
4. no-real-ai 通过
5. 不修改真实文件
6. 不把 DOCX 问题修成 PDF 风险
7. 修复范围最小
```

Stop conditions：

```text
需要 app.js 大改，停止。
需要 PDF 逻辑参与，停止。
测试需要弱化，停止。
```

Commit message：

```text
stage C9C fix DOCX real-case issue
```

---

### C9D：PDF 真实验证规划，不调用 AI

Goal：

```text
规划 PDF case02 的真实验证方式，不读取 PDF 内容，不调用 OCR。
```

Non-goals：

```text
不读取 PDF
不调用 OCR/API/AI
不修代码
不做真实识别
```

Allowed read：

```text
docs/testing/LOCAL_TEST_MATERIALS.md
文件名与路径
```

Allowed modify：

```text
docs/testing/C9D_REAL_PDF_VALIDATION_PLAN.md
```

AI/OCR/API permission：

```text
不允许。
```

Required tests：

```bat
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

diff scope：

```powershell
$env:QISI_ALLOWED_DIFF="docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

计划必须明确：

```text
1. 是否需要 OCR/API
2. 预计最多调用次数
3. 是否允许读取完整 PDF
4. 是否允许保存 OCR raw text
5. 是否允许生成脱敏 fixture
6. 成功标准
7. 失败标准
8. 停止条件
9. 成本控制
10. 不错挂优先原则
```

Commit message：

```text
stage C9D plan real PDF validation
```

---

### C9E：PDF 一次受控真实验证，只记录

前置条件：

```text
C9D 完成。
用户在当前任务中明确授权：允许本轮调用真实 OCR/API/AI。
没有这句话，不得执行 C9E。
```

Goal：

```text
对 case02 PDF+PDF 做一次受控真实验证，只记录结果，不修代码。
```

Non-goals：

```text
不修代码
不重复多次识别
不自动入库
不放宽 fail-closed
不提交真实 PDF
```

Allowed read：

```text
local-test-materials/case02-pdf-pdf-real/01-question.pdf
local-test-materials/case02-pdf-pdf-real/02-support-answer-solution.pdf
```

Allowed modify：

```text
docs/testing/C9E_REAL_PDF_VALIDATION_REPORT.md
```

是否允许保存 OCR raw text：

```text
默认不允许。
除非任务明确允许保存脱敏 OCR 文本。
```

AI/OCR/API permission：

必须明确写：

```text
允许真实 OCR/API/AI：是
最多调用次数：X
允许文件：具体路径
失败停止条件：具体条件
```

推荐默认限制：

```text
最多 1 次完整验证尝试。
失败不重试。
不自动修代码。
```

Required tests：

识别前：

```bat
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

识别后：

```bat
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

diff scope：

```powershell
$env:QISI_ALLOWED_DIFF="docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

报告必须记录：

```text
1. 实际调用次数
2. 使用的文件路径
3. 是否成功读取问题 PDF
4. 是否成功读取答案/解析 PDF
5. 题目识别数量
6. support 识别数量
7. answerItems 序列
8. solutionItems 序列
9. 是否 full
10. 是否 prefix
11. 是否 fail-closed
12. 是否出现断号
13. 是否出现回跳
14. 是否出现重复题号
15. 是否出现 answer/solution 不一致
16. 是否有错挂风险
17. 是否写入草稿
18. 是否被 fail-closed 阻断
19. 下一步建议
```

Stop conditions：

```text
API 调用失败一次，停止。
出现序列回跳，停止。
出现 answer/solution 不一致，停止。
需要修代码，停止。
需要第二次真实调用，停止并请求新任务。
```

Commit message：

```text
stage C9E record real PDF validation
```

---

### C9F：PDF 失败点转 mock fixture

前置条件：

```text
C9E 产生明确 PDF 失败点。
```

Goal：

```text
把 PDF 失败点转成脱敏 mock fixture，不依赖真实 PDF，不调用 AI/OCR。
```

Non-goals：

```text
不修业务逻辑
不提交真实 OCR 全文
不提交真实 PDF
不调用 AI/OCR/API
```

Allowed modify：

```text
tests/fixtures/pdf-real-case-minimal.js
tests/pdf-real-case.test.js
docs/testing/C9F_PDF_FIXTURE_REPORT.md
```

Preferred fixture content：

```text
题号序列
answerItems 序列
solutionItems 序列
断号/重复/回跳情况
必要的最小文本占位
```

不得复制完整题目内容。

Required tests：

```bat
npm.cmd test
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

diff scope：

```powershell
$env:QISI_ALLOWED_DIFF="tests/**,docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

```text
1. PDF 失败点可在 mock 中稳定复现
2. 不依赖 local-test-materials
3. 不调用 AI/OCR/API
4. 不含完整真实试卷内容
5. 后续 C9G 可据此修复
```

Commit message：

```text
stage C9F add PDF real-case fixture
```

---

### C9G：修复 PDF support 安全问题

前置条件：

```text
C9F 已建立可重复 fixture。
```

Goal：

```text
只修复 PDF support 对齐、block parser、controlled write 中的明确问题。
```

Non-goals：

```text
不追求答案填满
不使用语义猜测
不靠关键词 overlap
不自动相信 AI question 字段
不动 DOCX 主链
不大改 app.js
```

Preferred allowed modify：

```text
qisi-pdf-support-aligner.js
qisi-pdf-support-block-parser.js
qisi-pdf-support-controlled-write.js
tests/
docs/testing/C9G_PDF_FIX_REPORT.md
```

原则上不允许修改：

```text
app.js
```

若必须修改 `app.js`，停止并报告。

AI/OCR/API permission：

```text
不允许。
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:no-real-ai
npm.cmd run verify:safe
```

diff scope：

```powershell
$env:QISI_ALLOWED_DIFF="qisi-pdf-support-aligner.js,qisi-pdf-support-block-parser.js,qisi-pdf-support-controlled-write.js,tests/**,docs/testing/**"
npm.cmd run verify:diff-scope
```

Acceptance criteria：

```text
1. C9F fixture 通过
2. PDF known-bad 仍通过
3. DOCX stable 仍通过
4. 不出现断号后继续挂
5. 不出现回跳后继续挂
6. 不出现 answer/solution 不一致还继续挂
7. 不出现 solution 被拒但 answer 单独保留，除非 controlled-write 明确安全允许
8. no-real-ai 通过
```

Commit message：

```text
stage C9G fix PDF support safe alignment
```

---

### C9H：PDF 受控复验

前置条件：

```text
C9G 已修复。
用户明确授权是否允许真实 API/OCR。
```

Goal：

```text
验证 C9G 是否改善真实 PDF case02。
```

Non-goals：

```text
不继续修代码
不重复无限调用 API
不放宽规则
```

Allowed modify：

```text
docs/testing/C9H_REAL_PDF_REVALIDATION_REPORT.md
```

Required tests：

复验前后都必须执行：

```bat
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 真实 PDF 行为有记录
2. 若仍失败，失败原因可归类
3. 若通过，必须仍满足 fail-closed 安全规则
4. 不以错挂换取填满
```

Commit message：

```text
stage C9H record real PDF revalidation
```

---

## 5. C10：DOCX 主链修复与增强

### C10A：DOCX 主链审计

Goal：

```text
只审计 DOCX 主链当前流程与风险点。
```

Allowed modify：

```text
docs/audit/C10A_DOCX_CHAIN_AUDIT.md
```

Forbidden modify：

```text
业务代码
测试
真实文件
```

Required tests：

```bat
npm.cmd run verify:docx-stable
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

报告必须列出：

```text
1. DOCX question parse 入口
2. DOCX support parse 入口
3. answer/solution repair 位置
4. 草稿写入位置
5. 当前风险点
6. 可拆模块建议
```

Commit message：

```text
stage C10A audit DOCX chain
```

---

### C10B：DOCX 小修复任务

Goal：

```text
修复 C10A 或 C9C 明确指出的一个 DOCX 小问题。
```

Rules：

```text
一次只修一个问题。
不得混合多个问题。
不得碰 PDF。
```

Allowed modify：

```text
qisi-batch-importer.js
qisi-support-parser.js
qisi-support-repair.js
tests/
docs/testing/
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 指定问题修复
2. 不引入 PDF 回归
3. 不修改真实文件
4. 不调用 AI/OCR/API
```

Commit message：

```text
stage C10B fix DOCX <specific issue>
```

---

## 6. C11：PDF support 安全修复

### C11A：PDF support 审计

Goal：

```text
审计 PDF support 从 raw text、block parser、aligner、controlled write 到草稿写入的链路。
```

Allowed modify：

```text
docs/audit/C11A_PDF_SUPPORT_CHAIN_AUDIT.md
```

Forbidden modify：

```text
业务代码
测试
真实 PDF
```

Acceptance criteria：

报告必须列出：

```text
1. PDF question 识别入口
2. PDF support 识别入口
3. block parser 规则
4. aligner full/prefix/fail-closed 规则
5. controlled write 规则
6. 当前缺口
7. 后续可修点
```

Commit message：

```text
stage C11A audit PDF support chain
```

---

### C11B：PDF parser 小修复

Goal：

```text
只修一个 PDF block parser 明确问题。
```

Allowed modify：

```text
qisi-pdf-support-block-parser.js
tests/pdf-support-block-parser.test.js
docs/testing/
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 新增测试覆盖问题
2. block parser 修复
3. aligner 规则不放宽
4. DOCX stable 不受影响
```

Commit message：

```text
stage C11B fix PDF block parser <specific issue>
```

---

### C11C：PDF aligner 小修复

Goal：

```text
只修一个 PDF aligner 明确问题。
```

Allowed modify：

```text
qisi-pdf-support-aligner.js
tests/pdf-support-aligner.test.js
docs/testing/
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. full/prefix/fail-closed 三态仍保持
2. 不出现断号后继续挂
3. 不出现回跳后继续挂
4. 不出现 answer/solution 不一致还继续挂
5. DOCX stable 不受影响
```

Commit message：

```text
stage C11C fix PDF aligner <specific issue>
```

---

### C11D：PDF controlled-write 小修复

Goal：

```text
只修一个 controlled-write 明确问题。
```

Allowed modify：

```text
qisi-pdf-support-controlled-write.js
tests/
docs/testing/
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 不安全 support 不写入
2. 安全字段才写入
3. 拒绝原因有 warning
4. 不污染题库
5. DOCX stable 不受影响
```

Commit message：

```text
stage C11D fix PDF controlled write <specific issue>
```

---

## 7. C12：审核页与草稿体验修复

### C12A：审核页现状审计

Goal：

```text
只审计审核页草稿展示、答案/解析展示、warning 展示、图片挂载、清空草稿等行为。
```

Allowed modify：

```text
docs/audit/C12A_REVIEW_PAGE_AUDIT.md
```

Forbidden modify：

```text
业务代码
CSS
测试
```

Required tests：

```bat
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

报告必须列出：

```text
1. 草稿状态来源
2. 审核页显示字段
3. 答案/解析显示规则
4. warning 显示规则
5. 清空草稿边界
6. 可能的 UI 小修点
```

Commit message：

```text
stage C12A audit review page
```

---

### C12B：审核页小修复

Goal：

```text
一次只修一个审核页 UI/状态显示问题。
```

Allowed modify：

```text
app.js
app.css
tests/
docs/testing/
```

若修改 `app.js`，必须满足：

```text
1. 只改审核页相关小范围
2. 不改解析逻辑
3. 不改 PDF aligner
4. 不改 DOCX parser
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 指定 UI 问题修复
2. 草稿数据结构不变
3. DOCX stable 通过
4. PDF known-bad 通过
5. 清空草稿不影响正式题库
```

Commit message：

```text
stage C12B fix review page <specific issue>
```

---

## 8. C13：app.js 边界收缩与模块化

### C13A：app.js 拆分审计

Goal：

```text
只审计 app.js 中批量录题相关逻辑，制定拆分计划。
```

Allowed modify：

```text
docs/audit/C13A_APP_JS_SPLIT_AUDIT.md
```

Forbidden modify：

```text
app.js
qisi-*.js
tests/
```

Acceptance criteria：

报告必须列出：

```text
1. app.js 当前批量录题函数清单
2. 可抽离纯函数
3. 不可抽离 UI glue
4. 高风险函数
5. 拆分顺序
6. 每步测试要求
```

Commit message：

```text
stage C13A audit app.js split plan
```

---

### C13B：抽离纯工具函数

Goal：

```text
只抽离无副作用纯函数到新模块。
```

Allowed modify：

```text
qisi-batch-utils.js
app.js
tests/
docs/refactor/
```

Rules：

```text
不改变行为。
先加测试，再抽离。
app.js 净减少代码。
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 行为等价
2. 测试覆盖抽离函数
3. app.js 净减少
4. DOCX/PDF 红绿灯不变
```

Commit message：

```text
stage C13B extract batch pure utilities
```

---

### C13C：抽离草稿状态管理

Goal：

```text
将批量录题草稿状态处理从 app.js 中抽离。
```

Allowed modify：

```text
qisi-batch-draft-state.js
app.js
tests/
docs/refactor/
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. 草稿字段不丢失
2. missing_answer / missing_solution 逻辑不误伤
3. 清空草稿只清草稿
4. 正式题库不受影响
5. app.js 净减少
```

Commit message：

```text
stage C13C extract batch draft state
```

---

### C13D：抽离批量录题流程调度

Goal：

```text
将批量导入流程调度逻辑从 app.js 逐步抽离。
```

Allowed modify：

```text
qisi-batch-workflow.js
app.js
tests/
docs/refactor/
```

Non-goals：

```text
不重写解析器
不重写 UI
不改 PDF 安全规则
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
1. DOCX+DOCX 流程不变
2. PDF known-bad 行为不变
3. UI 入口不变
4. app.js 净减少
5. 出错时 fail closed
```

Commit message：

```text
stage C13D extract batch workflow
```

---

## 9. C14：最终回归与封版

### C14A：完整 mock 回归

Goal：

```text
执行全部默认安全测试并记录。
```

Allowed modify：

```text
docs/testing/C14A_FULL_MOCK_REGRESSION_REPORT.md
```

Required tests：

```bat
npm.cmd run check
npm.cmd test
npm.cmd run smoke:batch:mock
npm.cmd run verify:no-real-ai
npm.cmd run verify:docx-stable
npm.cmd run verify:pdf-known-bad
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

```text
全部通过。
工作区 clean。
```

Commit message：

```text
stage C14A record full mock regression
```

---

### C14B：真实 DOCX 最终回归

Goal：

```text
使用 case01 真实 DOCX 做最终验证。
```

AI/OCR/API permission：

```text
不允许。
```

Allowed modify：

```text
docs/testing/C14B_REAL_DOCX_FINAL_REPORT.md
```

Acceptance criteria：

```text
1. 真实 DOCX 行为记录
2. 不调用 AI/OCR/API
3. 不修代码
4. 结果可作为阶段封版依据
```

Commit message：

```text
stage C14B record real DOCX final regression
```

---

### C14C：真实 PDF 最终回归

前置条件：

```text
用户明确授权是否允许 OCR/API。
```

Goal：

```text
使用 case02 真实 PDF 做最终验证。
```

Rules：

```text
必须限制调用次数。
必须记录成本/次数。
失败不自动修代码。
不放宽 fail-closed。
```

Allowed modify：

```text
docs/testing/C14C_REAL_PDF_FINAL_REPORT.md
```

Acceptance criteria：

```text
1. 真实 PDF 行为记录
2. 是否 full/prefix/fail-closed 明确
3. 不错挂
4. 不污染题库
5. 失败原因明确
```

Commit message：

```text
stage C14C record real PDF final regression
```

---

### C14D：阶段封版

Goal：

```text
在全部目标达成后建立稳定阶段记录。
```

Allowed modify：

```text
docs/release/C14D_BATCH_IMPORT_STABLE_BASELINE.md
```

Required tests：

```bat
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

Acceptance criteria：

文档必须记录：

```text
1. 当前 commit
2. 已通过测试
3. DOCX 状态
4. PDF 状态
5. 已知限制
6. 禁止回退的安全规则
7. 下一阶段建议
```

Commit message：

```text
stage C14D record batch import stable baseline
```

---

## 10. 跳转规则

### 10.1 允许跳过的阶段

```text
C9B 可在 C9A 完全通过时跳过。
C9C 可在 C9B 不需要修复时跳过。
C9F 可在 C9E 没有明确失败点时跳过。
C9G 可在 C9F 不需要修复时跳过。
```

跳过必须写文档记录原因。

---

### 10.2 禁止跳转

禁止：

```text
未做 C9A 直接修 DOCX
未做 C9D 直接真实 PDF OCR
未做 C9F 直接修 PDF
未做 C13A 直接大拆 app.js
未跑 verify 直接提交
```

---

## 11. 失败处理规则

任何阶段失败时，只允许三种处理：

```text
1. 记录失败并停止
2. 新开“fixture 固化”任务
3. 新开“最小修复”任务
```

不得在同一阶段中：

```text
验证失败后顺手修
修完后顺手扩大范围
为了通过测试删除断言
为了填满答案放宽 fail-closed
```

---

## 12. 功能修复准入条件

一个功能修复任务必须满足：

```text
1. 问题来源明确
2. 有报告或 fixture
3. 修改范围明确
4. 验收标准明确
5. 回归测试明确
6. 不涉及真实 API/OCR，或已明确授权
```

不满足则不得修。

---

## 13. 总验收标准

整个自动化修改路线最终达成时，应满足：

```text
1. DOCX+DOCX 主链稳定
2. PDF+PDF 不错挂
3. PDF support 不可靠时 fail closed
4. 真实 API/OCR 不被默认调用
5. local-test-materials 不进入 Git
6. 每个问题都有测试或记录
7. app.js 逐步变薄
8. qisi-* 模块边界清楚
9. 每阶段都有 commit
10. 每阶段可回滚
```
