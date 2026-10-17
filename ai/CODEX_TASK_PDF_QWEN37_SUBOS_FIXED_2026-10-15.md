# 速博士路由修复后的深圳卷整卷验收（已独立授权）

目的：修复实际网络路径后完成同一试卷 21 页正常 UI 全流程，逐题视觉检查。用户对包含完整来源、目的地、模型、费用和停止条件的问题明确答复：“允许修复后新一轮 44 次／5 元整卷验收”。本次使用此新授权，不复用失败轮次授权。

- Model：qwen3.7-flash-2026-07-15，非思考、temperature 0、max_tokens 65536。
- Input：C:/Users/Administrator/Desktop/题目与答案/广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf；SHA256 874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21。包括 21 页原图及本流程派生转写、定位、候选、裁图。
- Endpoint：https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions；隔离本机服务 32188，正式 3000 不操作。
- Expected max calls：新账本最多 44 次物理 POST（R 21、L 21、O 1、V 1），本地裁图不收费。
- Expected cost/risk：新增已知核价和未知预留合计最多 5 元，每次未知保留 1.6 元；旧三笔未知合计 4.8 元独立保留，旧核价 0.0109388 元另计，均不代表实际账单。
- Success criteria：全部 44 次回执、21 页和 1–19 题的视觉核对、裁图归属、跨页表格和长证明完整、答案解析序列严格验证、缓存/刷新一致、正式入库 0。第 5 题源卷答案矛盾必须保留人工审阅。
- Abort conditions：任何受理未知、失败、截断、合同/模型/usage/顺序/哈希/预算异常立即停，不自动重发；速博士运行模式变为非 rule 时不得继续发送。每次 600 秒，整卷 60 分钟。
- Business code：执行期间冻结当前代码（撤回过的八次连接轮换不启用）。只有发现确定缺陷后才停止实测进行离线修复，不热改正在运行的流程。

目录：local-run-artifacts/pdf-qwen37-shenzhen-subos-fixed-2026-10-15/。执行器默认仅做 0 调用预检，付费执行还要求新授权状态及单次执行锁。网络证据见 local-run-artifacts/subos-route-repair-2026-10-15/route-comparison.json。
