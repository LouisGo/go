# 项目总览

LouisGo 的目标是让 AI 编程项目拥有一个 Git 可同步、可审计、可裁剪的上下文底座。它不是完整知识库，也不是后台记忆系统；它是把 AI 真正需要复用的 prompt 材料整理成 `.louisgo/` 协议。

## 当前闭环

```text
init 一次启用 -> 普通会话自动 context -> start 按需深度恢复 -> verify 记录事实 -> finish 正式交接
```

这个闭环已经通过本仓库自举验证：

- 本仓库可以用自己的 `.louisgo/` 恢复上下文。
- `louisgo context` 可以生成带来源、预算和优先级契约的上下文包。
- 刚初始化且没有真实项目记忆时，`louisgo context` 会使用 cold-start 旁路，不展开模板文件。
- `louisgo status` 可以报告协议、恢复来源、验证状态和工作区 diff。
- `louisgo verify` 可以运行项目门禁并写入机器可读结果。
- `louisgo finish` 可以生成正式 `HANDOFF.md`，供新会话恢复。
- `louisgo log` 可以输出本地诊断日志，帮助回看流程是否真正起作用。
- 外部 Git 项目可以通过全局 `louisgo init`、`npx --yes louisgo@latest init` 或本地 `dist/cli.js init` 开始实验。

## 文档边界

| 文档 | 作用 |
| --- | --- |
| `README.md` | 对外安装、日常用法和外部项目实验。 |
| `docs/01-product.md` | 产品心智、AI 行为和闭环定义。 |
| `docs/02-protocol.md` | `.louisgo/` 文件协议和数据结构。 |
| `docs/03-roadmap.md` | 已完成底座和下一阶段候选。 |

## 设计原则

- 日常入口保持少：`init`、自然对话、`$start`、`$finish`。
- 初始产物保持薄；行为 skill 通过 `louisgo skill` 按需启用，不能覆盖项目已有同名 skill。
- 用户本轮 prompt 永远优先；LouisGo 只提供上下文前缀。
- Markdown + YAML Front Matter 是默认协议格式；JSON 只用于验证结果。
- `HANDOFF.md` 是正式恢复，`STATE.md` / `MEMORY.md` 是日常辅助。
- 源码、Git 和验证结果优先于记忆叙述。
- 文档和协议文件保持短，能被新 AI 会话快速读取。
