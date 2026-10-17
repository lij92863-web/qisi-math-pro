# PDF HTTPS 根因分析与离线修复报告

日期：2026-10-15。用户在只读分析后要求“你直接进行修复吧”，已按[本轮任务](CODEX_TASK_PDF_HTTPS_REPAIR_2026-10-15.md)实施。真实 AI/OCR 调用为 0，没有启动新的整卷实验、调整网络设置或重启生产 3000。

## 根因结论与证据层级

最新深圳实验的直接故障发生在连接阶段。原始 `upstream-2.transport.json` 记录 TCP 于 3ms 建立，50ms 出现 ECONNRESET，没有 TLS 成功、HTTP 响应或模型 usage；本机代理随后返回 502。相邻成功请求在相同解析地址上于 1114ms 完成 TLS，11508ms 收到 HTTP200。因此本次中断不能归因为 PDF 解析、输出 token 上限或模型生成超时。

已确认的工程问题：

1. `qisi-local-https-transport.js` 原来固定 `agent:false`，每个请求新建 TCP/TLS。44 次串行模型调用重复暴露于握手故障；这是可消除的放大因素，不是已证明的外部 reset 来源。
2. 生产传输没有请求阶段快照，只能靠实验脚本临时观测。代理的通用 502 无法说明连接失败、TLS 失败还是响应中断。现有安全日志器会过滤任意嵌套 transport 字段，直接追加 console 字段并不能解决。
3. 代理将 deadline 和客户端断开引发的 AbortError 都记为超时，造成错误归因。
4. 补充合成回归发现，单独发生 response close 而没有 end/aborted 时，旧 Promise 不结算；现在明确失败。此为边界修复，不宣称它造成过深圳已记录的中断。

尚未证实的外部根因：发出 reset 的具体网络节点、Meta 路由内哪一环节或上游是否异常。相同路线既有成功又有失败，不能据此归咎某一方，也不能承诺 keep-alive 消灭所有 ECONNRESET。

整卷停止是既有安全策略的结果：网络 unknown 阻断后续收费请求，部分 R 不是可续跑完整缓存。该策略防止重复付费和污染，不作为本次要删除的 bug。

内容问题独立存在：本轮重新查看实际第一页提交图与原始 R 文本，确认 D 位于内部网格，而模型增加“点 D 在 OC 边上”。原 RAW_SYSTEM 已要求忠实转写；增加一条提示或软件删图注不能证明质量修好。L/O/V 真实效果仍未验证，本轮不改提示、模型或数学业务算法。

