---
schema: louisgo-memory-v1
updated_at: "2026-05-06T16:20:00.000Z"
---

# Memory

## Stable Notes

- 用户希望 80%-90% 日常工作只用 `$init`、`$start`、`$finish`；高级命令面向 AI、调试和自动化。
- LouisGo 定位为 Git 可同步 prompt cache，不做默认外部记忆系统。
- `HANDOFF.md` 是正式、大粒度交接；存在时优先读取，但没有 handoff 时不能导致新会话失忆。
- `louisgo context` 是可执行上下文编译器：按稳定层级组装、报告来源、控制预算、保留用户 prompt 优先级。
- `louisgo status` 必须让用户和 AI 看懂协议状态、验证状态、恢复来源和 Git 工作区是否还有待处理变更。
- 子 agent 使用 `louisgo context --capsule --goal "<任务>"` 获取干净上下文，避免继承完整聊天历史。
- `louisgo@0.1.0` 已发布到 npmjs，许可证 MIT；registry 安装 smoke test 已通过。
- CLI 版本从 `package.json` 读取，避免发版时 `package.json` 与 `louisgo --version` 漂移。
- `louisgo confirm --interactive` 支持终端交互式选择和补充输入；Codex 内仍可由 AI 展示并转接用户回复。
- `pnpm pack:check` 使用临时 npm cache，且已纳入本仓库 LouisGo verify 门禁。
- 当前自举收敛目标：README 给人看，`AGENTS.md`/skills 给 AI 执行，`context/status/verify/finish` 给其他项目实验。
- T007 已通过本仓库验证和临时外部 Git 项目 smoke：init/context/verify/finish/status 均可运行。
- `HANDOFF.md`、`STATE.md`、`QUICK_SAVE.md` 等生成型恢复文件不再计入验证 diff hash，避免 `$finish` 后验证立即无意义 stale。
- `RUNLOG.md` 是本地诊断日志：自动记录 LouisGo 命令级事件和状态摘要，默认被 `.louisgo/.gitignore` 忽略，调试时可发给 AI。
- T008 已通过本仓库测试和临时外部 Git 项目 smoke：`louisgo log --tail 10` 能输出 init/context/verify/finish 事件。
- T016 引入 Codex-first stats：`louisgo context` 写本地 token/section 事件，`louisgo stats import codex` 显式导入 Codex JSONL usage，`.louisgo/stats/` 默认忽略且不保存 prompt/回复/源码。

## Topic Files

- `.louisgo/memory/` 只放跨会话复用的长期主题记忆。

## Recent Sessions

- `.louisgo/sessions/` 只在需要审计、交接或总结关键会话时使用。
