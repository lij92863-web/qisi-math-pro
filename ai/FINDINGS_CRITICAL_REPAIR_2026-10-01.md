# Findings 2026-10-01：关键缺陷修复与 D-1 验收

修复目标：`C:\Users\Administrator\Desktop\题库系统`。分支 `stage/program-c-corrective-r1`，起始提交 `71dfe18`。用户确认保留原有 `.workbuddy/`、`deliverables/`、`启动奇思数学.bat`；这些内容未修改。E 盘版本业务代码未修改，Git 工作区仍干净。

已阅读 findings 全文（三轮审计）。报告中的“33 项仍在”不是当前实证结果：部分条目已修，部分属于旧版本、环境条件或尚待复现。本阶段完成 N1、N2、N39、N40，D-1 所必需的对齐器归一化修复，以及 N12 的一处重复遍历修复，以及用户明确批准的精确哈希冻结登记。最终 `verify:safe` 通过，不代表报告所有条目均已解决。

## 已复现并修复

| 编号 | 修复前证据 | 根因修改与修复结果 |
| --- | --- | --- |
| N39 | 恢复 `$$\frac{1}{2}$$` 后只剩单美元定界符 | 字符串替换把 `$$` 当替换模板；改为替换函数，原公式逐字保留。1 行。 |
| N40 | 五选项清理后只有四项 | 下标循环固定为四项；遍历 `max(4, 输入项数)`。所有选项保留，原有不足四项的补空行为保持。1 行。 |
| N1 | 空期望题号集仍输出三条答案、三条解析 | 删除空集合放行条件；空期望集输出空 items，原始 blocks 保留。 |
| N2 | 空字符串、空格、null 答案变成空 B 选项的 B 标签 | 在值匹配前拒绝空归一化答案。保留图片选项所需的空文本标签；显式 B 答案仍合法。3 行。 |
| 第一轮问题5（仅 aligner 部分） | `x3` 被识别成 3；`1000` 被截成 100 | 完整匹配数字/“第…题”，并限制为正安全整数；拒绝从正文或方程中截取数字，保留全角转换。 |
| N12（部分修复） | 对题号执行相同的全角转换两次 | 只删除 aligner 的重复遍历；block-parser 的同类重复仍未修，不能关闭整个 N12。 |
| D-1 | 19 题的答案、解析都缺第 7 题，只能保留第 1–6 题 | 完整校验两侧严格递增、题号完全相同、属于明确期望集、原始序列无异常后，接受全部 18 对；只扣留第 7 题。 |

D-1 是用户明确授权的规则变更，已同步宪法、稳定链说明和 PDF 对齐技能。增加 `subset` 模式；它仍属于 `safe-partial`，要求人工复核，不能冒充 `full`。生产序列验证、单题和批量 canonical projection 均识别该模式。

## 原链路内的必要修复

沿用现有解析 → 对齐 → 字段受控写入 → canonical projection 链路，没有新增业务模块，没有把逻辑搬到 app.js。

稳定链检查发现并纠正过一次 D-1 实现回归：文本解析器先过滤回退条目，导致输出看起来像正常共享缺题。保留原坏例和断言，在现有 sourceTrace 中传递 `supportSequenceReliable`，依据过滤前的完整 blocks 判断是否允许续接。不能因为过滤后的序列干净，就把原始异常洗掉。

生产 OCR Markdown 入口原本也遇缺号就截断。现在明确递增的编号/答案表缺号进入双侧验证；重复、回退、未知题号、表格冲突、页码异常和公式异常仍阻断续接。OCR 按期望题号输出时同样保留原始序列异常标记，避免排序隐藏回退。保留原始文本、页码、字段范围和表格单元格证据。

没有修改 known-bad 回退 fixture 及其断言。原先共享缺题的预期，仅按已批准的新规则修改；单侧缺题、重复、回退、未知、越界的拒绝规则保留。

## 精确冻结登记

用户批准替换两个历史“必须与旧提交字节不变”的冻结检查。两条检查仍保留原来的六个文件和两个基线提交；仅三个明确登记文件使用精确 SHA-256，其余三个继续与旧基线比对。LF 统一只消除换行格式差异。

登记位置：`architecture/pdf-freeze-approved-repairs.json`。静态登记，不会在验收时自动更新哈希。不匹配的后续内容修改仍失败；用内存追加未批准代码的测试验证了拒绝行为。

