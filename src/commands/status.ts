import type { Command } from "commander";
import type { Writable } from "node:stream";

import { formatStatusReport } from "../output/reporter.js";
import { appendRunLogEvent } from "../services/run-log-service.js";
import { checkProtocolStatus, type StatusServiceOptions } from "../services/status-service.js";

export interface RegisterStatusCommandOptions extends StatusServiceOptions {
  readonly stdout?: Writable;
}

export function registerStatusCommand(
  program: Command,
  options: RegisterStatusCommandOptions = {},
): void {
  program
    .command("status")
    .description("Show LouisGo protocol status")
    .action(async () => {
      const status = await checkProtocolStatus(options);
      (options.stdout ?? process.stdout).write(formatStatusReport(status));
      await appendRunLogEvent({
        cwd: status.workspaceRoot,
        command: "status",
        outcome: status.complete ? "success" : "failure",
        note: `issues=${status.issues.length}`,
      }).catch(() => undefined);
    });
}
