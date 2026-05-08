# 路线图

## 已完成底座

- Node.js + TypeScript CLI，包名 `louisgo`，公开版本 `0.1.0`。
- `.louisgo/` 协议初始化：mission、capabilities、state、memory、roadmap、verify scripts。
- Codex 集成：skills、`AGENTS.md` 指令块、普通会话自动读取 `louisgo context`。
- `louisgo context`：按层编译 prompt cache，输出来源、预算和用户 prompt 优先契约。
- `louisgo status`：报告协议完整性、当前任务、验证状态、恢复来源和工作区 diff。
- `louisgo verify`：运行项目验证入口，写入 `test-results.json` 并检查新鲜度。
- `louisgo finish`：生成正式 `HANDOFF.md`，记录 Git diff、验证、阻塞、确认请求和下一步。
- `louisgo confirm`：读取结构化确认请求，支持命令行选择和终端 fallback。
- `louisgo log`：输出本地诊断日志，帮助跨项目回看流程是否有效。
- 本仓库自举验证：format、typecheck、test、build、pack check 已进入 LouisGo verify 门禁。
- 工作阶段管理：STATE.md 支持 explore/execute/idle 三态，上下文按阶段注入不同指导。
- ROADMAP 完成信号：任务行支持 `#completion:` 后缀定义完成标准。
- 结构化证据链：STATE.md Evidence 段支持 claim | basis | implication 格式。
- CONTEXT.md 协议文件：可选领域术语表，AI 上下文组装时自动包含。
- ADR 草稿模板简化：三问过滤、可选段落、一段式支持。
- Codex skill 描述规范化：英文两句话模式、中文标题移入 body。
- 上下文头部领域术语提示：CONTEXT.md 存在时自动添加术语提示。
- Codex-first stats：本地 context token 估算、Codex usage 显式导入、cached token ratio 和 simulated savings。
- 轻量初始化：`init` 只写最小协议，未形成真实记忆时 `context` 使用 cold-start 旁路。
- 按需预设 skill：`louisgo skill list/enable/disable` 管理 grill/caveman，并检测项目同名 skill 冲突。
- 项目清理：`louisgo clear --dry-run` 预览目标，`louisgo clear` 通过终端交互确认后删除当前项目 `.louisgo/` 和项目 `AGENTS.md` 管理块。

## 下一阶段候选

- P1：`init` 时交互选择平台：Codex、Claude Code、Gemini CLI、Cursor、其他 CLI。
- P2：为非 Codex 平台输出对应 rules/memory 文件。
- P3：增加轻量 repo map，只缓存关键路径、模块边界和验证入口。
- P4：改进 `context --capsule`，生成更明确的 subagent 写入边界和返回格式。
- P5：CONTEXT.md 自动填充：AI 在探索阶段自动从代码中提取候选术语。
- P6：多平台规则输出：为 Claude Code、Gemini CLI 等生成对应的 memory/rules 文件。
- P7：扩展 stats adapter 到 Claude Code、OpenCode、Cursor，并支持用户自定义 pricing。

## 不做

- 默认不做后台服务、数据库、向量检索或云同步。
- 默认不保存完整聊天记录。
- 不让记忆覆盖源码、Git、验证结果或用户本轮 prompt。
