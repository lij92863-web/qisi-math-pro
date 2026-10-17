const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', desktop = 'C:/Users/Administrator/Desktop/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage26-review-reads';
const name = 'ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md', mirror = 'deliverables/code-audit-recheck-2026-09-30.md';
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(git(source, 'status', '--porcelain', '--untracked-files=no'), '');
assert.equal(git(desktop, 'status', '--porcelain', '--untracked-files=no'), '');
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'deployment-manifest.json')));
for (const item of manifest.files) assert.equal(sha(path.join(desktop, item.name)), sha(path.join(source, item.name)));
assert.equal(fs.readFileSync(path.join(source, name), 'utf8'), fs.readFileSync(path.join(desktop, name), 'utf8'));
assert.equal(fs.readFileSync(path.join(desktop, mirror), 'utf8'), fs.readFileSync(path.join(desktop, name), 'utf8'));
const sourceProgram = git(source, 'rev-parse', 'HEAD'), desktopProgram = git(desktop, 'rev-parse', 'HEAD');
let report = fs.readFileSync(path.join(source, name), 'utf8');
report = report.replace('第 15—22 阶段现已同步到该桌面版本，软件本地回归与离线桌面验收通过。', '第 15—22 阶段已同步到该桌面版本；第 26 阶段按题审核读取也已同步并通过桌面验收，详见第 7 节。');
report = report.replace('### 3.2 批量提交的全局成本与新测量', '### 3.2 批量提交的全局成本与第 25 阶段基线测量');
report = report.replace('下一代码阶段应以本次重复IDB读取测量与兼容约束设计小范围方案，保留事务内版本、幂等、恢复与并发语义，不把评估直接冒充实施。', '第 26 阶段已消除单题审核的重复整批重载，见第 7 节；正式事务中的重复全库读取、同批草稿重计和最终统计全批回写仍存在，后续须另做兼容设计，不把局部改进称为整批线性化。');
report += `

## 7. 第 26 阶段：按题审核一致读取与桌面部署

### 7.1 确证问题、改动与边界

此前单题审核/提交及成功读回均调用 reloadDraftBatch，重读整批文件、草稿与图片再 find 当前题。正式批量提交 M=20 时，仅工作流就调用该全量端口 2M+3=43 次（逐题前后共40次、选择1次、最终统计2次）。即使正式题库查重 CPU 已单次线性化，审核层仍反复复制无关草稿和图片 data URL。

仓库新增 loadDraftReview，在覆盖 draftImportBatches、draftQuestions、draftImages 的一个 readonly 事务内，通过两个主键和既有 questionId 索引读取当前视图；事务内直接 await Dexie 查询，之后复制结果。持久层新增 reloadDraftReview，验证批次主键、草稿主键/批次、图片批次/题号一致性。缺批次、缺草稿、关联错误及存储失败保持封闭错误；没有用排序或语义猜测补配。工作流只将 loadCurrent 换为此端口，保留现有版本检查、确认持久化、成功状态读回、逐题提交、部分成功及请求幂等语义。app.js 仅增加四行端口胶水；四个实际浏览器脚本更新缓存版本。架构清单九个函数 range 因此只平移+4，其禁止调用/最大行数等规则未变。

没有 schema/索引迁移、跨事务查重缓存、整批大事务、模型调用或生产数据编辑。单题确认的写入路径和批次统计维护仍按原实现全批读取/回写；本阶段没有把它们偷偷改成增量计数。E盘运行文件没有修改。

### 7.2 一致性与正确性证明的约束

设请求为(B,Q)。前提：使用当前已存在的 id 主键和 draftImages.questionId 索引，正规关联为 draft.batchId=B、image.batchId=B且image.questionId=Q。一个覆盖三表的r事务读出batch(B)、draft(Q)及所有questionId=Q的图片，同store的rw事务在其间不能提交。故返回值属于同一个序列化读取视图；持久层的精确关联门禁拒绝跨批草稿/图片及错题图片。与旧正常输入的投影等价：取旧批次.questions中Q、旧批次.images中questionId=Q，工作流仍按原status规则过滤deleted图片。其他题的文件、图片不参与该投影，无需读取。异常关联不当成正常投影，显式拒绝。

只读事务结束后的新写入仍可能发生；本证明不把审核视图当永久快照。正式提交继续在独立rw事务内重读草稿，检查版本、状态、请求幂等和新鲜正式题库查重，并原子写入正式题、图片、草稿和批次。没有扩展证明为“所有图片编辑与正式提交具有新的联合事务”；该事务边界保持原样。

真实IndexedDB并发反例检查在读取batch后立即排队一个覆盖同三表的写者：第一次读取标记/版本/图片标记均为[1,1,1]，写者结束后第二次均为[2,2,2]，没有混合视图；跨批图片返回ASSOCIATION_INVALID，删除草稿后仍保留原图片证据并返回缺草稿。源模块与实际桌面端口各执行一次，夹具库自动移除。初次实现误用通用异步封装造成PrematureCommitError，完整浏览器门禁6项失败；失败日志保留，已改为事务内直接Dexie查询，修复后门禁全通过，没有降低预期或添加保活分支。

### 7.3 复杂度与全局影响

设D为同批草稿数，I为同批图片数，M为本次全部成功提交题数，k_q为题q的图片数，S_q为当前题、批次及其图片内容大小。原单题投影需要枚举、复制D/I/文件和相关内容；新接口只返回一条批次、一条草稿及k_q条图片，复制/关联验证O(S_q)。在主键/有序索引查找模型中，查询是两次主键定位及一次索引定位+范围枚举，数量成本O(log B+log D+log I+k_q)；浏览器实际索引实现的常数及内部算法不作为规范保证，实测报告读取条数而不是声称IDB接口本身严格O(1)。

对于全部成功的批量提交，整批工作流重载从2M+3次降到3次；图片返回数量从(2M+3)I降到3I+2*sum(k_q)。选择循环find仍含O(MD)，正式仓库仍逐题读全库并重计同批草稿，M次正式库读取行数依旧MN+M(M-1)/2。故整体固定长度记录上界仍包含O(MN+M²+MD)，不能称整个算法降为线性。最终统计复制/写入整批草稿图片、单题确认的持久化读取、UI绘制、长文本/图片字节等成本也未消失。

### 7.4 原生全链实测

在新浏览器上下文中使用真实IndexedDB临时库，运行生产ReviewWorkflow、ProductionReviewValidator、BatchFormalSubmit、Admission、正式仓库逐题事务、图片data URL转Blob、DraftMaintenance最终统计持久化与读回。种库不计时。每题绑定一条4096字节合成图片负载（重复x字节的data:image/png，用于传输/Blob成本，不作为PNG解码或视觉验收），各方案/规模3个样本，旧/新顺序交错；比较来自同一基线的三个模块，仅替换本阶段改动。未用fake database替代I/O或stub替代正式提交/统计；未调用的其他维护端口使用满足接口的夹具胶水。计时探针保留Dexie Promise，有额外开销；排除Vue渲染、AI、种库和用户数据。

| N正式题 / D草稿 | M | 旧/新全链中位数(ms) | 旧/新同批草稿索引返回行数 | 旧/新图片返回行数 |
|---|---:|---|---|---|
| 1000 / 20 | 20 | 315.4 / 251.3 | 1260 / 460 | 860 / 100 |
| 1000 / 400 | 20 | 2557.3 / 1527.9 | 25200 / 9200 | 17200 / 1240 |
| 10000 / 400 | 20 | 4294.6 / 3044.0 | 25200 / 9200 | 17200 / 1240 |

“草稿索引返回行数”不含新接口的40次草稿主键返回，也不包含未读取的文件；两方案均仍含20次正式事务的批次重计。D=400时图片data URL返回字符合计94359200→6802640（字符数，不冒充二进制字节）。每个样本都验证N+20条正式题、20条正式图片/81920字节、20条submitted草稿且版本+1、其他草稿版本保持1、统计submittedCount=20；N=1000/10000的正式库读取仍分别20次/20190行与20次/200190行。

样本随时间明显波动，例如N=10000/D=400旧3029.4—4790.0ms、新2477.1—4423.1ms；不能由三样本给任意用户数据、硬件或完整识别速度保证。确定结论是整批重载/无关图片读取数量减少，并在这些夹具中观察到中位数降低；原3.2仅正式事务边界的156.9/1030.3ms包含范围不同，不能直接相减或比较成同一轮加速倍数。

### 7.5 提交、门禁与交付证据

C隔离树程序提交 \`${sourceProgram}\`；桌面程序提交 \`${desktopProgram}\`。十个文件精确同步，旧桌面HEAD blob和经过Git过滤的磁盘内容逐一等于源基线，外部逐文件备份后SHA256核对，新桌面文件与源逐字节相同。原桌面三个未跟踪项目保留，未重装依赖或重启无变更的服务端。

新增4项行为回归：只读事务/按键读取及删除后新鲜读取、错批/错题关联拒绝、缺记录/存储错误边界、工作流缺题拒绝；既有确认、版本冲突、图片、取消、部分失败重试/幂等预期保持。源完整安全门禁和桌面pre-commit均1754通过/0失败，另20项批量mock通过；runtime登记、app架构、精确diff通过。源verify:batch-safety另通过DOCX稳定链与PDF known-bad。桌面实际3000端口新隔离上下文确认新端口存在、六导航、11个SRI、完整备份下载与恢复预览、打印3处KaTeX及按钮就绪，pageerror/console error/外网请求均0。真实用户库无写入。

本阶段证据目录为 \`deliverables/stage26-review-reads-evidence-2026-10-01/\`，含TASK、源/桌面完整门禁、保留的首次失败日志、精确同步manifest、18个原生全链样本、并发视图检查、桌面验收JSON/截图及脚本。旧十文件备份仍在外部 \`${out}/desktop-before/\`（Temp清理会失去该回滚副本）。文档是单独审计报告提交，本节不写其自身未生成提交号。

千问本阶段新增调用0，第二轮仍用4/20、剩16，第4次502 halt和两ledger SHA均未改；深圳19题离线缺漏表保持原判定，**深圳整卷验收仍未通过**。
`;
const backups = [{ root: source, name }, { root: desktop, name }, { root: desktop, name: mirror }];
for (const [index, item] of backups.entries()) fs.copyFileSync(path.join(item.root, item.name), path.join(out, `report-before-${index}.md`));
for (const item of backups) fs.writeFileSync(path.join(item.root, item.name), report);
const dest = path.join(desktop, 'deliverables/stage26-review-reads-evidence-2026-10-01'); fs.mkdirSync(dest, { recursive: true });
for (const entry of fs.readdirSync(out, { withFileTypes: true })) if (entry.isFile() && !entry.name.startsWith('report-before')) fs.copyFileSync(path.join(out, entry.name), path.join(dest, entry.name));
const visual = 'C:/Users/Administrator/.codex/visualizations/2026/09/30/01a0f29d-5103-7f62-a577-682728664b43';
for (const script of ['stage26-edit.cjs', 'stage26-measure.cjs', 'stage26-idb-validation.cjs', 'stage26-deploy.cjs', 'stage26-desktop-acceptance.cjs', 'stage26-report.cjs']) fs.copyFileSync(path.join(visual, script), path.join(dest, script));
console.log(JSON.stringify({ sourceProgram, desktopProgram, reportSha256: sha(path.join(source, name)), evidence: dest }));
