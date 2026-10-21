# 连续推进：验证阻断修复、离线评测与隔离恢复

## 2026-10-21：用户要求先交接，停止代码实施（当前唯一范围）

最新用户明确要求：不再写代码，先详细交接，再由 Astra 慢慢规划；交接必须包含个人13条要求、已做、失误、未做、风险和证据。此前“持续推进直到额度用完”不能覆盖这次收缩范围。允许修改本任务索引、ai/CODEX_TASK.local.md、ai/CONTINUOUS_BASELINE_RESULT_2026-10-20.md、docs/BASELINE_STATUS.md，新增 ai/HANDOFF_FOR_ASTRA_2026-10-21.md；其他业务、页面、架构登记、测试、工具、依赖、原材料、人工记录和生产数据只读。交接检查日志仅写新的 local-run-artifacts/golden-baseline/20261021-handoff 目录。

下节打印拆分仅是未实施候选，已被本范围取代，不能当接手者自动实施的授权。实际 app.js、qisi-handout-html.js、main.html 均与候选准备前相同，只有任务文字和只读快照准备。不得进入模块拆分、旧链删除或新功能阶段。保留既有脏工作区及暂存区，不提交、不清理。文档完成后运行 verify:safe，检查本轮仅文档改动、原暂存和保护材料哈希不变；若失败如实记录，不借机改业务。交接完成即停止实施。

## 2026-10-21：打印文档字符串从app.js等价搬移

> 状态：候选准备，未实施；已由上节交接范围取代。以下保留当时设想，不能视为确定顺序或当前任务。

入边清单与2191完整门禁、1491文件源码恢复/109与113项保护完成。新初始1493源码/116项保护及原暂存区保持。按原任务单的有界模块拆分，复用既有qisi-handout-html.js，不另造重复渲染器。app.js必须触及的唯一业务区域为PRINT_FONT_STACKS/PRINT_FONT_SIZES与openPrintWindow的html模板：模板/字体移至已有模块，原函数只传显式config/baseUrl/escape回调并保留原Blob、链接打开与回收逻辑；仅添加模块而不改调用不能接入真实打印或减少app.js。禁止改任何解析、绑定、准入、试卷分组/内容生成或数据写入，不新增算法，不顺手修CSS或设置校验。

允许app.js上述窄区域、qisi-handout-html.js追加buildPrintWindowDocument纯字符串API及字体映射（旧buildHtml/escapeHtml不变）、main.html单次加载、本模块在architecture/owners.json、architecture/layers.json、architecture/runtime-modules.json、docs/architecture/owners.json和layers.json的精确登记。已有责任矩阵仅在确需时允许行号范围同步且旧函数AST hash/调用白名单/预算不变；不得松门禁。其他业务/模板区域、旧测试、旧标签、依赖、秘密、原材料、人工记录及生产数据只读。

先按2191版app实际AST冻结openPrintWindow、字体及转义函数到tests/fixtures/print-window-before.json，标原SHA；新增tests/print-window-document-equivalence.test.js，以隔离假Blob/DOM/计时器执行冻结旧窗口函数，覆盖多配置、题答HTML、标题转义/默认值、HTTP/file基址等的逐字HTML与窗口副作用等价；新API未实现先红。字符串中打印页自己的就绪脚本保持原字节，不在Node执行DOM。模板仅把旧隐式window.location.href替换显式baseUrl，其他表达式、空白、字体与已有坏图状态规则保持。旧Html API体源码归一化hash保持，新增函数零DOM/网络/存储访问。

要求真实DOCX及单/双PDF已有打印预览、实际分页、坏图状态回归全部保持，main仅加载一次且在app前、Node/浏览器导出与架构门禁通过；再完整safe/batch、固定6场景和1493源码/116项保护/原暂存区检查。任务/结果及docs/BASELINE_STATUS.md可记录，脚本/截图/证明放local-run-artifacts/golden-baseline/20261021-print-document-extraction。通过后允许新源码恢复点，沿用原秘密/依赖/真实材料/生产数据排除与独立安装未验收边界。无提交、真实识别、生产数据或用户服务重启。

## 2026-10-21：历史代码入边清单，暂不删除

两份Word只读观察、2180完整门禁、固定6场景和1491源码/105项保护完成。新阶段初始1491源码/109项保护及原暂存区保持。按原任务单先建立文件引用报告；既有architecture/runtime-modules.json和verify-runtime-modules只作声明/验证来源，不重复改登记。允许tools/inventory.cjs、tests/inventory.test.js、本任务/结果、docs/BASELINE_STATUS.md、docs/RUNBOOK.md；其他业务源、模板、架构清单、旧测试、依赖、秘密、上传材料、备份/历史包及生产数据只读。

工具只读取根目录源码/入口与tests、scripts、tools内JS/CJS/MJS，跳过vendor、node_modules、运行证据、tmp、deliverables、隐藏配置及符号链接；只用既有Acorn解析，不执行被扫描代码或联网。建立HTML脚本/静态require-import/保守文件名字符串引用边，区分生产入口、诊断入口、声明角色，输出live/dormant/dead-candidate/uncertain及每条来源/类型；无可达引用不等于可安全删除。解析失败、动态加载、声明生产但缺静态路径时明确存疑，不用静态结果自动删文件。未被使用的引用环需按可达性处理，不能因为彼此引用就算生产在用。

平台登记browser/node不等于生产入口；缺静态生产路径只记入口需人工复核，不据此宣称登记错误。实际扫描发现有效CommonJS的顶层return被脚本语法误报，补独立红例后允许按scripts/tests/tools、.cjs或node登记使用CommonJS解析条件，非法.mjs顶层return仍报解析存疑；原初版报告保留。

CLI只向新的忽略报告路径输出机器JSON/人工Markdown；源码/秘密内容不进入报告，只列路径、hash、计数和引用位置，不遍历配置/生产数据库。报告明确deletionAuthorized=false与模型限制。单测覆盖生产/诊断/无根环、缓存参数和相对路径、动态加载/解析失败保守处理、只读不执行、输出不覆盖与范围保护，先红例再实现。完成后实际仓库报告、verify:safe/batch、固定6场景及1491源码/109项保护/暂存区检查；无tag/删除/安装/真实AI/OCR/服务重启/提交。若清理需另列确切文件和保护证据，不直接按候选删除。

