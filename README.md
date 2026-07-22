# TEX题库

TEX题库是一个面向教师的本地数学题库与批量录题系统，用于将 DOCX / PDF / 图片等资料转为可审核、可入库的题目草稿。

## 项目定位

本项目用于本地题库管理、批量录题、DOCX-PDF 支持、草稿审核与人工确认入库。系统优先保护题库数据质量：缺失答案可以接受，错挂答案或解析不可接受。

## 当前稳定能力

- DOCX+DOCX 是当前稳定主链。
- PDF+PDF 当前采用 safe partial + manual review。
- PDF 不追求 12/12 全自动 complete。
- Route B answer-only AI pass 已冻结为 research-only。
- controlled-write 是 PDF 答案写入的唯一 truth gate。

## 运行方式

安装依赖：

```bat
npm install
```

启动本地服务：

```bat
npm start
```

本仓库也包含 Windows 本地启动入口：

```bat
open-app.cmd
start-app.vbs
```

## 安全测试命令

常用安全验证：

```bat
npm.cmd run verify:safe
npm.cmd run verify:batch-safety
npm.cmd run smoke:batch:mock
npm.cmd run verify:pdf-known-bad
node --test tests/pdf-route-b-hold.test.js
node scripts/pdf-master-browser-runner.js preflight
node scripts/pdf-master-browser-runner.js dry-run
```

默认开发和验证禁止执行 `real-run`，也禁止调用真实 AI/OCR。

## 目录说明

- `app.js`：当前主应用入口，仍在迁移中。
- `qisi-*.js`：逐步拆分出的业务模块。
- `scripts/`：验证、runner、迁移控制脚本。
- `tests/`：Node 测试。
- `docs/refactor/`：重构与迁移文档。
- `docs/testing/`：测试与链路验证文档。

## 开发者注意

- 不要接 Route B 到生产链路。
- 不要绕过 controlled-write。
- 不要把 scaffold 当作 real migration。
- 不要在未授权情况下执行 real-run。
- 不要在未授权情况下调用 AI/OCR。
- DOCX+DOCX 稳定主链优先。
