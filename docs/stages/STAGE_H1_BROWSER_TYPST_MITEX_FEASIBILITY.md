# STAGE H1 — 浏览器 Typst / MiTeX 可行性验证

## 1. 结论

H1 通过。

本阶段已经用独立原型证明：

```text
受控文档模型
→ 可信 Typst 源码 + 行映射
→ 本地 MiTeX / 固定字体 / 本地图片虚拟文件
→ 模块 Web Worker
→ 本地 Typst WASM
→ PDF bytes
→ 同一 bytes 的浏览器预览与下载
```

该链路不需要教师安装 Typst、TeX、LibreOffice、Python、Java 或 Rust，也不调用云端
编译服务。普通 `main.html` 启动没有请求任何 H1 资源。

H1 仍是隔离原型，不是生产讲义功能；没有数据库、导航、题库、DOCX/PDF 导入或现有
打印链改动。

## 2. 边界与职责

H1 没有把新业务放进 `app.js`。原型按职责拆为：

| 模块 | 单一职责 |
|---|---|
| `proof-document.mjs` | 确定性生成受控证明文档和内容块/公式行映射 |
| `runtime-contract.mjs` | 固定资源、消息协议、请求 ID、源码大小和行映射约束 |
| `diagnostics.mjs` | 将编译器路径/行号映射为内容块与公式编号 |
| `compiler-client.mjs` | 管理主线程请求、超时、进度和 Worker 生命周期 |
| `compiler-worker.mjs` | 初始化 Typst、挂载虚拟文件、预检并生成 PDF |
| `prototype-app.mjs` | 管理页面状态、预览、下载和 Blob URL |

边界约束：

- Worker 不读取题库、不访问 IndexedDB、不解释 UI 状态；
- UI 不初始化编译器、不拼接临时补救源码；
- 所有运行资源先通过同源校验；
- 请求源码上限为 512 KiB；
- 预览和下载共享同一份 PDF 字节；
- 错误、空 PDF 或缺失资源均 fail closed；
- 失败时立即撤销旧 Blob URL、移除旧预览并禁用下载。

取消编译、缓存版本迁移和生产 PDF.js 集成属于 H5，不在 H1 原型中伪装完成。

## 3. 固定依赖与许可证

完整机器可校验清单位于
`prototypes/handout-typst/dependency-manifest.json`。测试逐个核对字节数、SHA-256 和
许可证文件。

| 依赖 | 固定版本 | 许可证 | 用途 |
|---|---:|---|---|
| `@myriaddreamin/typst.ts` | 0.7.0 | Apache-2.0 | 浏览器编译封装 |
| `typst-ts-web-compiler` | 0.7.0 | Apache-2.0 | Typst WASM |
| MiTeX | 0.2.7 | Apache-2.0 | LaTeX 到 Typst 公式 |
| New Computer Modern | typst-assets 0.13.1 | GUST Font License 1.0 | 西文与数学字体 |
| Noto Serif CJK SC | 2.003 | SIL OFL 1.1 | 完整简体中文字体 |

本地 H1 运行资产清单约 55.15 MB，其中：

- Typst WASM：28,325,178 bytes；
- Noto Serif CJK SC 完整字体：24,543,080 bytes；
- New CM 文本与数学字体：1,737,172 bytes；
- MiTeX 运行文件与规范：约 332 KiB。

这些资源只在原型入口请求，不增加普通题库页面启动网络与解析成本。

### 中文字体纠错记录

初始验证曾使用 typst-dev-assets 中 1.35 MB 的裁剪字体。自动文本断言通过，但逐页
渲染发现“浏览器”的“浏”显示为方框。该字体被移除，改为 Noto 官方 `Serif2.003`
标签下 24,543,080 bytes 的完整简体中文 OTF，并新增：

- 固定 SHA-256：
  `2a2eae2628df83556c54018c41e20fa532c1b862c5256ae8b3f23feb918d12ca`；
- OFL 1.1 许可证文件；
- “浏览器 Typst”PDF 文本证据；
- 两页 PNG 人工视觉复核。

因此 H1 不把“PDF 成功生成”误当成“中文字体完整”。

## 4. 证明内容

真实浏览器证明文档包含：