全部门禁通过后允许生成当前源码恢复点，在新目录逐文件解包核验；沿用原材料/秘密/依赖/生产数据排除，另外保护actual-final/report.json及collection-link-proof.json。日志来自本阶段活动源码，不声称解包后独立安装或全环境复现；归档后不回填该版本源码。

## 2026-10-21：深圳/河北同卷Word格式只读观察

2180完整门禁、固定6场景计数保持及1489源码文件恢复/97与100项保护通过。初始1491源码与105项保护核验，继续保留原暂存区。只读Desktop/题目与答案下深圳DOCX（e66c87064eda0c6678c5fce0b211cb7a5063a337db76d5b26f8a084e8ccc9cd9）及河北DOCX（23445a879af85d8f69a3e84694d7aa3f6bf0a50d05ac7c636fa613ba2750fd70），分别显式full角色、新端口/上下文普通确定性DOCX导入；网络与AI/OCR全部阻断，不采纳、确认或提交真实题。

允许本任务/结果和docs/BASELINE_STATUS.md记录实际观察，其余源码/测试/依赖/标签/人工记录/真实源全部只读。独立脚本、来源哈希、原始XML/rId图字节、草稿字段/凭证、图片token字段与DOM解码、刷新一致和失败原样保存到local-run-artifacts/golden-baseline/20261021-docx-variants；可使用既有只读导航记录器。图片字段检查须同时识别精确IMAGE/FORMULA_IMAGE令牌，不能因观察器漏识别制造缺陷。不同格式的同卷不算新独立人工样本，不将PDF结果当Word金标准；真实错挂数/内容正确率仍未知。若发现明确新缺陷，保留证据后再登记责任文件与合成红例，不借观察扩大业务修改或弱化准入。

完成后运行safe/batch、原6场景比较及1491源码/105项保护/原暂存区检查；可创建同排除规则的full-source恢复点，但不复制生产题库或声称独立安装。历史导航故障继续未归因，不覆盖旧失败报告，无Git提交或用户服务重启。

## 2026-10-21：离线自动答案计数闭合

2171完整门禁及备份阶段1488文件恢复/91与94项保护通过。新初始1490源码/97项保护，原暂存区保持。只核对离线评测：当前重复题号的自动答案进入automaticAnswers分母，却因无法选定唯一草稿而既不计正确、错误，也不计未判定；另有身份错/来源错但参考答案未标注时的重复计数风险，以及显式扣留却自动接受时被计正确。先独立合成红例，不根据真实生产输出反写expected。

允许scripts/golden/metrics.cjs仅自动答案的互斥计数/诊断：正确、已知错误、未判定三类加总必须等于自动答案总数；预期题号内重复身份的答案记未判定并单列ambiguousAutomaticAnswers，未判定存在时precision为null；错身份/错来源或违背显式withhold答案的自动接受记已知错误，不能又计正确或未判定。未知题号继续记错，不因为重复而降低错误数。不改变candidate指标、题号规范、标签、标注来源、自动绑定算法或任何运行业务。

重复组也先保留可独立证明的错误（显式扣留、错身份/来源/已标注答案值），仅剩余无法选唯一身份的记录计未判定；不因重复把已知错误洗成未知。增加重复组扣留及已知错误与未知并存的反例。此为离线计数归类，不选择或采纳重复组中的任一候选。

允许新tests/golden-automatic-accounting.test.js、golden/README.md、本任务/结果及docs/BASELINE_STATUS.md；生产源/共享harness/原测试与expected/依赖/真实材料/人工字段全部只读。证据放local-run-artifacts/golden-baseline/20261021-automatic-accounting，要求独立红绿反例及混合分母恒等式、旧指标测试、固定6场景同SHA计数保持、完整safe/batch、1490源码/97项及原暂存区范围检查。无真实AI/OCR或生产数据库写入，无Git提交。通过后允许同排除规则下full-source恢复点，未知质量仍保留null，导航旧问题仍未归因。

## 2026-10-21：完整备份下载后的状态记录失败

额外允许tests/backup-download-status.test.js验证新catch边界：备份读取/校验/下载原错误身份保持且不得写成功状态，仅两条非关键记录写入异常可警告返回；使用内存合成端口，不替换业务方法或修改旧断言。

打印修复版2164完整门禁、固定6场景/9题前后指标、1486源码文件恢复及85/88项保护均已通过。新阶段初始1488源码/91项保护和原暂存区保持。用户关心原功能保护，继续只查既有备份错误状态，不扩新功能。先允许tests/e2e/backup-download-status-failure.test.js及本任务/结果、docs/BASELINE_STATUS.md/RUNBOOK.md；证据放local-run-artifacts/golden-baseline/20261021-backup-download-status。新端口/浏览器通过固定合成PDF普通UI生成带图片及待审核邻题的隔离测试库，明确审核提交一题。只在本上下文将两个qisi_last_full_backup_*键之一的Storage.setItem抛一次QuotaExceededError，其他原生存储/下载/归档逻辑不替换。

若实际下载包可完整读取且11表/二进制不变，却因状态记录异常显示整次失败，允许qisi-backup.js仅exportFullDatabaseBackup中两条状态写入增加非致命try/catch警告；原create/verify/download异常必须继续抛出，原返回manifest、下载路径、文件/表内容、安全策略、恢复和workspace逻辑不变。不得吞掉备份创建/验证/下载错误或制造未保存的备份成功；界面仍只声称发起下载、要求用户确认文件保存。先红例，两个键分别故障及下一次明确点击/当前数据不变检查，再完整safe/batch与原六场景比较、1488源码/91项保护/原暂存区核验。无AI/OCR、生产数据、真实材料、用户服务重启或提交。通过后允许新full-source恢复点，沿用原排除规则与日志适用边界。

## 2026-10-21：打印预览图片失败状态

上一阶段2162完整门禁、1485源码文件隔离恢复及原暂存区/82项保护已通过。当前初始1487源码/85项保护，按用户连续推进指令检查openPrintWindow图片onerror后仍启用“渲染已就绪”的状态。先允许新tests/e2e/print-image-readiness.test.js及本任务/结果、docs/BASELINE_STATUS.md/RUNBOOK.md；新端口、全新浏览器与合成DOCX，只在隔离测试库明确审核提交。损坏GIF为独立构造输入，不改旧fixture/expected或数据库内容，不请求真实AI/OCR。

