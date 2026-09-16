# Astra 连续工作交接（持续更新）

更新时间：2026-09-16。**当前任务尚未完成，本文不是验收通过证明。**

## 最新接手入口（优先于下方早期快照）

PDF 模块已经接入 `app.js` 和 `main.html`，不是下方所说“待接入”。
详见 `PDF_INSPECTION_STAGE_2026_09_16.md`。`verify:safe` 第二轮和
`verify:batch-safety` 已通过，7 个新增定向测试通过。只有合成服务回应和阻断的请求，
没有真实付费 API 调用。纯文本实际 PDF 字节直接产草稿；复杂页失败进入可看原图的 review。
缓存命中、无假题、跨页保守隔离和未知题号拒绝均有测试。

最新 DOCX 矩阵：`artifacts/audit-baseline/astra-docx-final-matrix.log`，G2–G11 已完成，
均 review、零 AI 请求。**不等同于逐题视觉通过。**
独立查看 G2 原件和真实输出发现：第 8、11 题图像 token 在题号前，
`qisi-utils.js:splitFlatTextIntoQuestionBlocks` 的 marker 包含 token，但 contentStart 从
marker 后开始，因此 token 被丢弃。提取文本有原 token，草稿没有。下一步优先修这个明确 bug，
保留“同一行题号前”的图片，勿把前一题单独一行的图片猜挂到下一题。
G2 第 4 题是完整合成 PNG（`rId46-image22.png`），其透明底黑线在深色查看器上不明显，
不能据此判为原生矢量图丢失；先前怀疑已被 XML 证据推翻。

最新额度读取失败，不能把上一次 75% 当作当前值。接近额度时优先更新本节、核对 Git 状态，
明确未完成工作，不宣称全部验收完毕。

## 用户授权与目标

用户要求完整阅读外部交接文档，独立审计当前 HEAD，连续推进 DOCX + PDF 的审核、
验证、修复、优化和真实材料验收，不需要逐阶段询问。禁止自行 merge main、删除真实数据、
不可逆迁移或产生未授权付费 API 费用。另要求在额度接近耗尽时留下完整交接。

外部交接：`D:/Backup/Downloads/qisi_math_pro_astra_handoff_docx_pdf_2026-09-16.md`。
仓库：`E:/备份/题库系统`。分支：`codex/integration-main-hardening`。
`ai/CODEX_TASK.local.md` 还是旧 C8A，不代表本次授权范围。
本轮范围与计划见 `INGESTION_AUDIT_PLAN_2026_09_16.md`。

## Git 与已完成工作

- 起点和已拉取远端 integration：`4ced38ec11468e875a2fb93efe7be4eb18ffe59d`。
- main 基线：`b15e6fbe24c525c95a573b51a0c7ab68e77f4790`，未修改。
- DOCX 第一阶段已提交：`20bd59b`，尚未 push。
- 初始已有未跟踪 `artifacts/`，必须保留，不能 add 整个目录。
- 本轮新增所有真实文件结果和探针也放在 `artifacts/audit-baseline/`。

`20bd59b` 内容：

1. 新增 `qisi-ingestion-context.js`：按导入文件对象缓存 pending extraction，ZIP/XML/关系/OLE
   共享；记录阶段开始、结束、耗时、输入输出数和错误码；超时工具支持取消。
2. 新增 `qisi-docx-ingestion.js`：用既有 app 中 MTEF-aware 读取与本地切题/支持解析器，
   不另造一个 DOCX 解析器；按证明的题号过滤支持内容，冲突答案保留证据而不选较长值。
3. `app.js` 普通 DOCX 分支直接调用模块，移除约 700 行转换/视觉优先及重复兜底编排。
   普通 DOCX 不再发模型请求，不依赖本地转 PDF。可选转换请求增加有界等待。
4. 移除主流程按数组顺序及 AI index 自动补答案的调用。旧函数定义尚在，但不再被调用。
5. `qisi-docx-numbering.js` 读取 `numbering.xml` 的已证明单层 decimal 编号，恢复“高二”
   前五题的 Word 自动编号；不按段落位置猜题号。不支持的编号类型保留 unresolved evidence。
6. MathType script template 27/28/29 原把 sub slot 当 base，造成 `C{A}_{}B` 等错位。
   改成脚本附着于前一字符；修正 nth-root 的 radicand/index 槽位方向。
7. importer 入口也消费共享 context 和 MTEF expansion，OLE `.bin` 不再当图片编码。
8. 非浏览器可显示的 WMF/EMF 图形保留 `[[IMAGE_UNRESOLVED:rid]]`，在持久化前标记
   对应字段 rejected / withheld，避免静默丢图。原始材料未改。
9. seal 测试原同时比较 HEAD blob 与工作区 sha，修改后无法在提交前验证。
   现在校验实际工作文件的 Git blob + normalized sha 对准确登记值，未登记文件仍对照原 seal。
   没有提高 app.js 行数上限，没有削弱已知坏例断言。

## 已验证与推翻的假设

- “DOCX 仍 convert/vision-first”：源码确认，已改主入口并加真实浏览器 no-conversion/no-AI 断言。
  新断言在旧实现失败（观测到 conversion request），新实现通过。
- “周二晚测卡住 240 秒”：本轮未复现。接受确认弹窗后旧 HEAD 约 17 秒完成 12 题。
  更早探针没有消费 confirm 弹窗。新实现约 2.5 秒完成 12 题。
