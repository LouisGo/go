# 决策日志

## 使用规则

- 本文件记录已经确认的关键决策。
- 新决策使用递增编号 `D001`、`D002`。
- 如果决策被替代，不删除旧记录，而是标记为 `superseded` 并指向新决策。
- 尚未定案的问题放在 `docs/07-open-questions.md`。

## 状态说明

| 状态 | 含义 |
| --- | --- |
| `accepted` | 已接受，后续按此执行。 |
| `superseded` | 已被后续决策替代。 |
| `deprecated` | 不再推荐，但暂未替代。 |

## D001 使用 `.louisgo/` 作为协议目录

状态：`accepted`

日期：2026-05-01

决策：

- LouisGo 的仓库内协议目录统一使用 `.louisgo/`。
- 不使用旧协议目录命名。

原因：

- `.louisgo/` 更具项目归属感。
- 避免和其他 AI 工具或通用约定冲突。
- 后续文档、模板、CLI 都围绕 `.louisgo/` 设计。

影响：

- 所有协议文件位于 `.louisgo/` 下。
- 文档中不得再出现旧协议目录命名。

## D002 文档和代码注释默认使用简体中文

状态：`accepted`

日期：2026-05-01

决策：

- 项目文档使用简体中文。
- 后续代码注释默认使用简体中文。
- 命令名、文件名、字段名、schema 值等协议标识可以使用英文。

原因：

- 项目主要维护者使用中文进行需求和设计讨论。
- 简体中文更利于长期理解设计意图。
- 协议标识保持英文有利于跨工具稳定。

影响：

- `docs/` 文档统一使用简体中文。
- 代码注释应优先使用简体中文。

## D003 显式指令使用 `$` 前缀

状态：`accepted`

日期：2026-05-01

决策：

- AI 工作流显式指令使用 `$` 前缀。
- MVP 指令为 `$start`、`$pause`、`$resume`、`$finish`。
- 后续预留 `$delegate`、`$merge`、`$review`、`$decide`。

原因：

- `$` 更像命令调用，贴近 Codex CLI 使用习惯。
- `@` 容易让人联想到提及用户、Agent 或上下文对象。
- 指令名应该像用户动作，而不是实现细节。

影响：

- 文档和交互提示统一使用 `$` 指令。
- MVP 只实现单会话流程所需指令。

## D004 自主模式使用 `auto`、`assist`、`manual`

状态：`accepted`

日期：2026-05-01

决策：

- LouisGo 使用三种 AI 自主模式：
  - `auto`
  - `assist`
  - `manual`

原因：

- `auto` 和 `manual` 足够直观，保留不改。
- `assist` 比原先的中间模式命名更容易理解。
- 三档权限能覆盖主动推进、协助执行、只读观察三类常见工作状态。

影响：

- 面向用户的状态提示必须包含当前模式。
- 协议字段中的模式值只能使用 `auto`、`assist`、`manual`。

## D005 MVP 优先服务单 AI 会话

状态：`accepted`

日期：2026-05-01

决策：

- MVP 只支持单仓库、单主 AI 会话。
- 委派、多 Agent、worktree 自动合并、独立审查不进入 MVP。

原因：

- 当前核心问题是会话连续性、状态可信和验证新鲜度。
- 多 Agent 编排会显著增加复杂度。
- 先把单会话闭环跑通，才能判断委派是否真的必要。

影响：

- MVP 不实现 `delegate`、`merge`、`review`、`decide` 的实际命令。
- 架构只预留扩展点。

## D006 使用 Node.js + TypeScript 实现 CLI

状态：`accepted`

日期：2026-05-01

决策：

- LouisGo CLI 使用 Node.js + TypeScript 实现。
- Node.js 最低版本暂定为 20。

原因：

- 维护者更熟悉 JavaScript/TypeScript，而不熟悉 Python。
- TypeScript 类型系统适合约束协议字段。
- npm / npx 分发更符合开发者工具使用习惯。
- MVP 性能瓶颈不在语言运行时。

影响：

- 项目使用 TypeScript strict 配置。
- 通过 npm 发布，支持 `npx louisgo init`。

## D007 包名使用 `louisgo`

状态：`accepted`

日期：2026-05-01

决策：

- MVP 包名直接使用 `louisgo`。
- 预留未来迁移到 npm scope 的可能，例如 `@louisgo/cli`。

原因：

- `louisgo` 简短直接，适合作为 CLI 命令和 npm 包名。
- MVP 不需要一开始引入 npm scope。

影响：

- CLI 命令为 `louisgo`。
- 发布准备阶段需要检查 npm 包名可用性。

## D008 使用 Markdown + Front Matter 表达关键协议文件

状态：`accepted`

日期：2026-05-01

决策：

- 关键 Markdown 文件使用 YAML Front Matter 保存机器可读字段。
- 正文用于人类审阅。

原因：

