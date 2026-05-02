# 项目总览

LouisGo 是仓库内 AI 编程记忆和交接协议。它的目标不是让用户记住更多命令，而是让 AI 在项目目录里持续维护可恢复上下文。

## 当前产品判断

主路径收敛为：

```text
louisgo init -> $start -> 自然对话 -> $finish
```

- `init` 是一次性启用入口，默认完成协议初始化和 Codex 集成。
- `$start` 是深度上下文重建入口，不要求每个新会话重复执行。
- 新会话的默认恢复依赖 `AGENTS.md` 自动读取 `.louisgo/`。
- `$finish` 写入正式 `HANDOFF.md`，它比滚动记忆拥有更高恢复优先级。
- `status`、`verify`、`pause`、`handoff promote`、`codex setup` 保留为高级和兼容命令。

## 文档地图

| 文档 | 作用 |
| --- | --- |
| `README.md` | 对外入口和快速使用说明。 |
| `docs/00-overview.md` | 当前文档地图和产品方向。 |
| `docs/01-product.md` | 用户主路径、命令心智和恢复优先级。 |
| `docs/02-protocol.md` | `.louisgo/` 文件协议和 Markdown 数据结构。 |
| `docs/03-roadmap.md` | 接下来实现和收敛的路线图。 |

## 设计原则

- 用户只需要少数入口，复杂协议由 AI 和 CLI 承担。
- Markdown + YAML Front Matter 是默认协议格式；JSON 只用于机器验证结果。
- 正式 handoff 和滚动 memory 分工明确：handoff 是权威交接，memory 是日常上下文。
- 验证结果是事实来源，AI 自述不能替代验证、代码事实或用户确认。
- 文档数量保持克制，过期设计应删除，不并存。
