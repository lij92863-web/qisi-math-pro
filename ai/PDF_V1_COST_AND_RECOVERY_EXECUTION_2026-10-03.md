# PDF V1 第 19–21 节恢复、量测与成本执行报告

日期：2026-10-03，Asia/Shanghai。对应用户要求一次执行交接规划第 21 节，并承接第 19–20 节的修复与验证。结论：**两个恢复 bug 已修复，最终离线门禁通过；费用账、11 张候选证据卡和重复资源量测已交付。没有新成本配置通过“质量不降、效率不降、完整费用确实下降”的准入，降费目标及两卷完整最终验收仍未完成。**

用户要求连续执行覆盖原“本节只写文档”的阶段限制；没有扩大原材料/模型/服务权限，也没有把时间经过当成历史 Arrearage 已恢复。账户恢复未获得明确证据，本轮完成所有可独立执行的离线工作，新增收费请求 0。未探余额、未改生产 IndexedDB、未提交/推送、未清理历史 dirty。保护 smoke 的具体迁移例外仍未给出，因此最后一个 dormant 旧模块没有被删除。

## 1. 基线、范围与可复查证据

起始 HEAD：`71dfe18770e5161a19d38c07842d0ab865f20c92`，分支 `stage/program-c-corrective-r1`。本轮前 `baseline.json` 保存 1160 个非忽略文件的 hash、Git 状态、原两源/账本 hash，历史 dirty 全部保留。本轮基线不是 Git HEAD；不能把历史已有修改算作本轮改动。

证据根目录：[本輪本地证据](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03)。原请求/响应、账本、源 manifest 从 `E:/备份/题库系统/local-run-artifacts/` 只读。新量测没有覆盖旧阶段报告或 E 盘原响应。

| 证据 | 内容 |
| --- | --- |
| [baseline.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/baseline.json) / 各 `.before` | 本轮修改前版本与原字节 |
| [cache-recovery-baseline.log](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/cache-recovery-baseline.log) / [green](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/cache-recovery-green.log) | 第 19.2 节原同一反例的前后行为 |
| [ui-repeat-baseline.log](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/ui-repeat-baseline.log) | 原 producer 的实际无编辑重跑失败复现 |
| [cost-ledger-analysis.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/cost-ledger-analysis.json) | 85–107 每尝试原 usage、hash、终态、耗时、已知费用和未知项 |
| [11 张证据卡](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/candidate-evidence-cards.md) / [JSON](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/candidate-evidence-cards.json) | 每方案完整 11 项材料及未来优化实验的预先比较标准 |
| [ui-performance.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/ui-performance.json) / [summary](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/measurement-summary.json) | 最终接线版本三轮两源冷导入/重跑与分段、资源原记录 |
| [synthetic-load.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/synthetic-load.json) | 10/20/30/50 页纯本地负载三次原记录，非真实卷验收 |
| [lifecycle-summary.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/lifecycle-summary.json) / 两份 `lifecycle-*-actions.json` | 代表题编辑、确认失效、入库事务、重开和图片 Blob hash |
| [verify-safe-closure.log](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/verify-safe-closure.log) / [scope-audit.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-cost-audit-2026-10-03/scope-audit.json) | 最终门禁及本轮增量范围、源/账本/保护 hash 校验 |

当前全部 defaults 原样：`qwen3-vl-plus, W=5, O=2, renderScale=2, cropScale=3, JPEG=.94, maxTokens=16384, retryCount=1`。本轮没有修改 prompt、Contract 或输入规格；优化候选只有设计与离线推导。

## 2. 已修复的两个实际恢复问题

### 2.1 坏响应留证不能等于成功缓存