- 纯 Markdown 太容易变成叙事，机器检查不稳定。
- 纯 JSON 不适合人类长期阅读和审阅交接。
- Front Matter 能兼顾机器字段和人类正文。

影响：

- `MISSION.md`、`HANDOFF.md`、`HANDOFF_DRAFT.md`、`QUICK_SAVE.md` 等文件使用 Front Matter。
- 协议层必须负责 Front Matter schema 校验。

## D009 ROADMAP 必须使用稳定任务 ID

状态：`accepted`

日期：2026-05-01

决策：

- `ROADMAP.md` 中的任务必须使用稳定 ID，例如 `T001`。

原因：

- 任务标题可能变化，不能作为可靠引用。
- `QUICK_SAVE.md`、`HANDOFF.md`、任务拆分和路线图都需要引用同一任务。

影响：

- AI 更新任务时必须保留 ID。
- 不允许复用旧 ID 表示新任务。

## D010 验证结果必须能判断新鲜度

状态：`accepted`

日期：2026-05-01

决策：

- `.louisgo/test-results.json` 必须包含 `git_head` 和 `diff_hash`。
- `$finish` 不能静默依赖过期验证结果。

原因：

- 旧测试结果是 AI 开发中常见的不可信状态来源。
- 只有测试结果和当前代码状态匹配，才能作为事实依据。

影响：

- `louisgo verify` 必须校验结果是否匹配当前 Git 状态。
- 验证缺失或过期时，交接草稿必须如实记录。

## D011 `diff_hash` 使用 Git 状态、diff 和未跟踪文件内容计算

状态：`accepted`

日期：2026-05-01

决策：

- `diff_hash` 使用 Git 状态、`HEAD` diff、未跟踪文件路径和未跟踪文件内容 hash 组合后计算 SHA-256。
- MVP 不优化大文件和二进制文件性能。

原因：

- 只看 `git diff` 会漏掉未跟踪文件。
- 只看文件时间戳不稳定。
- MVP 更需要正确感知状态变化，而不是极致性能。

影响：

- 工作区状态变化应导致 `diff_hash` 变化。
- 大文件性能问题延期到 MVP 后处理。

## D012 `louisgo init` 必须在 Git 仓库内运行

状态：`accepted`

日期：2026-05-01

决策：

- `louisgo init` 要求当前目录已经是 Git 仓库。
- 如果不是 Git 仓库，提示用户先执行 `git init`。

原因：

- LouisGo 的验证新鲜度依赖 Git HEAD 和工作区状态。
- 没有 Git 时协议事实基础不足。

影响：

- T009 必须测试非 Git 仓库失败场景。
- 初始化文档需要提醒先执行 `git init`。

## D013 Windows 先保证基础可用，主要调优 macOS

状态：`accepted`

日期：2026-05-01

决策：

- MVP 从第一版开始保证 Windows 基础可用。
- macOS 是主要体验调优平台。
- Windows 优先 PowerShell，不专门优化 cmd.exe 或 Git Bash。

原因：

- 跨平台基础可用有利于工具长期传播。
- 过早追求 Windows 完整体验会拖慢 MVP。
- 当前主要开发环境是 macOS。

影响：

- `louisgo init` 同时生成 `verify.sh` 和 `verify.ps1`。
- `louisgo verify` 根据平台选择默认验证脚本。

## D014 `pause` 和 `finish` 不接收正文参数

状态：`accepted`

日期：2026-05-01

决策：

- MVP 阶段，`louisgo pause` 和 `louisgo finish` 不允许通过参数传入正文内容。
- CLI 只生成结构稳定的模板，正文由 AI 补齐。

原因：

- 当前 CLI 负责事实和结构，不负责理解任务语义。
- 过早支持正文参数会增加命令复杂度和转义问题。

影响：

- T018 和 T020 不实现正文参数。
- AI 在命令生成模板后补充自然语言正文。

## D015 `HANDOFF.md` 不强制验证状态为 `passed`

状态：`accepted`

日期：2026-05-01

决策：

- `louisgo handoff promote` 不强制验证状态必须为 `passed`。
- 但必须如实保留 `failed`、`stale`、`missing` 等状态。

原因：

- 有些会话需要在失败或阻塞状态下正式交接。
- 强制通过会导致用户无法记录真实状态。
- 关键是不能伪造通过。

影响：

- `HANDOFF.md` 可以代表未完成或失败状态。
- 下次 `$start` 必须能识别并提示真实验证状态。

## D016 提供命令行脚手架，避免手动复制模板

状态：`accepted`

日期：2026-05-01

决策：

- MVP 提供 `louisgo init` 创建 `.louisgo/` 模板。
- 不要求用户手动复制模板文件。

原因：

- 手动复制容易漏文件、错路径、错格式。
- CLI 脚手架能保证初始协议一致。

影响：

- T009 是 MVP 的关键任务。
- README 必须以 `npx louisgo init` 作为主要入口。
