# 独立任务卡：字体真实字重修复（2026-10-21）

> 本文是**独立任务**，不属于 W2（隔离重建候选提交）范围，也不属于 app.js 拆分 R1–R7。
> W2 只补了字体的许可与来源记录，**没有**改字体文件、CSS 或页面加载方式。
> 任务卡按 `ai/HANDOFF_FOR_ASTRA_2026-10-21.md` 第 22 节模板填写。

```text
阶段 ID / 子步骤：R0-FONT（独立字体资产任务，可与 R1 并行，但不与 R1 同提交）

用户能感知的目标：
  页面正文/标题/加粗不再依赖浏览器"合成加粗"，加粗处是真实 Bold 字形；
  打印和另存 PDF 时字重与屏幕一致；常用汉字不缺字；离线打开不请求外部字体。

前置提交、源码身份和本地材料范围：
  前置：W3 通过的候选（codex/w2-candidate-20261021 末端）。
  源码身份：vendor/fonts/noto-serif-sc/*.woff2（101 个，6,030,988 字节）、
            qisi-noto-serif-sc.css、main.html 第 19 行的字体样式链接。
  本地材料：不引入真实题库材料；字体源文件与生成脚本作为本地证据保存，不提交缓存。
  禁止：新增网络字体/CDN、改 app.js、改业务模块、借机重排页面布局。

已复现的问题：
  qisi-noto-serif-sc.css 共 404 个 @font-face = 4 个字重（400/500/600/700）× 101 个 unicode-range
  子集，但四套声明**全部指向同一批 101 个文件**；这些文件的内嵌 family 是
  "Noto Serif SC ExtraLight"（nameID 1）、subfamily "Regular"、版本 2.003-H1。
  因此 500/600/700 没有对应字形，浏览器只能合成加粗。
  证据：local-run-artifacts/golden-baseline/20261021-w2-candidate/fonts-manifest.json（逐文件 sha256 与 name 表）、
        vendor/fonts/noto-serif-sc/MANIFEST.sha256、vendor/fonts/NOTO_SERIF_SC_PROVENANCE.md。

现有入口 / 生产者 / 消费者 / 唯一负责人：
  生产者：qisi-noto-serif-sc.css 的 @font-face 声明（唯一字体来源）。
  消费者：main.html 的全局字体族设置；打印窗口复用同一套样式与字体。
  负责人：目前没有"字体资产负责人"；本任务应在 vendor/fonts/ 内新增一个生成/校验脚本，
          并在来源记录里登记版本、字重、子集范围。不要把这个职责塞进 app.js。

精确允许文件及禁止文件：
  允许：vendor/fonts/**（新增 500/700 子集、更新 MANIFEST 与来源记录）、
        qisi-noto-serif-sc.css、main.html 仅字体相关行、
        新增只读校验脚本（如 tools/verify-fonts.cjs）及其测试。
  禁止：app.js、qisi-*.js 业务模块、打印逻辑、数据库/存储、识别链路、任何在线字体请求。

输入输出合同：
  输入：与现有 ExtraLight 同源同版本（Noto Serif SC / Source Han Serif 2.003 系列）的
        400、500、700 字重字体文件。
  输出：family 名保持 'Noto Serif SC'（避免全站样式改动）；每个 @font-face 的 unicode-range
        必须与该文件真实覆盖一致；至少提供 400 与 700 两套真实字形，500/600 可映射到最近的真实字重
        但必须在来源记录中写明映射关系，不能再次用同一文件冒充多个字重。
  错误语义：缺字重/缺子集必须在构建期失败，不能静默回退到 ExtraLight。

可变状态、初始化/卸载次序、资源释放：
  字体按 unicode-range 惰性加载；文件数可能从 101 增至约 202–303，需评估首屏请求数与总体积；
  不得为了减少请求把多个子集合并成超大文件而不做实测。

旧接线退出清单：
  旧的 4×101 同文件声明在验证通过后整体替换，不保留 disabled 旧声明；
  旧 MANIFEST.sha256 更新为新文件集的清单；来源记录保留历史段落并注明替换日期。

合成/回放/真实本地材料/人工复核各自边界：
  合成：字体二进制解析（name 表字重、表数量、sha256）、CSS 引用闭合、unicode-range 抽样。
  真实本地材料：真实页面的标题/加粗/公式对比截图；打印 PDF 的字体嵌入检查（pdffonts 或等价工具）。
  人工复核：屏幕与打印的字重、缺字、行距变化必须由用户或独立复核者确认；代理不得代填"已通过"。

必要回归、普通 UI 验收、完整门禁、独立复审：
  - tests/e2e/exam-print-preview.test.js、tests/e2e/print-image-readiness.test.js；
  - 显示相关：tests/qisi-utils-display-math-normalize.test.js、tests/e2e/pdf-exam-print-preview.test.js；
  - npm run verify:safe 全量；npm run verify:batch-safety；
  - 独立复审字重映射与体积/首屏影响。

算法输入域、正确性条件及必要的性能测量：
  输入域：GB2312/常用汉字 + 数学符号 + 拉丁；正确性条件：任一码位只命中一个真实字重的子集，
  且该子集确实包含该字形（抽样 + 覆盖统计）。
  性能：记录首屏字体请求数、总字节、首次渲染时间；总体积建议不超过 12 MB（超出需单独论证）。

失败停止条件、回退对象和数据不变条件：
  停止：拿不到同版本真实字重、必须引入在线字体、打印 PDF 未嵌入字体、或体积/首屏明显劣化。
  回退：恢复现有 qisi-noto-serif-sc.css 与 101 个文件（按 MANIFEST.sha256 校验）。
  数据不变：不改任何题库/草稿/图片数据，不改存储结构。

精确增量对账、候选提交和未完成项：
  对账：字体文件清单（新增/删除/哈希）、CSS diff、main.html 行、体积与请求数对比。
  候选提交：单一提交（字体资产 + CSS + 来源记录 + 校验脚本/测试），不与业务修复混提。
  未完成项：视觉复核签字、打印 PDF 嵌入证据、体积实测。
```

## 复现与校验入口（本机）

```powershell
# 逐文件 name 表与哈希（只读）
node local-run-artifacts\golden-baseline\20261021-w2-candidate\scripts\font-probe.cjs
# 现有 101 个文件的校验
cd vendor\fonts\noto-serif-sc
sha256sum -c MANIFEST.sha256
```

## 当前状态

- 状态：**未开始**（W2 只补了许可/来源，未改字重）。
- 已知影响：`font-weight: 700` 的文字目前是合成加粗；打印/PDF 的字重可能与设计不一致。
- 风险提示：替换字体会改变版面行高与分页，必须重新做打印分页验收；不要与 app.js 拆分同提交。