| 登记文件 | 最终 SHA-256（LF） |
| --- | --- |
| qisi-pdf-support-block-parser.js | 1ff6d5d9810f3b6a1bf7d4f7266a84e73f418ddbcdbb57ece87dd0c6dfc22d2e |
| qisi-pdf-support-controlled-write.js | d8e4446f610ba45a77c4784eaa1b7028972a2da392910369b0e12863ab2d371d |
| qisi-pdf-support-aligner.js | 7170e08afa4f5beca74071790dc913c5057260b69ca51801b175f1f888203d4b |

登记机制是开发验收规则，不能抵御有意同时篡改代码和审批文件的攻击；哈希/授权记录的变更仍需代码审查。这不是运行时安全机制。

## 证明范围与性能

令 E 为合法、严格递增的期望题号集合，A、S 分别为完整答案、解析序列。在 D-1 条件下，A=S=T，T 严格递增且 T⊆E，原始序列没有被过滤或排序隐藏的异常。

安全性：每个接受题号 t 都同时具有显式答案和解析，两侧唯一、同号，且 t∈E；通过题号关联，无偏移、无语义猜测。E\T 没有配对证据，继续扣留。原始异常或 A≠S 不满足条件，不能进入续接分支。

最优性：本规则只允许接收 T 中明确配对的题，任何合法输出的题号集合 U 必须满足 U⊆T，所以 |U|≤|T|。实现接受全部 T，达到 |T| 上界。因此它在**该输入模型和已授权规则下达到最大安全配对覆盖**。该结论不证明 OCR 内容正确，不证明整套导入系统全局最优，不把实验枚举当作一般数学证明。

新续接决策的扫描与集合操作为 O(|E|+|A|+|S|)，辅助空间 O(|E|+|A|)。要拒绝任意位置的未知/回退异常，最坏情况下必须读取全部题号；要枚举缺失题号还需读取 E，所以其验证扫描达到线性输入下界。原有 report 中的重复检测等算法仍有二次复杂度，**整个 aligner 不具有线性时间或全局性能最优的证明**。未扩展为无关性能重构。

独立一次性脚本枚举 E={1,…,8} 的所有 256×256 答案/解析子集组合，共 65,536 组。使用独立集合/前缀 oracle 校验：相同子集接受全部，否则仅保留两侧共同的连续安全前缀。另检查 256 组 `supportSequenceReliable=false`，均不能扩大前缀。全部通过。该脚本留在本地验证产物目录，没有加入持续测试套件。

同进程、同 VM 编译方式对比原提交和最终 aligner；交替六轮，每轮 3000 次，丢弃预热轮，固定 19 题缺 7 输入。每次中位数从 0.08763 ms 到 0.08455 ms，安全配对数从 6 到 18。此数据仅说明这个小样例未观察到明显耗时退化；细小差异可能属于运行噪声，不能承诺整体提速。此前不同调用环境的 0.02441 ms 测量不能与这组 VM 测量混比。没有真实材料 OCR 准确率统计。

N40 在 K 个输入项、总文本长度 L 的完整输出模型下，输入输出至少需要 Ω(K+L)；遍历 Θ(K)，继续调用原有清理函数，不改变该函数复杂度。不把旧实现通过丢弃第五项节省的时间当成同任务的性能优势。

## 最终验证

系统 Node v24.16.0；显式清空 NODE_OPTIONS。没有调用真实 AI/OCR，没有读写生产 IndexedDB。浏览器门禁使用已有隔离测试库及 mock。

| 检查 | 结果 |
| --- | --- |
| 初批四个相关文件，修复前/后 | 193 项：189 通过、4 失败 → 193 全部通过。 |
| OCR 生产缺题用例，修复前 | 合法 19 题缺 7 被截为 prefix，而应为 subset；回归断言失败。 |
| OCR、aligner、projection、batch smoke 局部验证 | 73/73 通过；编号与答案表 × 双侧缺题、单侧缺题、回退六种生产场景均通过。 |
| `npm.cmd run verify:safe`（允许桌面测试临时写入） | **1773/1773，0 fail、0 cancelled、0 skipped**；其后的 smoke 20/20 与 verify:no-real-ai 通过。 |
| `npm.cmd run verify:batch-safety` | 通过；包含 DOCX stable、PDF known-bad、mock/no-real-AI 检查。 |
| `node scripts/verify-app-shell-architecture.js` | APP_SHELL_CORRECTIVE_CLOSURE_ACCEPTED，9 个锁定函数，0 errors。 |
| `npm.cmd run verify:diff-scope` | 通过；显式逐文件白名单，另保留原有三个未跟踪项。 |
| `git diff --check` | 通过。 |
| 独立枚举与冻结内容篡改拒绝 | 65,536 + 256 组通过；精确哈希篡改用例通过。 |

