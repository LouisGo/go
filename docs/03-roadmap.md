# 路线图

## 已完成底座

- Node.js + TypeScript CLI。
- `.louisgo/` 协议目录初始化。
- Markdown + Front Matter 读写。
- Git HEAD / diff hash。
- 验证脚本运行和新鲜度判断。
- `status`、`verify`、`pause`、`finish`、`handoff promote`、`codex setup` 基础命令。
- Codex skill 和 `AGENTS.md` 安装能力。

## 当前重构

- [x] 收敛文档为少数核心契约。
- [x] 初始化时创建 `STATE.md`、`MEMORY.md`、`memory/`、`sessions/`。
- [x] `louisgo init` 默认安装 Codex 集成。
- [x] Codex 指令改为自动上下文恢复，而不是要求每个新会话 `$start`。
- [x] `louisgo finish` 默认更新正式 `HANDOFF.md`。
- [x] 状态检查将 `HANDOFF.md` 作为最高恢复来源，`STATE.md` / `MEMORY.md` 作为辅助。

## 后续

- 支持 `louisgo init` 交互选择 AI 平台：Codex、Claude Code、Cursor、其他 CLI。
- 增加 `louisgo context` 供 AI 内部生成可读上下文包。
- 自动生成 `sessions/*.md` 摘要的结构化入口。
- 为 Claude Code、Gemini CLI、Cursor、Continue 等平台输出对应 rules/memory 文件。
