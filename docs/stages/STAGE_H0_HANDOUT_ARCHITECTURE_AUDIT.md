# STAGE H0 — 讲义制作与 Typst PDF 架构审计

## 1. 结论

讲义功能可在当前仓库中实现，但不能作为 `app.js` 中的又一个视图继续堆叠。

安全的集成方式是：

```text
main.html
  └─ 轻量链接（后续 H6）
       └─ handout.html（独立同源入口）
            ├─ 只加载讲义编辑所需模块
            ├─ HTML + KaTeX 快速预览
            └─ 首次正式预览时再懒加载
                 ├─ Typst WASM
                 ├─ MiTeX
                 ├─ 固定中文/数学字体
                 └─ Web Worker
```

这条边界能够同时满足：

- 不改变现有组卷和 HTML 打印链；
- 不让普通题库启动加载大型排版资源；
- 不向 21,854 行的 `app.js` 添加讲义业务逻辑；
- 继续使用同源 IndexedDB 中的正式题库；
- 为讲义建立独立的领域、存储、编译和 UI 测试。

H0 只完成审计与边界冻结，没有实现或宣称 Typst 原型、讲义编辑器或 PDF 导出。

## 2. 审计范围与证据

审计了：

- `package.json`
- `main.html`
- `app.js`
- `app.css`
- `qisi-db.js`
- `qisi-backup.js`
- `qisi-components.js`
- `qisi-entry-composable.js`
- `qisi-exam-print-renderer.js`
- `qisi-a4-exam-template.js`
- `qisi-local-server.js`
- `scripts/production-entry-manifest.js`
- `tests/*.test.js`
- `vendor/**`

使用的只读检查包括：

- `rg --files`
- 对 Worker、Service Worker、KaTeX、打印、Blob、数据库写入和视图入口的检索；
- 生产文件和测试文件数量统计；
- 本地依赖和字体库存统计；
- 当前数据库 schema 与题目写入结构核对。

## 3. 当前技术栈

| 层 | 实际实现 | 对讲义的影响 |
|---|---|---|
| 前端 | Vue 3.5.40 全局生产包，经典 `<script>` 加载 | 没有模块打包器；新模块应保持浏览器/Node 双导出风格 |
| UI | 单个 `main.html` 模板 + Tailwind 预编译 CSS + `app.css` | 不适合继续扩充大型讲义模板 |
| 公式预览 | KaTeX 0.16.8，本地 vendored | 可复用为讲义快速预览 |
| 数据 | Dexie 3.2.4 + IndexedDB | 可做加法式 schema 迁移与 repository |
| 图片 | `images` store 保存 Blob，题目保存图片引用 | 讲义插入时必须复制快照资产，不能只留源题引用 |
| PDF 阅读 | PDF.js 3.11.174，本地 vendored | 可用于展示 Typst 生成的 PDF |
| 正式打印 | HTML/CSS A4 模板 + 浏览器打印 | 与讲义 Typst 链保持并行，不替换 |
| 本地服务 | Node + Express 静态服务，`localhost:3000` | 可提供 WASM、字体、模板和 Worker 静态资源 |
| 测试 | Node test + Playwright | 可扩展纯函数、存储、浏览器和 PDF 验收 |
| 构建 | 无 JS bundler；Tailwind 只有 CSS 构建 | H1 必须验证所选 WASM 包能否静态 vendoring |
| 网络 | 生产依赖已本地化 | 讲义资源必须保持同样策略 |

`package.json` 只有 Express、本地上传、dotenv、Playwright 和 Tailwind 等依赖；
仓库内没有 Typst 或 MiTeX。

## 4. 启动与模块边界

### 4.1 当前主入口

`main.html` 当前包含：

- 48 个 `<script>`；
- 4 个样式入口；
- 6 个主视图：新题目录入、批量录题、题库与检索、智能组卷台、个人管理、
  极客排版配置。

生产加载顺序由 `scripts/production-entry-manifest.js` 固定。

所有主视图都在一个 Vue `App.setup()` 和一个 `#app-tpl` 中协调。虽然已有
Entry、Library、Exam、Review、Settings 等 composable，`app.js` 仍有：