原两个单页窗口反例：第一页成功、第二页 `stop` 但非法 JSON；保存后重跑，即使识别端口现可成功，第二页仍重复消费旧坏文本，0 次新请求，只有第 1 题。新 producer 在重试循环前对匹配旧缓存做一次当前 JSON/schema/原页/角色/finish 验证；不合格保持原始 evidence，转入该窗口现有最多 2 次新尝试。缓存校验不占新尝试槽，不反复校验同一坏响应。成功新响应也先验证才产生 proposals。

同一反例现在重跑只请求第 2 页一次，最终第 1/2 题都在，窗口错误清零，原坏响应仍在。既有 V1 单个业务回归参数化覆盖 JSON、schema、页越界、角色不符、截断、空正文；检查输入证据未被修改、成功窗零请求、旧确认未继承、第三跑零请求且历史不继续增长。

保留旧 evidence 的引用副本，替换副本内的成功复用元数据；不修改原 source evidence 的对象。新失败尝试继续原字节留证，因此河北失败历史从 10 到 16 项属于真实发生的六次新尝试，不通过删证据压空间。

缓存键仍是现有 SHA-256：模型、完整动态 prompt（含角色/已见题号）、maxTokens、窗口原页号和页面 JPEG URL；另外核协议/sourceId。不能声称“任意情况下只有失败窗口会重跑”：若恢复前窗新增题号，后窗的已见编号 prompt 变了，它的有效输入也变，旧成功缓存应失配。未来新增可变 transport 参数必须纳入有效输入键。这里没有新建缓存平台。

复杂度真实边界：对输入 bytes 哈希 O(B)，每窗 `.findLast` 在 H 条历史中最坏 O(H)，总查询 O(KH)；解析与响应长度相关，历史引用数组 O(H)。不把这段现有扫描宣称恒定空间或整体线性。

### 2.2 正常 UI 无编辑重跑必须进入窗口验证

实际 UI 暴露原请求身份缺口：默认复用已提交整批 requestId，bridge 先报告进度将数据库状态变为 processing，再走 committed readback，报 `PRODUCTION_IMPORT_READBACK_MISMATCH`，没有进入窗口验证。注入本轮 `.before` 原 producer 仍复现，证明不是 2.1 引入。

最终由现有 `ProductionImportRoutePolicy.canReuseNormalUiCommittedRequest` 判断内部已选择身份；默认 PDF 重跑不复用整批已提交请求，产生新的草稿版本。通用 controller 只接收可选策略端口，不读取 producerMode，不选识别路线。显式 requestId 幂等重试、同批并发 promise、DOCX 既有默认请求身份保持，桥接和 DB/schema 没改。

`app.js` 仅在现有 controller 工厂处加两行函数引用接线，没有新增业务算法/箭头。九个保护 handler 的源字节和 AST hash 均保持；责任矩阵只登记整体 AST +9 节点、handler 行号 +2，572 个函数及 allowed/forbidden calls 不变。初版 PDF 判断被唯一路由 owner 门禁拒绝后已移到正确责任模块，**没有降低该断言**。

既有幂等单测与正常 UI 端到端用例新增对应业务检查：无编辑重跑版本 +1，已成功响应零新边界调用、业务字段保持、manualConfirmed=false、formalRows=0。丢失 UI 响应的 DOCX committed 重试和显式 requestId 安全反例仍通过。

## 3. 按原 usage 核算真实成本账