若普通导入/审核/组卷真实红例证明损坏图仍显示就绪，允许app.js仅openPrintWindow现有内联脚本中btn.disabled、btn.textContent两条UI赋值变更：读取img.naturalWidth及现有missing-image提示决定保持禁用和显示修复提示。该脚本是独立Blob文档的一部分，页面模块不会被其继承；两条现有UI状态表达式不足以值得新增业务模块/脚本加载。保持行数、其他脚本、打印内容、图片字节、审核/准入和架构登记不变；不新增业务算法，不自动重试/删除坏图/替换原文。正常图及无图旧用例继续启用并可显式调用打印，损坏图不谎报就绪；只约束应用按钮，不能宣称阻断浏览器菜单打印或认证内容质量。

红绿专项→完整safe/batch及固定6场景比较→1487源码/85项保护/原暂存区范围检查；证据放local-run-artifacts/golden-baseline/20261021-print-image-readiness。发现故障被更早正式验证拒绝则只记录，不绕过验证制造红例；不扩大到字体/分页/解析/绑定/依赖/真实材料或正式数据，无提交。

全部门禁及完整性通过后，允许本阶段full-source生成新源码恢复点并在新目录逐文件验证；同前阶段排除真实材料/秘密/依赖/生产数据，门禁日志明确来自活动源码。保留2162版恢复包和所有失败报告，归档后不回填该版本源码。

## 2026-10-21：DOCX审核阶段导航上下文销毁诊断

诊断扩展范围：16次独立DOCX与常速/CPU降速完整套件均未复现，目前不宣称根因或业务修复。允许scripts/golden/navigation.cjs增加只读CDP导航/文档请求/上下文事件采集，scripts/golden/run.cjs只接入采集、报告及工具哈希，tests/golden-navigation.test.js提供事件订阅/释放/脱敏/有界截断/原错误身份测试，tests/e2e/golden-navigation.test.js使用隔离合成页面故意导航验证真实事件；golden/README.md、docs/BASELINE_STATUS.md可记录适用限制。业务源、共享harness、旧预期仍只读；不通过重复调用、异常吞掉或固定等待改变结果。观察器启动错误必须失败，清理错误不掩盖首个业务错误；所有故障及过去失败均保留。完整门禁即使通过也不宣称间歇故障已修好。

完整门禁和完整性通过后，可在本阶段full-source生成包含昨日最终打印样式和本轮诊断的源码恢复点，并在新忽略目录逐文件解包核验；沿用原材料、秘密、依赖、生产题库排除规则，公开TLS测试fixture保留。门禁日志复制并注明来自活动源码，不声称解包目录独立运行；归档后不回填该版本源码。

用户明确“继续改，我还没时间”，继续保留既有dirty内容和全部未人工复核状态，将昨日完整门禁的DOCX mark-reviewed:1导航失败作为当前有界任务。初始1484源码/79项保护及原暂存区先核验。先只允许本任务/结果记录；运行代码、共享harness、旧测试/标签只读，独立诊断包装及CDP导航事件/堆栈/请求记录放local-run-artifacts/golden-baseline/20261021-review-navigation。新端口/新浏览器，只回放固定合成DOCX材料，不确认真实题或调用真实AI/OCR。包装只能每次调用原方法一次并保留原值/异常，不加等待或重试刷绿；独立重复观测每次保存且任一失败仍标失败。定位确切责任层后，再登记具体允许文件与独立反例进行最小修复；未知导航不能据此修改审核/准入策略。用户无暇人工复核不改变金标准状态。最终要求verify:safe、batch安全、固定六场景及增量/暂存区/旧失败证据保护，不提交或重启用户服务。

## 续作：含图选项在实际PDF中异常分页的局部样式修复

实际PNG复核又发现仅inline-block时选项字母基线落到图片题注行；同一含img选择器允许vertical-align:top，并增加字母/内容顶边一致的DOM回归。反事实已确认顶端对齐恢复且仍为2页。初版2页输出与首次完整检查保留，不把它们当最终视觉验收；最终样式和新增断言后重跑完整门禁。

最终可归档本阶段full-source完整源码并在新目录逐文件恢复验证，沿用原敏感文件/两份散落材料/生产数据排除规则；日志仅复用本阶段verify-safe-final.log（记录原名及SHA，不声称在解包目录重测），不覆盖旧包。归档后活动源码不再回填结果，实际哈希与恢复文件数以result.json为准。

2152完整门禁和1483源码保持，实际合成打印PDF首次发现短双题卷题答导出5页（首题被分散至多页），不是此前DOM预览可发现的问题。旧PDF/全页PNG/文本与两轮完整本地字体样式诊断保留于20261020-print-pdf-qa；字体/MIME/CORS无报错仍5页，反事实仅含图option-content设inline-block变为2页，去外层grid仍5页。允许app.js仅openPrintWindow打印CSS现有option-content规则同行追加含img的inline-block选择器，零增行、零业务算法，不改其他区域；独立Blob文档需要在此生成CSS，主页面样式不继承，新增模块会额外接线。新增tests/e2e/pdf-print-pagination.test.js，以固定合成单/双PDF正常UI生成真正PDF，经现有PDF.js读回页数及题答分离；无图保持2页、含图从5页改2页，原字段/图片/正式记录不变，不通过去掉图片或改预期消除失败。任务/结果、docs/BASELINE_STATUS.md和RUNBOOK.md可记录，其他模块/模板/架构/旧测试/依赖只读。若现有架构门禁拒绝，不顺手改矩阵。先原UI红例再修样式；完整safe/batch、原六场景及1483/75项保护、原暂存区门禁，证据放20261020-print-pagination-fix。无真实材料审核、真实AI/OCR、物理打印或Git提交。

## 续作：原生恢复事务中途写失败的原子回滚

另允许docs/RUNBOOK.md补充本轮已验证的安全备份写失败处理及源码包/题库数据包区别；仅操作说明，不承诺未测试的断电/磁盘真实故障，不建议绕过验证或清理浏览器数据。

