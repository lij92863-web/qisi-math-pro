# Repository Asset Inventory R2

## Counts and workspace state

- Tracked: 454
- Untracked at audit: 0
- Ignored entries: 716
  - node_modules: 706
  - local-test-materials: 4
  - local-run-artifacts: 2
  - plus ignored local configuration/evidence entries
- Tracked files larger than 5 MB / 20 MB / 100 MB: 0 / 0 / 0
- Tracked names matching log/tmp/bak/old/orig/rej/recovery/debug/scan/result/dump: none

## Classification

| Class | Assets | Policy |
|---|---|---|
| A production runtime | root `qisi-*.js`, `app.js`, `main.html`, `app.css`, server/startup files | retain; production gate required |
| B tests and gates | `tests/`, mandatory runner and verify scripts | retain; deletion is prohibited without audit |
| C engineering tooling | `scripts/`, `tools/`, `skills/` | retain; do not classify by filename alone |
| D active architecture docs | `ai/`, new `docs/architecture/` and active handoffs | index and maintain |
| E historical audit evidence | `docs/refactor/`, `docs/testing/`, existing release reports | retain or archive with status; do not bulk-delete |
| F private local materials | ignored `local-test-materials/`, `.env`, local-run-artifacts | never commit |
| G removable temporary artifacts | none proven among tracked files in Phase 0.5 | deletion requires a separate audited list |
| H manual confirmation | root `1.docx`, `test.pdf`, `page-1.png` | tracked baseline binaries; provenance must be confirmed before removal or publication decisions |

## Largest 50 tracked files

| Bytes | Path |
|---:|---|
| 1139252 | `app.js` |
| 359276 | `page-1.png` |
| 291728 | `test.pdf` |
| 187332 | `1.docx` |
| 129622 | `main.html` |
| 90357 | `scripts/pdf-master-browser-runner.js` |
| 76942 | `app.css` |
| 71713 | `qisi-batch-importer.js` |
| 59099 | `qisi-batch-engine-v2.js` |
| 51817 | `tests/support-parser.test.js` |
| 49961 | `tests/qisi-app-display-cleaners-fixtures.test.js` |
| 47155 | `tests/batch-smoke-mock.test.js` |
| 46836 | `qisi-support-parser.js` |
| 46311 | `tests/pdf-support-controlled-write-answer-ownership.test.js` |
| 45096 | `CODEX_TASK_2_AGENT_CONSTITUTION_AND_SKILLS.md` |
| 41793 | `qisi-utils.js` |
| 40028 | `package-lock.json` |
| 35766 | `qisi-pdf-support-block-parser.js` |
| 35321 | `qisi-pdf-support-controlled-write.js` |
| 31766 | `qisi-components.js` |
| 30276 | `tests/fixtures/pdf-real-case-minimal.js` |
| 28431 | `ai/AUTOMATION_STAGE_ROADMAP.md` |
| 28292 | `tests/pdf-master-browser-runner.test.js` |
| 27578 | `docs/testing/P8_0_REPOSITORY_ONBOARDING_REPORT.md` |
| 26567 | `tests/pdf-real-case.test.js` |
| 26027 | `qisi-docx-pipeline.js` |
| 25095 | `tests/pdf-support-aligner.test.js` |
| 22610 | `tests/pdf-support-block-parser.test.js` |
| 22194 | `tests/pdf-answer-path-trace.test.js` |
| 22178 | `docs/refactor/BM_AUTO_CHAIN_A_A4_RISK_MATRIX.md` |
| 22057 | `docs/refactor/BM_AUTO_CHAIN_A_A4_CALLSITE_MAP.md` |
| 20333 | `qisi-local-server.js` |
| 20034 | `tests/support-repair.test.js` |
| 18289 | `qisi-support-repair.js` |
| 17978 | `qisi-pdf-support-aligner.js` |
| 17446 | `tests/pdf-answer-extraction-quality.test.js` |
| 17136 | `qisi-review-draft-state.js` |
| 15884 | `qisi-db.js` |
| 15015 | `tests/base-migration-execution-gate.test.js` |
| 13435 | `docs/refactor/BM_AUTO_A4_R3_SHARD_PLAN.md` |
| 13425 | `docs/testing/PDF_SUPPORT_PARSER_MARKER_COVERAGE_REPORT.md` |
| 13397 | `tests/qisi-app-display-cleaners-doc-audit.test.js` |
| 13302 | `docs/refactor/BM_AUTO_CHAIN_A_MANUAL_AUDIT_MAP.md` |
| 12989 | `qisi-pdf-answer-only-extraction.js` |
| 12923 | `scripts/bm-a4-doc-audit.js` |
| 12897 | `tests/pdf-answer-only-ai-pass.test.js` |
| 12254 | `docs/refactor/BM_AUTO_A4_R3_OWNERSHIP_AUDIT.md` |
| 11239 | `qisi-backup.js` |
| 10656 | `docs/refactor/BM_AUTO_A4_R3_RESIDUAL_FREEZE_FINAL.md` |
| 10437 | `docs/testing/PDF_SUPPORT_P8A_ANSWER_REJECTION_AUDIT.md` |

## qisi module sizes

| Module | Lines | Bytes |
|---|---:|---:|
| `qisi-support-parser.js` | 1652 | 46836 |
| `qisi-batch-engine-v2.js` | 1427 | 59099 |
| `qisi-pdf-support-block-parser.js` | 1091 | 35766 |
| `qisi-utils.js` | 1015 | 41793 |
| `qisi-batch-importer.js` | 992 | 71713 |
| `qisi-pdf-support-controlled-write.js` | 958 | 35321 |
| `qisi-local-server.js` | 693 | 20333 |
| `qisi-support-repair.js` | 689 | 18289 |
| `qisi-docx-pipeline.js` | 661 | 26027 |
| `qisi-components.js` | 642 | 31766 |
| `qisi-pdf-support-aligner.js` | 548 | 17978 |
| `qisi-review-draft-state.js` | 420 | 17136 |
| `qisi-pdf-answer-only-extraction.js` | 380 | 12989 |
| `qisi-backup.js` | 371 | 11239 |
| `qisi-pdf-answer-extraction-quality.js` | 297 | 9441 |
| `qisi-db.js` | 202 | 15884 |
| `qisi-runtime.js` | 148 | 3995 |
| `qisi-config.js` | 140 | 6420 |
| `qisi-ui-events.js` | 78 | 2502 |
| `qisi-pdf-safe-partial-pipeline.js` | 76 | 4151 |
| `qisi-app-facade.js` | 68 | 1818 |
| `qisi-file-dispatcher.js` | 67 | 3141 |
| `qisi-batch-orchestrator.js` | 19 | 988 |
| `qisi-review-view-model.js` | 15 | 727 |
| `qisi-storage-facade.js` | 1 | 512 |
| `qisi-ui-renderer.js` | 1 | 420 |

## Cleanup conclusion

No tracked file is deleted in Phase 0.5. In particular, tests/scripts/skills/tools are protected regardless of words such as scan, result, or report in their contents. The three root binary files are not assumed private or disposable; they remain class H pending provenance review.
