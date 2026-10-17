# MinerU 块协议（v1，三个并行任务共同遵守）

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
- `id` 形如 `p{页}b{块序}`，页内稳定、全局唯一。
- 已丢弃 `page_number`（页脚）块；其余块保持原始顺序。
- `answerTable` 由**软件**从表格块里确定性解析（HTML `<table>` 的“题号/答案”两行），解析不出就整个字段为 `null`，不许猜。
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

- `image/table/chart` 块只给占位描述，不给字节。
- 单次请求的块总量以「一页窗口」为单位（默认 4 页，见归属层分窗）。

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
- 一个块可以被多个题引用（如跨页题干续段），但**同一题的同一字段内不得重复**。
- 选择题的 `answer` 若 `answerTable` 已给出，则**以表为准**；模型给的与表冲突时，记 `issues:["answer-table-conflict"]` 并采用表。
  比较口径（已确认）：模型答案块通常是 `D. $\mathrm{i}$` 这类带标号的原文，因此先从模型答案里抽选项标号（`D` / `AB`）再与表比对；
  **抽不出标号时记 `answer-table-unverifiable`，不判冲突**——如实报告不可比，比猜一个冲突或猜一个通过都更安全。
- 软件按 id 顺序拼接文本：`text` 直接取原文；`image/chart` 转成 `[[IMAGE:<文件名>]]`；`table` 取其 HTML。
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
