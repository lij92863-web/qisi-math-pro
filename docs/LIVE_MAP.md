# 当前普通界面主链路（2026-10-20）
1. main.html → app.js.createDraftImportBatch → NormalUiImportController → ProductionImportBridge。
2. DOCX 默认 docx-deterministic → ProductionDocxSourcePort → DocxImportCoordinator / BatchImporter。
3. PDF 默认 PdfMineruProducer → 本地 MinerU 路由/任务服务 → 块证据与 PaperSegmenter。
4. 路径对应 contract / 校验 → 输出投影 → ReviewDraftBuilder → DraftPersistenceService → 回读审核。
5. ReviewController / ReviewWorkflowService → 人工确认 → BatchFormalSubmit / FormalAdmissionPolicy。
6. StorageRepository.confirmDraftToQuestion 完成受约束正式写入；候选显示不等于获准绑定或入库。
7. Backup / BackupWorkspace 提供完整备份、恢复预览、恢复前备份；只在隔离环境做破坏性演练。
8. 链路证据见 ai/STAGE0_BASELINE_2026-10-20.md；离线质量边界见 golden/README.md。
