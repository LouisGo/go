# 整体架构设计草案

## 目标

本文描述 LouisGo MVP 的整体架构设计。

LouisGo 的本质不是测试框架，也不是 AI Agent 平台，而是一个 **仓库内 AI 编程工作流协议 + 命令行工具**。

MVP 架构目标：

- 让 `.louisgo/` 文件协议可被稳定创建、读取、校验和更新。
- 为 Codex CLI 提供可靠的底层命令能力。
- 保持技术栈无关，不绑定任何项目语言或测试框架。
- 以最少模块支撑 `$start`、`$pause`、`$resume`、`$finish` 对应的工作流。
- 后续可以扩展到委派、worktree、多 Agent 审查，但 MVP 不实现。

## 架构总览

LouisGo MVP 分为以下职责层：

```text
用户 / AI 对话层
        │
        ▼
CLI 命令层
        │
        ▼
应用服务层
        │
        ├── 协议层
        ├── Git 状态层
        ├── 验证层
        ├── 模板层
        └── 文件系统层
```

各层职责：

| 层级 | 职责 | 典型模块 |
| --- | --- | --- |
| 用户 / AI 对话层 | 用户通过自然语言或 `$` 指令驱动 AI，AI 再调用 CLI。 | Codex CLI 会话 |
| CLI 命令层 | 解析命令、参数、输出面向用户的结果。 | `src/cli.ts`、`src/commands/*` |
| 应用服务层 | 编排命令流程，不直接处理底层细节。 | `src/services/*` |
| 协议层 | 读写和校验 `.louisgo/` 文件协议。 | `src/protocol/*` |
| Git 状态层 | 获取 Git HEAD、状态、diff、diff hash。 | `src/git/*` |
| 验证层 | 调用项目验证脚本并检查结果新鲜度。 | `src/verify/*` |
| 模板层 | 生成 `.louisgo/` 初始文件和草稿。 | `src/templates/*` |
| 文件系统层 | 封装路径、读写、存在性检查。 | `src/fs/*` |

## 核心原则

### CLI 不理解业务代码

LouisGo 不解析用户项目的业务代码，也不理解具体技术栈。

它只关心：

- `.louisgo/` 协议文件是否完整。
- Git 状态是否可读取。
- 验证脚本是否可执行。
- 验证结果是否匹配当前代码状态。

项目怎么测试、怎么构建、怎么 lint，由 `.louisgo/scripts/verify.*` 决定。

### AI 负责任务语义，CLI 负责事实

AI 可以负责：

- 理解用户意图。
- 填写交接正文。
- 总结当前进度。
- 给出下一步建议。

CLI 负责：

- 创建模板文件。
- 计算 Git HEAD。
- 计算 diff hash。
- 调用验证脚本。
- 校验 `test-results.json`。
- 生成结构稳定的草稿文件。

生产者与审查者分离：

- 生成代码的 AI 可以触发验证。
- CLI 可以提供验证事实。
- 代码生产者不能用自己的叙事或判断代替验证、独立审查或用户确认。

### 协议层优先稳定

只要 `.louisgo/` 文件协议稳定，后续 CLI 实现可以替换。

因此协议层应避免依赖 CLI 表现形式，例如输出文案、颜色、交互提示等。

### 命令默认不覆盖用户内容

脚手架和生成命令必须遵循安全写入原则：

- 文件不存在时创建。
- 文件存在时默认不覆盖。
- 需要覆盖时必须显式传入参数，例如未来的 `--force`。

## 推荐项目结构

