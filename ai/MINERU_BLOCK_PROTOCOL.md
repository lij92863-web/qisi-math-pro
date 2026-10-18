# MinerU 块协议（v1，含 2026-10-18 完整性扩展）

本文件是接口契约，任何实现不得擅自改字段。改动必须先改本文件。

## 1. 解析层输出（服务端 → 浏览器）

一次解析 = 一次 MinerU 精准解析任务，返回：

```json
{
  "protocol": "mineru-blocks-v1",
  "job": "任务句柄，供 GET /api/mineru/image?job=… 取图",
  "source": { "filename": "试卷.pdf", "pages": 21, "sha256": "..." },
  "pages": [
    {
      "page": 1,
      "blocks": [
        { "id": "p1b0", "type": "text",     "text": "广东深圳…试卷", "bbox": [163,92,833,114] },
        { "id": "p1b6", "type": "equation", "text": "$$z(1+\\mathrm{i})=2\\mathrm{i}$$", "bbox": [..] },
        { "id": "p1b7", "type": "image",    "image": "images/847e….jpg", "bbox": [149,563,379,659] },
        { "id": "p1b8", "type": "table",    "text": "<table>…</table>", "image": "images/ac37….jpg", "bbox": [..] },
        { "id": "p1b9", "type": "chart",    "image": "images/….jpg", "bbox": [..] }
      ]
    }
  ],
  "answerTable": { "1": "D", "2": "A", "3": "B", "4": "A", "5": "C", "6": "D", "7": "C", "8": "D", "9": "AB", "10": "BCD", "11": "BC" },
  "notes": ["page_number 块已丢弃", "…"]
}
```

规则：
- 基础 `id` 形如 `p{页}b{块序}`，页内稳定、全局唯一。块序只计算原始非页脚项，附属文字不改变后续基础 ID。
- `page_number`（页脚）不进入显示块，但仍在 `evidence.items` 中保留；其页码也参与总页数统计。缺失或非法 `page_idx` 必须报错。
- 原始 `content_list` 完整放在 `evidence.items`。未知类型以 `unsupported` 块保留并提示核查，不能静默丢弃。
- `answerTable` 由**软件**从 HTML 的相邻“题号/答案”行确定性解析。没有此结构返回 `null`；结构存在但列数、题号、答案或跨表一致性不合法时抛出 `MINERU_ANSWER_TABLE_INVALID`，不能把错误表当作不存在。成对空单元格只作为末行填充，不生成答案。
- `image` 是 ZIP 内相对路径；服务端需能按 id 取回字节（见 §4）。

## 2. 归属层输入（软件 → 模型）

只把**编号清单 + 文本**给模型，不给坐标、不给图片字节：

```json
{
  "exam": { "pages": 21, "question_numbers": ["1","2","…","19"] },
  "answer_table": { "1": "D", "…": "…" },
  "blocks": [
    { "id": "p1b6", "p": 1, "kind": "text", "text": "1. 复数 z 满足 …" },
    { "id": "p1b7", "p": 1, "kind": "image", "alt": "图" }
  ]
}
```

- `image/chart` 块只给占位描述，不给字节；table 传原始 HTML 文本，避免另一条模型输入路径丢掉表内证据。
- caption、footnote 是独立 text 块，payload 必须传播其 `parentId`，不能仅传图片占位符而丢弃附属文字。
- 窗口是原顺序的连续块切片，以不同页标签数量控制预算（默认 4）；页码不能证明跨页文本的实际来源范围。缺页码或非法窗口大小报契约错误，不能丢块或排序补救。正文不截断；显式字符预算不足时返回规划错误。

## 3. 归属层输出（模型 → 软件）

模型**只做归属**，不抄写正文，不改写公式：

```json
{
  "protocol": "block-ownership-v1",
  "questions": [
    {
      "question_no": "1",
      "type": "single_choice",
      "stem": ["p1b6"],
      "options": { "A": ["p1b6"], "B": ["p1b6"], "C": ["p1b6"], "D": ["p1b6"] },
      "answer": ["p1b6"],
      "solution": ["p9b2", "p9b3"],
      "figures": ["p1b7"],
      "issues": []
    }
  ],
  "unassigned": [{ "blocks": ["p9b9"], "reason": "无法判断归属" }]
}
```

规则：
- 所有值必须是**已存在的块 id**；出现不存在的 id → 该题判 `invalid`，不得猜测修补。
- 模型字段齐全、题号顺序符合 expected，且每个引用位于确定性分段建立的本题/本角色范围内才准入。跨题共享原块必须先得到有来源区间的片段，不能靠模型题号决定归属。同一字段不得重复 ID。
- `questions` phase 只能填题干/选项/图；`solutions` phase 只能填答案/解析。模型提供的“选项 D 文本”不是原文答案声明；答案来自所有原文显式声明与原表的聚合。相互冲突不能由表优先或头优先消除。
- `assembleQuestion`、`assembleExam`、`validateOwnership` 共用来源准入与投影；失败时答案和解析为空，原文和候选字段留待核查。
- 软件按 id 顺序拼接原文。共享选项块须按数学区域外完整连续标签切分，保留前导文字与片段区间；无法切分不能复制整块。选择题选项必须完整，答案标签须属于选项集合。
- 图片结构包含 `path/sourceId/assetId/name`，其中 name 只作展示，assetId 为来源和完整 ZIP 路径的复合身份；标记内编码该身份。**本轮未接入正式图片存储/导出消费者，不能把这个标记当作已支持的正式 UI 格式。**
- 拼接后仍要过既有的“公式必须 LaTeX”门禁，不过就判该字段 rejected。

