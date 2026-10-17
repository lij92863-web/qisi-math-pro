# PDF录题 API 与公开实现调研 — 2026-10-04

建议优先小样本比较 **GLM-OCR托管文档解析API** 与 **Qwen3.7-Flash视觉API**，验证“专用OCR保留全文/版面，再独立组织题目”的路线。GLM-5.3-Flash或豆包Seed2.1-Lite可作为第二批通用视觉候选。用户已明确只用API，本轮不推荐本地推理，不安装/运行开源项目。

本轮查了9家国内服务商官方模态、现行定价，以及11个固定提交的公开解析/录题项目；另外核对了Mathpix的数学OCR API。其他厂商没有上传试卷或实测，当前只有Qwen3-VL-Plus的真实质量证据。官方公开基准与宣传数字不是这两卷的验收结果。

当前任务交付调研、隔离诊断和可审查的下一项实验规格，不修改生产链。根因证据见 [四次隔离实测](C:/Users/Administrator/Desktop/题库系统/ai/PDF_V1_ISOLATION_DIAGNOSIS_2026-10-04.md)。

## 1. API选择与价格

核对日期2026-10-04。下面输入/输出均为**人民币/百万Token**，按中国服务标准实时调用、未命中缓存、短输入首档；阿里为北京地域。每行均已核对支持图像，不能拿纯文本模型的便宜价格替代视觉价格。

“同Token换单价”只把现有三组失败基线108/110/111的各请求usage代入：输入28597、输出13333、图像25519，13次页面出现，缓存0。其他厂商分词、图像缩放、图片Token和输出长度不同，**这列不是实际费用预测，也不是同质量降本证明**。专用OCR输出任务与原结构化任务也不同。

