# MVP 任务拆分

## 拆分原则

任务拆分必须符合以下原则：

- 先搭建项目基础，再实现协议核心。
- 先能安全读写 `.louisgo/`，再实现命令。
- 先实现 `init` 和 `status`，再实现会改变工作流状态的命令。
- 先实现 Git 状态和 `diff_hash`，再实现验证新鲜度判断。
- 先实现验证，再实现 `finish` 和 `handoff promote`。
- 每个任务必须有明确产出和完成标准。
- 每个任务都使用稳定任务 ID。

## 阶段划分

MVP 分为 6 个阶段：

| 阶段 | 目标 | 依赖 |
| --- | --- | --- |
| P0 | 项目基础和工程骨架 | 无 |
| P1 | 协议模型和文件读写能力 | P0 |
| P2 | 脚手架和状态检查 | P1 |
| P3 | Git 状态、diff hash 和验证能力 | P1 |
| P4 | 会话工作流命令 | P2、P3 |
| P5 | 测试、文档和发布准备 | P4 |

## P0 项目基础

### T001 初始化 Node.js + TypeScript 项目

依赖：无

目标：

- 建立 LouisGo CLI 的基础工程结构。

产出：

- `package.json`
- `tsconfig.json`
- `tsup.config.ts`
- `src/cli.ts`
- `tests/` 目录
- 基础 npm scripts

完成标准：

- 能执行 TypeScript 类型检查。
- 能执行测试命令，即使暂时只有占位测试。
- 能通过本地命令启动 CLI 入口。

测试要求：

- 至少有一个 CLI smoke test 或基础模块测试。

### T002 配置代码质量基础

依赖：T001

目标：

- 建立最小但可靠的工程质量检查。

产出：

- TypeScript strict 配置生效。
- Vitest 配置生效。
- 格式化或 lint 策略明确。

完成标准：

- `pnpm test` 可运行。
- `pnpm typecheck` 可运行。
- 后续任务可以稳定依赖这些命令。

测试要求：

- 验证测试框架能发现失败用例。

## P1 协议模型和文件读写能力

### T003 定义协议常量和路径解析

依赖：T001

目标：

- 集中定义 `.louisgo/` 路径和协议文件名，避免路径散落。

产出：

- `src/protocol/paths.ts`
- `src/fs/workspace.ts`

完成标准：

- 能定位当前 Git 仓库根目录。
- 能生成所有 MVP 协议文件的绝对路径。
- 不在非 Git 仓库中静默工作。

测试要求：

- Git 仓库内路径解析正确。
- 非 Git 仓库返回明确错误。

### T004 定义协议 schema

依赖：T001

目标：

- 用 TypeScript 和 Zod 定义核心协议结构。

产出：

- `src/protocol/schemas.ts`
- `LouisGoMode`
- `VerificationStatus`
- `TestResults`
- `HandoffFrontMatter`
- `QuickSaveFrontMatter`
- `MissionFrontMatter`
- `CapabilitiesFrontMatter`

完成标准：

- 能校验合法对象。
- 能拒绝缺失关键字段或非法枚举值。
- 文件字段使用 snake_case，内部对象可以使用 camelCase。

测试要求：

- 覆盖合法 schema。
- 覆盖非法模式、非法验证状态、缺失字段。

### T005 实现 Markdown Front Matter 读写

依赖：T004

目标：

- 提供统一的 Markdown + Front Matter 读写能力。

产出：

- `src/protocol/frontmatter.ts`

完成标准：

- 能读取 Markdown 的 Front Matter 和正文。
- 能写入 Front Matter 和正文。
- 能在 schema 校验失败时返回文件路径和字段信息。

测试要求：

- 正常读写。
- 空文件处理。
- 缺失 Front Matter。
- schema 不匹配。

### T006 实现安全写入

依赖：T003

目标：

- 避免命令误覆盖用户已有文件。

产出：

- `src/fs/safe-write.ts`

完成标准：

