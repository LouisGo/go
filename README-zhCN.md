# LouisGo

English: [README.md](README.md)

LouisGo 是 AI 编程任务连续性工具。它把个人任务 checkpoint 放在团队 Git 之外，
再为新会话编译最小必要上下文，帮助长任务跨窗口、跨设备、跨会话继续。

## 最小闭环

```text
npm install -g louisgo
louisgo init
louisgo context
# 正常让 AI 开发
louisgo pause --message "这次改了什么"
louisgo resume
louisgo verify
louisgo finish
```

| 阶段 | 用户动作 | CLI 行为 |
| --- | --- | --- |
| 安装 | `npm install -g louisgo` | 安装 `louisgo` 命令。 |
| 启用仓库 | `louisgo init` | 创建很小的 `.louisgo/` 项目 anchor 和可选 Codex 路由。 |
| 工作 | `louisgo context` | 编译当前请求、active task、项目 anchor、Git 和验证事实。 |
| 暂停 | `louisgo pause` | 写入 `~/.louisgo/` 下的私有 task checkpoint。 |
| 恢复 | `louisgo resume` | 检查仓库状态并输出恢复包；不匹配时阻断并说明原因。 |
| 验证 | `louisgo verify` | 运行项目验证，并把结果挂到 active task。 |
| 收尾 | `louisgo finish` | 写入私有阶段总结，用于 commit、PR 或下次会话准备。 |

## 存储边界

个人任务状态默认写在仓库外：

```text
~/.louisgo/
  projects/<project-key>/
    active-task.json
    tasks/<task-id>/
      meta.json
      state.md
      checkpoints/latest.md
      resume.md
      verification.json
      finish.md
```

仓库内 `.louisgo/` 只是小型共享 anchor，不是个人 checkpoint、resume prompt、
stats、run log、转交文件或 subagent 队列的位置。

## Codex 使用

```text
npm install -g louisgo
cd /path/to/your/git-project
louisgo init
```

常用命令：

```text
louisgo status
louisgo context --goal "继续重构"
louisgo pause --message "完成 parser 边界"
louisgo resume
louisgo verify
louisgo finish
```

Codex directive skills 会把 `$context`、`$pause`、`$resume`、`$verify`、`$finish`
映射到同名 CLI 命令。

## Subagent

Codex 已提供原生 subagent 能力。LouisGo MVP 不做自己的 subagent 调度器。

LouisGo 只提供窄上下文胶囊：

```text
louisgo context --capsule --goal "review verification flow"
```

这个胶囊可以交给 Codex 原生 subagent；LouisGo 只负责任务连续性和上下文编译。

## 诊断

诊断数据默认也是私有的：

```text
louisgo log --tail 30
louisgo stats
louisgo stats import codex --days 7
```

Codex usage 导入只保存 token 数字，不保存 prompt、回复、源码或 secret。

## 开发命令

```text
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm pack:check
node ./dist/cli.js verify
```
