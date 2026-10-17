# MinerU 最小样本：认证与 3 页解析 — 2026-10-04

## 用户明确授权

上一轮已交付离线准备、两个样本/hash、认证流程和精确范围。助手分别询问：允许向 OpenXLab 发送 AK/本地签名完成认证（SK 不外发）；允许向 MinerU 上传这 3 页，仅在免费权益已核实时执行、付费上限 0 元。用户本轮回复“是”，确认两项。无需重复询问已有授权，但不扩大页面、服务、费用或生产改动范围。

## 精确任务

使用现有 DPAPI 凭据在同一 Windows 用户本机内存解密。一次 OpenXLab 认证流程，最多两次 POST：

- `https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/auth`：只提交 AK。
- 本地使用 SK 对原 nonce 按已核查算法签名；`https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/getJwt`：只提交 AK 与签名 d。

SK、JWT、签名不进入聊天、普通日志、Git 或永久环境变量。含秘密的原 HTTP 请求/响应用当前用户 DPAPI 保存原字节，不清洗覆盖原证据。禁重定向、重试、refresh、SDK 安装/执行。认证拒绝、未知算法/结构、网络异常立即停；不可无限换端点测试。取得 OpenXLab JWT 不视为 MinerU 权限验证通过。

只有核实账户对本次 3 页明确可用免费权益才上传。使用原离线 `sample-manifest.json` 的两个文件，hash 固定：

- 深圳原 13 页：`shenzhen-p13.pdf`，236414 字节，SHA256 `b8bc8f76fb52d989825edd592e61a03d40c200dbea264c2ca4ae23c1bc63fe95`。
- 河北原 6/7 页：`hebei-p06-p07.pdf`，178075 字节，SHA256 `7ff88bc09bde462d8e2b131c0ad707664bc4da7b36b2d43e5c17220e765e332e`。

申请链接最多一次：POST `https://mineru.net/api/v4/file-urls/batch`，固定 vlm/is_ocr=true/enable_formula=true/enable_table=true/language=ch；PUT 最多两次，仅原响应限定 HTTPS 接收域 `mineru.oss-cn-shanghai.aliyuncs.com`。原整卷、gold、纠正内容、DOCX均不上传。PUT 可自动触发解析，不再次提交。

轮询 GET `https://mineru.net/api/v4/extract-results/batch/{batch_id}` 最多 30 次，间隔至少 10 秒、总等待 5 分钟；下载原 ZIP 最多两次，限定 `cdn-mineru.openxlab.org.cn`、100MB/包；先保存原包及 hash，再离线核协议、逐页原文/图资源。未知域/重定向/状态/schema停止，不猜坐标、不执行包内文件或访问资源外链。

费用上限 0 元；不能核实权益或收费则暂停。公开文档和合法 JSON/模型 complete 不充当账户权益或全文质量证据。旧 DashScope 账本 124/150 只读，26 次预留不使用。独立新账本记录认证/控制台只读核验/申请/上传/处理页/轮询/下载及失败，在每次真实请求前持久登记。控制台只读核验不提交试卷；只访问已核实的官方账户接口或 UI，不猜路径轮番探测。

允许新增：本文件、`ai/PDF_V1_MINERU_REAL_SAMPLE_2026-10-04.md`、`local-run-artifacts/mineru-real-sample-2026-10-04/**`。其他既有文件和历史 dirty、证据、凭据、原材料、gold/账本/smoke只读。无生产 route、app.js、DB、UI、依赖、配置或用户 3000 服务改动，无 reset/stash/commit/push，无子代理。

成功标准：认证及实际权限/权益分别明确；条件满足时仅 3 页真实解析，保存全部原结果并逐段源对照 `8^16`、河北 a3/齐次、第 6 题尾段、原图标签/页脚与边界。漏文、字形/公式/归属错误单列并停止扩页，不用其他模型修成通过。若认证或权益阻断，完成离线核验/范围/报告并说明确切缺口。最后 verify:safe、保护/hash/scope核验。

不自动进入 13 页双轮、组织算法、生产替换或两卷 38 题验收。
