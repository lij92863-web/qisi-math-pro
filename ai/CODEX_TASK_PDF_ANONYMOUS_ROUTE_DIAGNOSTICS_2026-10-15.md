# DashScope 连接路径匿名诊断

深圳两次新轮次分别在已复用 TLS 的第 12 个 POST 和首个新建 TLS 的握手前出现 `ECONNRESET`。为了区分纯握手不稳定与负载/上游处理故障，仅对固定主机 `dashscope.aliyuncs.com:443` 做最多 8 次顺序 TLS 握手观测，每次最长 5 秒、总计不超过 1 分钟。使用系统 DNS 和默认 TLS 证书验证，不更改代理、DNS、路由、证书或环境变量。只记录时间、解析地址、成功/失败阶段、错误 code、TLS 授权布尔和协议；不读取凭据，不发送 PDF、HTTP 请求、模型 POST 或其他应用数据，费用风险 0。诊断仅供归因，不把成功握手当成整卷稳定性证明。

输出写入忽略目录 `local-run-artifacts/pdf-qwen37-shenzhen-simple-full-2026-10-15-revalidation/anonymous-tls-probe.json`。如任一次连接有异常，仍完成剩余匿名握手以估计波动；任何异常都不能自动触发付费重验。