- 默认只创建不存在的文件。
- 文件存在时返回 skipped 状态。
- 支持后续扩展 `force`，但 MVP 不暴露覆盖行为。

测试要求：

- 新文件可写入。
- 已存在文件不会被覆盖。
- 写入失败能返回明确错误。

### T007 实现 ROADMAP 解析

依赖：T004

目标：

- 读取 `ROADMAP.md` 中的稳定任务 ID 和完成状态。

产出：

- `src/protocol/roadmap.ts`

完成标准：

- 能解析 `- [ ] T001 任务标题`。
- 能解析 `- [x] T002 任务标题`。
- 能找到第一个未完成任务。
- 能检测重复任务 ID。

测试要求：

- 正常任务列表。
- 空路线图。
- 重复 ID。
- 非法 ID。

## P2 脚手架和状态检查

### T008 实现模板生成

依赖：T004、T005、T006

目标：

- 提供 `.louisgo/` 初始文件模板。

产出：

- `src/templates/mission.ts`
- `src/templates/roadmap.ts`
- `src/templates/blocker.ts`
- `src/templates/capabilities.ts`
- `src/templates/verify-sh.ts`
- `src/templates/verify-ps1.ts`

完成标准：

- 模板内容符合协议文档。
- 文档和代码注释使用简体中文。
- `verify.sh` 和 `verify.ps1` 都能生成 `test-results.json` 的最小结构。

测试要求：

- 模板包含必要 Front Matter。
- 验证脚本模板包含 `schema`、`git_head`、`diff_hash`、`status` 等字段。

### T009 实现 `louisgo init`

依赖：T003、T006、T008

目标：

- 在已初始化 Git 的仓库中创建 `.louisgo/` 协议目录。

产出：

- `src/commands/init.ts`
- `src/services/init-service.ts`

完成标准：

- 当前目录不是 Git 仓库时失败并提示先执行 `git init`。
- 创建 `.louisgo/` 和 `.louisgo/scripts/`。
- 创建 MVP 必需文件。
- 不覆盖已有文件。
- 输出下一步建议。

测试要求：

- Git 仓库中首次 init 成功。
- 重复 init 不覆盖用户文件。
- 非 Git 仓库中 init 失败。

### T010 实现协议完整性检查

依赖：T003、T004、T005、T007

目标：

- 检查 `.louisgo/` 文件是否完整、格式是否基本正确。

产出：

- `src/services/status-service.ts` 的协议检查部分。

完成标准：

- 能报告缺失文件。
- 能读取当前模式。
- 能读取当前任务。
- 能识别 `QUICK_SAVE.md` 和 `HANDOFF.md` 的恢复优先级。

测试要求：

- 完整协议目录。
- 缺失文件。
- Front Matter 错误。
- QUICK_SAVE 比 HANDOFF 更新。

### T011 实现 `louisgo status`

依赖：T010

目标：

- 向用户和 AI 输出当前 LouisGo 状态。

产出：

- `src/commands/status.ts`
- `src/output/reporter.ts`

完成标准：

- 输出当前模式。
- 输出当前任务 ID。
- 输出协议完整性。
- 输出恢复来源。
- 输出验证状态占位。

测试要求：

- 状态正常时输出简洁摘要。
- 缺失文件时输出可执行下一步。

## P3 Git 状态、diff hash 和验证能力

### T012 实现 Git 基础能力

依赖：T003

目标：

- 封装 Git 命令调用。

产出：

- `src/git/git.ts`
- `src/git/status.ts`

完成标准：

- 能读取 Git 根目录。
- 能读取当前 HEAD。
- 没有提交时返回 `NO_HEAD`。
- 能读取 porcelain status。

测试要求：

- 有提交仓库。
- 无提交仓库。
- 非 Git 仓库。

### T013 实现 `diff_hash`

依赖：T012

目标：

- 计算当前工作区状态指纹，用于判断验证结果是否过期。

产出：

- `src/git/diff-hash.ts`

完成标准：