- “长数字是内部 ID”：后续仓库记录与源码表明旧 XML 元素匹配边界错误；不要再粗暴删长数字。
- “高二漏前五题”：是 Word 自动编号未展开，已从编号定义恢复到 56 题。
- “高二答案 49 重复”：原件确实存在两个 49，不得猜前一个是 48；冲突留空，保存两值证据。
- “三个 PDF 几乎无文本层”：本轮 pdf.js 实测推翻。每页约 850–1250 字符，但 Symbol/数学
  字体有 PUA 字符且公式上下标/分数处于二维布局。应归为 mixed，不是纯扫描，也不能把乱序
  平铺文本当可靠数学公式。精确结果在 `astra-pdf-inspection.json`。

## 测试状态

- 起点 `verify:safe`：1349 测试 + 20 smoke，零失败。
- DOCX 阶段最终 `verify:safe`：通过，日志 `astra-docx-verify2.log`。
- `verify:batch-safety`：通过，日志 `astra-docx-batch-safety.log`。
- 第一次修改曾错误把卷首答题栏“答案”当正文后答案章节，导致周二只剩 1 题。
  已修复为必须前面已有真实题号；回归 `docx-ingestion.test.js` 与
  `e2e/docx-question-scope.test.js` 均锁定该边界。不要使用第一次失败日志当最终结果。

## 本轮真实材料证据（阶段性，不等于全部视觉验收）

来源目录 `C:/Users/Administrator/Desktop/题目与答案`，13 DOCX + 3 PDF。
测试使用 `tests/e2e/browser-harness.js` 的独立 browser context，拦截所有 AI 端点和非缓存外网。
没有访问教师实际浏览器数据库，没有付费请求成功。

- G1：简略版题目 + 完整版答案，6 题；答案 B/空/B/C/D/C；q2 solution 保留；约 2.6 秒。
- G2：完整版题目 + 完整版答案，12 题。
- G3：题目 + 答案，14 题（标题为 2026年7月9日高中数学作业）。
- G4：周二晚测，12 题；约 2.5 秒；一次 unzip。
- G5：高二 full，56 题；约 4.6 秒；一次 unzip；答案 48 缺失、49 冲突。
- G6：题目+答案 full，14 题。
- G7–G11：五份省市试卷，均进入 review、各 19 题；仍有 unresolved formula/image 和缺答案。

文件 `docx-batch-astra-G*.json` 中有精确结果、字段、warnings、withheld、计时和 zipLoads。
部分结果在最后图片/章节修复前生成，**最终验收必须统一再跑一遍**。
G1 原件第一页已亲自看过：q3 D=-1 正确；q6 D=1:27 在当前 MTEF 已能恢复（旧交接说不能恢复
已过时）；q1 补集下标揭示并促成 script template 修复。图形和所有解析页面还需继续逐题对照。

## 正在写、尚未接入/验证的 PDF 工作

以下新文件当前未提交，不能声称产品已采用：

- `qisi-pdf-inspection.js`：pdf.js 文本项 + geometry + operator list 检查；text/mixed/scanned
  分类；线分组；页内显式题号/支持 anchor；跨页分块；重复/回跳阻断；资源释放与超时。
- `qisi-pdf-ingestion.js`：待接入的 deterministic-first 编排草稿；纯文本候选直接解析；
  混合页先保留 anchor 和可验证答案字母；受题号契约约束的可选视觉；单次页面请求、hash
  缓存、像素预算、失败可复核证据。**仍需认真审阅和测试，尤其 support solutions 尚未闭环。**

下一步：
1. 把 PDF 模块接入 `processDraftImportBatch` 的 PDF 文件分支，minimal glue。
2. 让需要视觉但服务被阻断的页面带清楚原因进入 review/withheld；零题时保留页面与覆盖报告，
   不造假题，不把局部失败整批归零。UI 要能看到原因和源页面。
3. 单/双 PDF 共用模块；答案/解析仍须 sequence/controlled-write，不能裸信 AI question。
4. 补 synthetic text/mixed/scanned、跨页、重复/未知号、缓存、超时、传输分类回归和真实 UI 验证。
5. 视觉真实验收若需要收费，先完成所有不付费工作并给出具体页数、模型、调用与成本计划，
   请求用户授权；不要因为 key 配置存在就视为授权。
6. 渲染原件并逐题对照所有 DOCX/PDF，记录真正的 WRONG MATCH/WRONG CONTENT，不伪称全绿。
7. 最终门禁、限定文件提交、push integration；main 不动。

## 可复用命令与环境

- `npm.cmd run verify:safe`、`npm.cmd run verify:batch-safety`。
- `node artifacts/audit-baseline/astra-docx-acceptance.cjs --id <id> --question <path> --support <path>`；
  combined 用 `--full`。该版接受 dialogs，统计 unzip，保存本地提取文本。
- `node artifacts/audit-baseline/astra-run-docx-matrix.cjs`：G2–G11。G1 单独跑。
- `node artifacts/audit-baseline/astra-inspect-pdf.cjs`：3 PDF 的独立 inspection。
- `render-docx-page.js`：LibreOffice 独立 profile 转原件，然后 pdf.js 出 PNG；
  `rendered-g1/`、`rendered-g2/`、`rendered-all/` 已有部分原件 PDF/PNG 可复用。
- shell 的 `python` 指向不可用 WindowsApps。bundled Python 在
  `C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`，
  但没有 fitz；可以直接复用浏览器 pdf.js 渲染。无需安装新依赖。
- git fetch 首次 TLS 失败、第二次成功；Git 写 `.git` 需工具 sandbox escalation。
- `astra-update-seal.cjs` 更新当前 app blob/hash，但每次会追加 reason，最终报告整理时去重。

最近额度检查：五小时剩余约 75%，本周剩余约 49%。该值是账户共享额度，不是本任务预算。