```text
.
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── status.ts
│   │   ├── verify.ts
│   │   ├── pause.ts
│   │   ├── finish.ts
│   │   └── handoff-promote.ts
│   ├── services/
│   │   ├── init-service.ts
│   │   ├── status-service.ts
│   │   ├── verify-service.ts
│   │   ├── pause-service.ts
│   │   ├── finish-service.ts
│   │   └── handoff-service.ts
│   ├── protocol/
│   │   ├── paths.ts
│   │   ├── schemas.ts
│   │   ├── frontmatter.ts
│   │   ├── roadmap.ts
│   │   ├── handoff.ts
│   │   ├── quick-save.ts
│   │   ├── confirm-req.ts
│   │   ├── adr.ts
│   │   └── test-results.ts
│   ├── git/
│   │   ├── git.ts
│   │   ├── diff-hash.ts
│   │   └── status.ts
│   ├── verify/
│   │   ├── runner.ts
│   │   └── freshness.ts
│   ├── templates/
│   │   ├── mission.ts
│   │   ├── roadmap.ts
│   │   ├── blocker.ts
│   │   ├── capabilities.ts
│   │   ├── confirm-req.ts
│   │   ├── adr-draft.ts
│   │   ├── verify-sh.ts
│   │   └── verify-ps1.ts
│   ├── fs/
│   │   ├── workspace.ts
│   │   └── safe-write.ts
│   └── output/
│       └── reporter.ts
├── tests/
└── docs/
```

说明：

- `commands/` 只负责 CLI 参数和输出，不放核心业务逻辑。
- `services/` 编排流程，是命令的主要用例层。
- `protocol/` 是最重要的稳定层，集中管理 `.louisgo/` 结构。
- `git/` 只封装 Git 相关操作。
- `verify/` 只负责运行验证和判断验证结果是否新鲜。
- `templates/` 只负责生成初始文本和脚本模板。
- `fs/` 统一处理路径、工作区定位和安全写入。
- `output/` 统一管理终端输出，避免业务逻辑散落 `console.log`。

## 命令架构

MVP CLI 命令：

```text
louisgo init
louisgo status
louisgo verify
louisgo pause
louisgo finish
louisgo handoff promote
```

命令和服务映射：

| 命令 | 服务 | 主要输出 |
| --- | --- | --- |
| `louisgo init` | `InitService` | `.louisgo/` 模板文件 |
| `louisgo status` | `StatusService` | 当前协议完整性、模式、任务、验证状态 |
| `louisgo verify` | `VerifyService` | 执行验证脚本，并检查 `test-results.json` |
| `louisgo pause` | `PauseService` | `.louisgo/QUICK_SAVE.md` |
| `louisgo finish` | `FinishService` | `.louisgo/HANDOFF_DRAFT.md` |
| `louisgo handoff promote` | `HandoffService` | `.louisgo/HANDOFF.md` |

## 关键流程

### `louisgo init`

流程：

1. 定位仓库根目录。
2. 检查是否在 Git 仓库中。
3. 创建 `.louisgo/` 和 `.louisgo/scripts/`。
4. 创建 `.louisgo/ADR/draft/`。
5. 创建必需模板文件。
6. 创建 `verify.sh` 和 `verify.ps1`。
7. 不覆盖已有文件。
8. 输出后续建议，例如运行 `louisgo status`。

失败策略：

- 找不到 Git 仓库时，提示用户先执行 `git init`。
- 文件已存在时跳过并报告。
- 权限不足时返回明确错误。

### `louisgo status`

流程：

1. 检查 `.louisgo/` 是否存在。
2. 检查必需文件是否存在。
3. 读取 `MISSION.md` 的默认模式。
4. 读取 `ROADMAP.md` 的第一个未完成任务。
5. 判断恢复来源：`QUICK_SAVE.md`、`HANDOFF.md` 或无恢复点。
6. 检查是否存在未解决 `CONFIRM_REQ.md`。
7. 检查是否存在 ADR 草稿。
8. 检查 `test-results.json` 是否存在。
9. 判断验证结果是否新鲜。
10. 输出结构化状态摘要。

状态输出应优先给 AI 和人类都容易读懂的结果，例如：

```text
[assist] 协议完整，当前任务 T001，验证状态 stale，恢复来源 QUICK_SAVE。
```

### `louisgo verify`

流程：

