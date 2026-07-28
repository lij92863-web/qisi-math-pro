# H1 浏览器 Typst / MiTeX 可行性原型

这个目录只证明讲义正式 PDF 链可以在浏览器本地、离线、无原生排版软件的条件下
成立。它不是生产讲义编辑器，也不读取题库或写入数据库。

## 运行

在仓库根目录执行：

```powershell
npm.cmd start
```

然后打开：

```text
http://127.0.0.1:3000/prototypes/handout-typst/index.html
```

页面会自动编译有效证明文档。可以手动执行“验证错误定位”，确认错误公式会阻止导出、
清空旧预览并显示内容块与公式编号。

## 模块边界

```text
proof-document.mjs
  只构造可信 Typst 源码和源代码行映射

runtime-contract.mjs
  固定资源位置、Worker 消息类型和输入上限

compiler-client.mjs
  管理主线程与 Worker 的请求生命周期

compiler-worker.mjs
  唯一允许初始化 Typst、挂载 MiTeX/字体/图片和生成 PDF 的模块

diagnostics.mjs
  将 Typst 行号映射回内容块与公式编号

prototype-app.mjs
  只管理原型页面状态、Blob URL、预览和下载
```

## 强制约束

- 编译只在模块 Worker 内执行。
- 运行时资源只允许同源 URL，不请求 CDN 或云端编译服务。
- Typst、MiTeX、字体和图片都使用固定本地文件。
- 预览与下载使用同一个 `Uint8Array`，不进行第二次编译。
- 编译失败、资源缺失或 PDF 为空时禁止下载，并移除旧预览。
- 原型不允许任意用户 Typst 输入，不接触 `app.js`、IndexedDB、DOCX、PDF 导入或打印链。

## 验证

```powershell
$env:QISI_H1_WRITE_EVIDENCE='1'
node --test tests/handout-typst-h1.test.js
```

可选证据会写入 `tmp/pdfs/h1-proof.pdf`。该目录是临时验证输出，不应提交。