2150门禁及恢复前安全写失败两场景通过。新增 tests/backup-restore-atomicity.test.js、本任务/结果和docs/BASELINE_STATUS.md，所有业务源码/旧测试只读。临时本地页面和随机命名测试IndexedDB准备11表旧记录/题图/草稿图/来源二进制，使用原StorageRepository.restoreBackup及snapshot policy；只在测试库images（第2表）或draftImages（最后表）的Dexie creating hook投一次QuotaExceededError，不替换IndexedDB、Repository、事务或数据写方法。验证先前表已发起新行写入、事务拒绝后11表全部原值/二进制相同，明确第二次调用成功后11表完全等于incoming；不做产品重试、生产数据库/真实材料操作或外部识别。1482源码/72项保护、原暂存区、完整safe/batch和六场景为门禁；故障报告与日志放20261020-restore-atomicity，失败保留，需产品修复时另列owner。

## 续作：恢复前安全备份写失败的真实UI拒绝验证

2148门禁和包含备份编码修复的1479文件恢复包已通过。允许新增 tests/e2e/backup-safety-write-failure.test.js、本任务/结果及docs/BASELINE_STATUS.md，其余运行代码/旧测试只读。全新端口/浏览器的合成测试数据库可直接准备两组题/图及有效incoming备份；仅文件夹端口在before-restore写入时分别注入QuotaExceededError和NotAllowedError一次，不替换Backup/Workspace/Repository/IndexedDB。通过UI预览、文件夹、明确覆盖确认及恢复，断言首次失败原库和11表计数不变、页面不跳转、无成功安全包、写入中止、恢复状态解锁；人工式第二次显式点击成功，且安全包是原库内容、恢复数据为incoming。不得自动重试产品动作、写用户库、真实AI/OCR、暂存/提交。失败保留且需业务修复时另列owner。1481源码/69项保护、原暂存区、完整safe/batch和固定六场景为门禁，输出20261020-restore-safety-fault；前一阶段归档保持原字节。

## 续作：普通导入数据通过UI备份跨隔离来源恢复并打印

实证修复范围：两轮新UI用例均卡在下载，诊断记录backupStatus.error=ARCHIVE_ENTRY_NOT_ALLOWED。正式图片ID由原PDF producer合法生成，含源块编码%2F；qisi-backup.js safeName只替换Windows禁用字符，仍让百分号/Unicode进入ZIP文件名，与原full-backup白名单不符。新增允许 qisi-backup.js 仅safeName改为与既有归档路径白名单一致的ASCII安全字符（保持截断/索引去重和原metadata ID、引用）；新增 tests/backup-image-identifiers.test.js 验证原生格式ID、Unicode/标点、归一化碰撞、截断及旧包读取和恶意条目仍拒绝。不改归档安全策略、原导入/图片ID/准入/数据库/读取兼容层，不删除图或过滤原记录。保存旧源码与独立单元红例，再跑原新UI用例；不得通过放宽ZIP白名单或修改旧expected消除失败。

最终完整性核验后允许本阶段full-source完整源码包及新目录解包校验，沿用前阶段路径/秘密配置/生产数据排除规则，并复用本阶段已通过的活动源码门禁日志。归档后不修改活动源码来回填结果；仅result.json记录实际归档哈希和解包结果，旧1477文件恢复包仍保留。

2141门禁、三条合成UI导入至打印、1477源码文件恢复包和60项保护通过。新增 tests/e2e/import-backup-portability.test.js、本任务/结果及docs/BASELINE_STATUS.md，其他业务源/测试/依赖只读。复用固定SHA的合成题答双PDF，原HTTP夹具、默认导入和明确审核提交只写自身测试库；通过真实UI下载备份文件，另一个新端口/上下文用恢复预览、明确确认与必需恢复前备份流程恢复。仅浏览器文件夹选择/写入使用现有测试同型内存目录端口，core backup/restore/数据库/图片/打印不替换。验证11表及源字节/草稿/正式图关联完整、恢复前安全包保存、新来源正式/草稿读回和打印图字节/解码；只新页拦截系统打印。不得接触用户配置或正式题库、外网/真实识别、真实材料审核、Git暂存/提交。1479源码/63项保护及原暂存字节、完整safe/batch/六场景为门禁，原失败保留，需产品修复时另列owner。证据放20261020-import-backup-portability，当前阶段更新不覆盖前一阶段已归档版本。

## 续作：单PDF及题答双PDF审核至打印预览

同阶段补充只读影响复查：复用20261020-word-corpus/config.json内佛山/武汉固定SHA的DOCX，在33210/33211新端口走默认full导入，复用原观察器原断言，不采纳/确认/提交。新配置/报告/截图和逐字段前后比较放本阶段目录；不改既有报告，真实AI/OCR与外网拒绝。只核查新支持答案语法对其他已观察材料的影响，差异不得自动认证为正确或据此反写标注。

本阶段最终可另将已过门禁的完整源码归档至本目录/full-source，在全新子目录隔离解包逐字节验证，沿用既有capture/verify-restore的路径/敏感文件排除规则（两份根材料只记SHA、公开TLS测试夹具保留）。只复制本阶段门禁原日志和记录其来源，不将解包称为重新运行测试或独立安装；最终文档与增量核验之后归档，归档后活动源码保持不变，旧检查点及生产浏览器数据不动。

DOCX三种预览及完整2139门禁、1478源码/54项保护已通过。继续补齐原路线三条UI主流：新增 tests/e2e/pdf-exam-print-preview.test.js、本任务/结果和docs/BASELINE_STATUS.md；其他源码/既有测试/标注只读。复用固定SHA合成套件pdf-full和pdf-dual-with-image，仅源字节匹配HTTP夹具，不注入producer或草稿；默认UI导入、刷新、明确候选采纳/图片确认、审核并提交到独立测试库，再组卷带答案预览。验证未采纳/仅确认不能新增正式题，源角色、题目/答案/解析/选项/图片字节及DOM、正式记录刷新保持。系统打印仅新预览页拦截。不同端口隔离，禁止外部或真实AI/OCR，不扩大真实数据权限。所有失败保留，新修复需另列owner；完整safe/batch、固定六场景及1478源码/57项保护/原暂存区为门禁，证据在20261020-pdf-exam-preview。

## 续作：合成审核入库后的组卷打印预览证明

