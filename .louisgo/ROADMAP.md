# Roadmap

## Self-bootstrap Closed Loop

- [x] T001 人工试用 LouisGo 自举流程
- [x] T002 确认 npm 发布版本、许可证和包名
- [x] T003 发布前审查和正式发布
- [x] T004 CLI 版本读取 package.json 单一来源
- [x] T005 confirm 支持交互式选择和补充输入
- [x] T006 pack:check 使用隔离 npm cache 并进入验证门禁
- [x] T007 收敛自举成果为人能理解、AI 能执行、外部项目能实验的最小闭环
- [x] T008 增加可跨项目投递给 AI 诊断的 LouisGo 流程日志
- [x] T009 工作阶段管理（explore/execute/idle）
- [x] T010 ROADMAP 完成信号（#completion:）
- [x] T011 结构化证据链（STATE.md Evidence 段）
- [x] T012 CONTEXT.md 可选协议文件
- [x] T013 ADR 草稿模板简化
- [x] T014 Codex skill 描述规范化
- [x] T015 上下文头部领域术语提示
- [x] T016 Codex-first stats 与上下文观测

## Next Candidates

- P1：`init` 交互选择 AI 平台，而不是拆成多个用户命令。
- P2：为 Claude Code、Gemini CLI、Cursor 等平台输出对应规则文件。
- P3：增加轻量 repo map，只缓存关键路径和模块边界。
- P4：增强 `context --capsule` 的 subagent 写入边界和返回格式。
- P5：CONTEXT.md 自动填充：AI 在探索阶段自动从代码中提取候选术语。
- P6：多平台规则输出：为 Claude Code、Gemini CLI 等生成对应的 memory/rules 文件。
- P7：扩展 stats adapter 到 Claude Code、OpenCode、Cursor，并支持用户自定义 pricing。
