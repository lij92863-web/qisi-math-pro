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
qisi-server.cmd
start-app.vbs
```

`open-app.cmd` 与 `qisi-server.cmd` 会复用已经健康的本地服务。若 3000
端口被其他程序占用或旧服务没有响应，启动器不会结束未知进程，而会自动选择
3001–3010 中的可用端口，并打开正确页面。正常冷启动通常不到 1 秒；启动失败时
窗口会保留明确诊断信息。

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

## MathType 原生转换开关

DOCX 里的 MathType 公式默认由本地确定性 MTEF 读取器转换，不启动 MathType 程序。
某些机器上安装的 MathType 原生组件会在转换时崩溃，并在桌面上弹出
“DDE Server Window: MathType.exe 应用程序错误”对话框；默认关闭原生转换可以避免这些弹窗。

如果确认本机 MathType 运行正常，并希望使用原生转换器作为首选来源，可以显式开启：

```bat
set QISI_MATHTYPE_NATIVE=1
npm start
```

无论是否开启，无法转换的公式都不会被猜测或静默替换：相关题目会被跳过并在批次提示中说明。

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