- 21,854 行；
- 约 2,652 个 `const` 声明（全文件粗粒度统计）；
- 约 267 个 setup 返回项（粗粒度统计）。

### 4.2 集成决策

讲义不新增为 `app.js` 内部大视图，而采用独立 `handout.html`：

1. 与 `main.html` 同源，因此可读取同一 IndexedDB；
2. 可复用本地 Vue、Dexie、KaTeX、PDF.js；
3. Typst 资源只在该入口按需加载；
4. 编译失败不会使题库主应用白屏；
5. 讲义 UI 和业务可以按模块独立测试；
6. 后续主页面只需一个链接，不需要把讲义状态加入 `App.setup()`。

这是边界隔离，不是第二套应用或第二套题库。

## 5. 当前数据与存储

### 5.1 数据库

当前数据库：

```text
Dexie database: QisiMathVueDB
schema version: 8
```

当前 stores：

- `questions`
- `images`
- `customTemplates`
- `personalKnowledge`
- `externalQuestions`
- `importBatches`
- `mergeBatches`
- `draftImportBatches`
- `draftImportFiles`
- `draftQuestions`
- `draftImages`

`qisi-db.js` 当前通过经典脚本共享顶层 `const db`，没有显式数据库模块导出。
现有代码可以继续使用该绑定，但讲义 repository 不应再复制这种隐式耦合。

### 5.2 正式题目结构

普通录题和批量入库的公共核心字段是：

```text
id
grade
diff
type
knowledge / knowledgeType
systemKnowledge / personalKnowledge
stem
options[]
answer
solution
images[]
layout?
meta
createdAt
updatedAt
```

其中：

- `analysis` 不是当前正式题目的独立公共字段；
- 导入内容通常把详细解析存放在 `solution`；
- `images[]` 是引用对象，可包含 `id`、`align`、`anchorType`、`dimensions`、
  `layout`、`paragraphIndex`；
- 图片二进制位于 `images` store。

讲义模型必须忠实映射现有字段，不能凭空把 `analysis` 与 `solution` 拆成错误内容。
可以在讲义 schema 中保留两个槽，但插入适配器必须记录字段来源。

### 5.3 讲义存储决策

H2 使用 `QisiMathVueDB` 的加法式版本迁移，新增但不修改已有 store：

```text
handouts
handoutAssets
handoutRevisions
```

约束：

- 不改变已有 store 的索引、键和数据；
- repository 是唯一读写入口；
- `qisi-db.js` 增加显式数据库访问出口，但保留现有绑定；
- `qisi-backup.js` 必须纳入讲义记录和 Blob；
- schema 升级、旧数据库打开、备份校验和现有题库读取都必须有回归测试。

与单独新建数据库相比，同库加法迁移能让全量备份、恢复和版本管理保持单一真值；
其风险通过 H2 的 schema 与稳定链门禁控制。

## 6. 题目引用、快照与资产

题目块采用三层结构：

```text
sourceQuestionId/sourceUpdatedAt
        +
插入时不可变 snapshot
        +
只保存用户实际修改字段的 contentOverrides
```

插入题目时：

1. 从正式题目构造规范快照；
2. 记录源题 ID 和更新时间；
3. 复制题目使用的 Blob 到 `handoutAssets`；
4. 在快照中保存讲义资产引用和源图片证据；
5. 后续源题删除或换图不破坏旧讲义；
6. 讲义编辑不调用 `db.questions.put`。

源题更新检测使用时间戳和字段级 diff。存在覆盖值时不得静默刷新冲突字段。

## 7. 当前公式链

### 7.1 已有能力

- 题目公式以 LaTeX 字符串保存；
- `qisi-components.js` 用 KaTeX `renderToString` 生成网页公式；
- 打印链也用 KaTeX；
- 已有裸 LaTeX、分隔符和公式错误相关测试；
- 原始题库 LaTeX 可以保持不变。

### 7.2 缺口