- 简体中文标题、正文、表格、提示框和页眉页脚；
- 行内 LaTeX；
- 分段函数；
- 矩阵；
- 向量与集合符号；
- 本地 SVG 图片与题注；
- 显式分页和两页以上输出；
- 第 1 页、第 2 页页码；
- 故意非法公式。

非法公式返回：

```text
公式 formula-bad（内容块 piecewise）：
unknown variable: formula-bad-symbol [/main.typ:26]
```

失败状态下：

- `iframe` 不再具有 `src`；
- 下载按钮被禁用；
- 旧 PDF 字节不再可用；
- 诊断保留 `blockId`、`formulaId`、路径与行号。

## 5. 自动化验收

`tests/handout-typst-h1.test.js` 覆盖：

1. 依赖版本、许可证、字节数和 SHA-256；
2. 证明文档确定性和公式行映射；
3. 非法 Worker 请求、路径和行范围约束；
4. 编译器诊断到内容块/公式编号映射；
5. 随机本机端口上的真实 Chromium；
6. `.wasm` MIME 类型；
7. 阻断所有非本机 HTTP(S) 请求；
8. Worker 生成有效 `%PDF-` 字节；
9. 预览与下载 SHA-256 完全相同；
10. PDF.js 提取两页文本、中文证据和页码；
11. 非法公式 fail-closed；
12. 页面错误、控制台错误和 4xx/5xx 响应为零；
13. `main.html` 对 Typst、MiTeX、讲义字体和原型资源请求为零。

聚焦门禁：

```text
node --test tests/handout-typst-h1.test.js

tests 4
pass 4
fail 0
```

## 6. 真实浏览器与 PDF 证据

2026-07-28 在应用内浏览器访问：

```text
http://127.0.0.1:3000/prototypes/handout-typst/index.html
```

完整字体后的实际热运行结果：

```text
初始化 105ms
编译 219ms
PDF 56KB
诊断：无编译错误
```

下载文件经 Poppler `pdfinfo` 检查：

```text
Creator: Typst 0.14.2
Pages: 2
Page size: A4
PDF version: 1.7
File size: 57,145 bytes
```

两页均以 144 DPI 渲染为 PNG 并逐页检查：

- 中文无方框、无乱码、无裁切；
- 行内公式、分段函数和矩阵可读；
- SVG 清晰且题注位置正确；
- 表格边界完整；
- 页眉和页码正确；
- 第二页内容没有异常溢出。

## 7. 运行时与可迁移性

H1 资源随项目分发，通过现有本地 HTTP 服务加载。目标电脑不需要安装 LibreOffice 或
Typst。大型 WASM 和完整中文字体是懒加载资产；只有打开未来讲义入口并正式编译时才
加载。

这项证明不改变现有 DOCX 转换策略，也不宣称 LibreOffice 已从当前批量导入链移除。
它只证明未来讲义 PDF 导出可以独立于 LibreOffice 和本机 Typst 安装。

## 8. H1 未完成项

以下项目按阶段边界保留给后续阶段：

- H2：讲义 schema、repository、题目快照、资产和备份；
- H3：独立讲义编辑器与 HTML 快速预览；
- H4：学生/教师版本安全投影、正式生成器和模板；
- H5：取消、缓存版本、生产编译服务和 PDF.js 预览；
- H6：主页面轻量入口和第一优先级闭环；
- H7：批量设置、源题冲突、多图复杂布局；
- H8：真实题库公式、5/20/50 页、离线重启、性能和最终全回归。

H1 不跨阶段提前实现或宣称上述能力。

## 9. 提交前门禁

执行时间：2026-07-28。

```text
node --test tests/handout-typst-h1.test.js
PASS — 4/4

npm.cmd run verify:safe
PASS
```

`verify:safe` 实际结果：

- 生产 JavaScript 语法：51 个文件通过；
- Node/浏览器测试：1,261 项；
- 通过：1,253；
- 失败：0；
- 既有条件跳过：8；
- 批量稳定链 mock smoke：20/20；
- no-real-AI/OCR：通过。

本阶段没有调用真实 AI/OCR，没有修改生产代码、数据库、用户数据、DOCX/PDF 导入或
现有打印业务。
