# PDF HTTPS 连接与阶段诊断修复

2026-10-15：用户先授权保留历史 dirty 的只读根因分析，随后明确要求“你直接进行修复吧”。本任务记录本轮离线实施边界；不继承旧付费实验额度。

## 目标与证据

最新深圳 R2 在 TCP 连接后、未观察到 TLS 成功时 ECONNRESET；本机代理返回 502，producer 按 unknown 停止。具体网络节点尚未定位。现有 HTTPS owner 使用 agent:false，每次重建连接，且缺少生产阶段诊断；代理把客户端断开也归为超时。修复这三个确定的工程问题，不承诺已根治外部网络。

## 允许范围

- qisi-local-https-transport.js：共享有界 HTTPS Agent、每次请求的有限阶段快照、清理；保持固定目的地、证书验证、正文、响应上限、单次提交语义。
- qisi-local-server.js：诊断白名单传播及现有安全日志字段复用、区分 deadline 与 client disconnect、服务关闭时释放连接。只改代理和关闭衔接。
- tests/local-https-transport.test.js：保留既有安全断言，增加故障阶段、取消、监听器清理测试；将“不复用”断言替换为本任务明确要求的有界共享 Agent 行为。
- 新 tests/local-https-transport-integration.test.js、tests/local-ai-proxy-diagnostics.test.js，及 tests/fixtures/https-transport/ 下的合成本地测试证书。测试只允许 mock 和 127.0.0.1，不使用真实模型、凭据或文档。
- 本任务与 ai/PDF_HTTPS_REPAIR_RESULT_2026-10-15.md；新 ignored local-run-artifacts/pdf-https-repair-2026-10-15/ 下的基线、离线脚本和验证记录。源码快照使用 .before 后缀。

## 保持不变

所有历史 dirty、旧证据/账本、23 个退役删除、app.js 和用户 tests/base-migration-smoke.test.js 原字节保留。不改 PDF 业务流程、模型/提示、缓存、费用、unknown、正式准入、DOCX、UI、数据/schema、依赖、默认开关、网络/VPN/证书设置、生产 3000。不读写/打印密钥或 .env；不 commit/push。

不自动重发任何收费 POST；即使阶段显示 TLS 之前失败也不自动清除 unknown。诊断描述传输事实，不代表供应商受理/计费。收到上游非 2xx 与本地拒绝的更细账本分类不在本轮修改范围。

## 实施与验收

1. 冻结当前增量基线及历史证据，先增加可失败的定向测试。
2. 使用现有 HTTPS owner 的共享连接池（keepAlive，最多 4 活动连接、2 空闲连接、LIFO），不新增网络库/业务 owner。保留每次调用只创建一个 HTTP 请求。
3. 记录 socket/DNS/TCP/TLS/本地写完/响应头/响应完成及失败阶段；复用连接不能因本次无 secureConnect 事件被误判为未建立 TLS。快照只含枚举、布尔、有限数值，不含 headers、正文、密钥、任意异常消息或 IP。
4. 代理沿原 rawResponse 通道返回有限诊断；安全日志使用现有 requestId/stage/code/duration 字段，不放宽 logger 白名单。客户端断开不再记成 deadline，也不向已关闭响应写 JSON。
5. 本地 TLS 服务证明连续 44 请求真实复用、上游关闭/中断无重试、并发/超时/取消互不污染、监听器无累积、TLS 校验保持。测试使用合成受信证书且只绑定回环。
6. 定向回归、新固定 PDF 失败门禁、npm.cmd run verify:safe、runtime/app-shell 检查；以 baseline/scope-proof 证明范围，不能把整个历史 git diff 当作本轮增量。

离线修复验收后停止。外网匿名探测、网络配置变更、真实模型整卷测试需各自有明确范围；本任务不执行。模型无依据图注、真实定位/完整证明质量仍未验收。