- 仓库没有 MiTeX；
- 没有 Typst 编译器或 WASM；
- 没有真实题库到 MiTeX 的兼容性清单；
- 没有 Typst 转义器或注入边界；
- 当前 Noto Sans 文件不是已证明覆盖中文的固定 Typst 字体方案；
- KaTeX 字体不能直接等同于 Typst 的完整数学与中文字体方案。

H1 必须先独立证明：

```text
LaTeX data → MiTeX → Typst WASM → PDF
```

在证明之前，不允许开发一个假 PDF 导出按钮或用公式图片代替。

## 8. 当前打印与 PDF 能力

现有组卷链：

```text
题目
→ qisi-exam-print-renderer.js 生成 HTML
→ qisi-a4-exam-template.js 生成完整打印页
→ Blob HTML 新窗口
→ 浏览器按 A4 分页
→ window.print()
```

它具有：

- A4 页面尺寸；
- 浏览器分页预览；
- 图片溢出压缩；
- 题型分组；
- 选项自动列数；
- 题目版与答案版；
- 带框/无框模板。

但它不是：

- 可编程 PDF 编译器；
- Typst；
- 稳定的 PDF 字节生成链；
- 讲义混合内容模型。

讲义可以借鉴排版规则和测试方法，但不得调用或改写该组卷链来假装 Typst 完成。

## 9. Worker、离线和资源现状

### 9.1 Worker

生产源中没有自有 `new Worker(...)`，也没有自有 Worker 文件。

H1 需要验证：

- Express 静态服务对 `.wasm` 的响应；
- Worker 相对 URL；
- Worker 中的 WASM 初始化；
- 可取消任务；
- 错误序列化；
- 页面卸载后的资源释放。

### 9.2 离线

当前没有 Service Worker。

主应用能够在没有互联网时运行的原因是依赖位于本地 `vendor/`，但仍需要本地
Node 服务。讲义第一版应优先直接随发布包携带固定资源；Service Worker 只用于缓存
和版本迁移，不应成为“资源其实在 CDN”的掩饰。

必须分别验收：

- 本地服务运行、互联网断开；
- 资源已缓存后的浏览器重启；
- 缓存版本升级；
- 关键资源缺失时 fail-closed。

“首次断网且资源从未随发布包提供”不能被标记为已支持。

### 9.3 当前本地资源

`vendor/` 当前约 5 MiB，包含：

- Vue；
- Dexie；
- KaTeX 及字体；
- PDF.js；
- JSZip；
- Vue Virtual Scroller；
- Lucide；
- Tailwind CSS；
- Noto Sans Regular/Bold。

Typst、MiTeX 和可分发中文字体会显著增加发布体积。H1 必须记录每个新增文件的：

- 版本；
- SHA-256；
- 大小；
- 来源；
- 许可证；
- 是否修改；
- 是否只在讲义入口加载。

## 10. 备份与恢复

当前 `qisi-backup.js`：

- 导出已知 Dexie 表；
- 把 `images` Blob 分离到 ZIP；
- 对清单、记录数量和缺失 Blob 做回读校验。

讲义存储不能绕过这条可靠性基线。H2 必须：

- 扩展备份格式或建立兼容的新版本；
- 备份 `handouts`、`handoutAssets`、`handoutRevisions`；
- 校验所有讲义资产；
- 保持旧备份可读；
- 不把临时 Blob URL 写入正式草稿。

## 11. 目标模块边界

建议的生产文件按职责拆分：

```text
handout.html
handout.css
qisi-handout-model.js
qisi-handout-validation.js
qisi-handout-migrations.js
qisi-handout-question-adapter.js
qisi-handout-question-instance.js
qisi-handout-edition-policy.js
qisi-handout-layout-policy.js
qisi-handout-typst-escape.js
qisi-handout-typst-model.js
qisi-handout-typst-generator.js
qisi-handout-repository.js
qisi-handout-asset-repository.js
qisi-handout-compiler-client.js
qisi-handout-components.js
qisi-handout-app.js
workers/qisi-handout-typst-worker.js
templates/handout/default.typ
```

约束：