第一次完整门禁使用只读桌面沙箱，既有测试创建 `.bm_test_*`、本地上传样例时发生 EPERM，并导致 DOCX mock 浏览器测试失败。申请已授权目标目录的测试临时写入权限后，原断言不变、完整门禁通过。不是通过改断言解决环境失败。

验证日志、证明脚本和 JSON：桌面项目 `local-run-artifacts/findings-2026-10-01/`。完整成功日志为 `findings-final-verify-safe-elevated.log`。保留原始红/绿输出及环境失败日志，避免只展示成功。

## 变更与交付状态

git status --short：22 个已有 tracked 文件修改，4 个新增任务文件，另有用户要求保留的三个既有未跟踪项。没有 stage、commit 或 push，commit hash：无。

git diff --stat：已有 tracked 文件 22 files changed, 291 insertions(+), 73 deletions(-)；Git 默认 stat 不含新增的报告、哈希登记、30 行检查助手和 13 行篡改测试。

Files changed：

- 业务文件七个：qisi-utils.js、qisi-pdf-support-block-parser.js、qisi-pdf-support-controlled-write.js、qisi-pdf-support-aligner.js、qisi-pdf-ocr-support-parser.js、qisi-pdf-candidate-projection.js、qisi-import-validation-service.js。
- 授权验收：architecture/pdf-freeze-approved-repairs.json、scripts/verify-frozen-pdf-files.js，两处原冻结验收测试和一个篡改拒绝测试。
- 相关既有测试：bare-latex display、选项清理 fixture、PDF block/controlled-write/aligner/projection/characterization、import validation、batch smoke。新增长期测试共九个，均针对具体复现、授权规则或新增安全边界。
- 规则与记录：ai/AGENT_CONSTITUTION.md、ai/STABLE_CHAINS.md、ai/CODEX_TASK.local.md、skills/pdf-support-safe-align/SKILL.md、本报告。

app.js、UI、DOCX parser、依赖、真实数据未变。旧题库里已丢失的选项或已错误写入的答案不会被此修复自动恢复。

## 其他审计条目与未完成范围

编号纠正（2026-10-01）：先前将第一轮“问题5”的 aligner 归一化修复误记为 N5。N5 实际是草稿编辑器脏标记问题，未修；第一轮问题5的其他模块也未完整修复。N12只修了 aligner 一处，仍待关闭。

按 N1–N56 逐项关闭口径：56 项减去报告已推翻的 N19/N20/N21/N24，再减本轮完整修复的 N1/N2/N39/N40，剩 48 项待复核/修复（原 33 项剩 31，加 N38–N56 的 19 项中剩 17）。D-1 不在 N1–N56 内，已单独完成。48 是未关闭清单条目数，不能等同于 48 个已独立确认的当前生产 bug。

| 条目 | 独立核对结果 |
| --- | --- |
| 第一轮指纹分隔符碰撞 | 当前桌面代码已有 qisi-core-v2 + JSON 编码修复，未重复改动。 |
| 嵌套 smoke wrapper | 当前 Node 24 下 25/25 通过，完整门禁也通过；报告的 Node 22 环境尚未核验，未改 wrapper。 |
| docs 已停止更新 | Git 存在后续文档更新，不能依据旧时间戳认定整体过期。 |
| N41 小数页码 | 已复现 `expandPageRange('3.14',10)` 输出 `[3.14]`；本阶段未修。 |
| N38 索引失效/未回填 | 尚未证实当前正常 v9 升级和事务写入路径存在报告推断的缺陷；未添加“未命中就全表扫”的兜底。 |
| 其他条目 | 尚未逐项完成当前版本复现，不能认定全部存在或全部已解决。 |

Not done / Risks：全报告逐项关闭、真实材料识别准确率验收、存量污染修复和全流程性能最优证明均未完成。本阶段安全边界与测试通过不构成这些结论。

Next recommended task：单独复核并修复 N41 等剩余条目，逐项先复现再改根因。当前阶段已验收，按 AGENTS.md 的“Do not enter the next stage after finishing the current task.”停止，不自动扩展到下一阶段。
