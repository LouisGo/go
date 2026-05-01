# 技术选型

## 结论

LouisGo MVP 采用 **Node.js + TypeScript** 实现命令行工具。

核心理由：

- 项目需要长期演进协议、CLI、模板、schema 和文件操作，TypeScript 的类型系统能降低协议漂移风险。
- 维护者更熟悉 JavaScript/TypeScript 生态，不熟悉 Python；长期可维护性优先于单文件极简。
- LouisGo 面向开发者工具场景，npm / npx 分发路径更自然。
- MVP 的性能瓶颈主要在文件系统和 Git 命令，不在语言运行时。

## 选型原则

- 优先保证维护者能理解和持续修改。
- 优先保证协议字段和命令行为可被类型约束。
- 优先使用成熟、轻量、社区稳定的库。
- 避免过早引入重框架、守护进程或复杂构建链。
- 保持跨平台能力，至少覆盖 macOS、Linux，后续兼顾 Windows。

## 候选方案对比

| 维度 | Python | Node.js + TypeScript | 判断 |
| --- | --- | --- | --- |
| 维护成本 | 语法简洁，但维护者不熟悉。 | 维护者更容易理解和修改。 | Node.js + TypeScript 更合适 |
| 类型约束 | 需要额外工具和约定。 | TypeScript 原生支持类型建模。 | Node.js + TypeScript 更合适 |
| 文件处理 | 标准库能力强。 | Node 标准库足够，生态丰富。 | 两者都可行 |
| JSON / Schema | 标准库可处理 JSON，schema 需额外库。 | Zod 等库成熟，能和 TS 类型联动。 | Node.js + TypeScript 更合适 |
| Markdown Front Matter | 可通过依赖实现。 | `gray-matter` 等库成熟。 | 两者都可行 |
| Git 调用 | `subprocess` 成熟。 | `execa` 等库体验好。 | 两者都可行 |
| CLI 生态 | `argparse`、`typer`、`click` 等成熟。 | `commander`、`cac` 等成熟。 | 两者都可行 |
| 分发方式 | `pipx`、`uv tool` 可用，但用户认知略高。 | `npm`、`npx` 对开发者工具更自然。 | Node.js + TypeScript 更合适 |
| 性能表现 | 足够。 | 足够。 | 不是决定因素 |
| 功能上限 | 很高。 | 很高。 | 不是决定因素 |

最终选择 Node.js + TypeScript，主要基于维护者熟悉度、类型约束和 npm 分发生态。

## 运行时

MVP 使用 Node.js LTS。

建议最低版本：

```text
Node.js >= 20
```

原因：

- Node.js 20 已经是成熟 LTS 基线。
- 原生 `fs`、`path`、`child_process`、`crypto` 能覆盖大量基础能力。
- 支持现代 ESM 和较新的 JavaScript 语法。

是否支持更低版本 Node.js 暂不作为 MVP 目标。

## 语言

使用 TypeScript。

要求：

- 启用严格类型检查。
- 协议字段必须定义类型。
- CLI 命令入参和输出结构必须显式建模。
- 运行时代码不得依赖隐式 `any`。

建议配置方向：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## 推荐依赖

MVP 依赖应保持少量、明确、可替换。

| 能力 | 推荐库 | 用途 |
| --- | --- | --- |
| CLI 命令解析 | `commander` | 定义 `louisgo init`、`louisgo status` 等命令。 |
| Schema 校验 | `zod` | 校验 `test-results.json`、Front Matter 字段和配置结构。 |
| Markdown Front Matter | `gray-matter` | 读取和写入 Markdown 头部字段。 |
| 命令执行 | `execa` | 调用 Git 和项目验证脚本。 |
| 打包 | `tsup` | 将 TypeScript 打包为可发布 CLI。 |
| 测试 | `vitest` | 单元测试文件协议、命令行为和模板生成。 |

依赖原则：

- 不引入 Web 框架。
- 不引入数据库。
- 不引入后台进程管理框架。
- 不引入大型任务编排框架。
- 优先选择维护活跃、API 稳定、功能聚焦的库。

## 包管理器

MVP 推荐使用 `pnpm`。

原因：

- 安装速度快。
- lockfile 稳定。
- 适合后续 monorepo，但不强制一开始使用 monorepo。

如果后续发现目标用户更偏向 npm，也可以保持发布层面完全兼容 npm：

```text
npm install -g louisgo
npx louisgo init
```

## CLI 命令范围

MVP 的命令行工具负责底层文件操作和可验证行为。

对话中的 `$start`、`$pause`、`$resume`、`$finish` 是 AI 工作流指令；CLI 则提供可被 AI 或用户调用的具体命令。

建议 MVP CLI 命令：

```text
louisgo init
louisgo status
louisgo verify
louisgo pause
louisgo finish
louisgo handoff promote
```

### `louisgo init`

作用：

- 创建 `.louisgo/` 目录。
- 创建必需模板文件。
- 创建 `.louisgo/scripts/verify.sh`。
- 创建 `.louisgo/scripts/verify.ps1`。
- 不覆盖已有用户文件。

### `louisgo status`

作用：

- 检查 `.louisgo/` 文件是否完整。
- 显示当前模式、当前任务、验证状态和恢复来源。
- 报告缺失文件。

### `louisgo verify`

作用：

