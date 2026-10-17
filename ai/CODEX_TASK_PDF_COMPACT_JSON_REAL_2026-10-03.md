# PDF 当前提示词与紧凑 JSON 同源实测任务 — 2026-10-03

授权依据：用户要求按已知反例建立真实基线、只改变 JSON 输出格式并实测质量/Token/费用/耗时；本轮用户已明确回复“已确认账户恢复”。承接 CODEX_TASK.local.md / CODEX_TASK_PDF_MULTIMODAL_V1.md 中原两卷、既有端点/模型、累计最多150次授权；保留已有 dirty 现场，不重置、不提交、不推送。本任务明确允许下列收费实验，不扩展样本、服务或模型。

Purpose: 三组小窗口服务边界对照，检验紧凑 JSON 是否保留原文且产生实际输出 Token 和费用收益。不是正常 UI 完整导入或两卷最终验收。

Model: qwen3-vl-plus，temperature=0、enable_thinking=false、max_tokens=16384、response_format=json_object，均沿用当前实现。模型别名的服务端版本不可由客户端保证，记录原始 response.model。

Input file: 原 source-manifest 两份 PDF。深圳 SHA256 874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21，原页10–14及19–21；河北 SHA256 011f12024f5c8bdd013e6524ba63b1ed762b34db501295d2edd9b6505d06c4a9，原页4–8。复用原请求88/91/93保存的原 PDF.js scale=2 JPEG；发送前同时校验原 PDF 和逐图 data URL hash。每对使用完全相同字节、页号及角色full，已见编号1–19按旧同窗口元数据冻结，不向模型提供金标正文。

Endpoint: 本任务独立 127.0.0.1:32261 服务器 /api/ai/chat，既有 proxy 仅转发 https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions；使用既有配置，不读取/打印密钥，不改服务器安全限制。仅使用本任务启动的服务器；不接触生产 IndexedDB或正式题库。

Expected max calls: 本阶段槽最多8次、计划6次（三组当前提示词基线，然后三组仅追加紧凑序列化要求）；此次脚本硬上限6，不自动重试。余2次不主动消耗，必要追加须先登记具体原因。失败/异常/超时照样计数。原累计107/150；本轮结束预计113/150，保留原6次候选确认、26次最终两卷、3次机动和未用2次。

Expected cost/risk: 按每次返回的 usage 和2026-10-03官方北京阶梯价格核算；≤32k输入为¥1/百万、输出¥10/百万、隐式缓存输入¥0.2/百万。记录分档、cached_tokens及未折缓存费用，无法取得实际账户账单则明确列未知，不以核算值冒充账单。按历史输入及16384输出上限，6次首档约不超过¥1.2；这不是账户费用硬保证。源全文仍可能错号/删改/漏步，必须审原对象和源页；不把漏识别带来的Token下降判成功。

Success criteria: 全部6次HTTP成功、finish_reason=stop、现行contract校验通过。候选在各窗口中无新增关键公式/归属/漏文/false-complete错误；源上明确可归属的本窗口全文不能静默遗漏；不增加已知严重错挂，不假称无歧义。仅窗口外正文允许标partial，源歧义单列。全部图片提案与原页/题/字段核对；缺图、截标签或含周围正文均列失败。费用与效率事先阈值：三个配对的总输出Token下降、缓存调整前与按缓存计价的总费用均至少下降5%；总服务墙钟不超过基线110%，单窗不超过150%。小样本只支持候选是否值得进一步确认，不证明整卷成本或最终验收。候选有明确严重错误即不进入窗口调整/最终阶段，不以相对基线更好覆盖绝对缺陷。

Abort conditions: 原源/图片/生产代码hash变化、账本非预期变化或本轮尝试数超6、累计超150、模型或端点变化；任一网络/HTTP失败（含Arrearage、401/402/403/429）、未完成响应则停止后续发送，保留响应/计数/费用未知项。JSON或质量失败保留原证据，成功HTTP的配对继续完成以免选择性只报告好结果。不得用收费健康探测代替实验。

Whether business code can be modified: 否。仅新增本任务文件、ai/PDF_V1_COMPACT_JSON_REAL_COMPARISON_2026-10-03.md和ignored local-run-artifacts/pdf-v1-compact-json-2026-10-03/材料。允许在既有 E:/备份/题库系统/local-run-artifacts/paid-import-ledger-2026-10-02.json 上先记后发并补终态；在既有 pdf-v1-implementation/ 仅新建 request-108及后续至113的请求、图片、response文件，旧证据绝不覆盖。修改前1165文件hash/原107账本行保存在本轮 before.json。

单因素：基线直接调用当前 PdfMultimodalProducer.prompt(['full'], ['1',…,'19'])；候选只在末尾追加紧凑JSON序列化说明。字段、数组、原字符串中的换行/空格/LaTeX/步骤均须保留。提示词新增Token按实际usage计，不改schema/窗口/角色/输出上限/渲染/缓存/模型，不对原结果清洗后伪装模型输出。

核验：请求前冻结 registration.json，原始响应和原始decoded字符串保留；各流题号/状态/来源、全文与金标/源页/裁图人工复核；比对全部1165个原文件及原107账本行不变，npm run verify:safe。第5/15题源字形及全卷图片仍保持未最终验收。

## 单次网络故障恢复登记（第109次后、重发前）

108成功并保留，不重发。109在66ms返回HTTP502，原响应causeCode=ECONNRESET，无usage；不是Arrearage/账户拒绝。脚本已按停止条件停止并关闭自有服务器。现使用原8次槽中的1次故障余量，仅对同hash深圳19–21页重试一次，随后补河北基线和三组候选；本轮总尝试上限改为7，预计累计114/150。不循环重试；再有任何网络/HTTP失败即停止本轮外发。原登记和门槛不变，恢复原因独立追加recovery-registration.json，全部失败计数/费用未知保留。允许新增原E盘request/response/image编号延至114；恢复仅为隔离测试运行器的进度管理，不改产品代码。