- domain 不读取 DOM、Dexie、Worker 或网络；
- repository 不处理 Vue 状态或 Typst；
- edition policy 在 Typst 生成前删除受保护字段；
- layout policy 同时供 HTML 和 Typst 模型使用；
- generator 只接收经过验证的 `TypstDocumentModel`；
- Worker 不访问题库；
- UI 不拼接 Typst 源码；
- `app.js` 不新增讲义业务逻辑。

## 12. 正式数据流

```text
QisiMathVueDB.questions/images
        │ 只读适配
        ▼
QuestionSnapshot + copied HandoutAssets
        │
        ▼
Handout + sparse overrides
        │ validate/migrate
        ▼
NormalizedHandout
        │ resolve edition + visibility + placement
        ▼
Student/Teacher TypstDocumentModel
        │ leakage scan + escaping
        ▼
trusted main.typ + virtual filesystem
        │
        ▼
Typst Worker
        │
        ├─ PDF.js 正式预览
        └─ 同一 PDF bytes 下载
```

正式预览与下载不能各自生成一份文档。

## 13. 学生版安全边界

优先级固定为：

```text
版本安全规则
  > 讲义全局设置
  > 章节设置
  > 题目局部设置
```

学生模型中必须物理删除：

- `answer`
- `analysis`
- `solution`
- `teacherNote`
- 文末答案索引；
- 仅教师可见的标签或资源引用。

至少设置三重门禁：

1. 纯函数测试验证学生模型没有受保护字段；
2. Typst 源码生成前扫描；
3. PDF 导出后提取文本并扫描真实答案/解析标志和测试哨兵。

任一门禁失败则不提供下载。

## 14. 图片与排版边界

正式图片对象保存：

- `assetId`
- `source`
- `placement`
- `width.value/unit`
- `alignment`
- `caption`
- `captionMode`
- `order`
- `keepAspectRatio`
- `visibility`
- `groupLayout`

合法尺寸单位只允许 `mm` 和 `percent`。拖拽只负责把界面变化转换为结构化尺寸。

`right-of-stem` 与 `right-of-options` 使用确定性双栏；空间不足时由共享 layout policy：

1. 在允许的最小文本宽度和最小图片宽度内尝试；
2. 无法满足则降级为 `below-stem`；
3. 记录诊断；
4. HTML 与 Typst 使用同一决策。

不允许任意坐标、CSS float 猜测或覆盖文字。

## 15. 页眉页脚模型

页眉和页脚分别保存，每个区域含 left/center/right 三个槽。槽内容经过结构化占位符
解析，支持：

```text
{title} {filename} {teacher} {school} {page} {pages}
```

页面范围使用：

```text
all | except-first | first-only
```

距离、边距和高度使用毫米。图片必须引用讲义资产。外部 URL 未转存为本地资产时阻止
离线正式导出。

## 16. 第一版与后续同模块范围

### 第一优先级（H3—H6 必须闭环）

- 题目属性面板；
- 当前讲义实例内容覆盖与恢复；
- 选项四种布局；
- 图片替换、宽度、位置、对齐和排序；
- 答案、分析、解析分别放置；
- 题型/讲义显示标签；
- 学生版和教师版；
- 页眉页脚；
- 草稿保存恢复；
- Typst 正式预览；
- PDF 导出。

### 第二优先级（H7）

- 多题批量设置与撤销；
- 源题差异、全部更新、保留及字段冲突；
- 多图复杂并排；
- 自定义标签；
- 页眉页脚图片和通栏背景；
- 局部 Typst 正式预览。

### 明确不做

- AI 内容生成或改写；
- 题目二维码；
- 任意 Typst 源码；
- 模板市场；
- 极复杂图文环绕；
- 任意坐标排版；
- Word 导出。

## 17. 测试基线

当前共有：

- 111 个 `*.test.js`；
- 17 个 DOCX 相关测试文件；
- 18 个 PDF 相关测试文件；
- 现成的 Playwright 浏览器测试；
- 生产入口顺序与语法门禁；
- `verify:safe`、`verify:docx-stable`、`verify:pdf-known-bad`、
  `verify:batch-safety` 和 no-real-AI 门禁。

