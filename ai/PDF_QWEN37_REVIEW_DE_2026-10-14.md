# 千问 3.7 Flash 审核与跨窗口接入报告

日期：2026-10-14。完成本轮 D/E 软件范围，固定模型 qwen3.7-flash-2026-07-15。没有真实 AI/OCR 调用，没有更改生产数据或默认启用；C 困难页质量试验及 F 独立整卷验收仍未完成，不能宣称整份通用方案已验收。

## 修改与原因

- qisi-pdf-external-contract.js 提供纯审核视图：原页、完整候选、模型逐项复核、源异常、遗漏和补页请求。按明确 item_id 和来源页引用证据，不用题意推测关联；投影不修改原始响应。模型对原候选的结论不等于老师确认当前字段。
- main.html/app.css 展示原页和候选两列、完整公式及图片引用、原 PDF 打开按钮。新 v2.2 候选可人工采用；历史 PDF 与 DOCX 保持既有审核路径。任务级遗漏/补页意见不会伪装成单题归属。
- qisi-normal-ui-import-controller.js 在读取任务前取得按 batchId 命名的 Web Lock，持续至识别、账目/草稿持久化与最终读回完成。第二窗口立即显示拒绝原因；锁释放后才可重新读取。这样解决的是整段旧快照写回竞争，而非只保护模型请求。Web Locks 的 ifAvailable 语义由 [W3C Web Locks 规范](https://www.w3.org/TR/web-locks/)定义。浏览器管理锁的释放，不新增数据库租约/心跳或 schema。
- qisi-config.js/qisi-pdf-external-producer.js 为 PDF 路线要求浏览器 Web Locks 能力；不具备能力时在外部请求前拒绝执行。Node/mock 保持可注入测试端口。该保护针对同一浏览器配置、同源页面的正常入口，不声称覆盖不同机器或绕过入口的调用。
- app.js 仅装配审核 computed/export、失败提示、未保存编辑保护，以及已采用字段的既有编辑器基准同步。没有加入分题、数学、答案归属或并发业务算法。

## 完整人工采用流程暴露的通用缺陷

软件生成的“需要人工核对”说明原来写入 warnings，导致老师采用全部字段后仍被永久阻止确认。现在该说明保存在 reviewNotice；模型/原文的实际 issues 和警告保留，不放宽正式审核规则。

非选择题采用候选时，空 options 原来被标成 manual，违反已有“缺失字段保持 missing”的规则。现在空值/空数组保留 missing，实际采用的非空字段才记录 manual；不改 FormalAdmissionPolicy。

已采用候选保存后，原编辑基准未同步，界面错误地判断为未保存修改。现在调用已有 ReviewDraftState 同步方法。存在真正未保存编辑时禁止覆盖；模型复核通过、全部字段已采用仍不能代替人工确认。

这些修改按信息与状态的职责处理，没有深圳题号、特殊词语或数学修补规则。

## 验证

`npm.cmd run verify:safe` 退出码 0：主测试 1733/1733、DOCX 稳定链 8/8、PDF 已知坏例 62/62、批量 mock 8/8；no-real-ai 检查通过。app-shell guard 通过。

本轮聚焦合同/状态测试 64/64，通过纯投影不改原文、字段/任务意见范围、模型与人工状态分离、空可选字段证据和锁覆盖最终读回。浏览器测试 5/5：三个历史场景、新 v2.2 完整采用/确认/刷新/缓存、真实双页面 Web Locks 互斥。浏览器与数据库均为隔离测试环境。

九个受保护 app.js handler 的 AST hash 完全不变；总 AST 节点 27838→27901、函数 585→586。责任矩阵仅更新实际预算及行号。原有工作树和证据按阶段基线做 SHA256 核对，结果见本轮 scope-proof.json；不清理混合历史改动，不 commit/push。

证据：local-run-artifacts/pdf-qwen37-review-de-2026-10-14/ 下的 focused-final.log、browser-final-4.log、verify-safe.log、app-ast-proof.json、scope-proof.json、review-panel-final.png。截图已目视检查原页/候选两列和人工状态；mock 只证明软件流程，不证明模型识别质量。

## 下一项已准备工作

真实困难页试验清单：ai/CODEX_TASK_PDF_QWEN37_PILOT_2026-10-14.md。原深圳 PDF 哈希复核一致；第 14 页只作上下文，15—21 页为输出范围。实际请求预览与提示/schema/页图哈希已离线生成，网络调用为 0。

拟使用同一固定千问模型执行一次识别、一次独立原页复核，最多 2 次请求/16 次页图出现，已知费用加未知预留上限 0.5 元；无效响应或受理未知即停止，不自动重试、整卷或换模型。真实付费预算尚待本次明确授权，旧未知记录及旧预算不被清零或复用。
