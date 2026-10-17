# MinerU 接手离线准备报告 — 2026-10-04

已完成交接第 12 节步骤 A，及步骤 B 的最小 3 页样本、认证关系、实验契约与可审核范围准备。**真实认证 0、上传 0、解析页 0；MinerU 质量/权限/费用未实测。** 尚未进入 13 页两轮对照、生产替换或两卷 38 题最终验收。

本轮任务：[精确范围及待授权实验](CODEX_TASK_MINERU_OFFLINE_PREP_2026-10-04.md)。本轮依据用户明确指令保留历史 dirty，不 reset/stash/commit/push；交接中的“留在本地”没有由笼统继续指令解除。

## 1. 现场与旧证据

分支 `stage/program-c-corrective-r1`，HEAD `71dfe18770e5161a19d38c07842d0ab865f20c92`。mandatory preflight 三项已执行。起始存在 1184 个非忽略文件，另记录 Git 已删除文件的缺席状态；与交接前 1183 的差异是交接文档本身。本轮将其作为只读基线，不以 HEAD 差异统计本轮贡献。

`before.json` 冻结这些文件、当前本地 `local-run-artifacts` 及 E 盘 `pdf-v1-implementation` 中合计 1666 份既有证据（385953498 字节）的 hash。本轮证据放在独立 ignored 目录，不覆盖其他阶段记录。

- 原累计账本仍为 `limit=150`、`calls.length=124`、末条 `number=124/status=200`，剩余 26 次。E 盘原账本只读，未创建新主账或挪用预留预算。
- 两源 PDF、source manifest、两份 JSON gold、保护 smoke、DPAPI 凭据与交接保护清单核对一致；其中 smoke SHA256 仍为 `3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea`。
- 凭据文件仍为 Windows-DPAPI-CurrentUser 加密的 OpenXLab AK/SK 类型，Git 忽略保持。仅核对脱敏元数据和文件 hash，未解密、另存或修改内容。`networkAuthenticationPerformed=false`、`mineruAuthenticationValidated=false`。
- DOCX、生产 PDF route、producer/contract、app.js、UI、架构清单、依赖、测试、数据库及用户 3000 服务均未修改。

## 2. 认证关系已查清到哪一步