2138门禁及公式答案1477源码/51项保护检查已通过。现有默认E2E未覆盖组卷打印预览，允许新增 tests/e2e/exam-print-preview.test.js、本任务/结果及docs/BASELINE_STATUS.md记录。业务源、模板、准入、旧测试/素材、依赖及app.js只读。在全新端口/浏览器用新建合成DOCX正常UI导入、审核、明确提交到独立测试库，验证试卷车及重排持久化、题目卷/带答案卷/分卷的真实blob预览DOM、公式、图字节/解码、题目数与答案隔离、标题转义及缺失车题的阻断。允许测试仅观察新预览页并拦截window.print以证明不唤起系统打印，不导出真实材料、不触碰用户库。失败先保留，不修改产品或旧预期；需要新修复时另列精确owner。1477源码/54项保护、原暂存区、完整safe/batch及固定六场景为门禁；证据放local-run-artifacts/golden-baseline/20261020-exam-preview。

## 续作：已验证支持块中公式间斜杠的原样答案提取

拒绝的重复边界不得产生独立绑定，但在已有相同题号答案声明时仍须参与原有冲突检测：不同字面值扣留、相同值按原规则去重；新增两项专门反例，不能因新语法条件跳过冲突。

第13题分层追踪证明3个源公式已由原生MathType确定性展开成功，support-p268题号边界accepted且expectedQuestion为true；其原始答案行含多个完整公式及公式间斜杠，现有纯公式语法拒收，producer/parser/草稿证据齐全。允许 qisi-support-text-parser.js 的结构化支持块答案分支新增有限格式：只对boundaryStatus=accepted、expectedQuestion=true、明确answer或full来源角色、单行完整公式组之间的字面斜杠，原样保留全部公式和分隔字符。不推断替代/除法/多空关系、不拆分或计算值，不接收未知/缺失元数据、错角色、错题号、拒绝边界、损坏公式、文字、空/连续斜杠。新增 tests/docx-formula-answer-separator.test.js 及 tests/e2e/docx-formula-answer-separator.test.js，任务/结果和docs/BASELINE_STATUS.md可记录；原公式转换、importer、SourcePort、通用Utils、PDF、准入、app.js、模板、依赖与旧expected只读。先独立合成红例和默认UI，再同源真实验证：只第13题answer及其凭证变化，所有题干/选项/解析/图片/原始证据保留，1/19题不可转换解析仍正式拒绝，全部真实题待审核且正式0。完整safe/batch、原SHA六场景、1475文件/51项保护和暂存区为门禁。首次追踪在刷新后读取导致观察数组空，已保留报告并在第二个新上下文刷新前保存结果；包装未更改原值。

## 续作：十二校第13题公式答案的分层证据

用户再次要求继续，且明确深圳卷尚未人工复核、继续软件工作。当前1475源码与最终检查点逐字节一致，2129门禁及1473归档文件恢复校验通过。只读固定十二校DOCX（a7167274161950665e7b775a9b31581e9e31b2c676094fb230462e09264c2739），在新隔离普通UI中观察原始Word公式对象→确定性展开→producer支持块→答案提取→草稿字段的各层结果。允许本任务/结果、docs/BASELINE_STATUS.md记录实证，其他源码/测试/依赖/旧包/人工字段和生产数据只读；输出到新的local-run-artifacts/golden-baseline/20261020-docx-answer-formula。观察包装只能原样返回、每次只调用一次，不更改边界/字段/策略，不注入最终草稿；所有外部和真实识别端点阻断，不确认或提交。发现责任层后再列有界修改范围及合成红例，不依据原文语义或解析推算答案，原缺失和正式拒绝保留。最终safe及增量、51项保护和原暂存字节校验。

## 续作：包含最终DOCX修复的完整源码恢复点

2129完整门禁、固定六场景、真实十二校待审核保留及45项保护均已通过。仅允许本任务/结果说明，所有运行代码和测试只读；新完整归档、Git只读证据、逐文件SHA和新隔离解包放 local-run-artifacts/golden-baseline/20261020-verified-source-current。以20261020-docx-support-review完整性overlay核验当前1475文件集合，仍排除根目录1.docx/test.pdf（仅记哈希）、秘密配置、依赖、缓存、上传原材料和生产浏览器数据；保留tests/fixtures和公开本地TLS测试素材。旧快照/失败证据/原暂存字节均不变。完整safe2129及归档/解包/活动源码逐字节一致后才写result.json成功；不在归档后回写源码、不覆盖活动checkout或执行Git还原，不声称题库数据恢复或独立安装通过。

## 续作：不可转换DOCX支持解析可保留草稿，正式拒绝不变

三份Word观察和2122软件门禁/40项保护完成，十二校原失败明确保留。允许 qisi-import-validation-service.js 在现有reviewable分支增加一个严格有限场景：只有确定性DOCX、明确精确题号支持来源、solution含完整不可转换DOCX占位符、字段原值与unique支持证据一致、每条声明源在实际DOCX输入内且归当前题源或显式solution支持角色时，允许原字段/证据进入待审核草稿。其他错误必须逐个仍拒绝；题干/选项/答案、PDF/视觉/人工状态、空或伪造/冲突证据不得借此放行。新增 tests/docx-unconverted-support-review.test.js 及 tests/e2e/docx-unconverted-support-review.test.js，任务/结果和docs/BASELINE_STATUS.md可更新；正式准入策略、ReviewValidator、审核内容检查、原DOCX投影/支持SourcePort、app.js、依赖和旧预期均只读。原占位符不修补、隐藏或删除，正式提交仍由原规则拒绝；正常邻题可独立审核提交，仅合成隔离测试允许写自己的正式测试表。真实十二校仅复验草稿/原始证据/来源/可见问题/刷新及纯验证拒绝，不确认或提交。先红例、混合恶意/错源/角色反例与默认UI全链路，再真实离线、完整safe/batch和六场景对比、1473文件及45项材料/暂存区保护。若需扩大到其他字段或更改正式拒绝，停止该实现分支，不扩权。

## 续作：三份真实Word材料结构与持久化观察

DOCX两处通用实证修复已通过2122完整门禁、固定六场景和源字节检查。继续只读 Desktop/题目与答案 下佛山、十二校、武汉三份DOCX，SHA/原文标题元数据在 local-run-artifacts/golden-baseline/20261020-word-corpus/config.json 固定；以full角色在各自新端口/浏览器上下文走默认确定性链，外部与AI/OCR请求全部阻断。不带人工expected，不反写标签或自动采纳/提交。只允许本任务/结果记录，全部运行源码、依赖、旧测试、原材料、生产库只读。输出逐份原始快照、题号/字段/图片关系和字节、token字段、DOM解码、原始XML、来源、重载一致及真实失败；发现问题先保留，不在观察中扩张业务修复。三份标题不同的材料不能仅按文件数宣传独立人工金标准数量；实际质量仍未知。记录完整safe及相对1472文件基线、40项受保护材料和原暂存区校验。

