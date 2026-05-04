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
        completionSignal: null,
      },
      {
        id: "T002",
        title: "配置质量检查",
        completed: false,
        line: 4,
        completionSignal: null,
      },
      {
        id: "T003",
        title: "定义协议路径",
        completed: false,
        line: 5,
        completionSignal: null,
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

  it("检测缺少稳定任务 ID 的 checkbox 任务行", () => {
    expect(() => parseRoadmap("- [ ] 实现模板生成\n")).toThrowError(RoadmapParseError);

    try {
      parseRoadmap("- [ ] 实现模板生成\n");
    } catch (error) {
      expect(error).toBeInstanceOf(RoadmapParseError);
      expect((error as RoadmapParseError).issues).toEqual([
        {
          code: roadmapErrorCodes.invalidTaskId,
          line: 1,
          taskId: "实现模板生成",
          message: "非法任务 ID：实现模板生成",
        },
      ]);
    }
  });

  it("检测空 checkbox 任务行", () => {
    expect(() => parseRoadmap("- [ ]\n")).toThrowError(RoadmapParseError);

    try {
      parseRoadmap("- [ ]\n");
    } catch (error) {
      expect(error).toBeInstanceOf(RoadmapParseError);
      expect((error as RoadmapParseError).issues).toEqual([
        {
          code: roadmapErrorCodes.invalidTaskId,
          line: 1,
          taskId: "",
          message: "缺少任务 ID",
        },
      ]);
    }
  });

  it("从任务行提取完成信号", () => {
    const result = parseRoadmap(
      `- [ ] T001 实现登录 #completion: 所有登录测试通过且构建成功\n`,
    );
    expect(result.tasks).toEqual([
      {
        id: "T001",
        title: "实现登录",
        completed: false,
        line: 1,
        completionSignal: "所有登录测试通过且构建成功",
      },
    ]);
  });

  it("无完成信号时 completionSignal 为 null", () => {
    const result = parseRoadmap(`- [ ] T001 实现登录\n`);
    expect(result.tasks[0]?.completionSignal).toBeNull();
  });

  it("完成信号保留任务标题干净", () => {
    const result = parseRoadmap(
      `- [x] T001 修复 Bug #completion: 单元测试通过\n`,
    );
    expect(result.tasks[0]?.title).toBe("修复 Bug");
    expect(result.tasks[0]?.completionSignal).toBe("单元测试通过");
    expect(result.tasks[0]?.completed).toBe(true);
  });
});
