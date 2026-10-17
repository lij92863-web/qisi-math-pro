# MinerU 接手：离线准备与最小样本待授权任务 — 2026-10-04

依据用户本轮指令：阅读 `PDF_V1_MINERU_API_HANDOFF_2026-10-04.md`，按第 12 节继续，保留现有改动和全部证据。本轮先完成步骤 A 及步骤 B 的可审核准备；认证、材料上传分别等待明确授权。“留在本地”未被本轮笼统继续指令解除。

## 当前执行范围

- 保留历史 dirty，不 reset/stash/commit/push。冻结当前文件字节、Git 状态、旧证据、原账本、两源 PDF、gold、保护 smoke 和 DPAPI 凭据 hash。
- 查阅当前 MinerU 官方云接口、公开 OpenXLab 认证实现；只下载阅读公开资料，不安装或执行 SDK，不解密密钥、不联网认证。
- 从深圳原第 13 页、河北原第 6/7 页生成两个本地子 PDF。保留原页内容，去除其他页和非页面附件，冻结实际外发文件 hash、页数、原页映射，并渲染逐像素对照。原 PDF 不变。
- 在 ignored 实验目录实现只接受注入 mock 端口的认证/异步响应契约、有限轮询、明确来源映射及未知结果结构隔离。不注册生产模块、不创建完整题目、不使用旧语义 parser。
- 冻结最小实验待授权清单；运行 mock、文件范围和完整 verify:safe，交一份接手报告。

允许新增：本文件、`ai/PDF_V1_MINERU_OFFLINE_PREP_2026-10-04.md`、`local-run-artifacts/mineru-offline-prep-2026-10-04/**`（ignored）。所有既有文件只读，包括历史报告、凭据、账本、保护测试及产品代码。保留证据，不清理旧文件；无依赖安装、生产 DB/IndexedDB/localStorage 操作或用户 3000 服务操作。

## 真实最小实验草案（未获授权，不执行）

目的：验证专用解析 API 能否保留已知反例的关键公式、数字、字形和跨页尾段，以及来源块/资源的真实协议。不是录题生产替换或整卷通过。

输入仅为本地新生成的 `shenzhen-p13.pdf`（1 页）和 `hebei-p06-p07.pdf`（2 页）。原文件与样本 hash、原页映射见实验目录 `sample-manifest.json`。不发原整卷、不发 gold、不发旧模型响应、正确答案或纠正公式。参数固定 `model_version=vlm`、`enable_formula=true`、`enable_table=true`、`language=ch`、每文件 `is_ocr=true`；不做 pipeline/vlm A/B。

认证：已从官方 PyPI 的 OpenXLab 0.1.3 发布包核实，先 `POST https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/auth` 提交 AK 取得 nonce/algorithm；SK 仅在本地内存签名，再 `POST https://openapi.openxlab.org.cn/api/v1/sso-be/api/v1/open/getJwt` 提交 AK 和签名 d。最多一次认证流程/两次 HTTP 请求，不发送 SK。仅用公开源码核对协议，不执行 SDK 的持久化/更新逻辑；实际服务响应尚未验证。认证资料与上传授权分开登记；取得 OpenXLab JWT 不代表 MinerU 权限。若需 MinerU 管理页 Token，只通过本地加密路径处理，不在聊天或 Git 写值。凭据有效性、MinerU 权限和账户权益仍未知。

提交/文件接收：`POST https://mineru.net/api/v4/file-urls/batch` 申请两个上传链接；文件 PUT 目的地必须是原响应给出的 HTTPS 地址，并在已确认来源域内（文档当前示例 `mineru.oss-cn-shanghai.aliyuncs.com`），未知域/重定向先停。上传到签名 URL 时不附认证服务密钥或 MinerU Bearer。两个 PUT 完成即可能自动开始解析，无须再次提交。

结果：`GET https://mineru.net/api/v4/extract-results/batch/{batch_id}`；下载仅采用结果原响应的 HTTPS 地址，当前文档示例 `cdn-mineru.openxlab.org.cn`。签名参数保留在本地原响应，不打印。原 ZIP 保存并 hash 后只离线检查，不执行包内文件、不跟随资源里的外链。

拟定上限：认证流程最多 1 次/HTTP 最多 2 次；申请上传链接最多 1 次；文件上传最多 2 次；解析文件最多 2 个/3 页；轮询最多 30 次、间隔至少 10 秒、总等待 5 分钟；结果包最多 2 个、每包 100MB（此为本地实验资源上限）。不自动重试、不复发提交、不换厂商、不升级模型。未取得可用权限或错误终态立即停，保留失败记录。认证-only 授权不允许申请解析上传链接或上传文件。

费用止损：仅在账户明确显示此次 3 页可用免费权益时运行，付费预算上限 0 元；无法核实权益、要求付款或费用不确定则暂停。官网“1000 页最高优先级额度”不作为免费证明。记录实际账单/usage；缺失时记未知，不能冒称实测费用 0。旧 DashScope 124/150 账本只读，26 次预留不挪用，新服务单独记认证/提交/上传/处理页/轮询/下载与失败次数。

质量停止条件：公式/数字/字形/尾段新增错误，原文遗漏或资源来源无法解释时保留反例并停止扩页。首轮仅报告 OCR 原文与来源资源，不推定自动题号组织可靠。至少重点核深圳等式的 `8^16`、河北第 6 题续文及“故选 D”、第 5 题原 `a3` 和“齐次”；完整样本逐段目视核对，图中文字/页脚也保留。

进入 13 页同源两轮、组织层设计、生产切换和两卷 38 题最终验收均为后续阶段，本轮不自动进入。

## 当前完成条件

现场/保护字节一致；子 PDF 页数/映射/像素核查成立；mock 覆盖错误/未知状态/身份失配/超时/未知 schema 的拒绝与原证据保留；默认测试无真实 AI；完整 verify:safe 成功；给出具体缺失授权及材料。