依据：[完整交接](PDF_QWEN37_COMPLETE_HANDOFF_2026-10-15.md)、[最新真实结果](PDF_QWEN37_SHENZHEN_SIMPLE_FULL_RESULT_2026-10-14.md)、`local-run-artifacts/pdf-qwen37-shenzhen-simple-full-2026-10-14/` 下的两份 transport、原图及 received-page-01.txt。Node 对 agent:false、连接池与过期连接的行为见[官方 HTTP Agent 文档](https://nodejs.org/docs/latest-v24.x/api/http.html#class-httpagent)。本轮实际 Node v24.16.0，OpenSSL 3.5.6。

## 实际修改

### HTTPS owner

仅在既有 owner 中使用按需创建的进程内共享 HTTPS Agent：keepAlive=true，maxSockets=4，maxTotalSockets=4，maxFreeSockets=2，LIFO，agentKeepAliveTimeoutBuffer=1000。未设置会提前截断长模型生成的短活动 socket timeout；原代理总 deadline 继续负责超时。

每个调用依旧只创建一个 POST；没有自动 retry、重发、换网络路线或修改模型工序。服务器正常关闭连接时，下一个独立调用可以建立新连接；正在执行的请求发生 reset 时直接失败。

诊断包含有限阶段序列、单调时钟耗时、复用标识、TLS 验证状态、本地写完、响应开始/完成标识。最多 12 个事件，只包含受控枚举、布尔、有限数值。不记录 headers、正文、凭据、IP、证书内容、TLS 密钥或任意异常消息。复用连接读取已有 TLS 状态，不因没有新的 secureConnect 事件就误判未建立 TLS。

成功/失败/取消统一结算一次，移除本次 socket/请求观测监听器。新增 close/不完整 end 处理，防止缺失 end 时悬挂或把不完整响应当成功。关闭连接池时释放并退役旧实例，后续生命周期创建新池；并发回环测试曾发现仅 destroy 后继续重用旧 Agent 会受到旧队列/连接清理状态影响，已修复且复测通过。

### 代理衔接

仅修改 `forwardDashScopeRequest` 及 server close 的少量接线：

- 阶段日志使用原安全日志器支持的 requestId/stage/code/duration 字段，不修改日志白名单。
- 连接错误 JSON 增加 transportDiagnostic，沿既有 PDF rawResponse 保存，无需修改 provider/producer、DB 或审核状态。
- 区分 deadline 与 client_disconnected；真正 deadline 保持 AI_PROXY_TIMEOUT/504，客户端断开记录 AI_PROXY_CANCELLED，且不向已关闭响应写 JSON。
- 上游完整 HTTP 状态、响应字节与 content-type 保持透传；响应上限、目标白名单、TLS 校验不变。
- 服务 close 释放连接池；本轮没有重启或部署到生产实例。

任何阶段信息都不设置 definitelyNotSubmitted/submissionAccepted，不作为退款或零费用依据。旧 unknown 及其预留逐字保留；上游非 2xx 与本地拒绝在账本中的进一步细分类未混入本任务。

## 离线验证

修复前新增测试复现不复用、缺失阶段诊断及提前 close 的等待问题；记录见 focused-red.log。该轮遇到等待后手动终止，保留原日志，不把它记成完整测试通过。

定向修复后 56/56 通过：HTTPS 单测、真实回环 TLS 集成、代理实际函数隔离测试、限流、Qwen 端口、新 PDF 固定流程。包括：

- 44 次连续合成 POST 只有一次真实 TLS 连接，响应逐次正确，握手监听器无累积。
- Connection: close 后新请求新建连接；复用连接 reset、响应截断均不重发。
- 最多 4 个活动连接，排队取消不发送第五个 POST，活动请求取消不影响同伴。
- 未受信测试证书拒绝、TCP 后 TLS 前 reset、响应提前关闭/不完整结束。
- deadline 与客户端关闭区分；诊断经安全日志与既有 rawResponse 保留，unknown 语义没有放宽。
- PDF 费用、失败阻断、完整缓存、模型/来源/序列门禁仍通过。

TLS 集成只使用 127.0.0.1 和仓库新增的合成 localhost 测试证书；没有安装到系统信任库。代理测试用 AST 提取现有函数并注入 mock，不启动代理、不加载 dotenv 或真实凭据。首次测试启动遇到 sandbox spawn EPERM、OpenSSL 进程初始化限制，使用明确的本地进程权限后通过，不把环境限制判为业务失败。

完整 `npm.cmd run verify:safe` 退出 0：主测试 **1801/1801**，DOCX 稳定链 **8/8**、PDF 坏例 **62/62**、batch mock **8/8**，no-real-ai 通过。日志为本轮 `verify-safe.log` 与 `verify-safe.exit.txt`。另已通过 node --check、runtime modules valid:true、app-shell ACCEPTED/9 个受保护函数；改动文件 git diff --check 通过。

## 增量范围与保全

基线包含 1238 个已有非忽略文件、380 份旧固定千问证据、23 个既有退役删除。只修改 3 个已有文件：qisi-local-https-transport.js、qisi-local-server.js、tests/local-https-transport.test.js；新增两份测试、合成测试证书/说明及本轮任务和报告。最终范围见 scope-proof.json。

app.js、用户 tests/base-migration-smoke.test.js、PDF 六个业务 owner、DOCX、默认开关、架构注册、依赖、源 PDF、历史账本保持。分支 stage/program-c-corrective-r1，HEAD 71dfe18770e5161a19d38c07842d0ab865f20c92；不 commit/push。整个历史 git diff 不能作为本轮修改清单。

## 后续实施次序（未执行）

1. 在单独明确范围的匿名诊断任务中，比较同一路线的新建 TLS 与共享连接；不带凭据、不发试卷、不 POST 模型端点。建议先限定 8 次 TLS 握手、8 次新连接 HEAD、8 次共享连接 HEAD，单次 10 秒、总 5 分钟，不跟随重定向，失败逐次记录。目标/路径和执行许可应先冻结，不能由本报告自动触发。
2. 根据阶段证据决定是否需要网络路径调整；本轮不修改 Meta/VPN、DNS、SNI、证书校验或代理环境。不把一次匿名成功当作 44 次真实调用稳定的保证。
3. 再准备新的固定模型质量/整卷验收任务：固定原文件/hash、提示/工序、模型/端点、调用数、实际容量和费用预留。旧 44 次许可已用 2 次，不能用剩余 42 次重跑需要 44 次的整卷；旧 unknown 不能清零。不得把旧 R1 拼成新的完整页包。
4. 真实验收分别检查原文忠实性、异常字形、表格/数阵、图框及实际裁图、跨页长证明、题号/答案归属、V 双向查漏与人工确认。保留首次输出和全部错误；不要增加深圳专用补字/图框/题号规则。

当前结论仅为传输软件的确定问题已离线修复。外部网络根因、真实整卷稳定性和模型质量仍须相应实测证明；默认 PDF 开关保持关闭。
