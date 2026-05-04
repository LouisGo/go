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

## Next Candidates

- P1：`init` 交互选择 AI 平台，而不是拆成多个用户命令。
- P2：为 Claude Code、Gemini CLI、Cursor 等平台输出对应规则文件。
- P3：增加轻量 repo map，只缓存关键路径和模块边界。
- P4：增强 `context --capsule` 的 subagent 写入边界和返回格式。