本观察另允许新建 docs/BASELINE_STATUS.md，汇总当前门禁、7组导入配置的分层观察及明确未完成项，减少依赖超长历史报告。只读追踪已确认十二校卷第1/19题solution含不可转换DOCX公式，现有正式入库拒绝检查在草稿保存阶段使整批0题；不得把这个失败从观察报告隐藏。任何后续草稿保存策略修复必须另列精确负责模块及合成拒绝/准入测试，保留正式入库检查。

## 续作：将两处DOCX实证缺陷固化为默认端到端回归

真实配对完整字节/关系/DOM/刷新检查已通过，但不能依赖本机真实材料做未来默认回归。允许新建 tests/e2e/docx-leading-image-boundary.test.js，在系统临时目录构造两份最小合成DOCX、微型公开GIF和明确question/support角色，通过默认普通UI验证题干前置图、题号与标签之间的支持图、解析无串题、精确来源、未审核及零正式题目、可见解码和刷新。仅本任务/结果说明及新用例可改，已修复业务模块保持只读。独立的忽略目录preload可在隔离浏览器只回放两份原始旧JS字节以验证该新用例确实红，再以当前版本变绿；不改活动源码、不污染默认测试依赖、不引入重试。新用例须纳入最终完整safe，旧用例和固定六场景expected保持。

## 续作：DOCX题号清理保留原有前置图片

明确支持标签边界修复已通过完整2116测试与batch安全。更严格观察在第8/11题发现：renderableText以完整图片token后接题号，stripQuestionNo却连前缀图片一并删除；图片字节在q.images里仍存在，当前inline renderer不会自动追加无token图片。允许 qisi-batch-importer.js 仅调整 stripQuestionNo 保留已经消费的前置图片token，新增 tests/docx-leading-image-preservation.test.js；不改题号识别、切题、选项/公式转换、支持绑定、图片字节、通用Utils或app.js。先合成XML红例，包含多图/拆分数字/正文图片和重复引用；原始rawXml及题号顺序不变，再验证真实第8/11题token及实际DOM解码可见、全部图片精确关系和源字节、刷新及人工状态。既有DOCX SourcePort从唯一已定位解析末尾“故选：C”恢复答案的规则保持原字节；纠正此前预估第2题会保持空答案的说法，parser本身仍不猜答案。初始严格脚本错把源码字节字段当作file而实际在uploadPath，保留失败日志后按存储协议校验，不因此改变产品或旧测试。证据仍在20261020-real-docx。最终safe/batch及合成六场景对比、两处owner局部diff/原字节保护为门禁。

## 续作：DOCX明确题号中插图阻断答案标签的边界修复

真实DOCX配对观察得到12题/11答案/11解析/6图，流程和重载检查通过但内容实证失败：第1题解析含“2. [[IMAGE:...]] 【答案】”及第2题详解，第2题为空。见20261020-real-docx/projection-findings.json；原观察报告不能作为整卷质量通过。允许 qisi-support-text-parser.js 的 parseNumberedSolutionBlocks 局部调整，新增 tests/docx-support-image-boundary.test.js，任务与结果报告；其他DOCX importer、PDF producer、qisi-utils、app.js、模板、绑定/入库、旧expected、依赖均只读。只允许完整图片token及空白出现在题号与明确字段标签之间时识别该标签边界，图片保留在其明确题号的解析证据内；不允许文字/数学/损坏token越过标签，不以图序猜题，不把无标签分步提升成题号，不猜补空答案。先合成红例，保留重复冲突与原始范围，修复后普通UI复验、逐图片原ZIP字节及精确XML关系、持久化、两份源文件哈希，补正初始观察脚本对ArrayBuffer/dataURL二进制覆盖的缺口。所有证据在同一忽略目录，失败报告不覆盖。完整safe及DOCX/batch/PDF已知拒绝门禁和增量/暂存区保护为最终门禁。

## 续作：真实DOCX稳定配对普通界面只读观察

源码检查点1467文件隔离解包逐字节通过，当前安全门禁2109通过。继续使用 Desktop/题目与答案/完整版题目.docx 与 完整版答案.docx，在新端口/浏览器上下文通过普通UI明确question和answer/solution角色，使用默认确定性DOCX链、不注入producer、不调用真实AI/OCR。源文件SHA和当前1469源码基线先保存在忽略的 local-run-artifacts/golden-baseline/20261020-real-docx。只允许本任务及结果报告记录事实，业务源/模板/依赖/旧测试均只读。记录真实来源、题号序列、字段及图token/字节/持久化、未人工确认、正式题目0和网络拒绝记录；预期题数与数学准确率没有人工标注，不从actual反写expected，不因通过就声称零错挂。与既有同名双PDF材料可能是格式变体，不能冒充独立新试卷。若出现产品缺陷保存失败与负责层证据，另定有界修复；本观察不顺手修改DOCX业务链。要求safe、DOCX/batch安全与增量及原暂存区保护。

## 续作：已验证源码整包检查点与隔离解包

回放诊断阶段完整2109测试、六场景及增量完整性已通过。按连续推进路线，合并当前真实源码为一个可校验检查点，避免恢复时必须人工拼接多层overlay。仅允许本任务/结果报告说明，其他源码只读；新归档、完整逐文件SHA清单、Git只读快照、解包目录与日志放忽略的 local-run-artifacts/golden-baseline/20261020-verified-source。以Git跟踪/非忽略文件和实际存在的普通文件确定源码集合，拒绝路径逃逸、链接、秘密配置与数据库文件，不纳入生产浏览器数据、缓存、依赖安装和原始上传材料。根目录散落的1.docx/test.pdf仅记保护哈希，不打包；tests/fixtures内的测试材料和已明确公开的本地TLS测试证书保留。原暂存区/旧快照不变；不执行Git恢复、覆盖活动checkout、安装或付费识别。完整safe为当前源版本门禁；归档解到全新隔离目录后逐文件字节核对，明确仅证明源码恢复，不声称独立安装或题库数据恢复。机器报告 result.json 为实际结果，归档后不为回写结果改变归档内源码。

