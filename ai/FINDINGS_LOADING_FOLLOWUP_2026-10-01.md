# 用户复核后的追加修复（2026-10-01）

目标：保全未提交成果与用户修改，隔离旧测试快照，修复N50/N51的实际加载脆弱性。

## 保存与证据隔离

修改前63个文件、相对HEAD的完整二进制补丁、Git状态和逐文件SHA-256保存在C:/Users/Administrator/Desktop/题库系统-修复存档/2026-10-01-followup。包含用户修改的tests/base-migration-smoke.test.js，内容SHA-256为3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea，本次不修改它。独立运行5/5通过。

旧all-48证据目录已原样移动到上述存档的previous-evidence/all-48，58个文件逐字节哈希相同，9个旧测试退出默认扫描。保留原递归测试命令，没有改旧副本、删测试、缩小正式测试范围或靠.gitignore规避。

## 实现与时序证明

Config的常量全部保留在Qisi.Config，不在加载期解构Vue。Components保留原六个公开对象/函数，注册时只创建定义，Vue在组件setup时读取。App只在加载时登记一个入口，DOM仍在解析则注册一次DOMContentLoaded回调，DOM已就绪则立即使用原Runtime.boot；所有Vue/配置/组件读取在这个启动阶段发生。对于普通同步页面脚本，DOMContentLoaded晚于全部脚本执行，因此三入口与Vue的任何排列都会先完成注册再挂载。24种排列逐一执行通过。这不承诺任意晚到的动态async脚本或真实缺失的依赖自动恢复；缺依赖继续由Runtime报错。

DB的比较/指纹和v9索引hook使用调用时委托，同一输入/参数交给原QuestionDuplicatePolicy，没有第二套算法或备用语义。DB脚本执行不要求去重策略已经存在；实际DB调用仍要求它存在。Dexie和QuestionIndexStorage的配置依赖保留并由加载门禁检查，不改数据库版本/字段/事务。真实隔离浏览器将App/Components/Config移到Vue之前并将DB放到策略之前：正常挂载、临时题目的creating hook产生正确core/stem v2指纹。测试数据库随隔离浏览器销毁，未操作生产库。

App的9个业务函数完整AST哈希、调用白/黑名单均保持原值，只人工登记闭包/启动代码新增的AST预算和整体14行偏移。业务路由、写入、对齐链没有变化。本轮没有新解析算法，因此没有用算法优化名义扩大变更。只新增两项模块加载回归并扩充一项DB先加载案例；图片安全测试通过Components公开出口取原函数，全部恶意URL断言保留。

## 验证

- 旧代码两项加载回归失败，直接复现Vue is not defined。
- 窄回归11/11；24种顺序；用户独立进程自检5/5；重排真实浏览器与实际索引hook均通过。
- app-shell、runtime库存/存在性/剩余加载顺序、no-real-ai、diff --check均通过。
- 最终verify:safe：1769/1769通过，失败/取消/跳过均0；DOCX稳定20/20、PDF已知坏样本68/68、批量mock20/20及no-real-ai均通过。

## 范围与交付状态

本轮新增改动：qisi-config.js、qisi-components.js、app.js包装与启动、qisi-db.js策略委托、scripts/verify-runtime-modules.js、精确责任矩阵、tests/runtime-module-loading.test.js、tests/db-fingerprint-owner.test.js、tests/image-display-url.test.js及本组ai报告/任务文件。上一轮未提交修改全部保留；用户测试修改字节不变；原三个未跟踪项未修改。没有改package-lock、vendor、数据库模式、生产数据或外部接口，没有真实AI/OCR、commit或push。原48项计数更新为39项修复/改进、9项排除/约束、待处理0；大备份恢复限额等原实际边界不因本轮改变。


测试总数说明：用户复核时1792项包含误扫描旧快照；移出后正式范围为1766项，本次新增3个加载根因案例得到1769项。上轮1786日志还包含用户随后修复的父测试内20个嵌套子测试；现在这20个场景仍在独立子进程执行通过，不计入父进程总数。没有删除正式测试或缩小测试发现范围。

最终scope/app-shell/runtime/no-real-ai/diff-check均通过；桌面项目正式tests目录外发现测试文件0个；9个核心业务AST哈希与调用约束不变；旧证据58个和改动前63个存档文件哈希不变，用户测试哈希不变。
