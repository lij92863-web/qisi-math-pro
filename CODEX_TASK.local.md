当前确认：以后正式开发目录就是：

```text
c:\Users\Administrator\Desktop\题库系统
```

这是我从昨晚备份文件重新整理出来的项目目录。现在不要执行 C8A，也不要执行 C8B。先执行 **C8-0：Git 初始基线建立**。

## C8-0 任务目标

把 `c:\Users\Administrator\Desktop\题库系统` 初始化为正式 Git 项目根目录，建立可回退、可审计、可提交的开发基线。

本轮只允许：

1. 确认项目根目录；
2. 初始化 Git；
3. 创建 `.gitignore`；
4. 安装依赖，如果缺少 `node_modules`；
5. 运行安全验证；
6. 做初始基线提交。

不得修改业务代码，不得修功能，不得重构，不得创建 AGENTS.md / ai / skills。

---

## 第一步：进入项目目录并确认文件

在 Windows cmd 或 PowerShell 中执行：

```bat
cd /d c:\Users\Administrator\Desktop\题库系统
dir
```

确认当前目录至少包含：

```text
package.json
package-lock.json
app.js
main.html
app.css
qisi-batch-importer.js
qisi-local-server.js
tests
scripts
```

如果这些文件不存在，立即停止，报告：

```text
当前目录不是项目根目录，未执行 git init。
```

---

## 第二步：确认当前不是 Git 仓库

执行：

```bat
git status --short
```

如果提示：

```text
fatal: not a git repository
```

这是正常的，继续执行 `git init`。

如果已经是 Git 仓库，则不要重复初始化，直接报告当前 `git status --short` 和 `git log --oneline -5`。

---

## 第三步：初始化 Git

执行：

```bat
git init
```

---

## 第四步：创建 .gitignore

只允许新增 `.gitignore`，内容如下：

```gitignore
# dependencies
node_modules/

# environment
.env
.env.*
!.env.example

# runtime temp
tmp/
uploads/
converted/

# logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS / editor
.DS_Store
Thumbs.db
.vscode/
.idea/

# local generated backups
*.bak
*.tmp
```

注意：

不得忽略以下文件或目录：

```text
app.js
main.html
app.css
qisi-*.js
package.json
package-lock.json
tests/
scripts/
```

---

## 第五步：安装依赖，仅在需要时执行

先检查是否存在 `node_modules`。

如果没有 `node_modules`，且存在 `package-lock.json`，执行：

```bat
npm ci
```

如果 `npm ci` 失败，立即停止，报告失败日志摘要，不要改代码。

如果已经存在 `node_modules`，跳过安装。

---

## 第六步：运行安全验证

执行：

```bat
npm run verify:safe
```

如果失败，立即停止，不要提交，报告：

```text
失败命令：
失败摘要：
是否修改过业务代码：否
```

---

## 第七步：做初始基线提交

如果 `npm run verify:safe` 通过，执行：

```bat
git status --short
git add .
git commit -m "stage C8-0 initialize git baseline"
git status --short
git log --oneline -5
```

---

## 明确禁止

本轮不得：

```text
修改 app.js
修改 main.html
修改 app.css
修改 qisi-*.js
修改 tests/
修改 scripts/
修改 package.json
修改 package-lock.json
调用真实 AI/OCR
创建 AGENTS.md
创建 ai/
创建 skills/
执行 C8A
执行 C8B
修任何功能
重构任何代码
```

如果 `npm ci` 导致 `package-lock.json` 变化，立即停止，报告变化，不要提交。

---

## 最终报告格式

```text
Stage: C8-0
Project root: c:\Users\Administrator\Desktop\题库系统
Project root confirmed: yes/no
Git initialized: yes/no
.gitignore created: yes/no
Dependencies installed: yes/no/skipped
Tests:
Commit:
Working tree:
Not done:
Next recommended task:
```

完成 C8-0 后停止。

下一步推荐任务只能写：

```text
C8A：重新执行 CODEX_TASK_2_AGENT_CONSTITUTION_AND_SKILLS.md，创建 AGENTS.md、ai/*、skills/*。
```