## 续作：回放故障分层，不增加业务重试

模块提取完整门禁2104通过，首次独立DOCX回放曾有未复现导航上下文故障，旧报告只有message而缺发生阶段。允许 scripts/golden/run.cjs 增加步骤阶段/耗时/失败栈/清理错误记录、tests/golden-diagnostics.test.js 和任务/结果说明；生产业务源、标注与指标算法只读。新包装必须每个操作只调用一次，保存原异常身份及首个失败，不靠延时或重试把失败改为成功，清理错误不得掩盖主错误。证据放忽略的 local-run-artifacts/golden-baseline/20261020-runner-diagnostics。合成失败注入证明阶段保留，完整六场景及safe/batch验证当前行为与计数不变；导航根因仍标未确认，不把诊断增强说成已修复原故障。

## 续作：已验证纯展示函数独立模块

两卷及双PDF源隔离检查已完成；业务源最后完整门禁2102通过。按持续推进与模块边界原则，将 producer 内 pureSectionHeading/projectQuestionText/tableDisplayText/questionDisplayBlocks 原样提取为 qisi-pdf-question-display.js（纯函数、Node/浏览器兼容）；唯一依赖适配为把 S.NUMBER_START 正则作为显式参数。允许新模块、qisi-pdf-mineru-producer.js 的依赖调用替换、main.html 单个模块加载、architecture/{owners,layers,runtime-modules}.json 与 docs/architecture/{owners,layers}.json 的精确注册、本任务及结果报告、tests/pdf-question-display.test.js。其他源文件特别是 app.js/qisi-utils.js/DOCX/切题/绑定/准入只读。原函数源码归一化后哈希一致、所有旧schema和接口不变，不改任何测试expected；调用链无IO或新网络入口。证据放忽略的 local-run-artifacts/golden-baseline/20261020-display-module。要求完整架构检查、Node/浏览器导出及原有投影/生命周期回归、两卷逐字段及图片等价、六场景比较、safe/batch和原字节保护，不重启用户服务或提交代码。

## 续作：已缓存双PDF来源隔离检查

继续只读检查 Desktop/题目与答案/完整版题目.pdf（50dc9a7e98299807f45521a50048240010be78212a21c840c30b2149739dd75d）与完整版答案.pdf（48549eadeee80340d3f58062762b724f56471c903f5ee0c3bdf2dbec25762c7f）。各自核验ready回执/ZIP与唯一导出内容；仅新端口和隔离浏览器使用既有回放器，通过普通UI设question与answer/solution显式角色。业务源文件保持已通过2102门禁版本；输出在忽略的 local-run-artifacts/golden-baseline/20261020-dual-pdf，本任务和结果报告允许记录验证。核查字段来源、图片token及字节、未人工确认、零正式题目、刷新一致；序列不可靠时只检查拒绝与证据保留，不修猜匹配，不发送识别请求。不将同一材料的角色组合当作新的独立样本数量。

## 续作：河北卷留出材料离线检查

河北卷实际UI检查因“Figure token must remain in its declared field”失败；projection-inspection.json证明第4题4张图token位于A/B/D选项，图position仍全为stem。更正初步诊断：C标签实际存在于p1b12/image_caption/0，并有明确parentId，不是缺失，而是图先字幕后导致C空正文。允许现有 qisi-pdf-mineru-producer.js 在明确选择题、独立字母字幕与父图精确关联、完整唯一A–D序列下仅调整展示顺序，再按精确token所在字段调整image.position，并同步保留候选中的所有题面图片；不改原始证据顺序。没有父图关系或标签/正文不完整时保留问题并加人工归属核对提示，禁止凭图序补标签、重编号或自动接受。追加 tests/pdf-question-projection.test.js 独立合成红例，复验河北/深圳与固定套件，完整safe/batch及前后原字节检查。证据存于同一河北目录；其他负责文件继续只读。

深圳投影修复已通过2097完整门禁和原字节检查，按用户持续推进指令检查第二份已缓存材料。只读 Desktop/题目与答案/河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷.pdf，SHA256 011f12024f5c8bdd013e6524ba63b1ed762b34db501295d2edd9b6505d06c4a9；回执ready，ZIP SHA256 44250658e9362d7f198273639638c3c58de14fe884913cf41893cd2bc9be7999。仅使用既有缓存与本地PDF渲染，在新端口/新浏览器上下文回放普通UI；输出放忽略的 local-run-artifacts/golden-baseline/20261020-holdout-hebei。允许本任务与结果报告记录检查事实，其他源文件保持已验证版本；若发现确切新缺陷再登记责任文件和独立合成红例。原文/缓存只读，不将留出观察反写金标准，不算人工认证，不调用AI/OCR或写正式数据。

## 当前授权：PDF投影四处实证修复与持续推进

2026-10-20 用户在上一项完整界面证据交付后要求继续，随后明确“别再停了……一直干到没额度为止”。保留既有dirty内容，自行验证、记录并推进已授权路线，不再逐项等“继续”；只在确需信息、额外权限或工具阻塞时暂停。此指令覆盖默认逐阶段停止，但不恢复历史付费识别或正式数据写入权限。

当前有界修复依据：20261020-real-ui/projection-findings.json，固定深圳源SHA下第8/10选项误拆、第18解答题误拆及第16表格HTML被图片分支遮蔽。允许 qisi-pdf-mineru-producer.js 的PDF展示投影局部修复、tests/pdf-question-projection.test.js、本任务与结果报告；证据与脚本放忽略的 local-run-artifacts/golden-baseline/20261020-pdf-projection-fix。通用 qisi-utils.js、DOCX、app.js、UI模板、序列/答案对齐/入库负责文件、架构与依赖全部只读。先合成红例再修复：解答/填空不拆选项；只在明确选择题、数学与图token之外、显式完整唯一A–D标签时修补粘连分隔；只过滤独立纯节标题块；表格保留现有图片并明确展示已有文字、差异待核提示，绝不猜补单元格。原始证据、候选来源、人工拒绝状态、已有序列扣留全部保留。验证为合成边界/注入/不完整反例、深圳真实缓存UI前后字段比较、相同合成套件比较、verify:safe/batch-safety与原字节完整性。若需要新业务owner先记录实际必要性与精确范围，不顺手改通用分隔器。

