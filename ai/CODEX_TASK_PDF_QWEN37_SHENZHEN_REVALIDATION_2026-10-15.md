# 深圳卷连接轮换后的独立整卷重验

目的：验证 2026-10-15 本轮 R12 `ECONNRESET` 后的每 socket 八次响应轮换是否足以让同一深圳卷 21 页走完正常 UI 的 R×21、L×21、O、裁图、V，并逐题对照原图及审核页。此前两轮证据、账本和受理未知均只读保持，不拼接旧输出。

- Model: `qwen3.7-flash-2026-07-15`，非思考、temperature 0、max_tokens 65536。
- Input file: `C:/Users/Administrator/Desktop/题目与答案/广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf`，SHA256 `874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21`；发送 21 页原图和本流程派生转写、定位、候选及实际裁图。
- Endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，自有隔离本机代理端口 32187，正式 3000 不操作。
- Expected max calls: **新的**最多 44 次物理 POST；原任务的 12 次不计入新上限，也不作为缓存续跑。
- Expected cost/risk: **额外新的**已知 usage 核价与受理未知预留合计最多 5 元，未结算调用每次预留 1.6 元。此前 10 月 14 日与 10 月 15 日共两笔受理未知预留合计 3.2 元仍独立保留，实际账单待服务商核对。固定官方[价格表](https://help.aliyun.com/zh/model-studio/model-pricing)全球部署档：输入每百万 token 0.2/0.6/1.2 元，输出 0.8/2.4/4.8 元，按输入 32K/256K/1M 分档。
- Success criteria: 44 阶段完整回执与 usage、1–19 题逐题视觉核对、全部图像归属/序列/答案解析审核、草稿缓存和刷新持久、正式题库零新增。来源第 5 题答案表与解析数字冲突须标记人工核查，不能自动采信。
- Abort conditions: 任何请求受理未知、拒绝、截断、模型/usage/合同/序列不符、预算/容量/裁图/来源哈希异常立即停止收费请求；不自动重发或自动采用。单次 600 秒，总计 60 分钟。
- Whether business code can be modified: 重验期间冻结当前业务代码；如出现确定新根因，另行局部修复与离线验证，不在运行中的流程里热改。

证据写入 `local-run-artifacts/pdf-qwen37-shenzhen-simple-full-2026-10-15-revalidation/`。用户已对“允许额外 44 次／5 元重验”明确答复，授权同一原卷及派生内容、同一端点和模型在上述边界内重新执行；此答复不允许失败后的再次自动重跑。
