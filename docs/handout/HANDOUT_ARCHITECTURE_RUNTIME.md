# TEX题库讲义架构与运行时边界

## 1. 数据与执行链

```text
正式题库只读记录
    → question snapshot（讲义自有快照）
    → handout domain model
    → student/teacher safety projection
    → trusted Typst document generator
    → lazy Web Worker
    → local MiTeX + local fonts + virtual assets
    → PDF bytes
    → PDF.js preview / download
```

`app.js` 不承载讲义业务逻辑。主页面只有轻量导航入口；编辑器、仓储、版本策略、文档生成、编译 Worker 和 PDF 生命周期分别位于独立的 `qisi-handout-*.js` 模块中。

## 2. 责任边界

| 模块 | 责任 |
| --- | --- |
| `qisi-handout-model.js` | 讲义、内容块、设置和资源图的规范化与校验 |
| `qisi-handout-repository.js` | IndexedDB、乐观并发、版本、讲义自有图片事务 |
| `qisi-handout-editor-state.js` | 纯编辑状态、撤销/重做、同字段输入合并 |
| `qisi-handout-question-instance.js` | 正式题目只读快照和时间戳兼容边界 |
| `qisi-handout-batch-settings.js` | 只对明确选择的题目应用允许的显示设置 |
| `qisi-handout-source-update.js` | 源题差异、字段选择和冲突显式接受 |
| `qisi-handout-preview.js` | 学生/教师投影和受保护内容剔除 |
| `qisi-handout-document.js` | 可信 Typst 源码、公式映射、答案索引和资产白名单 |
| `qisi-handout-compiler-client.js` | Worker 消息、取消、进度和错误协议 |
| `workers/qisi-handout-typst-worker.mjs` | 唯一允许加载编译器、MiTeX、字体并生成 PDF 的边界 |
| `qisi-handout-pdf-session.js` | PDF 字节、预览、下载和 Blob URL 生命周期 |
| `qisi-handout-app.js` | 页面编排与 UI 状态，不实现上述业务规则 |

## 3. 性能策略

- 普通主页面不请求 Typst、MiTeX、PDF.js 或讲义字体。
- 正式预览时才创建 Worker，编译不占用 UI 主线程。
- Worker 内复用已初始化运行时；本地固定资产使用版本化 Cache Storage。
- 旧缓存按运行时版本清理，浏览器重启后允许从本地缓存恢复。
- 文本输入按相同字段和时间窗口合并撤销记录；自动保存采用 500ms 防抖。
- PDF 预览与下载使用同一份内存字节，关闭预览或页面卸载时释放 Blob URL。

## 4. 安全边界

- 不提供任意 Typst 源码编辑器。
- 普通文本、占位符、公式和资源路径分别转义、预检和白名单校验。
- 学生版在文档生成前删除教师字段，并对最终投影和 PDF 文本做泄漏检查。
- 缺失图片、未知资产、公式转换失败或编译诊断会阻止导出，不静默降级。
- 源题更新只读取正式题库；讲义修改不能写回题库。

## 5. 固定本地依赖与许可证

| 依赖 | 固定版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| typst-ts-web-compiler | 0.7.0 | Apache-2.0 | 浏览器 Typst WASM |
| MiTeX | 0.2.7 | Apache-2.0 | LaTeX 数学公式转换 |
| PDF.js | 3.11.174 | Apache-2.0 | 本地 PDF 页面预览 |
| New Computer Modern | typst-assets 0.13.1 | GUST Font License 1.0 | 西文与数学字体 |
| Noto Serif CJK SC | 2.003 | SIL Open Font License 1.1 | 简体中文字体 |

许可证正文随 `vendor/typst`、`vendor/mitex`、`vendor/pdfjs-dist` 和字体目录分发。系统运行时不访问 CDN 或云端编译服务。
