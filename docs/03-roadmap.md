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

## 下一阶段候选

- P1：`init` 时交互选择平台：Codex、Claude Code、Gemini CLI、Cursor、其他 CLI。
- P2：为非 Codex 平台输出对应 rules/memory 文件。
- P3：增加轻量 repo map，只缓存关键路径、模块边界和验证入口。
- P4：改进 `context --capsule`，生成更明确的 subagent 写入边界和返回格式。

## 不做

- 默认不做后台服务、数据库、向量检索或云同步。
- 默认不保存完整聊天记录。
- 不让记忆覆盖源码、Git、验证结果或用户本轮 prompt。