1. 根据当前平台选择验证脚本。
2. macOS / Linux 优先运行 `.louisgo/scripts/verify.sh`。
3. Windows 优先运行 `.louisgo/scripts/verify.ps1`。
4. 验证脚本必须写入 `.louisgo/test-results.json`。
5. CLI 读取并校验 `test-results.json`。
6. CLI 重新计算当前 Git HEAD 和 diff hash。
7. 输出验证是否通过以及结果是否新鲜。

说明：

- `louisgo verify` 不负责具体测试逻辑。
- 具体测试命令由用户项目在 `verify.sh` 或 `verify.ps1` 中定义。

### `louisgo pause`

流程：

1. 读取当前模式。
2. 读取当前任务 ID。
3. 计算 Git HEAD 和 diff hash。
4. 生成或更新 `QUICK_SAVE.md` 的 Front Matter。
5. 生成正文占位，供 AI 补充当前进度和下一步。

说明：

- MVP 阶段，CLI 可以生成稳定模板，AI 负责补齐语义正文。
- MVP 阶段不允许通过命令参数传入正文内容，避免 CLI 过早承担任务语义生成职责。

### `louisgo finish`

流程：

1. 获取 Git diff 摘要。
2. 读取 `test-results.json`。
3. 判断验证结果是否新鲜。
4. 读取 `BLOCKER.md`。
5. 读取 `CONFIRM_REQ.md`。
6. 读取 `QUICK_SAVE.md`。
7. 读取 ADR 草稿列表。
8. 生成 `HANDOFF_DRAFT.md`。
9. 不写入 `HANDOFF.md`。
10. 提示用户 review 后执行 `louisgo handoff promote`。

说明：

- 如果验证缺失、失败或过期，草稿必须明确写出。
- 如果存在未解决阻塞，草稿必须保留。
- 如果存在未解决确认请求，草稿必须转存为遗留问题。
- 如果存在 ADR 草稿，草稿必须提示用户确认或继续处理。

### `louisgo handoff promote`

流程：

1. 读取 `HANDOFF_DRAFT.md`。
2. 校验 Front Matter 字段。
3. 生成 `HANDOFF.md`。
4. 保留验证状态，不伪造通过结果。
5. 输出成功状态和下一步建议。

说明：

- 该命令不等同于审核本身。
- 用户执行该命令代表认可当前草稿可以成为正式恢复点。
- 该命令不强制验证状态必须为 `passed`，但必须如实保留 `failed`、`stale`、`missing` 等状态。

## 协议模型

MVP 至少需要以下 TypeScript 类型：

```ts
type LouisGoMode = 'auto' | 'assist' | 'manual';

type VerificationStatus = 'passed' | 'failed' | 'error' | 'skipped' | 'missing' | 'stale';

interface GitSnapshot {
  gitHead: string;
  diffHash: string;
}

interface TestResults {
  schema: 'louisgo-test-results-v1';
  command: string;
  exitCode: number;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  gitHead: string;
  diffHash: string;
  startedAt: string;
  completedAt: string;
  summary: string;
}

interface HandoffFrontMatter {
  schema: 'louisgo-handoff-v1';
  mode: LouisGoMode;
  taskId: string;
  gitHead: string;
  diffHash: string;
  verification: VerificationStatus;
  generatedAt?: string;
  confirmedAt?: string;
}

interface ConfirmReqFrontMatter {
  schema: 'louisgo-confirm-req-v1';
  mode: LouisGoMode;
  taskId: string;
  status: 'open';
  createdAt: string;
}

interface AdrFrontMatter {
  schema: 'louisgo-adr-v1';
  status: 'draft' | 'accepted' | 'superseded';
  adrId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}
```

实现时，文件字段可以使用 snake_case，TypeScript 内部对象可以使用 camelCase。协议层负责转换，避免业务层混用命名风格。

## `diff_hash` 设计

`diff_hash` 用于判断验证结果是否对应当前工作区。

MVP 推荐算法：

