import { describe, expect, it } from "vitest";

import { RoadmapParseError, parseRoadmap, roadmapErrorCodes } from "../src/protocol/roadmap.js";

describe("ROADMAP 解析", () => {
  it("可以解析正常任务列表并找到第一个未完成任务", () => {
    const result = parseRoadmap(`# Roadmap

- [x] T001 初始化项目
- [ ] T002 配置质量检查
- [ ] T003 定义协议路径
`);

    expect(result.tasks).toEqual([
      {
        id: "T001",
        title: "初始化项目",
        completed: true,
        line: 3,
      },
      {
        id: "T002",
        title: "配置质量检查",
        completed: false,
        line: 4,
      },
      {
        id: "T003",
        title: "定义协议路径",
        completed: false,
        line: 5,
      },
    ]);
    expect(result.firstIncompleteTask?.id).toBe("T002");
  });

  it("空路线图返回空任务列表", () => {
    expect(parseRoadmap("# Roadmap\n")).toEqual({
      tasks: [],
      firstIncompleteTask: null,
    });
  });

  it("检测重复任务 ID", () => {
    expect(() =>
      parseRoadmap(`- [ ] T001 第一项
- [x] T001 第二项
`),
    ).toThrowError(RoadmapParseError);

    try {
      parseRoadmap(`- [ ] T001 第一项
- [x] T001 第二项
`);
    } catch (error) {
      expect(error).toBeInstanceOf(RoadmapParseError);
      expect((error as RoadmapParseError).issues).toEqual([
        {
          code: roadmapErrorCodes.duplicateTaskId,
          line: 2,
          taskId: "T001",
          message: "重复任务 ID：T001，首次出现于第 1 行",
        },
      ]);
    }
  });

  it("检测非法任务 ID", () => {
    expect(() => parseRoadmap("- [ ] TASK-1 非法 ID\n")).toThrowError(RoadmapParseError);

    try {
      parseRoadmap("- [ ] TASK-1 非法 ID\n");
    } catch (error) {
      expect(error).toBeInstanceOf(RoadmapParseError);
      expect((error as RoadmapParseError).issues).toEqual([
        {
          code: roadmapErrorCodes.invalidTaskId,
          line: 1,
          taskId: "TASK-1",
          message: "非法任务 ID：TASK-1",
        },
      ]);
    }
  });
});