- 已跟踪文件变更会改变 hash。
- 暂存区变更会改变 hash。
- 未跟踪文件新增、删除或内容变化会改变 hash。
- 没有 HEAD 的仓库也能生成稳定 hash。
- MVP 不优化大文件和二进制文件性能。

测试要求：

- 干净工作区。
- 修改已跟踪文件。
- 新增未跟踪文件。
- 修改未跟踪文件内容。
- 无首个提交。

### T014 实现验证结果读写和新鲜度判断

依赖：T004、T012、T013

目标：

- 校验 `.louisgo/test-results.json`，判断是否匹配当前 Git 状态。

产出：

- `src/protocol/test-results.ts`
- `src/verify/freshness.ts`

完成标准：

- 能读取合法 `test-results.json`。
- 能拒绝非法 schema。
- 能判断 `passed`、`failed`、`error`、`skipped`。
- 能判断 `missing` 和 `stale`。

测试要求：

- 当前状态匹配时 fresh。
- Git HEAD 不匹配时 stale。
- diff hash 不匹配时 stale。
- 文件缺失时 missing。

### T015 实现验证脚本运行器

依赖：T014

目标：

- 按平台运行项目验证脚本。

产出：

- `src/verify/runner.ts`

完成标准：

- macOS / Linux 默认运行 `.louisgo/scripts/verify.sh`。
- Windows 默认运行 `.louisgo/scripts/verify.ps1`。
- 能捕获退出码。
- 验证脚本运行后必须检查 `test-results.json`。

测试要求：

- 模拟 macOS / Linux 脚本选择。
- 模拟 Windows 脚本选择。
- 脚本缺失时报错。
- 脚本未生成结果时报错。

### T016 实现 `louisgo verify`

依赖：T015

目标：

- 提供用户可直接运行的验证命令。

产出：

- `src/commands/verify.ts`
- `src/services/verify-service.ts`

完成标准：

- 调用平台默认验证脚本。
- 输出验证状态。
- 输出验证结果是否新鲜。
- 非通过状态时返回非零退出码。

测试要求：

- 验证通过。
- 验证失败。
- 验证结果过期。
- 验证脚本缺失。

## P4 会话工作流命令

### T017 实现 QUICK_SAVE 协议读写

依赖：T005、T007、T013

目标：

- 支持 `$pause` 对应的文件状态。

产出：

- `src/protocol/quick-save.ts`

完成标准：

- 能生成 `QUICK_SAVE.md` Front Matter。
- 能记录 `mode`、`task_id`、`git_head`、`diff_hash`、`saved_at`。
- 正文只生成占位，不通过参数传入。

测试要求：

- 生成合法 Quick Save。
- 缺少任务时仍能生成明确占位。

### T018 实现 `louisgo pause`

依赖：T017

目标：

- 生成轻量暂停状态文件。

产出：

- `src/commands/pause.ts`
- `src/services/pause-service.ts`

完成标准：

- 写入 `.louisgo/QUICK_SAVE.md`。
- 不清理 `BLOCKER.md`。
- 不修改 `HANDOFF.md`。
- 不支持正文参数。

测试要求：

- 正常生成 Quick Save。
- 已存在 Quick Save 时按安全策略处理。
- 缺少协议文件时提示先 `louisgo init`。

### T019 实现 HANDOFF_DRAFT 生成

依赖：T005、T007、T014

目标：

- 支持 `$finish` 对应的交接草稿。

产出：

- `src/protocol/handoff.ts`
- `src/services/finish-service.ts` 的草稿生成部分。

完成标准：

- 能生成 `HANDOFF_DRAFT.md`。
- 写入当前模式、任务 ID、Git HEAD、diff hash、验证状态。
- 包含 Git diff 摘要。
- 包含 `BLOCKER.md` 摘要。
- 包含下一步占位。
- 不要求验证状态必须为 `passed`。

测试要求：

- 验证通过草稿。
- 验证失败草稿。
- 验证过期草稿。
- 存在 blocker。

