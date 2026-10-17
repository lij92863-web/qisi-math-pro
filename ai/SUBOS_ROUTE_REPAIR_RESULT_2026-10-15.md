# 速博士连接路径修复证据

## 结论

活动代理为速博士，不是 FlClash。速博士 `libcore.exe`（观察时 PID 1436）来自 `C:/Users/Administrator/AppData/Local/Programs/subos/resources/extra/libcore.exe`，控制器为 `127.0.0.1:9680`，混合代理端口为 10090，版本 v1.19.17。发现 FlClashHelperService 只能证明历史组件存在，不能证明它控制当前 TUN；先前据此指向 FlClash 的说法已更正。

速博士磁盘 config.yaml 为 rule，实际 `/configs` 返回 global。官方模式说明：global 使用 GLOBAL 代理组，rule 才进行规则匹配。故国内 GeoIP → DIRECT 规则在运行全局模式下不生效。参考：https://wiki.metacubex.one/en/config/general/ 。

## 可重复的对照

同一个 Node TLS 探针、同一系统 DNS、同一目标 dashscope.aliyuncs.com:443、保留默认可信证书验证；没有 HTTP 或 PDF/模型 POST，不读取模型 API key。

|运行模式|成功|失败|可观察实际链路|成功耗时|
|---|---:|---:|---|---|
|global|10/24|14/24 ECONNRESET|GLOBAL，未命中规则|1064–1606 ms|
|rule|24/24|0/24|GeoIP cn → DIRECT|101–137 ms|

14 次 reset 都发生在 TCP 后、TLS 成功前，与付费重验第一次请求的故障阶段相同。这证实当前全局代理路径能够独立造成相同握手故障；尚不能断言链路中哪个设备产生 reset，也不能用这组短连接试验证明长时间模型 POST 绝不会中断。

额外六次不带凭据的根 URL 延迟检查：DIRECT 169/158/154 ms，GLOBAL 2409/1203/1327 ms。只用于对照，不是模型服务成功回执。

## 实施及回滚

通过官方本地控制接口 `PATCH /configs {"mode":"rule"}` 修正运行模式；24/24 连接实际命中 DIRECT 后保留。未修改节点、订阅、DNS、路由表、证书或 app.js；未重启速博士、未关闭任何其他连接。API 说明：https://wiki.metacubex.one/api/ 。

原运行模式 global 已保存；如确需回滚，可向同一控制接口 PATCH `{"mode":"global"}`。当前磁盘配置本来就是 rule，无需重复写入。没有重启速博士验证其 UI 偏好是否会覆盖配置，因此不声明已验证重启持久性。整卷执行器每次发出模型请求前检查实际模式仍为 rule，否则中止。

脱敏证据：`local-run-artifacts/subos-route-repair-2026-10-15/route-comparison.json`；脚本 `diagnose-route.cjs`；控制 secret 仅内存认证，没有出现在证据中。此脚本有一次性执行锁，不应重复执行。

## 整卷验收边界

旧三笔受理未知预留 4.8 元与旧核价 0.0109388 元继续独立保留。用户已批准修复后新的最多 44 次/5 元整卷验收，见 `CODEX_TASK_PDF_QWEN37_SUBOS_FIXED_2026-10-15.md`。模式修复与匿名成功不等于完整试卷通过；完整结果由该独立轮次另行记录。