1. 读取当前 Git HEAD；如果仓库没有首个提交，使用固定值 `NO_HEAD`。
2. 获取 `git status --porcelain=v1 -z`。
3. 获取 `git diff --binary HEAD --`；如果没有 HEAD，则获取暂存区和工作区可用 diff。
4. 获取未跟踪文件列表。
5. 对未跟踪文件记录相对路径和文件内容 SHA-256。
6. 将以上内容按稳定顺序拼接。
7. 对拼接结果计算 SHA-256，得到 `diff_hash`。

设计目的：

- 覆盖已跟踪文件的暂存和未暂存变更。
- 覆盖未跟踪文件。
- 避免只看 `git diff` 时漏掉新文件。
- 在 macOS、Linux、Windows 上尽量保持一致。

MVP 可以先实现保守版本，只要满足“代码状态变化会导致 hash 变化”。后续再优化性能和边界情况。

## Windows 支持策略

MVP 从第一版开始保证 Windows 基础可用。

策略：

- CLI 本身使用 Node.js 跨平台能力。
- 路径处理统一使用 Node `path`，协议中展示路径统一为 POSIX 风格。
- `louisgo init` 同时生成：
  - `.louisgo/scripts/verify.sh`
  - `.louisgo/scripts/verify.ps1`
- `louisgo verify` 根据平台选择默认验证脚本。
- macOS 是主要调优平台，Windows 先确保能安装、初始化、读取协议、运行 PowerShell 验证模板。

不在 MVP 强制保证：

- Windows 上的 Git Bash 体验。
- cmd.exe 专用脚本。
- 所有终端颜色和交互细节完全一致。

## 错误处理

错误类型建议分层：

| 错误类型 | 示例 | 处理方式 |
| --- | --- | --- |
| 协议缺失 | 缺少 `.louisgo/MISSION.md` | `status` 报告缺失，`init` 可创建 |
| 协议格式错误 | Front Matter 缺少 `mode` | 报告字段和文件路径 |
| 未解决确认请求 | 存在 `.louisgo/CONFIRM_REQ.md` | `status` 和 `$start` 优先提示 |
| 未确认 ADR | `ADR/draft/` 中存在草稿 | `status` 和 `$finish` 提示 |
| Git 错误 | 不在 Git 仓库中 | 提示先 `git init` |
| 验证错误 | 验证脚本退出码非 0 | 写入或读取失败状态 |
| 验证过期 | `diff_hash` 不匹配 | 标记 `stale` |
| 文件写入冲突 | 目标文件已存在 | 默认跳过，不覆盖 |

终端输出原则：

- 简短。
- 明确下一步。
- 不隐藏验证失败。
- 不把技术栈细节堆给用户，除非用户需要排查。

## 测试策略

MVP 测试优先级：

1. 协议层单元测试。
2. `diff_hash` 单元测试。
3. 模板生成测试。
4. `test-results.json` schema 测试。
5. 命令服务集成测试。
6. 少量 CLI 端到端测试。

重点测试场景：

- 已初始化 Git 的空仓库执行 `louisgo init`。
- 已存在 `.louisgo/` 时不会覆盖文件。
- `louisgo init` 创建 `ADR/draft/`。
- `ROADMAP.md` 能识别第一个未完成任务。
- `status` 能识别未解决 `CONFIRM_REQ.md`。
- `status` 能识别 ADR 草稿。
- `test-results.json` 和当前 Git 状态匹配时为新鲜。
- 工作区变化后验证状态变为 `stale`。
- Windows 平台选择 `verify.ps1`。
- macOS / Linux 平台选择 `verify.sh`。

## 后续扩展点

MVP 不实现，但架构应预留：

- `louisgo delegate`：委派任务。
- `louisgo merge`：合并隔离工作区结果。
- `louisgo review`：独立审查。
- `louisgo decide`：生成决策请求的独立 CLI 命令；文件协议已进入 MVP。
- Git worktree 管理。
- 多 Agent 状态文件。
- CI 集成。

预留方式：

- 命令层新增命令，不破坏协议层。
- 协议层通过 schema version 演进。
- 委派状态使用新文件，不塞进 `ROADMAP.md`。