2026-10-03 已从官方重新核实北京现行价格：`qwen3-vl-plus` ≤32k 输入 ¥1/百万、输出 ¥10/百万；32–128k 为 ¥1.5/¥15，128–256k 为 ¥3/¥30。原成功响应均在第一档。现行 alias 文档映射到 2025-12-19 snapshot；原响应没有把历史后台 snapshot 明确固定，不能追认。这里是**原 usage × 现行价目的重建账，不是账户发票/余额证明**。[官方模型与价格](https://help.aliyun.com/zh/model-studio/qwen3-vl-plus)

每尝试包含失败/自动重试/最终复测；`cached_tokens` 已包含在 input 中，不重复加入 image_tokens。公式：

```text
C = Σ((input−cached)×Pinput + cached×Pcached + output×Poutput)/1e6
    + 其他已确认计费项
```

12 个有 usage 的原响应均 cached_tokens=0，正常 stop，output 1517–5688，未碰 16384 上限；不能因此默认加上限或删长解析。11 个失败/无结果尝试缺 usage/账单，未知费用不是 0。

| 观察轮次 | 全部尝试 / 可核算 | 已知输入 | 已知输出 | 已知小计 + 未知 | 原记录模型/网络耗时和 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 深圳初轮 85–91 | 7 / 7 | ¥.070260 | ¥.252010 | **¥.322270**，该轮 usage 完整 | 540333 ms |
| 河北初轮 92–101 | 10 / 3 | ¥.029788 | ¥.123390 | ¥.153178 + 94–100 七项未知 | 268729 ms |
| 深圳最终轮 102–105 | 4 / 1 | ¥.010773 | ¥.039240 | ¥.050013 + 103–105 三项未知 | 97293 ms |
| 河北最终轮 106–107 | 2 / 1 | ¥.010773 | ¥.056650 | ¥.067423 + 107 未知 | 123078 ms；107 耗时也缺 |
| V1 85–107 观察期 | 23 / 12 | ¥.121594 | ¥.471290 | **¥.592884 + 11 项未知** | 已记录 1029433 ms，另有 107 未知 |

这些耗时不是教师完整导入/审核的端到端时间，不能与离线浏览器墙钟混比；河北没有公平的完整单轮费用/时延基线。没有把此前 1–84 的旧管线请求计入 V1 单主链观察期。

费用归因：12 个已知响应视觉输入 111891 Token/¥.111891，prompt+辅助文本 9703/¥.009703，输出全文 47129/¥.471290，占已知价目重建费用约 18.87%/1.64%/79.49%。深圳完整初轮视觉 ¥.064779、文本 ¥.005481、输出 ¥.252010（78.20%）。输出才是首要费用项，不能通过摘要解析或少返回题目削减它。

深圳 33 次页输入中 12 次重叠，按实际每页1963视觉Token，对应输入 ¥.023556，约总价7.31%；河北10次重叠输入约¥.019630。重叠输出包含部分/冲突/不同语义单元，原usage不能可靠分离；未把22/62输入重复比当总账单节省比。失败额外费用均在未知项内。

| 使用场景 | 可支持的结论 |
| --- | --- |
| 首次完整窗口导入 | 深圳历史该轮 usage ¥.322270；其19个输出题不等于19道机器完整正确题。当前 prompt 最终完整新轮尚无账 |
| 同版本有效窗口重复 | 最终 UI 深圳三次0模型边界请求；本地精确复用新增提供方收费为0。本轮全部回放均0外发 |
| 单失败窗口恢复 | 同一 JSON 反例一次新端口成功；真实费用未实验。有 usage 的历史一次成功窗口价目范围 ¥.025392–.067493，仅作参照，需另加失败/重试/复核实际费用 |
| 河北部分失败恢复 | 三个失败窗口各两次，新边界6次，其他成功窗复用；失败新请求真实收费未知，不冒充整卷¥0 |
| 正常单卷 / 每道机器完整正确题 | 河北完整单卷与两卷完整正确整题分母缺失，暂不能给值。不能用38个输出题或2个人工修好题作分母 |

## 4. 有证据的候选与推荐

11 张卡逐一包含 baseline/hash、已测问题、单变量、不变量/反例/终止/复杂度、费用公式、预先标准、源与配置/价格日期、原记录/人工项、数值/不确定性、准入及回退。比较标准在任何新优化模型实验之前固定：新增错挂/错号/错图/漏步骤/关键公式退化/绕过为0；逐字段/整题不降；人工负担不增；至少三次配对的完整中位和最慢时间不变差，落在观测或网络波动内不能定胜负；CPU/内存/存储报告；完整费用缺项时不能认定下降。三次最慢观测不写成 p95，38题不当38个独立模型实验。

| 候选 | 已有数值证据 | 决定 |
| --- | --- | --- |
| R1 有效响应复用/失败恢复 | 深圳重复7→0边界调用，河北10→6；新JSON反例能恢复 | 作为正确性修复实施；有恢复收益，不冒充首次降费优化 |
| P1 缩短 prompt | 两组历史同图配对新版多235 input Token；假设每窗全可删，深圳七窗仅¥.001645≈0.51% | 收益机会小，质量证据不足，不删安全说明 |
| P2 只减少 JSON 纯格式 | 12份成功原响应130124→103422 bytes，解码值逐一相同，可去26702 bytes（20.52%） | 推荐下一单因素实验；生成Token/全文/效率/费用未知，未发布 |
| W1 W=6/O=2 | 深圳K/S7/33→5/29、河北6/29→5/27；中心费用情景约降12.45%/7.09% | 作为第二候选，跨页与完整全文未实测，不改默认 |
| I1 统一scale1.6，裁图仍3 | 理想面积为0.64倍；按历史视觉项情景深圳总费最多约降7.24% | 服务缩放/取整、小字质量及实际usage未证实，延期 |
| I2 只降JPEG质量 | 尺寸/服务网格相同不必少视觉Token | 否决“bytes更小必降费”理由，不实施 |
| S1 显式服务缓存 | 原成功cached=0；首次输入125%，命中10%；单次重复概率需>27.78%才可能省输入费 | 本地精确重复已经0外发，默认启用无依据 |
| S2 Batch File | 官方同tokens标价50%；深圳纯条件价目¥.161135 | 异步排队/公网图片URL/新接口权限，效率未证明，不能直接替换当前本地同步链 |
| M1 便宜模型+升级 | 必要式 Cc+pCs<Cs，p尚未实测 | 当前单模型保持；不增加路由/新材料外发 |
| R2 明确角色/范围、完整单元重读 | 原两卷full，没有可证丢弃的空白页/范围 | 不造空白检测或靠文本层删材料；复用收益不重复计一次 |

P1 的历史观察：85→102同图/其他参数，输入+235、输出+29，价目+.000525；92→106输入+235、输出−5，+.000185。两组均不是这次的“缩短优化”实验，时间受随机生成/网络影响，gold不足；不能反向回滚新安全 prompt。本地 minify 原 paid 响应的API节费为0；26702 bytes也不能换算成26702 Token。

服务规则核验：Qwen3-VL使用32×32视觉patch，实际API usage优先；JPEG bytes小并不保证收费Token少。[官方视觉规则](https://help.aliyun.com/zh/model-studio/vision) 显式缓存whole-user消息/前缀和TTL限制使不同窗口的重叠图片不自动成为相同缓存前缀；隐式命中按输入20%计价，显式首次125%/命中10%，不能把服务缓存算本地0请求。[官方缓存说明](https://help.aliyun.com/zh/model-studio/context-cache) Batch File为异步，输入JSONL/多模态公网URL的要求与当前本地base64流程不匹配；半价不能套到Batch Chat。[官方批处理说明](https://help.aliyun.com/zh/model-studio/batch-inference)

推荐顺序：维持修复后基线 → 补齐全文gold与账户恢复 → 优先比较P2纯格式，再只选W1一个窗口变量；满足完整质量/效率/费用条件才最小替换。不是“当前已经最优”。不为小文本收益建平台，不用原PDF文本层纠正模型正文，也不另接OCR。

## 5. 经实际 usage 校准的规模费用情景

当前纯windows函数对N1–100、W1–10、全部合法O共5500组核对：

```text
K = 1 + ceil(max(0,N−W)/(W−O))
S = N + O*(K−1)
```

首窗最多W页，随后每步新覆盖W−O页；每个相邻边界重复O页，到末页即停，所以成立。只适用连续等步长调度。校准12个成功响应每输入页1963视觉Token；当前两个首窗辅助文本958Token。取历史9个成功首轮窗口输出密度303.4–1137.6Token/页出现，中心788.8017。情景式 `C=(1963*S+958*K+10*d*S)/1e6`。

**下面全部为估算，不是候选实测或统计置信区间**。假设每窗文本958、低价档、无失败/缓存折扣，输出密度可跨页推广；后窗动态题号文本可能更多，未知陌生版式/更长解析/重试会超出区间。保留原数组/每窗page list在成本JSON。

| 原页数 | 当前W5/O2 K/S | 当前中心；经验密度情景区间 | 候选W6/O2 K/S | 候选中心；情景区间 |
| --- | --- | --- | --- | --- |
| 10 | 3/14 | ¥.140788；.072832–.189620 | 2/12 | ¥.120128；.061880–.161984 |
| 20 | 6/30 | ¥.301279；.155658–.405918 | 5/28 | ¥.280618；.144706–.378282 |
| 30 | 10/48 | ¥.482429；.249436–.649852 | 7/42 | ¥.420449；.216580–.566944 |
| 50 | 16/80 | ¥.803409；.415088–1.082448 | 12/72 | ¥.720769；.371280–.971904 |
| 深圳21 | 7/33 | ¥.331790；.171607–.446893 | 5/29 | ¥.290469；.149703–.391621 |
| 河北19 | 6/29 | ¥.291427；.150661–.392579 | 5/27 | ¥.270767；.139709–.364943 |

深圳历史实际usage重建.322270与上表当前prompt情景.331790不是同一个实测版本；河北历史不完整小计.153178也不能拿来与候选.270767判优劣。候选真实时延/质量/整份账单尚无值。

## 6. 三次正常 UI 分段/资源量测

机器：Windows、Node24.16.0、i5-12400F/12逻辑核、物理内存17032749056bytes。最终版本每源三个独立隔离origin冷导入及同任务重复，模型HTTP边界fulfill历史原响应；真正PDF.js整页渲染、原像素裁图、producer/Contract、审核UI及repository持久化均运行。原请求JPEG hash逐页匹配。历史旧prompt响应的回放只证明基础设施/缓存行为，不能作为当前prompt模型识别验收。模型生成/真实网络/教师审核均未计时。

| 卷/阶段 | 本地墙钟中位 [min,max] ms | 边界请求三次 | 主线程TaskDuration中位秒 | 采样JS heap中位 / 最大MiB | 浏览器origin用量估计中位bytes |
| --- | --- | --- | ---: | ---: | ---: |
| 深圳冷导入 | 7140.77 [7135.56,7169.30] | 7,7,7 | 2.379 | 77.86 /78.04 | 26224827 |
| 深圳重跑 | 6354.25 [6321.63,6376.18] | 0,0,0 | 2.463 | 153.73 /183.79 | 26532547 |
| 河北冷导入 | 4545.30 [4543.79,4659.82] | 10,10,10 | 1.761 | 64.22 /82.47 | 23619085 |
| 河北重跑 | 4007.18 [3995.92,4083.20] | 6,6,6 | 1.775 | 132.14 /153.54 | 23831673 |

CPU列是CDP主线程TaskDuration，非全浏览器/worker CPU；heap按100ms采样，是JS堆观测峰值，不是总RSS或严格峰值。`navigator.storage.estimate().usage`是浏览器配额估计，不是实际磁盘bytes。热跑heap更高，不能据较短时间宣称全面资源下降。此前中间接线版量测原数据另存，不挑最好一次替代这三次。

| 冷导入实际段，中位ms | 深圳 | 河北 |
| --- | ---: | ---: |
| 全页renderPages | 1263.2 | 1144.0 |
| 输入SHA-256 | 6.6 | 7.2 |
| parseResponse JSON/schema | 1.4 | .9 |
| exact groupProposals | 1.3 | .8 |
| canonicalDraft | 6.4 | 3.1 |
| mathProblems | 37.6 | 27.9 |
| 原像素renderRegion（20/8次） | 4663.0 | 1957.8 |
| 草稿事务persist | 57.3 | 50.9 |
| producerTotal | 6511.3 | 3973.5 |
| 离线HTTP回放边界 | 474.8 | 781.1 |

各段非互斥，不能全加当总墙钟；当前主要本地开销为原像素裁图，其次全页渲染。JSON/schema仅约1ms，无证据删减安全验证能有实质收益。没有实施渲染/图片缓存优化，也没有用本地速度代替账单降低。

原记录草稿UTF8序列化约深圳26824769bytes、河北24826523bytes，文件/图片另列在JSON。深圳sourcePageImages有49次URL出现但20个不同URL，河北41次/10个；说明图片字符串与原响应跨字段重复是存储机会，但不等同实际数据库磁盘重复份数。改schema/引用结构会扩大审核/历史兼容面，未为省API费擅自实现。深圳缓存热跑source evidence仍7条；河北新失败留证10→16条。

### 纯本地合成负载，不能冒充真实大卷

使用原五页JPEG、原合法wire重编号/页映射构造合法多窗负载，实际producer/Contract分组与canonical执行；裁图端口用保存PNG，**没有真实10/20/30/50页PDF渲染、网络、IndexedDB或模型质量**。每窗17不同题，有51/102/170/272草稿，刻意密集；序列化审计放在计时之外。

| 合成页/窗/草稿 | 冷/热中位ms（各3次） | 冷ms [min,max] | UTF8 bytes | 进程CPU冷中位ms | 累计进程RSS高水位KiB |
| --- | --- | --- | ---: | ---: | ---: |
| 10/3/51 | 28.10/18.36 | [25.40,29.69] | 86918879 | 31 | 398996 |
| 20/6/102 | 56.14/38.23 | [48.22,57.13] | 177199909 | 63 | 780264 |
| 30/10/170 | 92.80/66.38 | [77.41,105.57] | 291041628 | 109 | 1272576 |
| 50/16/272 | 154.24/96.20 | [132.59,160.53] | 469892529 | 172 | 2016124 |

RSS为同进程累计高水位，不是各case独立峰值；没有把约470MB序列化当真实50页入库预测。只支持随密集原证据增长会增大资源负载的结论。

## 7. 真入口、质量、事务与退役状态

| 实际责任链 | 最终核查 |
| --- | --- |
| 正常上传/角色 → RoutePolicy → NormalUiController → Bridge | 原单题目/答案/全文/双PDF及DOCX场景仍由现有route owner选链；controller无PDF业务分支 |
| PDF producer → 实际浏览器渲染 / 同源模型端口 → Contract | 无旧OCR/parser；动态输入键和严格响应验证；网络只在回放边界拦截 |
| exact key / canonical → output port → review persistence | 按exam+原题号，保留冲突/缺失，业务字段不被旧评分merger改写；真实草稿重开 |
| review editor / image确认 → admission → formal事务 | 旧确认失效；未确认提交被拒；代表题四字段与确认值一致、原图片Blob可回读 |

每次UI量测两卷各19草稿、formal=0；所有重跑六业务字段与各自初跑一致，深圳保留16个冲突题、河北10个，不把冲突默选为正确。模型边界与正式入库业务断言通过，不等于识别率已达标。全量17个true producer场景仍运行，PDF完整模式额外执行无编辑重跑断言。

本轮代表题深圳5、河北4再次完成实际编辑、确认、修改/复认失效、拒绝未确认入库、重新确认、正式事务、reload、1+5真实图片Blob hash匹配；证据在两份actions。PDF打开操作在headless中发生原PDF下载，bytes hash与原源一致；下载事件可能归opener，脚本现同时监听opener/popup并保留诊断，没改产品行为。第一次复验漏监听opener失败日志保留，不放宽“必须打开或下载原文件”的断言。原生PDF查看器深圳5的歧义字形未完成新的目视核验，不能以headless下载等价替代。

38题源页关键条件/答案/图表锚点见[人工参考](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_SOURCE_REFERENCE_2026-10-03.md)，仍不是全部解析逐字LaTeX gold。河北8原答案B，旧模型D是识别错误；深圳13孤立0原源存在；深圳19函数`xe^x+ae^x−1`、河北16`4^n`/`2^{n−1/2}`等勘误保持。仅2/38题有本轮完整教师闭环，人工修订量见actions；38题全部机器完整正确数、全卷教师审核耗时均未知。

上轮六个PDF专用模块、17个纯旧实现测试的退役记录继续保持，本轮没有新增删除。七个旧owner产品均不加载；真正DOCX严格视觉/序列验证及共享渲染保留。`qisi-pdf-support-controlled-write.js`产品不加载但保护smoke直接require，仍dormant/deprecated；不能宣称旧文件全部删除。保护测试具体迁移补丁已准备未应用，不擅自刷新保护hash。

## 8. 最终门禁、范围与续作缺口

| 检查 | 结果 |
| --- | --- |
| npm run verify:safe | **通过，1633/1633**，fail/cancelled/skipped/todo=0；check/no-real-ai/batch-safety通过 |
| PDF known-bad | **62/62**；含当前非法缓存参数业务反例，不削弱原坏例 |
| DOCX stable / batch smoke | **8/8**，原DOCX+DOCX三题稳定fixture、共享序列gate保留 |
| runtime manifest | valid=true，errors=[] |
| app-shell | 9个保护handler AST匹配、errors=[]；本轮源字节独立对照保持 |
| 本轮scope | 1160文件基线；10个既有文件变动，加本总报告1文件；不删文件，范围外0 |
| 源/账本/保护smoke | 原hash不变；账本仍107/150，剩43；未commit/push |

本轮生产改动仅 `qisi-pdf-multimodal-producer.js`、`qisi-normal-ui-import-controller.js`、`qisi-production-import-route-policy.js` 及 `app.js` 两行接线；配套三个既有测试、app-shell矩阵真实位置/节点登记、任务范围及旧执行报告追加。本报告是唯一新增非忽略文件；测量/候选/诊断脚本放忽略目录，不进入递归test发现。

源hash：深圳`874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21`、河北`011f12024f5c8bdd013e6524ba63b1ed762b34db501295d2edd9b6505d06c4a9`；保护smoke`3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea`；账本`1305b0764c827188149b5b1638d8189c204653fd26eb515ef4318689a78e8b99`。

剩余条件与工作已具体化：

1. 外部账户明确恢复后，只沿原两PDF、既有端点及qwen3-vl-plus授权执行；每次先落账/hash。43预算仍分8小样本/6局部确认/26最终双卷与重试/3机动。不是每个成本候选新增43。两个完整候选各最多26再加最终26会超预算，不能为凑赢家挤占验收。
2. 先补完整逐字gold、深圳5原生字形和机器/人工分离记录，再在证据卡预先标准下验证一个有依据的候选；目前没有其真实usage/完整时延/人工代价。候选未获胜时继续当前配置，明确成本目标未完成。
3. 第三轮最终版本两卷完整机器初始结果/全文/图表/归属验收及38题教师事务覆盖仍待完成；此前部分成功回放不能替代。
4. 保护smoke具体例外仍待明确，因此最后一个旧模块暂不删除；现有patch可审阅，无额外清理/生产数据迁移。

本轮可确定的真实收益是恢复可用性和同有效输入成功响应零重复外发；首次全卷降费、完整识别质量/效率非退化及全规划完成均不能宣称。