### T020 实现 `louisgo finish`

依赖：T019

目标：

- 提供正式收尾命令，生成交接草稿。

产出：

- `src/commands/finish.ts`
- `src/services/finish-service.ts`

完成标准：

- 生成 `HANDOFF_DRAFT.md`。
- 不写入 `HANDOFF.md`。
- 如果存在 `QUICK_SAVE.md`，确认状态已进入草稿后清理。
- 不支持正文参数。
- 输出下一步建议：review 草稿并执行 `louisgo handoff promote`。

测试要求：

- 正常生成草稿。
- Quick Save 被正确处理。
- 验证缺失时草稿标记 `missing`。

### T021 实现 `louisgo handoff promote`

依赖：T019

目标：

- 将用户认可的草稿提升为正式恢复点。

产出：

- `src/commands/handoff-promote.ts`
- `src/services/handoff-service.ts`

完成标准：

- 读取 `HANDOFF_DRAFT.md`。
- 校验 Front Matter。
- 生成 `HANDOFF.md`。
- 保留真实验证状态。
- 不要求验证状态为 `passed`。

测试要求：

- 草稿合法时提升成功。
- 草稿缺失时报错。
- 草稿 schema 非法时报错。
- `failed` 或 `stale` 状态能被如实保留。

## P5 测试、文档和发布准备

### T022 完善端到端测试

依赖：T009、T011、T016、T018、T020、T021

目标：

- 验证 MVP 命令可以串成完整工作流。

产出：

- CLI 端到端测试。

完成标准：

- 在临时 Git 仓库中执行完整流程：
  1. `louisgo init`
  2. `louisgo status`
  3. `louisgo verify`
  4. `louisgo pause`
  5. `louisgo finish`
  6. `louisgo handoff promote`

测试要求：

- macOS / Linux 主路径通过。
- Windows 脚本选择有覆盖测试。

### T023 完善 README 和使用说明

依赖：T022

目标：

- 让用户知道如何安装和使用 LouisGo MVP。

产出：

- `README.md`
- CLI 使用示例
- `.louisgo/` 文件说明链接

完成标准：

- 说明 `npx louisgo init`。
- 说明 `$start`、`$pause`、`$resume`、`$finish` 和 CLI 命令的关系。
- 说明 MVP 限制。

测试要求：

- 文档命令和实际 CLI 命令一致。

### T024 发布准备

依赖：T022、T023

目标：

- 准备 npm 发布所需配置。

产出：

- `package.json` bin 配置。
- npm package metadata。
- 构建产物检查。

完成标准：

- `pnpm build` 生成可执行 CLI。
- 本地 `npm pack` 内容正确。
- `npx` 使用路径明确。

测试要求：

- 本地打包后能执行 `louisgo --help`。

## 依赖图

```text
T001
 └─ T002

T001
 ├─ T003
 │   ├─ T006
 │   └─ T012
 │       └─ T013
 └─ T004
     ├─ T005
     ├─ T007
     └─ T014

T004 + T005 + T006
 └─ T008
     └─ T009

T003 + T004 + T005 + T007
 └─ T010
     └─ T011

T014
 └─ T015
     └─ T016

T005 + T007 + T013
 └─ T017
     └─ T018

T005 + T007 + T014
 └─ T019
     ├─ T020
     └─ T021

T009 + T011 + T016 + T018 + T020 + T021
 └─ T022
     ├─ T023
     └─ T024
```

## MVP 最小可交付切片

如果需要进一步压缩第一版，可以按以下顺序交付：

1. T001-T011：能初始化 `.louisgo/` 并查看状态。
2. T012-T016：能运行验证并判断结果是否新鲜。
3. T017-T021：能暂停、收尾和提升 handoff。
4. T022-T024：补齐端到端测试、文档和发布准备。

第一切片完成后，LouisGo 已经能解决“协议落地和状态可见”问题。第二切片完成后，开始具备“验证事实可信”能力。第三切片完成后，才形成完整 AI 会话闭环。
