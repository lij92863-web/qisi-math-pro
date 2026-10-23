# L3 诊断与历史迁移入口（审计修复后更新 2026-10-23）

默认启动不会写入迁移，普通页面不自动调用这些兼容入口。未在生产库运行诊断或迁移。

| 入口 | 实际消费者 | 当前行为 |
|---|---|---|
| window.auditQuestionLatexData | 显式控制台兼容调用 → app 薄别名 → LibraryService.createQuestionMaintenance.audit | Repository 只读 questions/images，检查 tokenize/KaTeX/图引用/内部 token；返回并报告问题，零写入。 |
| window.migrateSafeQuestionLatexData | 显式控制台兼容调用 → maintenance.migrate → 原 LibraryService 方法 | 仍用既有精确清理规则与 expectedUpdatedAt 校验，成功仅刷新题库域；重复并发不重复派发。 |
| LibraryService.migrateQuestions | 固定迁移方法与合成测试 | 逐题更新；失败提供 migrationProgress.changedCount/failedQuestionId，先前成功记录仍在，未完成行保持；不自动重试。 |
| app.downloadQuestionMetadataBackup | window 同名兼容入口 | 只读元数据 JSON；与显式 Latex 修复分开，不自动执行。 |
| window.runStage0SafetyCheck / exportFullQisiBackup | 显式控制台入口 | 只读诊断 / 原完整备份；不被解释成生产迁移许可。 |

部分迁移已写入后只读刷新失败，会准确报告已完成数量与刷新问题，不伪称整次回滚。诊断入口不运行迁移。新 owner 没有扩大数学修复范围或数据库 schema。

证据：qisi-question-maintenance 单测、真实 question-maintenance-entrypoints 测试（启动零迁移、诊断 11 表一致、显式迁移幂等），L3-verify-safe-resumed.log 2416/2416、exit 0。第一次会话中断的无 exit 日志留存，不计通过。后续完整门禁继续覆盖。

静态门禁保护 app→maintenance→LibraryService→Repository 完整边，禁止直接正式写入没有放宽。该记录为实施者自检，生产库未做实际迁移。
