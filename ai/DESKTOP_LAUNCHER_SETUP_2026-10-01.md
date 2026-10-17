# 桌面整理和一键启动（2026-10-01）

已创建桌面“奇思数学 Pro.lnk”，目标为Windows wscript.exe调用软件原start-app.vbs。点击后复用当前桌面服务；服务未启动时自动以隐藏窗口启动Node，检查同一软件实例并等待就绪后打开原地址http://127.0.0.1:3000/main.html。没有改浏览器来源或端口，没有改数据库或服务业务。

四个qisi目录是早期修复的代码/测试/Git补丁回滚备份，共19个文件。已按用户要求放入软件目录local-run-artifacts/历史版本存档的四个ZIP，每个ZIP内文件与原件SHA-256一致。原始目录已完整搬到桌面题库系统-修复存档/历史版本原件，未删除或修改文件。ZIP方式避免旧测试再次进入默认扫描。清单及说明位于同一存档目录。

实际验证：复制同一启动器到项目外隔离环境，只将端口改为32149、浏览器动作改为URL记录；其余启动/健康/实例/等待流程不变。冷启动与连续再次启动均通过，只有同一PID、MainWindowHandle为0、两次在就绪后到达打开页面步骤，真实main.html返回HTTP 200。测试只停止自身创建的临时服务，没有停止正在使用的3000服务。新桌面快捷方式已实际激活并复核3000桌面实例正常。

修改范围：open-app.cmd只改变启动Node为隐藏进程、更新对应说明；新增三行scripts/start-local-server.ps1。start-app.vbs原字节不变。新增此报告和任务范围记录。用户tests/base-migration-smoke.test.js修改保持原字节，SHA-256仍为3bba4b01a036dbd1d105a1eefbe527cb71264dc1ca57a18acbeb035812b59eea。程序业务、稳定导入、PDF冻结登记、依赖和生产数据均未改动，没有真实AI/OCR、commit或push。

检查时上轮项目外2026-10-01-followup存档目录已不存在，未找到原清单，不能宣称已再次核验那份70文件历史清单。本次另存当前全部工作区文件/清单及相对HEAD二进制补丁到desktop-launcher-final，包含以前未提交修复与用户测试修改；不假造原存档。

处理过程中旧Windows PowerShell曾按ANSI读无BOM脚本而生成乱码目录；19个文件已按哈希恢复，再以UTF-8 BOM执行完成。故障产生的副本放入外部存档的启动整理编码故障记录，原件内容不变，桌面没有留下乱码文件夹。

验证门禁：verify:safe全套1769/1769通过，失败/取消/跳过均0；DOCX稳定20/20、PDF已知坏样本68/68、批量mock20/20通过。范围/架构/runtime/no-real-ai/diff-check通过。冷/热启动证据：桌面题库系统-修复存档/launcher-verification/result.json。启动器修改前字节：历史版本原件/一键启动修改前。完整Git状态、diff/stat和最终门禁日志在同一外部存档的desktop-launcher-final下保存。
