export function createRoadmapTemplate(): string {
  return `# Roadmap

## Active

- [ ] T001 完成第一次 AI 编程闭环

## Notes

- 只把真正需要跨会话追踪的任务写成 Txxx checkbox。
- 后续想法可以写普通 bullet，避免把路线图变成流水账。
`;
}