## 2026-10-20 完整真实缓存界面离线验证

用户再次要求继续。补齐此前代用 renderPages 未验证的真实本地渲染、普通入口、持久化和审核展示：只读固定SHA的深圳原PDF、来源关联回执/ZIP/content list，在新端口与全新浏览器上下文中用现有按源字节回放器替代识别HTTP边界，真实PDF.js生成原页；不替换producer/字段投影/存储逻辑，不采纳候选或提交正式题目。允许新增 scripts/golden/replay-real-cache.cjs、tests/golden-real-cache-input.test.js，局部增补golden/README.md、本任务和结果报告；新配置、报告、截图及完整性快照放 workspace 内忽略的 local-run-artifacts/golden-baseline/20261020-real-ui，不写已移出可写范围的外部目录。现有材料、旧复核记录、所有业务文件与暂存区只读。要求源PDF/回执/ZIP/导出内容全链校验、未知HTTP端点拒绝、零真实AI/OCR、刷新字段与图片一致、未审核状态和零正式题目检查；不以此次离线结果声称OCR准确率。最终 verify:safe、相关batch safety、增量范围及原字节检查。若暴露新的业务问题只记录重现，不在本任务扩大业务修改。

## 2026-10-20 用户选定深圳卷复核包后的续作

用户已选择“使用深圳卷复核包”并要求继续。此次只补齐同一源哈希的 21 页代理视觉检查、逐题证据、离线人工填写页及其导出记录校验；材料选择不等同于人工确认。允许 scripts/golden/review-records.cjs、tests/golden-review-records.test.js、golden/README.md、本任务及结果报告的局部增补；生成页面、原页 PNG、代理意见、原始记录哈希和检查日志保存在新的外部 shenzhen-review-20261020 目录。已有复核工作区、空白人工清单、历史参考、缓存和源 PDF 保持字节不变，不自动修改 expected 或接入生产绑定。发现此前诊断不准确时以增补报告更正，保留旧证据。完整 verify:safe 及增量文件哈希比较为最终门禁；不新增生产业务修复、真实调用、数据库修改、依赖或 Git 提交。

日期：2026-10-20。依据：用户在阶段 0 交付后明确要求“继续，中途不要停下来了”。这覆盖逐阶段停下等待的默认流程，允许保留当前 dirty 内容连续推进已规划的安全本地工作。既有付费调用历史不作为本轮授权。

## 目标与范围

1. 修复已定位的审核测试旧按钮名称，保持全部业务断言并补充确认不自动入库的断言。
2. 建立离线回放入口、明确指标分母和适用层次、固定输入/标注哈希，输出逐题证据与机器报告。先复用已有合成素材；历史真实参考标注未确认来源与复核者前标为未认证，不能宣传为人工金标准。
3. 用已有备份模块和隔离数据库完成导出、读取验证、恢复、再次读取与图片/记录关联比较。保持生产数据和来源材料不变。
4. 根据证据复用已有审核与产品能力，不为路线图重复建设。持续运行必要门禁，记录实际完成度及确需人工标注的缺口。

## 允许写入

- 本任务及 `ai/CONTINUOUS_BASELINE_RESULT_2026-10-20.md`；阶段 0 报告保持历史事实。
- `tests/e2e/review-draft-command-ui-recovery.test.js`，仅已证明过期定位及加强安全断言。
- 已证明的基线模拟顺序缺陷：`tests/e2e/true-import-pdf-safe-partial.test.js` 改用现有 SHA-256 回放器；`tests/mineru-replay-identity.test.js` 增加请求顺序置换验证。原有业务和拒绝断言保留，不修改生产源排序。
- `scripts/golden/**`、`golden/**`、`tests/golden-*.test.js`、`tests/backup-roundtrip-drill.test.js`。
- 外部阶段 0 目录同级的后续证据目录，以及忽略的 `local-run-artifacts/golden-*` 报告/显式缓存回放配置。
- 仅在必要时补充测试指南的命令与已核实能力说明，不改运行入口或依赖。
- 新建 docs/LIVE_MAP.md、docs/RUNBOOK.md，记录已核实链路、现有备份入口和离线验证方法。
- ai/CODEX_TASK.local.md 仅添加本轮任务/结果入口，保留全部历史正文；该索引不恢复历史付费或生产数据写入授权。

业务模块、app.js、main.html、已有其他测试、架构清单、依赖、秘密配置、真实文档、生产浏览器数据库只读。无 reset/stash/stage/commit/push、无安装依赖、无真实 AI/OCR、无用户运行服务重启。若新增业务修复确有必要，先记录证据与精确负责文件，不顺手扩张。

## 验证与停止边界

补充已复现的有限 PDF 审核提示修复：qisi-pdf-mineru-producer.js 只将分段模块已报告的空表格内容缺失传递到对应题的 warnings/taskProblems；tests/pdf-empty-source-review.test.js 提供红绿回归。来源证据为已核验缓存的第 16 题 p5b0 空表格与原 PDF 第 5 页可见的表格行。允许这一个现有负责模块的局部改动；不改变切题、绑定、序列、凭证或入库算法，不修改 app.js / DOCX / 冻结模块或架构清单。之后重跑完整 safe 与 batch safety。

只读原页复核范围：Desktop/题目与答案/广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf，SHA-256 874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21。仅使用本地 Poppler 渲染关键原页，零外部识别请求、零 API 成本；输出放在外部证据目录。结果标代理复核，人工复核字段保持未确认；不修改原文件、历史标注或生产绑定规则。

补充有证据的模拟顺序修复范围：tests/harness/browser-engine-injection.js 增加显式文件哈希映射；tests/e2e/production-normal-ui-import-cutover.test.js 为 PDF 配置该映射；tests/mineru-replay-identity.test.js 验证逆序请求和未知来源拒绝。17 场景矩阵日志已记录题目/支持原始块互换，保持全部场景及断言，不改生产源排序。

先运行审核针对用例；离线指标必须测试重复题号、错挂/未知题号、缺失与空分母、非法标注及预期拒绝，不能把生产输出反写成 expected。完整流程和备份使用隔离环境。最终运行 verify:safe、相关 batch safety 与增量范围/原文件哈希检查。环境 EPERM 可在批准后解除子进程限制；产品失败不能靠重试掩盖。人工数据不足时交付可执行工具与明确待标注项，不伪造认证或准确率。