讲义测试分层：

1. domain：schema、迁移、覆盖、继承、布局、学生安全；
2. repository：CRUD、自动保存、恢复、复制、删除、资产和备份；
3. generator：Typst 转义、占位符、布局、答案末尾索引；
4. compiler：WASM、MiTeX、字体、图片、多页和取消；
5. browser：完整编辑、刷新恢复、源题不变、PDF 预览与下载；
6. PDF：页数、文本、字体、图片、答案泄漏与渲染截图；
7. regression：现有主页面、题库、组卷、打印和批量链。

## 18. H1 进入条件和阻断项

H1 必须在业务集成前回答：

| 问题 | 通过标准 |
|---|---|
| Typst WASM 能否无 bundler 静态加载 | 本地入口与 Worker 实际成功 |
| MiTeX 能否本地固定加载 | 中文 + 真实 LaTeX 样例成功 |
| 中文字体是否可分发 | 许可证、版本、大小和字形验证齐全 |
| Worker 是否保持 UI 响应 | 编译期间交互心跳不断 |
| 两页以上分页是否稳定 | 生成 PDF 并渲染检查 |
| 页眉页脚页码是否正确 | 真实 PDF 页级检查 |
| 错误能否定位到块/公式 | 失败样例返回结构化诊断 |
| 主页面是否零负担 | 网络记录无 Typst/MiTeX/讲义字体请求 |

以下任一情况会阻止进入 H2：

- 只能使用云端编译；
- 必须要求教师安装 Typst/TeX/Python/Java/Rust；
- 依赖或字体许可证不允许分发；
- MiTeX 失败被静默吞掉；
- 编译只能运行在主线程；
- 无法从错误映射回讲义块；
- 普通题库启动被迫加载 Typst 资源。

## 19. 风险矩阵

| 风险 | 级别 | 控制 |
|---|---|---|
| `app.js` 继续膨胀 | 高 | 独立入口，禁止讲义业务进入 `app.js` |
| 学生版泄漏答案 | 极高 | 数据投影前删除 + 源码扫描 + PDF 文本扫描 |
| MiTeX 兼容性不足 | 高 | H1 原型 + 真实公式回归 + fail-closed |
| 中文字体缺字或授权不明 | 高 | 固定字体、许可证、缺字测试、无静默替换 |
| 讲义图片随源题失效 | 高 | 插入时复制 Blob 到讲义资产 |
| schema 升级影响旧题库 | 高 | 加法迁移、旧库 fixture、完整稳定链门禁 |
| HTML 与 PDF 布局分叉 | 高 | 共享 layout policy；正式预览与导出同 PDF |
| WASM 阻塞页面 | 高 | Worker、取消、心跳和性能门禁 |
| 离线只是口号 | 中高 | 全资源本地化 + 断网重启与导出测试 |
| Blob URL 泄漏 | 中 | 集中资产解析器，页面关闭/任务结束释放 |
| 任意输入破坏 Typst | 高 | 无 raw Typst，按上下文转义和资源路径白名单 |

## 20. H0 未完成项

本阶段明确没有完成：

- Typst/MiTeX 选型；
- WASM 下载或安装；
- 字体选型；
- 浏览器编译；
- 数据库迁移；
- 讲义 UI；
- 正式预览；
- PDF 导出；
- 真实公式兼容性；
- 离线、性能或人工验收。

这些内容必须按 H1—H8 的阶段证据逐项完成，不能由本审计文档替代。

## 21. H0 验证结果

执行时间：2026-07-28。

```text
npm.cmd run verify:diff-scope
PASS

npm.cmd run verify:safe
PASS
```

`verify:safe` 的实际结果：

- 生产 JavaScript 语法：51 个文件通过；
- Node/浏览器测试：1,257 项；
- 通过：1,249；
- 失败：0；
- 既有条件跳过：8；
- 批量稳定链 mock smoke：20/20；
- no-real-AI/OCR：通过。

本阶段没有调用真实 AI/OCR，没有修改生产代码、依赖、数据库或用户资料。
