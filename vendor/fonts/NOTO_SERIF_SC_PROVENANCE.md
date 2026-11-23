# Noto Serif SC 字体资产：来源、许可与校验记录

本文件记录 `vendor/fonts/noto-serif-sc/` 下 101 个 woff2 子集和
`qisi-noto-serif-sc.css` 的来源、许可与可复核证据。它不是"字体已通过视觉验收"的证明。

## 1. 许可

- 许可证：**SIL Open Font License 1.1**（OFL-1.1）。全文见同级目录 `OFL.txt`。
- `OFL.txt` 取自 Google Fonts 字体仓库中本家族条目：
  `https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/OFL.txt`（2026-10-21 获取，逐字节保存，未改动正文）。
- 该副本头部版权行为 `Copyright 2012 Google Inc. All Rights Reserved.`；
  而每个 woff2 的 name 表内嵌声明为 `(c) 2017-2024 Adobe (http://www.adobe.com/).`。
  两个声明都保留：前者是 Google Fonts 打包副本的声明，后者是二进制实际携带的声明。
- OFL 允许随软件分发、嵌入与再分发，不得单独售卖字体；修改版不得使用保留字体名；
  分发时必须随附本许可证。**文档/试卷内容不受 OFL 约束**。
- 仓库 `.gitattributes` 的 `vendor/** -text` 使这些文件按二进制原样保存，避免换行规范化改动字节。

## 2. 来源

- 家族：Noto Serif SC（Google Fonts 提供的 Noto Serif 简体中文系列）。
- 形态：Google Fonts CSS2 API 生成的 unicode-range 子集 woff2（按码位切片），
  由页面样式 `qisi-noto-serif-sc.css` 逐个 `@font-face` 引用。
- 本地写入时间：2026-10-19 23:04:16–23:04:17（文件系统 mtime，只证明写入时刻，
  **不是**下载日志，也不证明当时的上游版本号）。
- 上游现状（2026-10-21 核对）：`fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400`
  当前返回 v36 且同样为 101 个子集；本地文件名哈希前缀为 `H4chBXePl9DZ0Xe7gG9cyOj7`，
  与当前 v36 的 `H4cy…` 不同，说明本地这批来自更早的上游发布。**具体版本号未记录，属未验证项。**

## 3. 二进制内嵌元数据（从每个 woff2 的 name 表读取）

| 字段 | 值 |
|---|---|
| family (nameID 1) | Noto Serif SC ExtraLight |
| subfamily (nameID 2) | Regular |
| version (nameID 5) | Version 2.003-H1;hotconv 1.1.1;makeotfexe 2.6.0 |
| copyright (nameID 0) | (c) 2017-2024 Adobe (http://www.adobe.com/). |
| 表数量 | 23 / 22 |
| 文件数 | 101 |
| 合计字节 | 6030988 |
| 单文件字节范围 | 2416 – 104964 |
| MANIFEST 聚合 SHA-256 | `a4526d48f6d2e642e80f33fd8527de3824d0f27823f6fbe92ba7cd0cf4f20805` |

## 4. 样式表与引用闭合

- `qisi-noto-serif-sc.css` 共 404 个 `@font-face`，
  去重后 101 个 woff2 URL，**缺失 0**。
- 声明字重：400/500/600/700；字型：normal；family：Noto Serif SC。
- 注意：404 = 4 个字重 × 101 个子集，
  但**四个字重指向同一批 101 个文件**，没有独立的 500/600/700 字重文件；
  且内嵌 family 名为 `Noto Serif SC ExtraLight`。因此页面上的粗体是浏览器合成加粗，
  不是真实 Bold 字形。这是资产记录的已知偏差，不在本轮修改（改动会改变显示效果）。

## 5. 校验

```
cd vendor/fonts/noto-serif-sc
sha256sum -c MANIFEST.sha256        # Linux/Git Bash
# 或 PowerShell：
Get-Content MANIFEST.sha256 | ForEach-Object { $h,$f = $_ -split '  '; (Get-FileHash $f -Algorithm SHA256).Hash.ToLower() -eq $h }
```

逐文件哈希见 `MANIFEST.sha256`；name 表解析方法与原始输出在本轮本地证据目录
`local-run-artifacts/golden-baseline/20261021-w2-candidate/`（`font-probe.cjs`、`fonts-manifest.json`）。
该目录被 Git 忽略，不随提交分发；上面的 MANIFEST 与内嵌元数据表可在新检出中独立复核。

## 6. 未验证 / 已知限制

- 未取得下载时的上游版本号或下载日志；不能声称与某个 Google Fonts 版本逐字节对应。
- 未逐一检查 101 个子集的 unicode-range 是否覆盖应用实际使用的全部汉字；
  未做缺字回退的视觉验收。
- 未证明字体渲染结果与设计稿一致；打印/PDF 字体嵌入仍需单独验收。
- 本轮只补许可与来源记录，未重命名、未替换、未重新下载任何字体文件。
