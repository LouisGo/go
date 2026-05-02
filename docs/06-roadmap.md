# MVP 路线图

## 使用规则

- 本文件是执行入口，只保留任务状态和任务标题。
- 任务细节、依赖、完成标准和测试要求见 `docs/05-task-breakdown.md`。
- 任务 ID 必须稳定，不得复用。
- 任务完成必须基于事实：代码产出、测试结果或用户确认。

## P0 项目基础

- [x] T001 初始化 Node.js + TypeScript 项目
- [x] T002 配置代码质量基础

## P1 协议模型和文件读写能力

- [x] T003 定义协议常量和路径解析
- [x] T004 定义协议 schema
- [x] T005 实现 Markdown Front Matter 读写
- [x] T006 实现安全写入
- [x] T007 实现 ROADMAP 解析

## P2 脚手架和状态检查

- [x] T008 实现模板生成
- [x] T009 实现 `louisgo init`
- [x] T010 实现协议完整性检查
- [x] T011 实现 `louisgo status`

## P3 Git 状态、diff hash 和验证能力

- [x] T012 实现 Git 基础能力
- [x] T013 实现 `diff_hash`
- [x] T014 实现验证结果读写和新鲜度判断
- [x] T015 实现验证脚本运行器
- [x] T016 实现 `louisgo verify`

## P4 会话工作流命令

- [x] T017 实现 QUICK_SAVE 和 CONFIRM_REQ 协议读写
- [ ] T018 实现 `louisgo pause`
- [ ] T019 实现 HANDOFF_DRAFT 生成
- [ ] T020 实现 `louisgo finish`
- [ ] T021 实现 `louisgo handoff promote`

## P5 测试、文档和发布准备

- [ ] T022 完善端到端测试
- [ ] T023 完善 README 和使用说明
- [ ] T024 发布准备

## MVP 交付切片

- [x] S1 完成 T001-T011：初始化 `.louisgo/` 并查看状态
- [x] S2 完成 T012-T016：运行验证并判断结果是否新鲜
- [ ] S3 完成 T017-T021：暂停、处理确认请求、收尾和提升 handoff
- [ ] S4 完成 T022-T024：端到端测试、文档和发布准备