## 4. 服务端接口

```
POST /api/mineru/parse   (multipart: file)          → §1 的 JSON（含逐块图片的可取回 id）
GET  /api/mineru/image?job=<id>&name=<相对路径>      → 图片字节
```

- token 只从服务端 `.env` 的 `MINERU_TOKEN` 读，浏览器不得接触。
- 只允许白名单方法、限制 200MB、单文件 200 页。
- 失败必须带上 MinerU 的原始错误码，不许吞成通用文案。

## 5. 验收（今晚必须做到）

1. §1 的实现能对真实 21 页卷返回 **274 个正文块**（content_list 原始 294 条 − 20 个 `page_number`），且 `answerTable` 与人工金标一致（1 D, 2 A, 3 B, 4 A, 5 C, 6 D, 7 C, 8 D, 9 AB, 10 BCD, 11 BC）。
   参考基线：丢弃「空且无图」的块后剩 171 个块；在归属完成前，`unassigned` 约 31 条属于正常。
2. §3 的校验器能拒绝不存在的块 id、重复字段、非数组值。
3. 端到端（解析 + 切分）**实测 16.0 秒**（submit 282ms / upload 416ms / poll 14.8s / zip 394ms）；三次独立实测中位数 25.8 秒，全部 < 30 秒。
4. 切分结果：19 题、答案 11/11 与金标一致、图块与金标零偏差、解析 **19/19 已定位**、issues 为空。

## 6. 无损来源、派生片段与确定性配对

新增字段均为 v1 的附加字段；旧字段含义保留。上面的块数/耗时是深圳历史基线，不是任意文件的固定断言。

解析基础块新增 `origin: {sourceId,itemIndex,field,blockId,range?}`。`sourceId` 为原 PDF SHA256，`itemIndex` 对应 `evidence.items`，`field` 为原始文本字段；文本范围采用 UTF-16 半开区间。

`image_caption/image_footnote/table_caption/table_footnote` 每个原始值生成一个 text 块：

```json
{
  "id": "p1b7/image_caption/0",
  "type": "text",
  "text": "C.",
  "parentId": "p1b7",
  "origin": {"sourceId":"...","itemIndex":8,"field":"image_caption","index":0,"blockId":"p1b7/image_caption/0","range":[0,2]}
}
```

附属文字保留在相邻资源之后，不能充当题号或答案章节边界。`parentId` 指向资源；`origin.blockId` 指向该文本来源本身，两种关系不能混用。

确定性 segmenter 切分同块多题时不 trim 原文。片段 ID 为 `{原始ID}@{绝对start}:{绝对end}`，`origin.blockId` 始终指向原始块，`origin.range` 为对应区间。`segment` 和 `assemble` 都返回 `blocksById`，消费者必须使用它解析公开引用。再次切分派生块时传入 `sourceRegistry: previous.blocksById`，保留原始来源索引。

`segment(...,{role:'support',numbers:[...]})` 对答案头、数学区域外题号和整个编号序列进行校验。`assemble` 消费 issues：重复、倒序、缺号、未知编号、歧义边界、来源或 ID 冲突均禁止答案与解析绑定；原文候选仍保存在索引和分段结果中。表格答案与另一处**原文明示答案**冲突时，该题答案和解析均暂空并保留冲突证据。此规则区别于 §3 模型归属意见与原表冲突：模型意见不构成第二份原始答案证据。

答案区章节头、题号重启之前紧邻的答案表及附属标题进入 `solutionSegment.preamble`，不能残留在最后一题题干。结构化答案表须有题号/答案行；没有章节头或重启证据时，表格单独出现不能证明进入答案区。章节回溯不越过前一题的题号。

`pairPapers` 将两侧 ID 分别加 `question/` 和 `support/` 命名空间，同时转换 parent/source 引用，避免不同 PDF 的 `p1b0` 相互覆盖。返回 `valid`、`blocksById`、`coverage.matched` 和 `coverage.paired`。matched 只是两侧同号候选数；paired 只统计通过准入且实际附有解析的题目。序列异常不能通过覆盖 Map 或按位置凑齐。

题目文件没有答案材料是正常结果，不自动报 solution-missing。主观题没有可独立确定的简答值时保留完整 `solutionBlocks`，`answer` 可以为空，不能计算答案或用第一分问冒充整题答案。

## 7. 2026-10-18 统一准入与核验记录

§3 的新约束取代早期“表优先”“只报错仍绑定”“共享整块复制”的实现行为。HTTP 返回客户端完整协议对象，含 evidence，不再逐字段删选。规范化块和附属块均携带 page；原始输入页码倒序拒绝，不能重排来源。

题干内部编号和支持材料内部多小问编号可能与步骤同形。扫描保留所有候选及原文片段，不能仅因 expected 恰好吻合就确认。重启边界必须由前后两段一致的严格递增编号及后段支持证据证明，无固定最小题数。

无法由文本区分时，可由受信任调用方提供原页复核后的 `boundaryReviews`：`{sourceId,blockId,text,offset,decision,evidence}`。decision 是 question-start 或 nested；offset 是原块内 UTF-16 偏移，text 为完整原块快照，evidence 为复核所用原页图像位置。模型不得生成这些记录。来源、原文或偏移变化必须重新核查；核验只证明该边界，不证明整题公式正确。

所有结果保留 `contentStatus:'unverified'`、`reviewRequired:true`；空壳来源以 contentIssues 报告。结构 valid 不代表逐页内容核对通过。图片持久化、服务任务恢复、压缩 PDF 页数强校验与正式 UI 接入仍不属于当前已实现协议能力。
