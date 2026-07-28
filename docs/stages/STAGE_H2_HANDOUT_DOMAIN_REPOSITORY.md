# STAGE H2 — 讲义领域模型与 Repository

## 1. 阶段结论

H2 已完成。

本阶段建立了独立的讲义数据边界：

```text
正式题库题目（唯一真值）
→ 插入时快照 + 源题引用
→ 讲义资产副本
→ 稀疏局部覆盖
→ 讲义 Repository
→ QisiMathVueDB v9
```

讲义编辑不会回写正式题库。源题后续发生变化时，只进行确定性的字段级比较；
系统不会依靠语义猜测自动覆盖讲义内容。

本阶段没有接入讲义 UI、主页面导航或 Typst 正式编译链，这些分别属于 H3—H6。

## 2. 模块边界

| 模块 | 单一职责 |
|---|---|
| `qisi-handout-model.js` | schema、迁移、规范化、验证和基础创建 |
| `qisi-handout-question-instance.js` | 源题快照、稀疏覆盖、源题变化比较 |
| `qisi-handout-asset-repository.js` | 讲义 Blob 资产及引用图完整性 |
| `qisi-handout-repository.js` | CRUD、自动保存、版本恢复和事务边界 |
| `qisi-db.js` | 加法式 Dexie v9 schema 与显式数据库访问口 |
| `qisi-backup.js` | 讲义表、版本和 Blob 的完整备份验证 |

四个新的讲义模块被登记为 `browser-library`：它们是生产领域库，必须存在并参加
语法检查，但 H2 不把它们加载进 `main.html`。H3 的独立入口将显式加载这些模块。

## 3. 数据模型

数据库从 v8 加法式升级到 v9，新增：

```text
handouts:         id, title, status, createdAt, updatedAt
handoutAssets:    id, handoutId, sourceQuestionId, sourceImageId, createdAt
handoutRevisions: id, handoutId, revision, createdAt
```

v8 的既有 store、索引和记录保持不变。既有词法变量 `db` 保留，同时新增只读入口：

```js
Qisi.Database.getDatabase()
```

讲义 schema 当前为 v1。缺少版本号或 v0 记录会经过确定性迁移；未知未来版本拒绝读取，
避免静默降级和数据损坏。

讲义块只允许：

- 标题；
- 正文；
- 提示框；
- 图片；
- 显式分页；
- 题目实例。

所有 ID、时间戳、状态、块数量、块类型、源题引用和快照版本均有边界验证。

## 4. 题目快照与覆盖规则

题目插入讲义时：

1. 保留源题 ID 和源题更新时间；
2. 复制题干、选项、答案、解析、图片布局和来源证据；
3. 将所需图片 Blob 复制到 `handoutAssets`；
4. 快照只保存讲义资产引用，不保存对象 URL、data URL 或源图片 Blob；
5. 同一源图片的重复引用复用一份讲义资产；
6. 任一必要图片缺失时整笔事务失败。

局部覆盖采用白名单字段，并且保持稀疏。`meta`、`sourceTrace` 等来源证据不可被覆盖。
保存、自动保存、恢复版本、插入和删除均通过 Repository 完成。

验证明确证明：

- 正式题库行在插入和覆盖后逐字节等价；
- Repository 不调用 `questions.put`；
- 已复制 Blob 不与源 Blob 对象别名；
- 悬空资产、跨讲义资产和缺失 Blob 均 fail closed。

## 5. 自动保存、恢复和并发

- 保存要求调用方提供 `expectedUpdatedAt`，过期写入返回 `HANDOUT_CONFLICT`；
- 内容未变化的自动保存是真正的 no-op，不制造时间戳和版本噪音；
- 有变化时先保存旧版本，再原子写入新讲义；
- 历史版本按上限裁剪，默认保留 20 份；
- 恢复版本同样经过 schema 和资产图验证；
- 删除讲义会在同一事务中级联删除讲义资产和版本；
- Repository 的数据库、时钟和 ID 生成器均为依赖注入，便于隔离测试。

## 6. 源题更新比较

比较仅基于受控字段的精确值，不进行语义猜测：

- 源题不存在：标记 `missing`；
- 内容未变但时间戳变：标记 timestamp-only；
- 内容字段变化：返回精确 `changedFields`；
- 当讲义局部覆盖和源题同时改动同一字段：返回 `conflictFields`；
- 源题 ID 不一致：立即拒绝。

自动采用源题更新、交互式冲突解决和批量同步属于 H7；H2 只提供可审计的比较事实。

## 7. 备份完整性

完整备份现在包含：

- `handouts.json`
- `handoutAssets.json`
- `handoutRevisions.json`
- `handout-asset-blobs/*`

验证器检查：

- manifest 表计数；
- 讲义资产 Blob 数量、文件存在性和非空性；
- 当前讲义与所有版本快照的资产引用；
- 资产归属讲义是否一致。

讲义资产缺失、Blob 缺失或跨讲义引用会阻止备份。旧版只含 `questions` 和 `images`
的 v1 备份继续兼容。

## 8. 自动化验收

聚焦测试：

```text
node --test tests/handout-h2-domain.test.js \
  tests/handout-h2-repository.test.js \
  tests/handout-h2-database-backup.test.js

tests 17
pass 17
fail 0
```

其中数据库测试在真实无头 Chromium 中创建 v8 Dexie 数据库，升级到 v9，并验证：

- 旧题目和图片仍存在；
- 旧 store 索引完全不变；
- 新表可完成真实事务；
- 快照、资产、自动保存、版本和级联删除可工作；
- 完整备份可以重新打开并通过验证。

阶段门禁：

```text
npm.cmd run verify:docx-stable
PASS — 20/20

npm.cmd run verify:batch-safety
PASS — DOCX 20/20；PDF known-bad 65/65；batch smoke 20/20；
       no-real-AI/OCR 通过

npm.cmd run verify:safe
PASS — 55 个生产 JavaScript 文件语法通过；
       1278 项测试，1270 通过，0 失败，8 项既有条件跳过；
       batch smoke 20/20；no-real-AI/OCR 通过
```

本阶段没有调用真实 AI/OCR，没有修改用户数据，也没有修改 `app.js`、`main.html`、
DOCX/PDF 识别、答案对齐或现有打印链。

## 9. H2 未完成项

按阶段边界留给后续：

- H3：独立讲义入口、列表、结构化编辑器和 HTML 预览；
- H4：学生/教师版本安全投影和正式 Typst 文档模型；
- H5：生产 Worker 编译、PDF.js 正式预览、取消和缓存；
- H6：主页面轻量入口与第一优先级端到端闭环；
- H7：源题更新交互、批量设置和复杂多图布局；
- H8：真实题库公式、离线、性能和最终浏览器验收。

H2 不宣称上述能力已经完成。