| 服务商 / 可收图像模型 | 输入/输出 | 同Token换单价，元 | 录题相关判断与官方来源 |
| --- | ---: | ---: | --- |
| 阿里 Qwen3-VL-Plus（当前） | 1 / 10 | 0.161927 | 六次修复候选和本轮组织样本仍漏文；[价格](https://help.aliyun.com/zh/model-studio/model-pricing) |
| 阿里 Qwen3-VL-Flash | 0.15 / 1.5 | 0.024289 | 可作便宜同系列对照；[价格](https://help.aliyun.com/zh/model-studio/model-pricing) |
| 阿里 Qwen3.7-Flash | 0.2 / 0.8 | 0.016386 | 第一批通用视觉候选；[价格](https://help.aliyun.com/zh/model-studio/model-pricing) / [视觉能力](https://help.aliyun.com/zh/model-studio/vision-model) |
| 阿里 Qwen3.8-Flash | 0.8 / 2.7 | 0.058877 | 新版本更贵，质量未实测；[价格](https://help.aliyun.com/zh/model-studio/model-pricing) |
| 智谱 GLM-OCR | 0.2 / 0.2 | 0.008386 | 专用文字/公式/版面解析，优先；[价格](https://docs.bigmodel.cn/cn/guide/start/pricing) / [接口](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr) |
| 智谱 GLM-4.6V-FlashX | 0.15 / 1.5 | 0.024289 | 廉价视觉对照；[价格](https://docs.bigmodel.cn/cn/guide/start/pricing) |
| 智谱 GLM-4.6V-Flash | 免费 | 名义0 | 配额/并发/稳定性另核验，不认定生产无限免费；[价格](https://docs.bigmodel.cn/cn/guide/start/pricing) |
| 智谱 GLM-5.3-Flash | 0.8 / 2.8 | 0.060210 | 新通用图像/文件模型，第二批；[价格及模态](https://docs.bigmodel.cn/cn/guide/start/pricing) |
| 字节 doubao-seed-2.1-lite | 0.8 / 2.7 | 0.058877 | 新通用视觉候选，第二批；[标准价格](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh) / [图像输入](https://docs.volcengine.com/docs/ark/coding-plan-enterprise-ai-opencode?lang=zh) |
| 字节 doubao-seed-2.0-mini | 0.2 / 2 | 0.032385 | 低价视觉备选；[价格](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh) |
| DeepSeek deepseek-flash 非高峰 | 1 / 4 | 0.081929 | 当前V4.1-Flash支持图像；[价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) / [视觉限制](https://api-docs.deepseek.com/zh-cn/guides/vision/) |
| 同一DeepSeek模型，高峰 | 2 / 8 | 0.163858 | 时间影响计费，不以非高峰报全年成本；[价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) |
| MiniMax-M3 标准 | 2.1 / 8.4 | 0.172051 | 支持原生图像，当前单价不占优势；[价格](https://platform.minimaxi.com/docs/guides/pricing-paygo) / [能力](https://platform.minimaxi.com/docs/guides/models-intro) |
| 月之暗面 Kimi K2.6 | 6.5 / 27 | 0.545872 | 原生图像/视频，非本轮降本首选；[价格](https://platform.kimi.com/docs/pricing/chat) / [能力](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart) |
| 月之暗面 Kimi K3 | 20 / 100 | 1.905240 | 原生视觉、长上下文，强制思考成本不合当前目标；[价格](https://platform.kimi.com/docs/pricing/chat) / [能力](https://platform.kimi.com/docs/guide/kimi-k3-quickstart) |
| 阶跃 Step3.7-Flash | 1.35 / 8.1 | 0.146603 | 新视觉版本，标价改善有限；[价格](https://platform.stepfun.com/docs/zh/guides/pricing/details) / [模态](https://platform.stepfun.com/) |
| 百度 ERNIE4.5-Turbo-VL | 3 / 9 | 0.205788 | 视觉版，不与文本版Turbo混淆；[价格](https://cloud.baidu.com/doc/qianfan-docs/s/Jm8r1826a) |
| 腾讯 HYVision2.0-Instruct | 7.5 / 17.5 | 0.447805 | 当前TokenHub视觉模型，不是旧平台3/9价；[价格](https://cloud.tencent.com/product/tokenhub) / [模型映射](https://cloud.tencent.com/document/product/1823/130078) |
| 腾讯 YT-VITA | 1.2 / 3.5 | 0.080982 | 较便宜多模态候选，数学全文能力未验证；[价格](https://cloud.tencent.com/product/tokenhub) |

以上为选型优先级，不是已经跑过的能力排名。Qwen3.7-Flash是新多模态系列，并非仅凭“文本生成”价格表推断支持图像；同样，当前DeepSeek Flash已有视觉输入，不能照旧印象判为纯文本。

分档和计费注意：

- 阿里K=1000；Qwen3.7-Flash超过32K输入改为0.6/2.4，超过256K为1.2/4.8；Qwen3-VL-Plus超过32K改为1.5/15、超过128K为3/30。按每个请求输入分档，不能把三次总输入用于定档。
- GLM4.6V-FlashX输入达到32K进入0.3/3；表中其他只列首档。普通GLM5.3为文本，图像候选是Flash/FlashX。
- 豆包列标准实时价；低优先级/批量半价另有时延和服务条件，不混作默认价。2.0-Mini长输入改为0.4/4及0.8/8。
- DeepSeek高峰为北京时间工作日9–12、14–18，排除中国法定节假日；其他时间非高峰。其图像缩放上限约1.69M像素、单图至多1024图像Token，不能直接沿用Qwen每张1963的实测计量或假定细小公式保真。
- MiniMax表中为普通API、标准优先级、≤512k；大输入和priority更贵。M3.1-Flash-Preview当前渠道与按量API不同，未核到通用按量价，不虚构价格。
- Kimi采用当前K2.6/K3，不沿用旧K2.5博客价。K3缓存写入另收费，表中无缓存；强制思考模式与Qwen关闭思考的任务配置不可当作完全相同。

## 2. 专用OCR API与教育切题服务

| 服务 | 当前收费口径 | 两卷40个独立原页的OCR标价示例 | 适合比较什么 |
| --- | --- | --- | --- |
| GLM-OCR布局解析 | 输入/输出各0.2元/MToken | 要实际usage才知道 | 完整文字、公式、阅读顺序、版面块；不直接替代题号归属门禁 |
| 百度文档解析PaddleOCR-VL | 按量0.05元/页 | 2元 | 专用完整文档解析；同质量复核省时是否抵消价差 |
| 百度试卷切题识别（普通接口） | 按量0.16元/成功次 | 不能把多页PDF一次请求简单当0.16元/卷 | 题干/选项/图框定位，另验独立答案卷对齐 |
| 百度试卷切题与识别（多模态新接口） | 本轮未找到与该接口明确对应的公开价 | 未知 | 异步整页切分+公式识别；不能套普通0.16元价 |
| Mathpix v3/pdf | 0.005美元/页 | 0.20美元，另有首次19.99美元开通费 | 数学OCR专项对照、逐行JSON与公式保真 |
| Mathpix Files API | 0.0015美元/页首档 | 0.06美元，另有开通费和异步流程 | 大批量异步解析，交付/轮询/配额与v3/pdf不同 |

百度价格页2026-09-10已将PaddleOCR-VL按量价从0.09降到0.05元/页，旧新闻价格不作为现价。5000页资源包230元，需要预付且有期限；新人9元/千页、免费额度属于有条件优惠，未计入基础比较。云端部署版本需从控制台/响应核验，不能因开源已到1.6就宣称托管API一定是1.6。[文档解析价格](https://ai.baidu.com/ai-doc/OCR/tlrzzplc1)、[教育普通接口价格](https://ai.baidu.com/ai-doc/OCR/Ek3h7xvq7)、[普通切题接口](https://ai.baidu.com/ai-doc/OCR/Tlqom5gvh)、[多模态新接口](https://ai.baidu.com/ai-doc/OCR/Cmn8k7ihq)。

Mathpix的整页图片超过12行可能按PDF页价，不能报0.002美元/图片来低估全文费用。API会返回逐行JSON；多页任务须等status完成，percent_done=100还可能没有生成完输出。Files API和v3/pdf共享页面配额。美元费用未与人民币相加，未假定汇率或中国网络表现。[现价](https://website.mathpix.com/pricing/api)、[文档API](https://docs.mathpix.com/reference/post-v3-pdf)、[Files API](https://docs.mathpix.com/guides/files-api-overview)、[配额](https://docs.mathpix.com/reference/limits-and-quotas)。

国内优先试GLM-OCR；百度Paddle云API作为更贵的质量参照。Mathpix不是国内定价表的一员，作为数学专项备选，当前没有向它上传试卷。

## 3. 从公开项目学到的具体实现

仅下载并阅读固定提交的源码、README、LICENSE和官方文档，没有安装执行。固定SHA避免把不断变化的main当作已审查代码。当前公开版本与早年的博客描述不同：MinerU已4.0系列、PaddleOCR-VL已1.6、Marker代码许可证已Apache2，不能照旧文章写结论。

| 项目与固定版本 | 阅读的实际路径 / 值得借鉴 | 对本项目的限制 |
| --- | --- | --- |
| [GLM-OCR cef4d0e](https://github.com/zai-org/GLM-OCR/tree/cef4d0ea120d1741f5cefe8985eee45f6c8eff1d) | glmocr/pipeline/pipeline.py、layout/layout_detector.py、parser_result/pipeline_result.py：读页→布局检测→区域识别→保持顺序汇集；有限队列控制并发，原始JSON与可视化可保留 | 学布局/出处/背压；使用托管layout_parsing，不部署模型。代码Apache2，模型MIT，布局模型单独许可 |
| [PaddleOCR dab3fe3](https://github.com/PaddlePaddle/PaddleOCR/tree/dab3fe35379033fdcb2d0e9572fac0b36c9a9ebf) | paddleocr/_pipelines/paddleocr_vl.py是PaddleX封装；完整流程文档明确先版面定位/顺序，再识别区域中的公式/文字，最后合并 | 单独VLM聊天不等同完整解析pipeline。Apache2；云端版本另核验 |
| [MinerU ed50cc1](https://github.com/opendatalab/MinerU/tree/ed50cc15bc2c9bfb00520dadfe61979866e62236) | mineru/backend/analysis/pdf/pipeline.py、text/native.py、render/_internal/content_list/v2.py、docs/next/sdk/parse-result.md：区分PDF输入模式、统一几何/中间表示；页/块定位、资源与显示分离，未知schema拒绝 | 学源位置与类型化结果，不加入本地推理。许可证为Apache2加商业阈值/在线署名等额外条款，不能说是纯Apache2 |
| [Docling 51fe9ff](https://github.com/docling-project/docling/tree/51fe9ff4578e9f150ef3bc6246433e6092a8ebfb) | docling/pipeline/standard_pdf_pipeline.py、models/postprocessing/reading_order_rb.py：独立ReadingOrderModel，公式提取显式开关；统一文档结构 | 通用PDF结构不解决答案卷题号身份；MIT代码，依赖权重分别核验 |
| [Marker e7c67f1](https://github.com/datalab-to/marker/tree/e7c67f1d239ea6a805cbf4ed6c6b2056d435e22d) | marker/providers/pdf.py、converters/pdf.py：保留原PDF字符信息，检测文本可用性，独立force_ocr/page_range；不同模式进行原生/视觉取舍 | 学质量门禁，不把LLM改写结果当原解析。代码Apache2；模型MODEL_LICENSE为附条件许可、含商用阈值，不能只看代码许可 |
| [DeepSeek-OCR-2 2f3699e](https://github.com/deepseek-ai/DeepSeek-OCR-2/tree/2f3699ebbb96fa8af32212e8c170f2cc28730fad) | DeepSeek-OCR2-master/DeepSeek-OCR2-vllm/run_dpsk_ocr2_pdf.py：保留grounding位置并裁图 | 位置需校验越界/页号/归属，不能凭bbox自动挂答案；开源OCR与DeepSeek聊天视觉API不同，代码Apache2 |
| [HunyuanOCR 1ef4179](https://github.com/Tencent-Hunyuan/HunyuanOCR/tree/1ef4179e53cf860f7e6fd8276a292e5d05b3e927) | README已介绍1.5及结构化文档/位置识别，用于补充专用OCR类别认识 | 不把本地权重效果或免费推理当腾讯云API效果/价格；自定义Tencent Hunyuan许可 |
| [Math Question Bank 58e18a0](https://github.com/JudgePeach/math-question-bank/tree/58e18a04094597ae83711b8a32ff2d87e4725e03) | mathbank/pdf_inspector_helper.py：逐页native_text_quality_reasons、公式丢失/位置异常检查；pdf_source_verify.py：数字/公式核源、原证据hash | 很贴近数学录题，值得学异常检测；不采用自动解题/画图修补原文。GPL3，不能整段抄进当前代码 |
| [ExamSplitAI 92364b3](https://github.com/yizhaofeng1/pdf_processor/tree/92364b3f51cdcec6c1b84fc3332c4666b2c7727d) | app/experimental/local_detection/cross_page.py、confidence_router.py、app/pdf/cropper.py：原PDF裁题思路、按页结构保存 | 跨页代码按底部/顶部位置追加，没核验相邻页号；序列检查前排序可能掩盖回跳。不能作为答案归属安全证据。未找到LICENSE |
| [TeX-QB-Gen a4c6dbd](https://github.com/ChouYuanjue/TeX-QB-Gen/tree/a4c6dbd6a76caf345204a0652ad749775c792bc2) | src/texbank/pdf_utils.py、pipeline.py：原生文字/可疑页OCR、答案/解析标记和输出LaTeX题库 | 提示词允许还原本意、生成解答，与本项目忠实录入不符；只学选择性处理与源保留。GPL3 |
| [pdf-exam-bank 4af4e76](https://github.com/hzhsec/pdf-exam-bank/tree/4af4e76c9005931c83f1434706897e860c9406b9) | parser/pdf_parser_v2.py：常规题号/选项正则与图片候选收集 | 规则式选择题演示，未证明复杂公式、跨页长证明、独立答案卷通过。未找到LICENSE |

核心借鉴有四点：保留不可变源页/块；版面位置与OCR文本同时保存；识别与题号组织分开；组织层能发现未分配尾段、续页和缺字。上述项目没有提供这两卷的金标验收证据，不能直接以开源录题已有完整实现替换安全门禁。

原PDF裁题能保留视觉证据，适合复核与导出；裁图本身不满足可编辑全文、公式和答案正确归属的要求。数学习题中的解题能力、摘要能力和OCR逐字保真也是不同指标。

## 4. 建议的API流程与代码边界

这是下一项研究实验的规格，**不是已接入生产的架构**。既有V1仍保持原链；若采用新流程，必须在新任务文件明确扩展V1规划，不能偷偷启用旧文本层/区域回退。

1. 对每个原页只识别一次，API返回文字/公式/版面块；冻结原始响应、源PDF SHA、页码、图像SHA、模型版本、块原坐标、usage、终态。
2. API适配器只解释厂商协议，禁止整理原文、补答案或修正数学。统一为页/块证据；模型返回的题号和归属只作观察，不直接入库。
3. 独立组织层按原始页序检查题号与角色。跨页必须有相邻原页、连续题号、上下文边界证据；起始不明尾段进入未分配区。任何漏页、回跳、重复、残段或无法核验的complete都阻止晋级。
4. 只有异常文字/公式块进行精确源裁图API复核；记录每次尝试，不重复全文刷多遍。有限并发、无隐式收费重试，原响应先落盘再处理。
5. 展示层保留源图对照；题目组织可以只输出块ID范围，避免反复让模型重写整段长证明。这部分仍需单独对照测试，不能当成已节省费用。

建议下一次增量模块边界：

| 模块责任 | 输入 / 输出 | 必须避免 |
| --- | --- | --- |
| provider-page-parser（独立实验适配器） | 原页/字节→不可变厂商响应+PageEvidence | 在app.js添加流程；改代理白名单给未确认目的地 |
| page-evidence-contract | docSHA/page/blockID/order/bbox/text/assetRefs/usage/status | 删除raw、相信供应商confidence就放行 |
| sequence-and-coverage-gate | 按原页顺序的块→归属或未分配残段、续页状态 | 先按题号排序掩盖回跳；语义猜题号 |
| review/export | 完整源对照与已验证结构 | 用生成答案/生成TikZ伪装原内容 |

GLM-OCR云端真实入口为POST https://open.bigmodel.cn/api/paas/v4/layout_parsing，与普通chat/completions不同；官方示例用model=glm-ocr和file字段。首次接入需保留真实响应，核验坐标、页序、usage形状，不预编造供应商JSON字段。Paddle云接口、Mathpix异步API也各有认证/轮询方式，不能仅替换base_url和model就假定兼容。[GLM接口](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr)

不需要GPU/权重部署。原图裁剪、页码/hash、普通PDF位置读取只是现有客户端预处理；它们不承担AI推理或替代公式质量验收。

## 5. 下一项可审查的同源API小样本

先验证两个候选即可，避免9家同时付费试错：

| 项 | 冻结规格 |
| --- | --- |
| 候选 | GLM-OCR layout_parsing；Qwen3.7-Flash固定快照2026-07-15，仅OCR任务 |
| 原页范围 | 深圳10–14、19–21；河北4–8，共13个独立原页 |
| 输入 | 同一批原图/原页，无金标提示，无数学纠错提示；厂商图像预处理和限制分别记录 |
| 输出 | 逐页完整原文/公式与可用源定位；不让模型一次组织题干/答案/解析 |
| 轮次 | 每候选2轮，共52个页面处理；HTTP提交次数按实际供应商协议另预登记，不把页数冒充请求数 |
| 质量硬门槛 | 0新增数字/指数/符号错误；关键中间等式/长证明全保留；未知源字形不猜补；组织层0错挂/0伪complete，图裁归属单独核验 |
| 效率 | 实测总耗时、每页分布、尾部延迟、失败/超时/限流、人工复核分钟数 |
| 费用 | 实际每次usage和账单，含失败/重试；固定并发与超时，不用假想跨厂商Token推导实付 |
| 量级估算与止损 | 按旧每轮28597输入/13333输出仅作量级估算：GLM两轮0.016772元，Qwen两轮0.032772元；不是承诺。执行前设置独立1元预算止损并按厂商实际计量停止 |
| 晋级 | 小样本两轮均达标，才设计两卷完整验收；恢复完成不等于成本优化/全卷通过 |

新服务商端点及凭据尚未接入。本轮没有把试卷发送至其他公司、消耗预留26次或调整生产模型。更换供应商的测试必须使用具体已确认的目的地与凭据；本报告已经把候选、输入、质量门槛和预算准备成可审核结果。

上述1元是运行止损上限，不保证所有API调用能在一笔请求内预知费用；必须先从样本和输出限额保守估算、账本登记再发。若API无usage/账单，列未知，不把它记为免费。

## 6. 为什么现有方式偏贵

三个真实基线列表费0.161927元，其中输出0.133330元，占82.34%；纯图片输入费最多只是其中一部分。因此压缩图片或缩短JSON键名只解决小部分问题。已试紧凑JSON省1.43%且耗时增加，不能认定成本优化成功。

更有希望的是便宜的专用OCR/Flash模型、源页只识别一次、组织输出块引用、只复核异常块；还需量入人工复核与失败重跑。若便宜模型需要大量人工纠正，它的每合格试卷成本仍可能更高。

有效成本口径为：(全部尝试费用 + 人工复核分钟×时薪/60) / 完整验收合格试卷数。

没有合格整卷时该值未定义；历史失败有未知账单时也不能报精确实际总成本。固定Token换单价只是筛选候选工具。

## 7. 可复核产物与本轮状态

公开源码/官方文档快照与URL/SHA在 ignored public-sources目录，GitHub元数据含固定提交日期/许可证；豆包价格正文从官方搜索缓存核对，下载的JS空壳不单独充当价格证据。部分官网web抓取超时，成功取得官方Markdown/HTML时保留了原文件。

[pricing.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-isolation-and-landscape-2026-10-04/pricing.json) 和 [cost-calc.cjs](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-isolation-and-landscape-2026-10-04/cost-calc.cjs) 可复算单位、分档、缓存及未知值；实际基线和换价结果在 [cost-comparison.json](C:/Users/Administrator/Desktop/题库系统/local-run-artifacts/pdf-v1-isolation-and-landscape-2026-10-04/cost-comparison.json)。计算器不注册进产品，不调用任何网络。

本轮4次原厂诊断标价0.064361元、累计124/150，剩余26；原代码/配置/数据库保持，verify:safe全部通过。调研结论是优先验证专用OCR API和廉价视觉API，尚未证明替代厂商能力更强或成本优化已经通过。