## 架构决策摘要

- 采用分层 CLI 架构，而不是单文件脚本。
- 协议层是核心稳定边界。
- CLI 不理解项目业务代码。
- `diff_hash` 由 Git 状态、diff 和未跟踪文件内容共同计算。
- 第一版支持 Windows 基础可用，但主要调优 macOS。
- `verify.sh` 和 `verify.ps1` 都由脚手架生成。
- `HANDOFF.md` 通过 `louisgo handoff promote` 从草稿生成。
- `louisgo pause` 和 `louisgo finish` 先不允许传入正文参数，只生成结构稳定的模板，由 AI 补齐语义内容。
- `louisgo init` 必须要求当前目录已经是 Git 仓库。
- `HANDOFF.md` 生成不强制验证状态为 `passed`，但必须如实记录失败、过期或缺失状态。
- `CONFIRM_REQ.md` 和 `ADR/draft/` 进入 MVP 协议，独立 CLI 命令后续再做。
- Windows 按最小成本支持，优先 PowerShell，不针对 cmd.exe 或 Git Bash 做专门优化。
- MVP 不考虑大文件和二进制文件的 `diff_hash` 性能优化。

## 设计自检

### 是否脱离初心

当前设计没有脱离初心。

LouisGo 的初心是轻量化 AI 编程 Harness，不是完整 Agent 平台。当前方案仍然围绕三个核心点展开：

- 通过 `.louisgo/` 文件协议沉淀上下文。
- 通过验证结果和 Git 状态提供事实依据。
- 通过 `auto`、`assist`、`manual` 控制 AI 自主程度。
- 通过 `CONFIRM_REQ.md` 和 ADR 草稿让关键决策可见、可交接。

需要警惕的是，CLI 命令已经从最初的文件约定扩展成产品化工具。如果后续继续增加委派、审查、多 Agent、CI 集成，就可能偏离 MVP。因此这些能力应保持为后续扩展，不进入第一版实现范围。

### 是否存在过度设计

当前存在轻微过度设计风险，但还在可控范围内。

风险点：

- 分层目录较完整，可能让第一版代码显得偏重。
- `diff_hash` 设计比普通文件时间戳复杂。
- 同时支持 `verify.sh` 和 `verify.ps1` 增加了模板和测试成本。
- `handoff promote` 比手动复制更严谨，但多了一个命令。

保留这些设计的原因：

- 分层是为了避免 CLI、协议、Git、模板逻辑混在一起，后续维护成本更低。
- `diff_hash` 是验证新鲜度的关键，不做会削弱 Harness 的可信性。
- Windows 基础支持是明确产品要求，但只按最小成本实现。
- `handoff promote` 能减少人工复制导致的格式错误。

控制过度设计的边界：

- MVP 不做委派。
- MVP 不做多 Agent。
- MVP 不做守护进程。
- MVP 不做数据库。
- MVP 不做复杂交互 UI。
- MVP 不优化大文件和二进制 diff 性能。

### 是否能解决真实 AI 开发问题

当前设计能解决一部分真实问题，尤其适合 AI 编程中的会话连续性和质量门禁问题。

能解决的问题：

- AI 会话重启后不知道该从哪里继续。
- AI 口头说测试通过，但没有可校验证据。
- 用户不知道 AI 当前是自动推进还是等确认。
- 临时中断后恢复成本高。
- 正式交接缺少固定格式，容易遗漏阻塞项和下一步。
- 不同项目之间缺少统一的 AI 协作范式。

暂时不能完全解决的问题：

- AI 生成代码质量本身仍依赖模型能力和项目测试质量。
- 没有测试的项目，验证可信度只能退化为最小检查。
- 多任务并行、委派失败恢复、独立审查还未进入 MVP。
- 用户仍需要 review `HANDOFF_DRAFT.md`，工具不能替代人的最终判断。

因此，MVP 的定位应保持清晰：它先解决“AI 开发过程的状态可信和恢复顺滑”，而不是一次性解决所有 AI 编程质量问题。
