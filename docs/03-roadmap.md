# 路线图

## 已完成底座

- Node.js + TypeScript CLI。
- `.louisgo/` 协议目录初始化。
- Markdown + Front Matter 读写。
- Git HEAD / diff hash。
- 验证脚本运行和新鲜度判断。
- `status`、`confirm`、`verify`、`pause`、`finish`、`handoff promote`、`codex setup` 基础命令。
- Codex skill 和 `AGENTS.md` 安装能力。

## 当前重构

- [x] 收敛文档为少数核心契约。
- [x] 初始化时创建 `STATE.md`、`MEMORY.md`、`memory/`、`sessions/`。
- [x] `louisgo init` 默认安装 Codex 集成。
- [x] Codex 指令改为自动上下文恢复，而不是要求每个新会话 `$start`。
- [x] `louisgo finish` 默认更新正式 `HANDOFF.md`。
- [x] 状态检查将 `HANDOFF.md` 作为最高恢复来源，`STATE.md` / `MEMORY.md` 作为辅助。
- [x] 产品定位从完整记忆系统收敛为 Git 可同步的 prompt 智能缓存。
- [x] 明确 L0-L5 分层缓存架构和 subagent context capsule 方向。
- [x] 实现 `louisgo context`，输出按 L1-L4 组装的上下文包。
- [x] 将 `$start`、Codex skill 和 AGENTS 默认路径切到 `louisgo context`。

## 后续

- P1：将 `STATE.md` / `MEMORY.md` 模板进一步压缩，确保默认新会话 prompt 足够短。
- P2：支持 `louisgo init` 交互选择 AI 平台：Codex、Claude Code、Gemini CLI、Cursor、其他 CLI。
- P3：为 Claude Code、Gemini CLI、Cursor、Continue 等平台输出对应 rules/memory 文件。
- P4：增加轻量 repo map，只缓存符号和关键路径，不做全文索引或向量库。
