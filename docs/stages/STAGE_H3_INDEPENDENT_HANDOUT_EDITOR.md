# STAGE H3 — 独立讲义编辑器与 HTML 快速预览

## 1. 阶段结论

H3 在不修改 `app.js`、`main.html`、DOCX/PDF 导入链和现有打印链的前提下，
新增了独立同源入口 `handout.html`。教师现在可以：

```text
新建/打开讲义
→ 添加标题、正文、提示框、图片、分页和题库题目
→ 调整顺序、复制、删除、撤销/重做
→ 只在讲义实例中编辑题干、选项、答案、解析、标签和布局
→ 设置页面、页眉、页脚和讲义信息
→ 查看学生版或教师版 HTML 快速预览
→ 自动保存、刷新恢复、恢复历史版本、复制或删除讲义
```

本阶段仍不生成正式 PDF，也不加载 Typst、MiTeX、PDF.js 或讲义字体。
正式文档模型和可信 Typst 生成器属于 H4；生产编译设施属于 H5。

## 2. 边界与模块

| 模块 | 单一职责 |
|---|---|
| `handout.html` | 独立结构化编辑界面和可访问的交互契约 |
| `handout.css` | 编辑器、属性面板和 A4 HTML 快速预览样式 |
| `qisi-handout-app.js` | Vue 组合根、交互协调、对象 URL 生命周期 |
| `qisi-handout-editor-state.js` | 纯编辑状态、结构操作、撤销/重做、稀疏覆盖 |
| `qisi-handout-preview.js` | 学生/教师快速预览投影、选项列数、KaTeX 安全渲染 |
| `qisi-handout-question-library.js` | 正式题库只读搜索、题目与引用图片读取、源题比较 |
| `qisi-handout-repository.js` | 讲义复制、图片导入和持久化访问 |
| `qisi-handout-asset-repository.js` | 复制讲义时显式重映射资产引用 |

UI 不调用 `questions.put`、`handouts.put` 或 IndexedDB API。数据库只在启动时注入
repository 和只读 question-library；所有讲义写入继续经过 repository。

## 3. 题目唯一真值与局部编辑

题目插入仍使用 H2 冻结的数据结构：

```text
sourceQuestionId/sourceUpdatedAt
        +
插入时不可变 snapshot
        +
仅保存实际修改字段的 contentOverrides
```

- 题库搜索最多扫描 5,000 条、最多返回 200 条；界面默认返回 80 条。
- 只读取题目实际引用的图片，不扫描或复制无关图片。
- 插入时若引用图片缺失，操作失败关闭，不生成半完整题目。
- 修改字段等于快照原值时，覆盖字段自动删除。
- “恢复插入时内容/恢复题干/恢复题库原图”只修改讲义实例。
- “检查源题更新”只显示时间与字段差异；H3 不自动覆盖冲突。

## 4. 编辑状态与恢复

- 支持标题、正文、提示框、图片、分页和题目六类内容块。
- 删除使用应用内确认框，不使用原生 `alert/confirm`。
- 撤销历史上限为 60；同一字段 800ms 内的连续修改合并为一个历史动作。
- 自动保存延迟为 500ms；并发保存期间的新编辑不会被旧响应覆盖。
- 保存使用乐观并发时间戳；冲突时停止写入并显示错误。
- 讲义复制在同一事务中复制 Blob、生成新资产 ID、重映射全部显式引用并验证资产图。
- Blob URL 只在打开讲义期间存在，切换讲义、页面卸载或刷新资产时立即回收。

## 5. 学生版安全与 HTML 快速预览

学生版投影在生成展示模型时物理删除：

- `answer`
- `analysis`
- `solution`
- `teacherNote`
- 教师提示框
- snapshot、meta、sourceTrace 等非展示证据

这不是 CSS 隐藏。单元测试使用独立哨兵扫描完整 JSON 和 HTML，确认学生投影不存在
教师内容。教师版保留答案、分析、解析，并支持题内、题后、文末或隐藏位置。

KaTeX 快速预览：

- 非公式文本先做 HTML 转义；
- `trust: false`；
- 不抛出未处理公式异常；
- 没有 KaTeX 时显示转义后的公式原文；
- 选项布局使用明确模式或确定性的长度规则，不读取屏幕坐标。

H4 会把同一布局决策抽成正式 document-model policy，并补充 Typst 转义和泄漏门禁。

## 6. 入口与启动约束

`scripts/production-entry-manifest.js` 现在分别记录主应用和讲义入口的本地脚本/样式顺序。

讲义入口：

- 只使用本地固定版本 Vue、Dexie、KaTeX；
- 不访问 CDN；
- 不加载 Typst、MiTeX 或 PDF Worker；
- 启动失败显示可读错误和重新加载按钮，不留下白屏；
- 运行时错误进入独立诊断数组并写入控制台；
- 不向 `app.js` 注入讲义业务。

## 7. H3 浏览器按钮验收

自动浏览器测试逐项执行：

| 区域 | 已执行动作 |
|---|---|
| 讲义 | 新建、重命名、立即保存、刷新恢复、复制、删除 |
| 历史 | 自动保存版本列表打开 |
| 内容块 | 标题、正文、提示框、分页、图片、复制、删除路径、撤销、重做 |
| 题库 | 打开、读取正式题目、插入、验证源题未变 |
| 属性 | 内容、选项、图片、答案解析、标签、显示、源题七个页签 |
| 布局 | 自动/一行四项/两列/单列策略，图片宽度和位置数据 |
| 预览 | 学生版、教师版、A4 高度、KaTeX、答案泄漏扫描 |
| 设置 | 页面、页眉、页脚、信息入口 |

测试同时记录：

- page error；
- console error；
- HTTP 4xx/5xx；
- 外部网络请求；
- Typst/MiTeX/PDF 编译资源请求。

以上数组均必须为空。

## 8. 阶段限制

H3 明确没有宣称完成：

- 正式 Typst 文档模型；
- Typst 源码生成、转义和注入门禁；
- Web Worker 编译；
- PDF.js 正式预览或 PDF 下载；
- 主页面讲义导航入口；
- 批量题目设置、复杂多图组合和源题冲突处理。

这些分别属于 H4—H7，不能由 HTML 快速预览冒充。

## 9. 验证命令

H3 聚焦门禁：

```text
node --test tests/handout-h3-editor-preview.test.js
                 tests/handout-h3-entry-manifest.test.js
                 tests/handout-h3-browser.test.js
                 tests/production-entry-manifest.test.js
```

全局门禁：

```text
npm.cmd run verify:safe
npm.cmd run verify:docx-stable
npm.cmd run verify:batch-safety
```

范围门禁只允许 H3 清单中的文件。H3 完成后停止，不自动进入 H4。