- 调用当前平台对应的验证脚本。
- 确认 `.louisgo/test-results.json` 是否生成。
- 检查验证结果是否匹配当前 Git 状态。

### `louisgo pause`

作用：

- 生成或更新 `.louisgo/QUICK_SAVE.md`。
- 写入当前模式、任务 ID、Git HEAD、diff hash 和下一步占位。

说明：

- MVP 阶段，具体“当前进度”和“下一步”仍主要由 AI 生成文本。
- CLI 负责写入稳定字段和模板。

### `louisgo finish`

作用：

- 生成 `.louisgo/HANDOFF_DRAFT.md`。
- 汇总 Git diff、验证状态、阻塞项和下一步占位。
- 不直接写入 `.louisgo/HANDOFF.md`。

说明：

- MVP 阶段，AI 可以在 CLI 生成的草稿模板基础上补充正文。

### `louisgo handoff promote`

作用：

- 基于 `.louisgo/HANDOFF_DRAFT.md` 生成 `.louisgo/HANDOFF.md`。
- 保留关键 Front Matter 字段。
- 不伪造验证通过状态。

## 分发方式

MVP 优先通过 npm 分发。

目标使用方式：

```text
npx louisgo init
```

或全局安装：

```text
npm install -g louisgo
louisgo init
```

后续可评估：

- Homebrew。
- 独立二进制。
- GitHub Release 附件。

这些不进入 MVP 强制范围。

## 项目结构建议

MVP 可以从单包结构开始：

```text
.
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── status.ts
│   │   ├── verify.ts
│   │   ├── pause.ts
│   │   ├── finish.ts
│   │   └── handoff-promote.ts
│   ├── protocol/
│   │   ├── schemas.ts
│   │   ├── paths.ts
│   │   ├── frontmatter.ts
│   │   └── diff-hash.ts
│   └── templates/
│       ├── mission.ts
│       ├── roadmap.ts
│       ├── capabilities.ts
│       └── verify-script.ts
├── tests/
└── docs/
```

原则：

- `commands/` 只处理 CLI 入口和用户输出。
- `protocol/` 处理 `.louisgo/` 文件协议、schema、路径和状态计算。
- `templates/` 保存脚手架模板。
- 测试优先覆盖 `protocol/`，再覆盖命令行为。

## 性能判断

LouisGo MVP 的主要操作是：

- 读取和写入少量 Markdown / JSON 文件。
- 调用 Git 命令。
- 调用项目验证脚本。
- 计算工作区 diff hash。

这些操作的瓶颈通常在文件系统、Git 和项目测试本身，不在 Node.js 运行时。

因此 MVP 不需要为性能选择 Go 或 Rust。等出现以下情况再重新评估：

- 需要扫描超大仓库。
- 需要长期驻留进程。
- 需要复杂并发调度。
- 需要发布无运行时依赖的单文件二进制。

## 功能上限

Node.js + TypeScript 足以支持后续能力：

- 多命令 CLI。
- `.louisgo/` 文件协议校验。
- Markdown Front Matter 读写。
- JSON schema 校验。
- Git worktree 管理。
- 任务委派状态管理。
- npm 分发。
- 与 Codex CLI 的工作流约定集成。

如果未来需要更高上限，可以采用渐进式扩展：

- 核心协议保持 TypeScript。
- 高性能 diff 或扫描逻辑独立成可选原生模块。
- CLI 保持 npm 分发。

## 暂不采用的方案

### Python

Python 能很好完成 MVP，尤其适合单文件脚本和零依赖原型。

暂不采用的原因：

- 维护者不熟悉 Python。
- 协议字段长期演进时，TypeScript 的类型系统更直接。
- npm / npx 更符合开发者工具的预期分发方式。

### Go

Go 适合构建单文件二进制 CLI。

暂不采用的原因：

- MVP 阶段文件协议仍在快速变化。
- 开发迭代成本高于 TypeScript。
- 目前没有足够性能压力要求 Go。

### Rust

Rust 适合高性能、强可靠性的底层工具。

暂不采用的原因：

- 学习和维护成本更高。
- MVP 主要风险在协议设计，不在运行时性能。

### Shell

Shell 适合极简原型。

暂不采用的原因：

- 结构化数据处理能力弱。
- 跨平台维护成本高。
- 难以稳定维护 Front Matter、JSON schema 和复杂命令行为。

## 已确认决策

- 使用 Node.js + TypeScript。
- Node.js 最低版本暂定为 20。
- 使用 npm / npx 作为 MVP 分发路径。
- 使用 `commander`、`zod`、`gray-matter`、`execa`、`tsup`、`vitest` 作为首选依赖。
- MVP 提供 `louisgo init` 命令，避免用户手动复制模板。
- MVP 不实现守护进程、数据库、Web 服务或多 Agent 编排。
- 包名直接使用 `louisgo`。
- 预留 npm 组织名空间，例如未来可迁移到 `@louisgo/cli`，但 MVP 先发布为 `louisgo`。
- MVP 从第一版开始保证 Windows 基础可用，但只针对 macOS 做主要体验调优。
- `diff_hash` 使用 Git 状态、`HEAD` diff、未跟踪文件路径和未跟踪文件内容 hash 组合后计算 SHA-256。
- Windows 环境提供 PowerShell 验证模板，建议路径为 `.louisgo/scripts/verify.ps1`；macOS 和 Linux 继续使用 `.louisgo/scripts/verify.sh`。
