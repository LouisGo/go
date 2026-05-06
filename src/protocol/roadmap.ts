export const roadmapErrorCodes = {
  duplicateTaskId: "DUPLICATE_TASK_ID",
  invalidTaskId: "INVALID_TASK_ID",
} as const;

export type RoadmapErrorCode = (typeof roadmapErrorCodes)[keyof typeof roadmapErrorCodes];

export interface RoadmapTask {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
  readonly line: number;
  readonly completionSignal: string | null;
}

export interface RoadmapParseResult {
  readonly tasks: readonly RoadmapTask[];
  readonly firstIncompleteTask: RoadmapTask | null;
}

export interface RoadmapIssue {
  readonly code: RoadmapErrorCode;
  readonly line: number;
  readonly taskId: string;
  readonly message: string;
}

export class RoadmapParseError extends Error {
  readonly issues: readonly RoadmapIssue[];

  constructor(issues: readonly RoadmapIssue[]) {
    super("ROADMAP.md 解析失败");
    this.name = "RoadmapParseError";
    this.issues = issues;
  }
}

const checkboxLinePattern = /^\s*-\s+\[(?<mark>[ xX])\](?:\s+(?<text>.*))?\s*$/;
const stableTaskIdPattern = /^T\d{3,}$/;

export function parseRoadmap(markdown: string): RoadmapParseResult {
  const tasks: RoadmapTask[] = [];
  const issues: RoadmapIssue[] = [];
  const seenTaskIds = new Map<string, number>();

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const match = checkboxLinePattern.exec(line);

    if (match?.groups === undefined) {
      continue;
    }

    const mark = match.groups.mark;
    const text = match.groups.text?.trim() ?? "";
    const [taskId, ...titleParts] = text.split(/\s+/);

    const fullTitle = titleParts.join(" ");
    const signalMatch = fullTitle.match(/#completion:\s*(.+)$/);
    const completionSignal = signalMatch !== null ? signalMatch[1]!.trim() : null;
    const cleanTitle =
      completionSignal !== null ? fullTitle.replace(/#completion:\s*.+$/, "").trim() : fullTitle;

    if (mark === undefined) {
      continue;
    }

    if (taskId === undefined || taskId.length === 0 || !stableTaskIdPattern.test(taskId)) {
      const invalidTaskId = taskId ?? "";
      issues.push({
        code: roadmapErrorCodes.invalidTaskId,
        line: lineNumber,
        taskId: invalidTaskId,
        message: invalidTaskId.length === 0 ? "缺少任务 ID" : `非法任务 ID：${invalidTaskId}`,
      });
      continue;
    }

    const firstSeenLine = seenTaskIds.get(taskId);

    if (firstSeenLine !== undefined) {
      issues.push({
        code: roadmapErrorCodes.duplicateTaskId,
        line: lineNumber,
        taskId,
        message: `重复任务 ID：${taskId}，首次出现于第 ${firstSeenLine} 行`,
      });
      continue;
    }

    seenTaskIds.set(taskId, lineNumber);
    tasks.push({
      id: taskId,
      title: cleanTitle,
      completed: mark.toLowerCase() === "x",
      line: lineNumber,
      completionSignal,
    });
  }

  if (issues.length > 0) {
    throw new RoadmapParseError(issues);
  }

  return {
    tasks,
    firstIncompleteTask: findFirstIncompleteTask(tasks),
  };
}

export function findFirstIncompleteTask(tasks: readonly RoadmapTask[]): RoadmapTask | null {
  return tasks.find((task) => !task.completed) ?? null;
}
