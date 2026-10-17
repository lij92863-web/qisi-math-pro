# MinerU 3 页真实实验：认证首请求无响应，未上传 — 2026-10-04

用户已明确确认 OpenXLab 认证和 MinerU 3 页上传授权，免费权益须先核实、付费上限仍为 0 元。本轮发起 **1 次认证尝试**，30 秒后未取得 HTTP 响应，按不重试/网络异常立即停止规则终止。**未取得 JWT，未申请 MinerU 上传链接，未上传文件，解析 0 页。** 不能据此判断 AK/SK 无效，也没有 MinerU 质量或费用实测。

精确范围：[本轮任务](CODEX_TASK_MINERU_REAL_SAMPLE_2026-10-04.md)。这次网络故障没有取消用户授权；后续不得重复索要已确认的一般认证/3 页上传权限，但原一次流程、无重试止损限制仍须遵守。若需要新一次认证尝试，应先解决实际连接问题并明确调整本次停止条件，不能以“第二次认证请求名额尚余”重复发送第一次请求。

## 实际操作及证据

预检 Git 状态、分支、最近 10 条提交已执行；按当前 desktop dirty 新冻结现场。分支 `stage/program-c-corrective-r1`，HEAD `71dfe18770e5161a19d38c07842d0ab865f20c92`。此前离线样本、gold、原账本、报告和凭据只读；原 DashScope 账本仍为 124/150，没有使用 26 次预留。

同一 Windows 用户在本机进程内解密原 DPAPI 载荷。首个请求仅含 AK，SK 没有进入请求体；由于 nonce 未返回，没有生成或外发 HMAC 签名，也没有执行第二个 getJwt 请求。

| 项目 | 实际记录 |
| --- | --- |
| 认证端点 | POST `https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/auth` |
| 时刻 | 2026-10-04 15:49:10，北京时间 |
| 本地等待时限 / 观察耗时 | 30000 ms / 30033 ms |
| HTTP 状态 / provider code | 未取得 / 未取得 |
| 账本终态 | `network-failed` |
| 后续认证、refresh、重试 | 0 |
| MinerU 申请/上传/轮询/下载 | 均 0 |
| 付费解析请求 / 处理页 | 0 / 0 |

网络操作通过与精确用户授权对应的执行权限获批后运行，未被自动审批拒绝。故障发生在等待服务响应阶段；没有记录足以区分 DNS、TLS、代理、连接或服务端等待的证据，故不推断服务停用、密钥失效、余额不足或账户权限问题。没有绕过失败去猜新端点、继续登录或提交试卷。

每次外部请求前写 `mineru-ledger.json`，原请求的 UTF-8 字节先 Base64，再由当前用户 DPAPI 加密存入 `auth-1-request.dpapi.json`。不打印 AK/SK/签名/token，不写 `.env`、Git 或永久环境变量；原凭据内容和 hash 保持。没有 HTTP 响应可保存，因此不存在虚构的 response/JWT/解析结果。

执行脚本 `authenticate.ps1` 没有 SDK 依赖，禁重定向；异常只输出阶段码，不输出可能带 AK 的服务消息、请求体或异常全文。`auth-outcome.json` 是脱敏状态：`providerAuthenticated=false`、`credentialsDecrypted=true`、`authHttpRequests=1`、`stopCode=AUTH_NETWORK_OR_RESPONSE_ERROR`。请求计数是已登记的发送尝试，服务端是否实际接收到它未知。

另对已保存密文做本地回读核查，只输出请求键名 `ak`，确认不含 SK；原字节未改。实际调用时的脚本保留为 `authenticate.executed.ps1`，SHA256 `f9a27a04af5d50b6d2ef0daf58232a7a4ea057b26ea3e4663963404dc2aa4354`。后续实验入口增添已有账本即直接退出的保护，并在本地验证该入口退出 1、原账本/结果 hash 保持，未产生第二次外部请求；此检查不是认证重试。

## 权限、免费权益和质量仍缺哪些证据

[MinerU 官方 API](https://mineru.net/apiManage/docs)要求管理页创建的 Bearer Token。本轮未获得 OpenXLab JWT，更未证明其具备 MinerU 权限。原 3 页上传许可依然有效，但免费权益先核实条件尚未满足，不能使用“1000 页最高优先级额度”替代账户免费证明。

两个样本字节/hash/原页映射保持上一轮冻结值，未再生成或修改原 PDF。源页对照 `8^16`、河北 `a3`/“齐次”、第 6 题尾段、图片/页脚仍等待真实解析结果。没有模型输出，机器正确率、处理耗时、同质量成本、免费额度消耗等均无可用实测；新增付费解析请求为 0 不能写成“MinerU 已免费通过”。

后续可由用户在[管理页](https://mineru.net/apiManage/token)直接取得 MinerU API Token 并核实当前账户免费权益；Token 应继续通过本机加密路径处理，不在聊天贴明文。此路径可以避免依赖本次未连通的 OpenXLab 换 JWT 流程，仍必须按已授权材料、限定目的地和 0 元边界实施，不立即扩到整卷或 13 页。

## 验证及范围

本轮最终本地验证和 hash/scope 结果保存于新证据目录 `local-run-artifacts/mineru-real-sample-2026-10-04/`，旧目录和旧结果不覆盖。新增非忽略文件仅本任务和本报告两个 Markdown；其余增量是 ignored 认证脚本、请求密文、账本、状态及核验日志。无产品代码、默认 PDF 配置、DOCX、DB、UI、依赖、生产数据或用户 3000 服务变更；无 reset/stash/commit/push、子代理或外发扩页。

保护检查包含当前非忽略文件、既有 local-run-artifacts 与 E 盘原响应、上一轮 3 页样本、两源 PDF/gold/smoke/原账本/凭据，以及分支/HEAD。门禁结果以 `final-verification.json` 和原 `verify-safe.log` 为准；通过只证明现有离线工程基线保持，不能替代尚未发生的认证成功或解析质量验收。
