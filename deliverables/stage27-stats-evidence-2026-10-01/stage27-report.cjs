const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', desktop = 'C:/Users/Administrator/Desktop/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage27-stats';
const name = 'ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md', mirror = 'deliverables/code-audit-recheck-2026-09-30.md';
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(git(source, 'status', '--porcelain', '--untracked-files=no'), ''); assert.equal(git(desktop, 'status', '--porcelain', '--untracked-files=no'), '');
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'deployment-manifest.json')));
for (const item of manifest.files) assert.equal(sha(path.join(desktop, item.name)), sha(path.join(source, item.name)));
assert.equal(fs.readFileSync(path.join(source, name), 'utf8'), fs.readFileSync(path.join(desktop, name), 'utf8'));
assert.equal(fs.readFileSync(path.join(desktop, mirror), 'utf8'), fs.readFileSync(path.join(desktop, name), 'utf8'));
const sourceProgram = git(source, 'rev-parse', 'HEAD'), desktopProgram = git(desktop, 'rev-parse', 'HEAD');
let report = fs.readFileSync(path.join(source, name), 'utf8');
report = report.replace('第 26 阶段按题审核读取也已同步并通过桌面验收，详见第 7 节。', '第 26 阶段按题审核读取和第 27 阶段事务内元数据统计均已同步并通过桌面验收，详见第 7—8 节。');
report = report.replace('正式事务中的重复全库读取、同批草稿重计和最终统计全批回写仍存在，后续须另做兼容设计，不把局部改进称为整批线性化。', '正式事务中的重复全库读取和同批草稿重计仍存在；第 27 阶段已修复统计重写草稿的并发反例并取消其全批回写。去重/显示清理等其他整批替换路径仍须单独复核其与正式提交的版本边界，不把局部改进称为整批线性化。');
report += `

## 8. 第 27 阶段：统计刷新不再覆盖已提交草稿

### 8.1 原生反例与改动

在第26阶段桌面基线的隔离原生IndexedDB中，按以下顺序执行真实生产模块：统计先加载reviewed/version1草稿 → 在原统计持久化端口写入前运行正式仓库确认事务 → 旧统计继续替换整批草稿。结果正式题数量1、committedQuestionId=formal-race，但草稿恢复reviewed/version1、submittedQuestionId为空、submittedCount=0。原因是统计写回旧草稿数组，正式事务更新草稿却未递增draftPersistence.version，旧批次版本检查仍通过。不是只从源码推测的风险；baseline-native-race.json保留实际结果，没有触及用户题库。

修复将统计计算、批次元数据更新和元数据读回放进覆盖draftImportBatches/draftQuestions/draftImages的同一rw事务。仓库直接读取当时草稿与图片，维护模块沿用原countsFor谓词，持久层从事务内批次版本构造version+1、原maintenance:stats:B:v格式的key和本次计数签名。仓库只update批次，不删除/写入草稿、图片或文件。批次其他字段保留；每次重算仍会递增批次版本，没有新增“统计无变化就跳过”的缓存分支。

统计返回仍含counts与readback.batch，去掉该内部统计结果冗余的files/questions/images；调用图核对无消费者依赖stats.readback的这些数组。去重/清理自己的readback和持久化接口保持原样。app.js只新增四行将持久端口交给维护模块；计数和事务逻辑留在三个既有模块。main四个脚本缓存版本更新，架构清单九组range只平移+4，其他规则不变。

### 8.2 约束、证明与没有覆盖的竞态

前提是当前既有主键/batchId索引、同步且纯的problemsForDraft/countsFor计算、所有所需行均在同一数据库。设统计事务为S，正式提交事务为F；二者至少重叠draftQuestions与draftImportBatches，所以IndexedDB串行安排这两个rw事务。若F在S前提交，S读到submitted与递增后的草稿版本；若S先完成，S只改变批次元数据，后续F提交不会被S的旧草稿数组覆盖。S也覆盖图片表，计数使用同一事务视图。countsFor保持原规则：reviewed/submitted分别计数、problem只计未提交且有问题的题、unassigned只计该状态图片、非空批次且全部submitted才completed，其余沿用批次status或review。

更新后的批次在S内读回，维护层逐字段核对counts。事务内在读取/计算、update前、update请求成功后及读回后检查取消；计算抛错或提交前检测取消会使整个事务abort。真实回归在update请求已成功后触发取消，最终所有表与原快照一致；没有把request success当成commit success。事务已经提交后的取消不会追溯撤销已完成写入。

S递增批次持久版本，故此前取得旧版本的普通整批命令拒绝。相同maintenance key的旧整批签名也不等于新的计数签名，被幂等冲突门禁拒绝。它没有为每次统计建立永久缓存，也不把最后一次counts当作永远新鲜：S之后的其他写者可以改变题目，下一次刷新才重新计数。

本阶段仅修复统计刷新这一替换路径。正式提交自身的batch持久版本更新策略、去重/显示清理等仍整批替换的路径没有改造，不能由本证明推出它们与正式提交之间的所有竞态已经解决；这些路径需后续独立验证/设计。PDF挂接、DOCX生产身份、admission和事务内新鲜查重未改。

### 8.3 复杂度与全链影响

令D/I/F为同批草稿/图片/文件数，P为problemsForDraft的总计算成本，T为读取草稿/图片及批次内容的总字节/字符量。统计仍须枚举D条草稿和I条图片，时间O(D+I+P+T)、驻留行/内容O(D+I+T)（规范化等临时内存另计）。当前没有可直接给全部复合业务谓词计数的索引，不能不检查相应记录就保证正确；此论证不宣称任意索引模型下最优。复制/write成本收敛为一个批次记录及固定5项统计，而非删除D+I行、重新bulkPut D+I+F行并写批次。图片大data URL仍在一次batchId读取中出现，尚未改为只读图片元数据的schema。

对于M条全部成功提交，工作流选择批次仍整批加载1次；最终统计直接扫描同批草稿/图片1次。与第26阶段相比reloadDraftBatch从3次降到1次，但不能把这个端口调用数说成“只读一次草稿/图片”：正式每题还扫描同批草稿，前后按题投影仍有2M次。全部索引草稿返回行数从(M+3)D降到(M+2)D（不含按题主键读取），图片返回从3I+2*sum(k_q)降到2I+2*sum(k_q)。

正式库仍读MN+M(M-1)/2行，选择find和正式重计仍有MD成本，所以整批固定长度记录上界仍包含O(MN+M²+MD)；本改动没有变成一次全库扫描。它降低统计无关写入量，并去掉一个已证实的数据覆盖风险。

### 8.4 原生生产链对照实测

同第7节测量边界：新浏览器上下文/独立原生IndexedDB，生产ReviewWorkflow、ProductionReviewValidator、BatchFormalSubmit、Admission、正式事务、data URL到Blob、维护统计及读回。比较第26基线与第27三个模块，三规模各3组旧/新交错，共18样本。每草稿绑定4096字节合成图片负载（重复x的data:image/png，用于Blob传输/记录成本，不用于PNG解码、图归属或视觉质量证明）；不计种库、Vue渲染、AI，夹具的未调用维护端口只提供接口胶水。探针保留Dexie Promise，全部样本验证20次实际成功提交、N+20正式记录、20个Blob共81920字节、草稿状态/版本和submittedCount一致。

| N正式题 / D草稿 | M | 第26/第27中位数(ms) | 草稿索引返回行数 | 图片索引返回行数 | 统计草稿/图片bulkPut行数 |
|---|---:|---|---|---|---|
| 1000 / 20 | 20 | 312.0 / 276.3 | 460 / 440 | 100 / 80 | 20+20 / 0+0 |
| 1000 / 400 | 20 | 1767.6 / 468.1 | 9200 / 8800 | 1240 / 840 | 400+400 / 0+0 |
| 10000 / 400 | 20 | 3460.7 / 1349.7 | 9200 / 8800 | 1240 / 840 | 400+400 / 0+0 |

旧统计还delete草稿/图片各D行，并bulkPut1条文件；新统计这些删除/重写均0，只update批次。所有方案正式库仍20次读取：N1000为20190行、N10000为200190行。D400图片URL字符返回6802640→4608240，不冒充Blob字节减少；20个正式Blob实际总字节保持81920。

时长波动明显：N1000/D400旧794.4—2552.3ms、新448.6—506.3ms；N10000/D400旧2344.2—3933.4ms、新1287.0—1382.2ms。三样本和合成短题不足以保证用户真实材料加速倍数。第7节另一次运行的中位数不能直接替代本次对照基线；确定证据是无草稿/图片/文件统计重写、读取行数减少、夹具中观察到时长改善，以及原生并发反例被修复。

### 8.5 验证、提交与证据

源程序提交 \`${sourceProgram}\`；桌面程序提交 \`${desktopProgram}\`；8文件、261行增加/26行删除，含1个新增原生事务回归文件。旧7文件在覆盖前核对源基线blob、桌面HEAD及Git过滤后的磁盘内容，逐文件外部备份/SHA核对；新增测试文件先确认桌面不存在。同步后源/桌面8文件逐字节相同。

新增2个原生事务回归（不是文档PASS断言）：正式提交与统计交错、仅批次update且草稿/图片/文件逐值保留；计算失败/计算内取消/update成功后取消均回滚、递增批次版本使旧整批命令拒绝。旧维护、计数、取消、错误和readback预期不降低。源与桌面完整门禁均1756通过/0失败、另20项批量mock通过；runtime、app架构、精确scope通过，源batch-safety覆盖DOCX稳定和PDF known-bad。桌面文档作为单独提交运行原有完整pre-commit，不把报告与业务改动混成一个提交。

实际桌面3000端口的新隔离上下文另检查：正式提交后统计结果submittedCount1、reviewedCount0、completed；草稿仍submitted/version2/正式引用存在，文件图片保留；旧版本命令返回VERSION_CONFLICT，同maintenance key旧整批签名返回IDEMPOTENCY_CONFLICT，缺批次保持NOT_FOUND。实际桌面导航6项、SRI11项、手动完整备份/恢复预览、3处数学打印和按钮就绪通过，pageerror/console error/外网请求均0。真实生产用户库没有写入。

证据位于 \`deliverables/stage27-stats-evidence-2026-10-01/\`：任务、基线原生覆盖反例、先失败的回归日志、相关回归、完整门禁、18个全链样本、部署manifest、真实桌面原生验证、导航/备份/打印验收、脚本及三份基线模块。旧7文件外部回滚备份在 \`${out}/desktop-before/\`，Temp清理会失去该副本。正式报告与deliverables镜像保持同内容，最终HEAD/SHA另存completion.json。

本阶段付费请求0；两个ledger SHA和第四次502 halt未改，第二轮仍用4/20、剩16。E盘HEAD/状态不变，桌面原有未跟踪项目保留，**深圳整卷真实验收仍未通过**。
`;
for (const [index, item] of [{ root: source, name }, { root: desktop, name }, { root: desktop, name: mirror }].entries()) {
    fs.copyFileSync(path.join(item.root, item.name), path.join(out, `report-before-${index}.md`));
    fs.writeFileSync(path.join(item.root, item.name), report);
}
const evidence = path.join(desktop, 'deliverables/stage27-stats-evidence-2026-10-01'); fs.mkdirSync(evidence, { recursive: true });
for (const entry of fs.readdirSync(out, { withFileTypes: true })) if (entry.isFile() && !entry.name.startsWith('report-before')) fs.copyFileSync(path.join(out, entry.name), path.join(evidence, entry.name));
const visual = 'C:/Users/Administrator/.codex/visualizations/2026/09/30/01a0f29d-5103-7f62-a577-682728664b43';
for (const script of ['stage27-race.cjs', 'stage27-edit.cjs', 'stage27-fix.cjs', 'stage27-measure.cjs', 'stage27-deploy.cjs', 'stage27-desktop-acceptance.cjs', 'stage27-desktop-native.cjs', 'stage27-report.cjs']) fs.copyFileSync(path.join(visual, script), path.join(evidence, script));
for (const file of ['qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-draft-maintenance-service.js']) {
    fs.mkdirSync(path.join(evidence, 'baseline-modules'), { recursive: true }); fs.copyFileSync(path.join(out, 'source-before', file), path.join(evidence, 'baseline-modules', file));
}
console.log(JSON.stringify({ sourceProgram, desktopProgram, reportSha256: sha(path.join(source, name)), evidence }));
