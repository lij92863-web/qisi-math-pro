# 固定用户已指定的千问 3.7 Flash

用户在通用修改方案实施请求之后纠正：“我说了用千问3.7flash啊”。模型选择已明确，不能继续列为待选。采用此前实际使用的固定版本 qwen3.7-flash-2026-07-15，识别、整理及独立视觉复核均使用该模型；独立复核是独立请求，不是模型自报完整。复用现有千问传输端口，保持默认关闭，不新增付费调用。

允许：qisi-config.js（PDF 外部模型/复核模型与显式复用识别传输的配置）、qisi-pdf-external-provider.js（仅显式配置后的复核传输复用）、tests/pdf-external-model-led.test.js、ai/PDF_EXTERNAL_V2_MODEL_LED_PLAN_2026-10-14.md、ai/PDF_MODEL_LED_AB_IMPLEMENTATION_2026-10-14.md、本任务及 ai/PDF_QWEN37_SELECTED_2026-10-14.md，新证据目录 local-run-artifacts/pdf-qwen37-selected-2026-10-14/。

保留所有 dirty 改动和既有证据。不修改 app.js、UI、DOCX、生产数据、凭据或依赖；不启用生产识别、不调用 AI/OCR、不 commit/push。后续真实验收须按既定模型进行，不能以需要重新选模型为由搁置。

验证：明确选择才允许使用同一传输端口复核；识别/复核必须是两个独立请求；缺少显式配置仍报未配置。运行相关离线测试与 verify:safe，核对增量范围。
