# Public Repository Handoff

## 当前最新阶段

Latest known completed stage:

```text
GH0 — GitHub Sync and Completeness Check
```

Latest known commit at GH0:

```text
5560dabdf2b9b2da3ece59e13d31753dde2e9e12
```

BM-AUTO 已完成：

```text
bdfc33b stage BM-AUTO add real migration control system
```

GH0 已确认 local/remote equal，BM-AUTO 6 个文件已跟踪。

## 关键历史结论

- BM21 = SCAFFOLD_ONLY 样本。
- BM23 = PARTIAL_MIGRATION 样本。
- BM24 = REAL_MIGRATION 样本。
- BM-AUTO = 自动迁移控制系统。

## 后续推荐路线

1. GH1 — Public Readiness Docs
2. BMG0 — BM-AUTO-GATE Verification
3. BMR1/BMG1 — BM-AUTO Round 1 + Gate
4. BMR2/BMG2 — BM-AUTO Round 2 + Gate
5. 最多自动到 BMR4/BMG4

## 绝对禁止事项

- 禁止 real-run。
- 禁止 AI/OCR。
- 禁止接 Route B。
- 禁止修改 controlled-write。
- 禁止修改 parser / aligner。
- 禁止无条件 `git add .`。
- 禁止 force push。
- 禁止把 timeout / skipped 写成 passed。

## GitHub 操作规范

每阶段开始：

```bat
git status --short
git branch --show-current
git fetch origin main
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
```

local/remote 不一致必须停止，不要 merge、rebase 或 reset。

提交规范：

```text
stage <STAGE> <short action>
```

例如：

```text
stage GH1 add public repository handoff
```

## 测试标准

文档阶段：

- verify:diff-scope
- verify:no-real-ai

代码迁移阶段：

- corresponding module test
- base-migration-execution-gate
- route-b-hold
- smoke:batch:mock
- verify:safe
- verify:batch-safety
- verify:pdf-known-bad
- preflight
- dry-run

## 迁移验收标准

REAL_MIGRATION 需要：

1. app.js delta <= -10
2. 旧函数从 app.js 删除
3. app.js 调用新模块
4. 新模块承接旧逻辑
5. 行为等价测试通过
6. 安全门禁通过