[MinerU 当前官方云 API 文档](https://mineru.net/apiManage/docs)要求管理页创建的 Bearer Token；[OpenXLab 官方发布说明](https://pypi.org/project/openxlab/)说明 AK/SK 可换 JWT，但这不证明 JWT 对 MinerU 的具体权限。

本轮只下载阅读官方 PyPI 的 OpenXLab **0.1.3** wheel，SHA256 `28bd36d225e6e92b25979de52b770fa477cc01180e2a0424c06e6ec8157dc57c`，与官方发布 JSON 校验一致。没有安装/执行 SDK。发布元数据的 repository 是占位 URL，未把它作为有效 GitHub 源码来源；认证结论来自已校验的实际发布包 `user_token.py` 和 `auth_client.py`。

| 顺序 | 实际公开源码协议 | 外发内容 |
| --- | --- | --- |
| 1 | POST `https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/auth` | AK，取得 nonce/algorithm |
| 本地 | 用 SK 对 nonce 做 HMAC，再 Base64 | 无外发 |
| 2 | POST `https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/getJwt` | AK 和签名 d |

SK 可继续只留本机；认证本身仍需要向服务商提交 AK/签名，必须先取得这部分授权。最多一次流程/两次 HTTP；不调用 refresh、不重试、不探余额。当前只是公开源码的协议证据，未验证真实端点响应、密钥有效性、账号服务权限或有效期。

SDK 默认可能在用户目录写 token，并含版本检查/更新逻辑。本轮独立 mock 适配只实现内存协议，不继承这些副作用。JWT 返回后只报告 OpenXLab 认证结果；MinerU 接受情况仍为 `unverified`。若实际 MinerU 拒绝 JWT，则保留错误并停，不把 AK/SK 当 Bearer 或自行换服务。

## 3. 三页样本已冻结

采用 PyMuPDF 1.27.2.3（精确运行版本另见 `sample-manifest.json`）复制选定原页对象，上传候选仍是保留文本层/原页面内容的 PDF，没有重绘、修字或加入金标。新文件无其他页、附件、目录及原文件级个人元数据；原 PDF 字节不变。

| 本地候选文件 | 原页 → 子 PDF 页 | 字节 | SHA256 |
| --- | --- | ---: | --- |
| `shenzhen-p13.pdf` | 深圳 13 → 1 | 236414 | `b8bc8f76fb52d989825edd592e61a03d40c200dbea264c2ca4ae23c1bc63fe95` |
| `hebei-p06-p07.pdf` | 河北 6 → 1，7 → 2 | 178075 | `7ff88bc09bde462d8e2b131c0ad707664bc4da7b36b2d43e5c17220e765e332e` |

三页在同一 PyMuPDF 渲染器 scale=2 下逐像素一致；文本层、MediaBox/CropBox 和尺寸也一致。另用 Poppler `pdftoppm -r 144` 渲染并逐页目视检查：深圳目标等式和全部上下标、几何图点名/虚线、河北第 6 题页首尾段、原页脚均保留。这个核查证明本地取页忠实，**不证明 API 识别质量**。

原页位置与印刷页脚不同：深圳原 13 页脚是“答案第 5 页，共 13 页”；河北原 6/7 页脚是“答案第 2/3 页，共 15 页”。云结果若使用零基 page_idx，必须根据实际协议确认后才能映射，不能拿页脚或请求数组下标猜原页。

样本自身有已知边界：深圳 13 页开头是第 10 题续文、结尾是第 11 题未完解析；河北 6 页开头是第 4 题残段、7 页结尾第 8 题继续到未提供的原第 8 页。首轮验证逐页转写/资源完整性，不把这些残段包装成 complete 整题，也不发送补全后的 gold。

## 4. 离线适配与 mock 结果

实验目录 `offline-contract.cjs` 无 fetch、凭据读取或生产导入能力，只接受显式 mock 端口；不是可部署的 MinerU 生产适配器。

11 项行为核查通过，包括：固定向量 HMAC；认证请求体不含 SK；认证失败/未知算法立即停；live 模式被拒绝；Bearer 前缀规范；上传地址域和数量校验；返回顺序改变时按明确文件名/data_id 绑定；未知状态/身份失配拒绝；保存原响应后再判终态；失败/非法 JSON/非零服务 code 不重试；轮询次数/截止时间终止；页基数未确认和越界拒绝；未知输出字节保留、不产生题目或猜 bbox。

认证仅允许服务给出的已实现算法。云响应只适配官方异步 envelope；内部 JSON、bbox 单位、阅读顺序、图片来源仍等待真实 ZIP 后核实。[官方输出文档](https://opendatalab.github.io/MinerU/reference/output_files/)描述的当前开源输出不能直接当作托管云的固定 schema。`done` 仅表示资源终态，质量始终为 `unreviewed`。未知结构保留原字节，questions=[]。

确定性边界：轮询每次只查询既有 batch，不重新申请/上传；最多 30 次，在每次查询前后核 5 分钟截止时间，非终态查询间隔至少 10 秒。每轮文件校验按文件名查找，M 个文件最坏 O(M²)，本实验 M=2；不宣称整卷算法性能优化。页映射在基数已明确时 O(1)，不解释语义。未知字节复制 O(B) 时间/空间。mock 的时钟与请求并非真实网络，没有证明真实延迟、服务状态兼容、真实免费权益或 OCR 准确率。

## 5. 下一步可审核范围，仍需两项授权

认证授权与试卷外发授权分开。认证-only 不申请文件上传链接、不提交解析任务。完整拟实验冻结于 `experiment-registration.json`，关键范围如下：

- 只上传上述两个已冻结子 PDF，共 3 页；不会以 page_ranges 名义上传整卷。固定 vlm、is_ocr=true、公式/表格识别开启、language=ch；无 gold/纠正公式/旧模型响应输入。
- `POST https://mineru.net/api/v4/file-urls/batch` 最多一次；文件 PUT 最多两次，只采用原响应的 HTTPS 地址并限定当前官方示例域 `mineru.oss-cn-shanghai.aliyuncs.com`。完成 PUT 可自动触发解析。未知接收域、重定向或超出范围即停。
- `GET https://mineru.net/api/v4/extract-results/batch/{batch_id}` 最多 30 次；下载最多两个原 ZIP，只接受已确认的 HTTPS 结果域 `cdn-mineru.openxlab.org.cn`，每包上限 100MB，先留原包/hash再检查。上传/下载不携带 OpenXLab AK/SK，文件接收 PUT 不附 MinerU Bearer。不执行包内文件或请求其中的资源外链。
- 付费上限 **0 元**：先核实账户对此次 3 页有明确免费权益，再上传。文档的“1000 页最高优先级额度”不是该账号免费余额证明；权益不能核实或要求收费则停。未取得账单/usage 的实际费用记未知，不强写 0。后续由本任务独立实验账本登记所有尝试，原 DashScope 账本不动。
- 重点源对照包括 `8^16`、河北第 5 题 `a3`/“齐次”、第 6 题续文及“故选 D”；另逐段核全文、图片/标签/页脚，不仅检查几个关键词。新增公式错误、漏文或来源不明即停止扩页，不换另一模型补成通过。

真正缺少的是：允许用本机凭据向上述 OpenXLab 端点认证，以及允许向 MinerU/限定接收域发送这 3 页。账户免费权益也尚未核实。现有 DashScope 指定目的地许可不覆盖这次新服务。

## 6. 验证、增量与未完成事项

- `node .../offline-spec.cjs`：11/11，真实网络认证/上传/解析均 0。
- 样本：3/3 原页像素与文本层一致；Poppler 二次渲染及目视检查完成。
- `npm.cmd run verify:safe`：退出 0，主测试 1633/1633；DOCX stable 8/8、PDF known-bad 62/62、batch mock 8/8、no-real-ai/batch-safety 均通过，0 fail/cancelled/skip/todo。
- 首次默认沙箱运行报 Node `spawn EPERM`，日志保留为 `verify-safe-sandbox.log`；原样门禁获准执行权限重跑，没有改代码、门禁或期望。公开资料下载的沙箱网络限制也只经批准后读取公开网页/发布包，没有认证请求。
- `node scripts/verify-runtime-modules.js`：valid=true；`node scripts/verify-app-shell-architecture.js`：9 个保护 handler 验证通过。
- 本轮非忽略增量仅本报告及对应任务文件两个 Markdown；`git diff --stat` 的既有大量业务改动属于保留基线。本轮旧文件/删除状态、1666 份证据、交接 8 份保护文件、分支和 HEAD 一致；见最终 `scope-audit.json`。ignored 新增仅本实验脚本、样本、公开资料、mock 和门禁日志。

证据目录：`C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/mineru-offline-prep-2026-10-04/`，主要文件 `before.json`、`preflight.json`、`sample-manifest.json`、`sample-visual-audit.json`、`upload-request-body.json`、`experiment-registration.json`、`public-source-audit.json`、`mock-results.json`、`verify-safe.log`、`runtime-modules.log`、`app-shell.log`、`scope-audit.json`。

没有业务代码变更、生产数据写入、部署、commit/push、SDK/模型安装或收费测试。DOCX 稳定链无改动且回归通过；PDF 对齐及 controlled-write 无改动、known-bad 保持。MinerU 实测、同质量降费、13 页稳定性、两卷 38 题和所有原图/Blob 最终验收仍未完成；本轮离线绿色不能替代这些目标。
